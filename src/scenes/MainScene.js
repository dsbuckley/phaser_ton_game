import Phaser from 'phaser';
import { TonConnectUI } from '@tonconnect/ui';
import { api } from '../utils/api.js';
import { gameState } from '../state/gameState.js';
import { buildTabs, setTabNotification } from '../config/tabs.js';
import { levelFromXp, scaleCoins, levelUpRewards, coinMultiplier } from '../config/levels.js';
import RewardCelebration from '../components/RewardCelebration.js';
import LeaderboardModal from '../components/LeaderboardModal.js';
import StatusBar from '../components/StatusBar.js';
import BottomTabMenu from '../components/BottomTabMenu.js';
import EnergyCountdownTimer from '../components/EnergyCountdownTimer.js';
import SettingsModal from '../components/SettingsModal.js';
import AmbientSystem from '../systems/AmbientSystem.js';
import UISlideSystem from '../systems/UISlideSystem.js';
import RewardEffectsSystem from '../systems/RewardEffectsSystem.js';
import ComboSystem from '../systems/ComboSystem.js';
import AutoPopSystem from '../systems/AutoPopSystem.js';
import EnergySystem from '../systems/EnergySystem.js';
import SyncSystem from '../systems/SyncSystem.js';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.tonConnectUI = null;
    this.telegramUser = null;
    this.walletAddress = null;
    this.audioUnlocked = false;
    this.firstClick = false;
    this.lastClickTime = 0;
    this.isJackpotPlaying = false;
    this.isAutoPopping = false; // Flag to prevent manual clicks during auto-pop sequence
  }

  async create() {
    // Lock orientation to portrait mode
    this.scale.lockOrientation('portrait');

    // Setup orientation change handling
    this.setupOrientationHandling();

    // Shared cross-scene game state (same localStorage keys as before —
    // existing players keep their balances). Server-authoritative values
    // reconcile into these via applyServerState().
    this.coinsState = gameState.coins;
    this.batteryState = gameState.energy;
    this.ticketsState = gameState.tickets;
    this.gemsState = gameState.gems;
    this.userLevelState = gameState.level;
    this.totalChestsOpenedState = gameState.chests;
    this.xpState = gameState.xp;

    // (Tab notification state lives in src/config/tabs.js helpers)

    // Initialize first-time events tracking (loaded from database in initializeUser)
    // Tracks one-time special events like guaranteed mega jackpot, tutorial, etc.
    this.firstTimeEvents = {
      guaranteed_mega_jackpot: false,
      tutorial_completed: false,
      welcome_bonus_claimed: false
    };

    // Initialize offline energy to 0 (will be calculated from database in initializeUser)
    this.offlineEnergyGained = 0;

    // Get Telegram WebApp user data (display only — trust comes from the server)
    this.getTelegramUserData();

    // Server sync system: authenticate with the Worker and load
    // authoritative stats (gameplay deltas accumulate in sync.buffer)
    this.sync = new SyncSystem(this);
    await this.sync.initialize();

    // Ambient background system (chest/palm anims, sun, clouds, sparkles)
    this.ambient = new AmbientSystem(this);
    this.ambient.createChestAnimation();
    this.ambient.createPalmTreeAnimation();

    // UI chrome slide-out/in during chest opening effects
    this.uiSlide = new UISlideSystem(this);

    // Reward effects (confetti, catchable drops, mega jackpot stream)
    this.rewards = new RewardEffectsSystem(this);

    // Combo tracking for rapid specialty-item catches
    this.combo = new ComboSystem(this);

    // Auto-pop sequences (10 free chest opens after catching a drop)
    this.autoPop = new AutoPopSystem(this);

    // Energy countdown tick + offline-regen notification
    this.energy = new EnergySystem(this);

    // Tear down all systems when the scene shuts down or is destroyed
    this.events.once('shutdown', () => this.destroySystems());
    this.events.once('destroy', () => this.destroySystems());

    // Create UI (assets and fonts already loaded by LoadingScene)
    this.createUI();

    // Show offline regeneration notification if energy was gained
    if (this.offlineEnergyGained > 0) {
      this.energy.showOfflineRegenNotification(this.offlineEnergyGained);
    }

    // Start the sync loop (flushes gameplay deltas to the Worker)
    this.sync.startLoop();

    // Start energy countdown timer updates (updates every second)
    this.energy.startCountdown();

    // MainScene sleeps while satellite tab scenes are open. On wake,
    // refresh the visible UI from shared state (satellites may have
    // changed balances via wheel spins, task claims, purchases, etc.)
    this.events.on('wake', () => {
      if (this.statusBar) {
        this.statusBar.setResource('coins', this.coinsState.get(), false);
        this.statusBar.setResource('energy', this.batteryState.get(), false);
        this.statusBar.setResource('gems', this.gemsState.get(), false);
        this.statusBar.setLevel(this.userLevelState.get());
      }
      if (this.bottomTabMenu) {
        this.bottomTabMenu.setActiveTab('main');
      }
      this.energy.updateEnergyTimerVisibility();
      // Pull authoritative stats in case a satellite changed them server-side
      this.sync.flush();
    });
  }

  // Hourly energy grants are computed SERVER-SIDE (apply_sync, server time).
  // The client just triggers a flush when the server-provided grant time
  // passes; the response carries granted_energy for the UI.

  setupOrientationHandling() {
    // Game canvas is locked to portrait dimensions
    // Scale.NONE with CENTER_BOTH keeps it centered with black bars in landscape
  }

  /** Tear down every extracted system (idempotent — runs on shutdown and destroy). */
  destroySystems() {
    if (this.ambient) {
      this.ambient.destroy();
      this.ambient = null;
    }
    if (this.uiSlide) {
      this.uiSlide.destroy();
      this.uiSlide = null;
    }
    if (this.rewards) {
      this.rewards.destroy();
      this.rewards = null;
    }
    if (this.combo) {
      this.combo.destroy();
      this.combo = null;
    }
    if (this.autoPop) {
      this.autoPop.destroy();
      this.autoPop = null;
    }
    if (this.energy) {
      this.energy.destroy();
      this.energy = null;
    }
    if (this.sync) {
      this.sync.destroy(); // beacons out any un-flushed deltas
      this.sync = null;
    }
  }

  createUI() {
    // Display player sprite centered
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // Create status bar at top of screen
    this.createStatusBar();

    // Create bottom tab menu at bottom of screen
    this.createBottomTabMenu();

    // Add background image
    if (this.textures.exists('background')) {
      const bg = this.add.image(centerX, centerY, 'background');
      // Scale background to cover the screen (with slight margin to prevent gaps)
      const scaleX = this.cameras.main.width / bg.width;
      const scaleY = this.cameras.main.height / bg.height;
      const scale = Math.max(scaleX, scaleY) * 1.01;
      bg.setScale(scale);
      bg.setDepth(-100); // Push background behind clouds
    }

    // Create clouds (in front of background, behind other elements)
    this.ambient.createClouds();

    // Create animated sun (in front of clouds, behind sparkles)
    this.ambient.createSun();

    // Create treasure chest sprite (starts with first frame)
    if (this.textures.exists('chest_0001')) {
      this.player = this.add.sprite(centerX + 10, centerY + 110, 'chest_0001');
      this.player.setScale(0.85);
      this.player.setDepth(20); // In front of sun (10) and sparkles (5)

      // Make chest interactive
      this.player.setInteractive({ useHandCursor: true });

      // Press up effect (scale up instead of down)
      this.player.on('pointerdown', () => {
        // Kill any existing tweens to prevent stacking
        this.tweens.killTweensOf(this.player);

        // Reset scale before starting new animation
        this.player.setScale(0.85);

        this.tweens.add({
          targets: this.player,
          scaleX: 0.90,
          scaleY: 0.90,
          duration: 100,
          ease: 'Power2'
        });

        this.openChest();
      });

      // Release effect
      this.player.on('pointerup', () => {
        // Kill any existing tweens to prevent stacking
        this.tweens.killTweensOf(this.player);

        this.tweens.add({
          targets: this.player,
          scaleX: 0.85,
          scaleY: 0.85,
          duration: 100,
          ease: 'Back.out'
        });
      });

      // Create "Tap Me" text above the chest
      // this.tapMeText = this.add.text(centerX, centerY + 100, 'Tap Me', {
      //   fontFamily: 'Tilt Warp',
      //   fontSize: '30px',
      //   fill: '#FFFFFF',
      //   stroke: '#000000',
      //   strokeThickness: 3,
      //   padding: { x: 20, y: 20 },
      //   shadow: {
      //     offsetX: 3,
      //     offsetY: 3,
      //     color: '#000000',
      //     blur: 0,
      //     stroke: false,
      //     fill: true
      //   },
      //   resolution: 2
      // }).setOrigin(0.5);

      this.tapMeText = this.add.text(centerX, centerY + 130, 'Tap Me', {
        fontFamily: 'Tilt Warp',
        fontSize: 30,
        color: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 3,
        padding: { x: 20, y: 20 },
        shadow: {
          offsetX: 3,
          offsetY: 3,
          color: '#000000',
          blur: 0,
          stroke: false,
          fill: true
        },
        resolution: window.devicePixelRatio // key change
      }).setOrigin(0.5);


      // Create pulsing animation
      this.tweens.add({
        targets: this.tapMeText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 800,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1 // Infinite loop
      });

    } else {
      // Fallback: create a simple circle if image doesn't load
      this.player = this.add.circle(centerX, centerY - 100, 30, 0x00ff00);
    }

    // Create sparkles below and to the right of the sun
    this.ambient.createSparkles();

    // Create palm tree sprite (starts with first frame, positioned on right side)
    // Place AFTER sparkles so it renders on top
    if (this.textures.exists('palm_001')) {
      this.palmTree = this.add.sprite(centerX + 125, centerY + 20, 'palm_001');
      this.palmTree.setScale(1.3); // Scale up to take up most of the screen
      this.palmTree.setDepth(100); // Ensure palm tree is always in front of sparkles

      // Start the swaying animation immediately
      this.palmTree.play('palm_tree_sway');
    }

    // Wallet address display (initially hidden)
    this.walletText = this.add.text(centerX, centerY + 100, '', {
      fontSize: '14px',
      fill: '#0088cc',
      align: 'center',
      wordWrap: { width: 400 }
    }).setOrigin(0.5);

    // Initialize TON Connect (button removed - chest is now interactive)
    this.initTonConnect();
  }

  createStatusBar() {
    // Create settings modal first (must exist before status bar references it)
    this.settingsModal = new SettingsModal(this, {
      onSoundToggle: (enabled) => {
        console.log('Sound toggle:', enabled);
        // Enable/disable all game sounds
        if (enabled) {
          this.sound.setMute(false);
        } else {
          this.sound.setMute(true);
        }
        // Sync settings to the server when toggled
        this.sync.flush();
      },
      onHapticToggle: (enabled) => {
        console.log('Haptic toggle:', enabled);
        // Haptic feedback is automatically handled in the modal component
        // based on the hapticEnabled state
        // Sync settings to the server when toggled
        this.sync.flush();
      }
    });
    this.add.existing(this.settingsModal);

    // Apply loaded settings from database (if available from initializeUser)
    this.applyLoadedSettings();

    // Get Telegram user photo URL if available
    let avatarUrl = null;
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url) {
      avatarUrl = window.Telegram.WebApp.initDataUnsafe.user.photo_url;
      console.log('Telegram photo URL found:', avatarUrl);
    } else {
      console.log('No Telegram photo URL available');
      console.log('Telegram WebApp data:', window.Telegram?.WebApp?.initDataUnsafe);
    }

    // Create status bar with initial values - fixed position at top
    // Load persisted values from localStorage/Supabase
    this.statusBar = new StatusBar(this, 0, 30, {
      avatarTexture: 'avatar_default',
      avatarUrl: avatarUrl,
      username: this.telegramUser?.username || 'Player',
      userLevel: this.userLevelState.get(),
      resources: [
        { key: 'coins', icon: 'statusbar_coin', value: this.coinsState.get(), width: 95 },
        { key: 'energy', icon: 'statusbar_energy', value: this.batteryState.get(), width: 65 },
        { key: 'gems', icon: 'statusbar_gem', value: this.gemsState.get(), width: 65 }
      ],
      onSettingsClick: () => {
        this.settingsModal.show();
      },
      onAvatarClick: () => {
        this.sound.play('button_sound');
        this.leaderboardModal.show();
      },
      statusBarY: 30 // Pass Y position for HTML avatar positioning
    });

    this.add.existing(this.statusBar);

    // Set status bar to stay at top (fixed position)
    this.statusBar.setScrollFactor(0);
    this.statusBar.setDepth(2000); // Always in front of everything (coins, tab menu, etc.)

    // Create energy countdown timer below StatusBar (compact style)
    const centerX = this.cameras.main.width / 2;
    this.energyCountdownTimer = new EnergyCountdownTimer(this, centerX, 70, {
      width: 600,
      height: 60,
      bgTexture: 'slider_bg',
      fillTexture: 'slider_fill_blue'
    });
    this.add.existing(this.energyCountdownTimer);
    this.energyCountdownTimer.setScale(0.35); // Scale down for compact appearance
    this.energyCountdownTimer.setScrollFactor(0);
    this.energyCountdownTimer.setDepth(1999); // Below StatusBar but above other UI

    // Initial visibility based on energy level
    const currentEnergy = this.batteryState.get();
    this.energyCountdownTimer.setVisible(currentEnergy < 100);

    // Daily leaderboard modal — opened by tapping the player avatar
    this.leaderboardModal = new LeaderboardModal(this);
    this.add.existing(this.leaderboardModal);
  }

  applyLoadedSettings() {
    // Apply settings loaded from database (after initializeUser)
    // Database is authoritative - overrides localStorage
    if (this.loadedSoundEnabled !== undefined && this.settingsModal) {
      console.log('Applying loaded sound setting:', this.loadedSoundEnabled);

      // Update the settings modal internal state to match database
      this.settingsModal.soundEnabledState.set(this.loadedSoundEnabled);

      // Apply the sound setting immediately
      if (this.loadedSoundEnabled) {
        this.sound.setMute(false);
      } else {
        this.sound.setMute(true);
      }
    }

    if (this.loadedHapticEnabled !== undefined && this.settingsModal) {
      console.log('Applying loaded haptic setting:', this.loadedHapticEnabled);

      // Update the settings modal internal state to match database
      this.settingsModal.hapticEnabledState.set(this.loadedHapticEnabled);
    }
  }

  createBatteryBar() {
    // Battery bar disabled - energy now displays in the status bar
    // Keeping method for backwards compatibility but not creating the visual component

    // Create a dummy batteryBar object to prevent errors in regeneration code
    this.batteryBar = {
      setBattery: () => {} // No-op function
    };
  }

  createBottomTabMenu() {
    const centerX = this.cameras.main.width / 2;
    const screenHeight = this.cameras.main.height;
    const barHeight = 100; // Increased height for better spacing
    const menuY = screenHeight - (barHeight / 2); // Position so bottom edge is at screen bottom

    // Tab definitions + navigation live in src/config/tabs.js (shared
    // with every satellite scene)
    this.bottomTabMenu = new BottomTabMenu(this, centerX, menuY, {
      activeTab: 'main',
      tabs: buildTabs(this)
    });

    this.add.existing(this.bottomTabMenu);

    // Set to stay fixed at bottom
    this.bottomTabMenu.setScrollFactor(0);
    this.bottomTabMenu.setDepth(1000); // Same as StatusBar
  }

  /**
   * Update tab notification state dynamically
   * @param {string} tabKey - Tab key (main, stickers, wheel, earn, shop)
   * @param {boolean} show - Show notification (true) or hide (false)
   * @param {string|null} text - Optional text to display in badge (e.g., 'NEW')
   */
  setTabNotification(tabKey, show, text = null) {
    // Persisted via the shared tabs config helper
    setTabNotification(tabKey, show, text);

    // Update the visual notification badge if menu exists
    if (this.bottomTabMenu) {
      this.bottomTabMenu.setNotification(tabKey, show, text);
    }
  }

  getTelegramUserData() {
    // Read Telegram WebApp initDataUnsafe
    if (window.Telegram?.WebApp?.initDataUnsafe) {
      const initData = window.Telegram.WebApp.initDataUnsafe;

      if (initData.user) {
        this.telegramUser = {
          id: initData.user.id,
          username: initData.user.username || initData.user.first_name,
          first_name: initData.user.first_name,
          last_name: initData.user.last_name
        };
        console.log('Telegram user (display data):', this.telegramUser);
        // NOTE: this data is untrusted. The Worker verifies the signed
        // initData string (HMAC) on every API call — see server/middleware/auth.ts
      }
    } else {
      console.warn('Not running in Telegram WebApp or no user data available');
      // For development: mock user (server accepts it only with DEV_ALLOW_MOCK=1)
      this.telegramUser = {
        id: 123456789,
        username: 'dev_user',
        first_name: 'Dev'
      };
    }
  }

  /**
   * Add XP and handle level-ups. The server runs the same curve and
   * grants the same rewards authoritatively (grant_level_rewards);
   * this local version keeps the UI instant.
   */
  gainXp(amount) {
    const newXp = this.xpState.get() + amount;
    this.xpState.set(newXp);

    const oldLevel = this.userLevelState.get();
    const newLevel = levelFromXp(newXp);
    if (newLevel > oldLevel) {
      this.handleLevelUp(oldLevel, newLevel);
    }
  }

  handleLevelUp(oldLevel, newLevel) {
    this.userLevelState.set(newLevel);
    if (this.statusBar) this.statusBar.setLevel(newLevel);

    // Apply rewards optimistically (server grants the same amounts —
    // reconciliation keeps them consistent)
    let tickets = 0;
    let packs = 0;
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      const rewards = levelUpRewards(lvl);
      tickets += rewards.tickets;
      packs += rewards.stickerPacks;
    }
    if (this.batteryState.get() < 100) {
      this.batteryState.set(100);
      this.statusBar?.setResource('energy', 100, true);
      this.energy.updateEnergyTimerVisibility();
    }
    this.ticketsState.add(tickets);
    if (packs > 0) gameState.stickerPacks.add(packs);

    const rewardRows = [
      { icon: 'statusbar_energy', amount: 100, label: 'Energy refill' },
      { icon: 'statusbar_ticket', amount: tickets, label: 'Tickets' }
    ];
    if (packs > 0) {
      rewardRows.push({ icon: 'icon_picture', amount: packs, label: 'Sticker Pack' });
    }

    RewardCelebration.show(this, {
      title: `LEVEL ${newLevel}!`,
      rewards: rewardRows
    });

    // New level also means bigger chest payouts — worth telling the player
    const bonusPct = Math.round((coinMultiplier(newLevel) - 1) * 100);
    this.showSuccess(`Chest coins +${bonusPct}% at level ${newLevel}!`);

    this.sync.flush();
  }

  async initTonConnect() {
    try {
      // Initialize TON Connect UI
      this.tonConnectUI = new TonConnectUI({
        manifestUrl: window.location.origin + '/tonconnect-manifest.json',
        buttonRootId: null // We're using custom UI
      });

      // Listen for wallet connection status changes
      this.tonConnectUI.onStatusChange((wallet) => {
        if (wallet) {
          this.onWalletConnected(wallet);
        } else {
          this.onWalletDisconnected();
        }
      });

      // Check if wallet is already connected
      const currentWallet = this.tonConnectUI.wallet;
      if (currentWallet) {
        this.onWalletConnected(currentWallet);
      }
    } catch (error) {
      console.error('Failed to initialize TON Connect:', error);
    }
  }

  /**
   * Check if user qualifies for guaranteed mega jackpot (first-time experience)
   * Triggers when energy drops to 10 or below for the first time
   * @returns {boolean} True if guaranteed jackpot should trigger
   */
  checkGuaranteedMegaJackpot() {
    const currentEnergy = this.batteryState.get();
    const guaranteedJackpotUsed = this.firstTimeEvents.guaranteed_mega_jackpot;

    // Condition: Energy at or below 10 AND flag not yet set
    if (currentEnergy <= 10 && !guaranteedJackpotUsed) {
      console.log('🎰 GUARANTEED MEGA JACKPOT TRIGGERED! (First-time experience)');
      return true;
    }

    return false;
  }

  openChest() {
    // Prevent opening chest during mega jackpot OR auto-pop sequence
    if (this.isJackpotPlaying || this.isAutoPopping) {
      return;
    }

    // Record the time of this click for battery regeneration logic
    this.lastClickTime = this.time.now;

    // Check if battery is too low (stop at 0/100)
    const currentBattery = this.batteryState.get();
    if (currentBattery <= 0) {
      // Low energy: nudge the player toward the free refill sources
      this.showError('Out of energy! Get more from EARN tasks or the wheel ⚡');
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
      }
      return;
    }

    // Hide "Tap Me" text on first click
    if (!this.firstClick && this.tapMeText) {
      this.tweens.add({
        targets: this.tapMeText,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          this.tapMeText.destroy();
        }
      });
      this.firstClick = true;
    }

    // Slide UI out of screen BEFORE audio unlock to prevent animation delays
    this.uiSlide.slideOut();

    // Resume AudioContext on first interaction (required by browsers)
    if (!this.audioUnlocked) {
      this.sound.context.resume().then(() => {
        this.audioUnlocked = true;
        console.log('Audio unlocked');
      }).catch(err => {
        console.warn('Failed to unlock audio:', err);
      });
    }

    // Trigger haptic feedback on chest click
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    // Decrease battery by 1
    const newBattery = currentBattery - 1;
    this.batteryState.set(newBattery);

    // Update StatusBar energy display
    this.statusBar.setResource('energy', newBattery, true);

    // Update energy countdown timer visibility
    this.energy.updateEnergyTimerVisibility();

    // Increment total chests opened counter
    const chestsOpened = this.totalChestsOpenedState.get();
    this.totalChestsOpenedState.set(chestsOpened + 1);

    // Record delta for the next server sync (1 chest = 1 XP)
    this.sync.buffer.chests_opened++;
    this.sync.buffer.xp_earned++;
    this.gainXp(1);

    // Note: uiSlide.startSlideBackMonitoring() is now called AFTER confetti spawns
    // to prevent race condition where monitoring checks empty Set before confetti exists

    // Check for guaranteed mega jackpot (first-time experience)
    const guaranteedJackpot = this.checkGuaranteedMegaJackpot();

    // Determine payout size with new probability distribution
    const rand = Math.random();
    let coinReward, isMegaJackpot = false, isBigPayout = false;

    // Coin payouts scale with player level (+10% per level) — leveling
    // up makes every chest richer. Server envelope matches (apply_sync).
    const playerLevel = this.userLevelState.get();

    if (guaranteedJackpot) {
      // 🎰 GUARANTEED MEGA JACKPOT (first-time experience at energy ≤ 10)
      isMegaJackpot = true;
      coinReward = scaleCoins(5000, playerLevel);

      // Mark as used (synced to server on next flush; only false->true allowed)
      this.firstTimeEvents.guaranteed_mega_jackpot = true;
      this.sync.pendingFirstTimeEvents.guaranteed_mega_jackpot = true;
      console.log('First-time mega jackpot flag set to true');
    } else if (rand < 0.005) {
      // 0.5% mega jackpot (normal probability)
      isMegaJackpot = true;
      coinReward = scaleCoins(Phaser.Utils.Array.GetRandom([3000, 4000, 5000]), playerLevel);
    } else if (rand < 0.20) {
      // 20% big payout
      isBigPayout = true;
      coinReward = scaleCoins(Phaser.Utils.Array.GetRandom([50, 75, 100, 125, 150]), playerLevel);
    } else {
      // 80% normal payout
      coinReward = scaleCoins(Phaser.Math.Between(3, 49), playerLevel);
    }

    // Determine if emerald reward should spawn (10% chance for non-mega jackpots)
    const isEmeraldReward = !isMegaJackpot && (Math.random() < 0.1);

    // Determine if energy reward should spawn (25% chance for non-mega jackpots)
    const isEnergyReward = !isMegaJackpot && (Math.random() < 0.25);

    // Determine if Auto Pop reward should spawn (5% chance for non-mega jackpots)
    const isAutoPopReward = !isMegaJackpot && (Math.random() < 0.05);

    // Handle mega jackpot differently
    if (isMegaJackpot) {
      // Stop any existing animations
      if (this.player.anims) {
        this.player.anims.stop();
      }

      // Disable chest interactivity during mega jackpot
      this.player.disableInteractive();

      // Directly set chest to more open frame
      // Loaded frames are: 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37
      // Using frame 27 for a more open chest
      this.player.setTexture('chest_0027');

      // Record the jackpot delta for the next sync
      this.sync.buffer.mega_jackpots++;

      // Start streaming mega jackpot immediately
      this.rewards.streamMegaJackpotCoins(coinReward);
    } else {
      // Normal/big payout flow
      // Play treasure chest sound (different sound for big payouts)
      this.sound.play(isBigPayout ? 'chest_sound_big' : 'chest_sound');

      // Restart chest opening animation (restarts if already playing)
      this.player.play('chest_open', true);

      // Trigger reward after 300ms delay
      this.time.delayedCall(300, () => {
        // Always spawn coin confetti
        this.rewards.createCoinConfetti(coinReward, isBigPayout);

        // 10% chance: ALSO spawn emerald (makes it harder to catch)
        if (isEmeraldReward) {
          this.rewards.createEmeraldReward();
        }

        // 10% chance: ALSO spawn energy (1-3 items randomly)
        if (isEnergyReward) {
          const energyCount = Phaser.Math.Between(1, 3);
          for (let i = 0; i < energyCount; i++) {
            // Stagger spawns slightly for better visual effect
            this.time.delayedCall(i * 50, () => {
              this.rewards.createEnergyReward();
            });
          }
        }

        // 50% chance: ALSO spawn Auto Pop item
        if (isAutoPopReward) {
          this.rewards.createAutoPopReward();
        }

        // Start monitoring AFTER confetti exists to prevent race condition
        this.uiSlide.startSlideBackMonitoring();
      });

      // Play closing animation after opening completes
      this.time.delayedCall(500, () => {
        this.player.play('chest_close', true);
      });
    }

    // Flush immediately on the important moments; otherwise the 10s
    // sync loop picks the deltas up
    if (isMegaJackpot || newBattery <= 0) {
      this.sync.flush();
    }
  }

  async onWalletConnected(wallet) {
    try {
      // Get wallet address
      this.walletAddress = wallet.account.address;

      console.log('Wallet connected:', this.walletAddress);

      // Update UI - show wallet address
      const shortAddress = this.walletAddress.slice(0, 6) + '...' + this.walletAddress.slice(-4);
      this.walletText.setText(`Wallet: ${shortAddress}`);

      // Save wallet address via the Worker (address is display-only until
      // ton_proof verification is added — never gate real value on it)
      await api.saveWallet(this.walletAddress);
      this.showSuccess('Profile saved!');

    } catch (error) {
      console.error('Error handling wallet connection:', error);
      this.showError('Error processing wallet connection');
    }
  }

  onWalletDisconnected() {
    this.walletAddress = null;
    this.walletText.setText('');
    console.log('Wallet disconnected');
  }

  showError(message) {
    // Create temporary error message
    const errorText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 50,
      message, {
      fontSize: '16px',
      fill: '#ff4444',
      backgroundColor: '#330000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);

    // Auto-remove after 3 seconds
    this.time.delayedCall(3000, () => {
      errorText.destroy();
    });
  }

  showSuccess(message) {
    // Create temporary success message
    const successText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 50,
      message, {
      fontSize: '16px',
      fill: '#44ff44',
      backgroundColor: '#003300',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);

    // Auto-remove after 3 seconds
    this.time.delayedCall(3000, () => {
      successText.destroy();
    });
  }

  update() {
    // Game loop - add your game logic here
  }
}