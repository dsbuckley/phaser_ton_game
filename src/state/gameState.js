import Phaser from 'phaser';

/**
 * Cross-scene game state.
 *
 * Wraps the SAME localStorage keys the game has always used (existing
 * players keep their balances), but lives outside any single scene so
 * every tab scene reads/writes one source of truth.
 *
 * Emits `change:<name>` (e.g. `change:coins`) on the shared emitter —
 * StatusBars in any scene subscribe to keep their pills current.
 *
 * The server is authoritative: these values are an optimistic cache
 * that MainScene reconciles from /api/auth and /api/sync responses.
 */

const events = new Phaser.Events.EventEmitter();

class Resource {
  constructor(name, storageKey, defaultValue) {
    this.name = name;
    this.storageKey = storageKey;
    this.defaultValue = defaultValue;
    this.currentValue = this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored !== null) return JSON.parse(stored);
    } catch (error) {
      console.warn(`[gameState] Failed to load "${this.storageKey}":`, error);
    }
    return this.defaultValue;
  }

  get() {
    return this.currentValue;
  }

  set(newValue) {
    this.currentValue = newValue;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(newValue));
    } catch (error) {
      console.warn(`[gameState] Failed to save "${this.storageKey}":`, error);
    }
    events.emit(`change:${this.name}`, newValue);
  }

  add(amount) {
    this.set(this.get() + amount);
    return this.get();
  }

  reset() {
    this.set(this.defaultValue);
  }
}

export const gameState = {
  events,

  // Storage keys unchanged from the original per-scene states
  coins: new Resource('coins', 'totalCoins', 0),
  tickets: new Resource('tickets', 'totalTickets', 0),
  gems: new Resource('gems', 'totalGems', 0),
  energy: new Resource('energy', 'batteryEnergy', 100),
  level: new Resource('level', 'userLevel', 1),
  chests: new Resource('chests', 'totalChestsOpened', 0),

  // New progression/feature state
  xp: new Resource('xp', 'userXp', 0),
  stickerPacks: new Resource('stickerPacks', 'stickerPacks', 0),
  autoPops: new Resource('autoPops', 'autoPops', 0),

  /**
   * Subscribe to a resource change, auto-unsubscribed when the given
   * scene shuts down (so per-scene UI can listen safely).
   */
  onChange(scene, name, callback) {
    events.on(`change:${name}`, callback);
    scene.events.once('shutdown', () => events.off(`change:${name}`, callback));
    scene.events.once('destroy', () => events.off(`change:${name}`, callback));
  }
};
