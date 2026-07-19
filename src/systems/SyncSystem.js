import { api } from '../utils/api.js';
import { gameState } from '../state/gameState.js';
import { levelFromXp } from '../config/levels.js';

// Server sync system: gameplay deltas accumulate in `buffer` between
// flushes; the Worker validates each batch and returns authoritative
// stats which reconcile back into the scene's game state.
export default class SyncSystem {
  constructor(scene) {
    this.scene = scene;
    this.buffer = this.createEmptyBuffer();
    this.pendingFirstTimeEvents = {};
    this.syncInFlight = false;
    this.syncPending = false;
    this.lastFlushTime = Date.now();
    this.nextGrantAt = null; // server timestamp of the next hourly energy grant
    this.autoSaveTimer = null;
    this.pageHideHandler = null;
  }

  createEmptyBuffer() {
    return {
      chests_opened: 0,
      auto_pop_chests: 0,
      coins_earned: 0,
      gems_earned: 0,
      energy_collected: 0,
      mega_jackpots: 0,
      auto_pops_collected: 0,
      xp_earned: 0
    };
  }

  bufferHasDeltas() {
    const b = this.buffer;
    return b.chests_opened > 0 || b.coins_earned > 0 || b.gems_earned > 0 ||
      b.energy_collected > 0 || b.mega_jackpots > 0 || b.auto_pops_collected > 0 ||
      Object.keys(this.pendingFirstTimeEvents).length > 0;
  }

  async initialize() {
    try {
      const res = await api.auth();
      this.applyServerState(res, { initial: true });
      console.log('Authenticated with server, stats loaded');
    } catch (error) {
      console.error('Failed to authenticate with server:', error);
      console.log('Continuing with localStorage values as fallback');
      // Don't throw - game stays playable offline; sync retries later
    }
  }

  /**
   * Reconcile local state with the authoritative server response.
   * On initial load the server values are applied directly. Mid-play,
   * un-flushed deltas in the sync buffer are layered on top so the UI
   * never visibly "rolls back" rewards the player just earned.
   */
  applyServerState(res, { initial = false } = {}) {
    if (!res || !res.stats) {
      // Mock/offline response - keep local values
      if (initial) {
        this.scene.loadedSoundEnabled = true;
        this.scene.loadedHapticEnabled = true;
      }
      return;
    }

    const s = res.stats;
    const b = this.buffer;
    const paidChests = Math.max(b.chests_opened - b.auto_pop_chests, 0);

    const coins = (s.coins ?? 0) + b.coins_earned;
    const gems = (s.gems ?? 0) + b.gems_earned;
    const energy = Math.max((s.energy ?? 100) + b.energy_collected - paidChests, 0);
    const chests = (s.total_chests_opened ?? 0) + b.chests_opened;
    const xp = (s.xp ?? 0) + b.xp_earned;

    this.scene.coinsState.set(coins);
    this.scene.ticketsState.set(s.tickets ?? 0);
    this.scene.gemsState.set(gems);
    this.scene.batteryState.set(energy);
    this.scene.xpState.set(xp);
    this.scene.userLevelState.set(Math.max(s.user_level || 1, levelFromXp(xp)));
    this.scene.totalChestsOpenedState.set(chests);
    if (typeof s.sticker_packs === 'number') gameState.stickerPacks.set(s.sticker_packs);
    if (typeof s.auto_pops === 'number') gameState.autoPops.set(s.auto_pops);

    // First-time flags: server state + anything set locally since last flush
    this.scene.firstTimeEvents = {
      ...(s.first_time_events || this.scene.firstTimeEvents),
      ...this.pendingFirstTimeEvents
    };

    if (res.next_grant_at) {
      this.nextGrantAt = new Date(res.next_grant_at).getTime();
    }

    if (initial) {
      this.scene.loadedSoundEnabled = s.sound_enabled ?? true;
      this.scene.loadedHapticEnabled = s.haptic_enabled ?? true;
      if (res.granted_energy > 0) {
        this.scene.offlineEnergyGained = res.granted_energy;
      }
    } else {
      // Mid-play reconcile: refresh the visible pills
      if (this.scene.statusBar) {
        this.scene.statusBar.setResource('coins', coins, false);
        this.scene.statusBar.setResource('gems', gems, false);
        this.scene.statusBar.setResource('energy', energy, false);
        this.scene.statusBar.setLevel(s.user_level || 1);
      }
      this.scene.energy.updateEnergyTimerVisibility();
      if (res.granted_energy > 0) {
        this.scene.energy.showOfflineRegenNotification(res.granted_energy);
      }
      if (res.clamped) {
        console.warn('Server clamped last sync batch (values corrected)');
      }
    }
  }

  /**
   * Flush accumulated gameplay deltas to the Worker. The server validates
   * the batch (energy accounting, rate caps, reward envelopes), applies
   * hourly grants, and returns authoritative stats for reconciliation.
   */
  async flush() {
    if (this.syncInFlight) {
      this.syncPending = true;
      return;
    }

    const buffer = this.buffer;
    const firstTime = this.pendingFirstTimeEvents;
    this.buffer = this.createEmptyBuffer();
    this.pendingFirstTimeEvents = {};

    const payload = this.buildSyncPayload(buffer, firstTime);
    this.lastFlushTime = Date.now();
    this.syncInFlight = true;

    try {
      const res = await api.sync(payload);
      this.applyServerState(res);
    } catch (error) {
      console.error('Sync failed, re-queueing deltas:', error);
      this.mergeBufferBack(buffer, firstTime);
    } finally {
      this.syncInFlight = false;
      if (this.syncPending) {
        this.syncPending = false;
        this.flush();
      }
    }
  }

  buildSyncPayload(buffer, firstTime) {
    let soundEnabled;
    let hapticEnabled;
    if (this.scene.settingsModal) {
      soundEnabled = this.scene.settingsModal.soundEnabledState.get();
      hapticEnabled = this.scene.settingsModal.hapticEnabledState.get();
    }
    return {
      ...buffer,
      elapsed_ms: Math.max(Date.now() - this.lastFlushTime, 0),
      sound_enabled: soundEnabled,
      haptic_enabled: hapticEnabled,
      first_time_events: Object.keys(firstTime).length > 0 ? firstTime : undefined
    };
  }

  /** Re-queue deltas from a failed flush so nothing is lost. */
  mergeBufferBack(buffer, firstTime) {
    const b = this.buffer;
    for (const key of Object.keys(buffer)) {
      b[key] += buffer[key];
    }
    this.pendingFirstTimeEvents = { ...firstTime, ...this.pendingFirstTimeEvents };
  }

  startLoop() {
    // Flush deltas every 10 seconds (skip when idle — hourly-grant flushes
    // are triggered separately by the countdown timer)
    this.autoSaveTimer = this.scene.time.addEvent({
      delay: 10000,
      callback: () => {
        if (this.bufferHasDeltas()) this.flush();
      },
      loop: true
    });

    // Flush when the tab/app is hidden (sendBeacon survives close).
    // Scene shutdown/destroy beacons fire via destroy() (destroySystems).
    this.pageHideHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.flushBeacon();
      }
    };
    document.addEventListener('visibilitychange', this.pageHideHandler);
    window.addEventListener('pagehide', this.pageHideHandler);
  }

  /** Fire-and-forget flush for page-hide/shutdown moments. */
  flushBeacon() {
    if (!this.bufferHasDeltas()) return;
    const buffer = this.buffer;
    const firstTime = this.pendingFirstTimeEvents;
    this.buffer = this.createEmptyBuffer();
    this.pendingFirstTimeEvents = {};
    api.syncBeacon(this.buildSyncPayload(buffer, firstTime));
    this.lastFlushTime = Date.now();
  }

  destroy() {
    // Beacon out any un-flushed deltas (no-op if the buffer is empty)
    this.flushBeacon();
    if (this.autoSaveTimer) {
      this.autoSaveTimer.remove();
      this.autoSaveTimer = null;
    }
    if (this.pageHideHandler) {
      document.removeEventListener('visibilitychange', this.pageHideHandler);
      window.removeEventListener('pagehide', this.pageHideHandler);
      this.pageHideHandler = null;
    }
  }
}
