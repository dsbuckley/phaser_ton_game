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
import ComboBonusDisplay from '../components/ComboBonusDisplay.js';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.tonConnectUI = null;
    this.telegramUser = null;
    this.walletAddress = null;
    this.audioUnlocked = false;
    this.firstClick = false;
    this.lastClickTime = 0;
    this.batteryRegenTimer = null;
    this.isJackpotPlaying = false;
    this.isAutoPopping = false; // Flag to prevent manual clicks during auto-pop sequence
    this.autoPopCountText = null; // Reference to countdown text
    this.autoPopPopsRemaining = 0; // Counter for remaining auto-pops (can stack)
    this.activeConfettiSprites = new Set(); // Track active confetti sprites
    this.uiSlideCheckTimer = null; // Timer for checking when to slide UI back in

    // Combo tracking state
    this.comboTracker = {
      itemType: null,        // 'energy' or 'gems'
      count: 0,              // Number of consecutive clicks
      lastClickTime: 0,      // Timestamp of last click
      pendingRewards: []     // Array of reward amounts to apply
    };
    this.comboTimer = null;  // Reference to 350ms delayed event

    // Server sync state: gameplay deltas accumulate here between flushes.
    // The Worker validates each batch and returns authoritative stats.
    this.syncBuffer = this.createEmptySyncBuffer();
    this.pendingFirstTimeEvents = {};
    this.syncInFlight = false;
    this.syncPending = false;
    this.lastFlushTime = Date.now();
    this.nextGrantAt = null; // server timestamp of the next hourly energy grant
  }

  createEmptySyncBuffer() {
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
    const b = this.syncBuffer;
    return b.chests_opened > 0 || b.coins_earned > 0 || b.gems_earned > 0 ||
      b.energy_collected > 0 || b.mega_jackpots > 0 || b.auto_pops_collected > 0 ||
      Object.keys(this.pendingFirstTimeEvents).length > 0;
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

    // Authenticate with the Worker and load authoritative stats
    await this.initializeUser();

    // Create treasure chest animation
    this.createChestAnimation();

    // Create palm tree animation
    this.createPalmTreeAnimation();

    // Create UI (assets and fonts already loaded by LoadingScene)
    this.createUI();

    // Show offline regeneration notification if energy was gained
    if (this.offlineEnergyGained > 0) {
      this.showOfflineRegenNotification(this.offlineEnergyGained);
    }

    // Start battery regeneration timer
    this.startBatteryRegeneration();

    // Start the sync loop (flushes gameplay deltas to the Worker)
    this.startSyncLoop();

    // Start energy countdown timer updates (updates every second)
    this.startEnergyCountdownUpdate();

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
      this.updateEnergyTimerVisibility();
      // Pull authoritative stats in case a satellite changed them server-side
      this.flushSync();
    });
  }

  // Hourly energy grants are computed SERVER-SIDE (apply_sync, server time).
  // The client just triggers a flush when the server-provided grant time
  // passes; the response carries granted_energy for the UI.

  setupOrientationHandling() {
    // Game canvas is locked to portrait dimensions
    // Scale.NONE with CENTER_BOTH keeps it centered with black bars in landscape
  }

  showOfflineRegenNotification(energyGained) {
    const centerX = this.cameras.main.width / 2;
    const startY = 150; // Start below battery bar

    // Create notification container with background
    const notification = this.add.container(centerX, startY);

    // Create background pill (similar to StatusBar style)
    const bgWidth = 280;
    const bgHeight = 60;
    const bg = this.add.nineslice(
      0, 0,
      'statusbar_bg_small',
      null,
      bgWidth, bgHeight,
      11, 11, 15, 15
    );
    bg.setOrigin(0.5);

    // Create energy icon (matching StatusBar energy icon)
    const icon = this.add.image(-100, -5, 'statusbar_energy');
    icon.setScale(0.85); // Larger icon for better visibility

    // Create main text
    const mainText = this.add.text(10, -8, `+${energyGained} Energy`, {
      fontFamily: 'Tilt Warp',
      fontSize: '22px',
      fill: '#4ADE80', // Green color for positive gain
      stroke: '#000000',
      strokeThickness: 4,
      padding: { x: 10, y: 10 },
      resolution: 2
    }).setOrigin(0.5);

    // Create subtitle text
    const subtitleText = this.add.text(10, 12, 'while you were away', {
      fontFamily: 'LINESeed',
      fontSize: '14px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 3,
      padding: { x: 5, y: 5 },
      resolution: 2
    }).setOrigin(0.5);

    // Add elements to container
    notification.add([bg, icon, mainText, subtitleText]);
    notification.setAlpha(0);
    notification.setDepth(2000); // Above everything

    // Animate: Fade in, slide down, pause, fade out
    this.tweens.add({
      targets: notification,
      alpha: 1,
      y: startY + 30,
      duration: 400,
      ease: 'Back.out',
      onComplete: () => {
        // Hold for 2 seconds
        this.time.delayedCall(2000, () => {
          // Fade out
          this.tweens.add({
            targets: notification,
            alpha: 0,
            y: startY + 50,
            duration: 400,
            ease: 'Power2',
            onComplete: () => notification.destroy()
          });
        });
      }
    });
  }

  startBatteryRegeneration() {
    // DISABLED: Energy now regenerates hourly (5 energy per hour on the hour)
    // No active regeneration timer needed - calculations happen on game load
    console.log('Active energy regeneration disabled - using hourly system');
  }

  createChestAnimation() {
    // Build frame array for animation (frames 1, 3, 5, ... 37)
    const frames = [];
    for (let i = 1; i <= 38; i += 2) {
      const frameNum = String(i).padStart(4, '0');
      frames.push({ key: `chest_${frameNum}` });
    }

    // Create opening animation
    this.anims.create({
      key: 'chest_open',
      frames: frames,
      frameRate: 38, // 19 frames at 38fps = ~0.5 seconds
      repeat: 0 // Play once
    });

    // Create closing animation (reverse order)
    this.anims.create({
      key: 'chest_close',
      frames: frames.slice().reverse(),
      frameRate: 38,
      repeat: 0
    });
  }

  createPalmTreeAnimation() {
    // Build frame array for animation (first 75 frames)
    const frames = [];
    for (let i = 1; i <= 75; i++) {
      const frameNum = String(i).padStart(3, '0');
      frames.push({ key: `palm_${frameNum}` });
    }

    // Create swaying animation (plays slowly, forward then reverse, loops continuously)
    this.anims.create({
      key: 'palm_tree_sway',
      frames: frames,
      frameRate: 15, // 75 frames at 30fps = 2.5 seconds per loop (smooth motion)
      repeat: -1, // Loop forever
      yoyo: true // Play forward then reverse for smooth back-and-forth motion
    });
  }

  createSun() {
    // Position sun in upper left where the background sun is
    const sunX = 30;
    const sunY = 230;

    // Create sun sprite
    this.sun = this.add.image(sunX, sunY, 'sun');
    this.sun.setScale(0.4); // Scale to appropriate size
    this.sun.setDepth(10); // In front of clouds (-50 to -30) and sparkles (0)

    // Pulsating animation (scale up and down)
    this.tweens.add({
      targets: this.sun,
      scaleX: 0.45,
      scaleY: 0.45,
      duration: 2000, // Slower: 3 seconds per pulse (was 2 seconds)
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1 // Loop forever
    });

    // Rotation animation (slow gentle rotation)
    this.tweens.add({
      targets: this.sun,
      angle: 360,
      duration: 60000, // Slower: 120 seconds (2 minutes) for full rotation (was 60 seconds)
      ease: 'Linear',
      repeat: -1 // Loop forever
    });
  }

  createClouds() {
    // Track active clouds
    this.activeClouds = [];

    // Define three depth layers for parallax effect
    // Apply yOffset to move clouds up 30px in compact mode
    this.cloudLayers = [
      {
        depth: -50, // Behind everything (far)
        scale: { min: 0.15, max: 0.25 },
        alpha: 0.5, // More transparent (far away)
        speed: { min: 8, max: 12 }, // Very slow (far away)
        yPosition: { min: 50, max: 180 } // Expanded range - higher and lower
      },
      {
        depth: -40, // Middle distance
        scale: { min: 0.25, max: 0.35 },
        alpha: 0.65, // Medium transparency
        speed: { min: 12, max: 18 }, // Slow
        yPosition: { min: 80, max: 220 } // Expanded range
      },
      {
        depth: -30, // Closer
        scale: { min: 0.35, max: 0.5 },
        alpha: 0.8, // Less transparent
        speed: { min: 18, max: 25 }, // Moderate speed
        yPosition: { min: 100, max: 280 } // Expanded range
      }
    ];

    // Spawn initial clouds immediately across the screen (visible on load)
    this.spawnInitialClouds();

    // Create continuous spawning timer
    this.cloudTimer = this.time.addEvent({
      delay: 8000, // New cloud every 8 seconds (much slower spawning)
      callback: () => {
        // Only spawn if we have fewer than 5 clouds active
        if (this.activeClouds.length < 5) {
          this.createSingleCloud();
        }
      },
      loop: true
    });
  }

  spawnInitialClouds() {
    // Spawn 4-5 clouds immediately at random positions across the screen
    const screenWidth = this.cameras.main.width;
    const numClouds = Phaser.Math.Between(4, 5);

    for (let i = 0; i < numClouds; i++) {
      // Random X position across the entire screen width
      const startX = Phaser.Math.Between(0, screenWidth);

      // Create cloud at random screen position (not off-screen)
      this.createSingleCloud(startX);
    }
  }

  createSingleCloud(startX = null) {
    const screenWidth = this.cameras.main.width;

    // Choose random cloud image (1, 2, or 3)
    const cloudType = Phaser.Math.Between(1, 3);
    const cloudKey = `cloud${cloudType}`;

    // Choose random layer for parallax effect
    const layer = Phaser.Utils.Array.GetRandom(this.cloudLayers);

    // Random scale within layer range
    const scale = Phaser.Math.FloatBetween(layer.scale.min, layer.scale.max);

    // Random Y position within layer range
    const y = Phaser.Math.Between(layer.yPosition.min, layer.yPosition.max);

    // If startX not provided, start off-screen to the left
    if (startX === null) {
      startX = -200;
    }

    // Create cloud sprite
    const cloud = this.add.image(startX, y, cloudKey);
    cloud.setScale(scale);
    cloud.setAlpha(layer.alpha);
    cloud.setDepth(layer.depth); // Set depth for proper layering

    // Add to active clouds array
    this.activeClouds.push(cloud);

    // Random speed within layer range
    const speed = Phaser.Math.Between(layer.speed.min, layer.speed.max);
    const duration = ((screenWidth + 400) / speed) * 1000; // Duration based on speed

    // Animate cloud moving from left to right
    this.tweens.add({
      targets: cloud,
      x: screenWidth + 200, // Move off-screen to the right
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        // Remove from active clouds and destroy
        const index = this.activeClouds.indexOf(cloud);
        if (index > -1) {
          this.activeClouds.splice(index, 1);
        }
        cloud.destroy();
      }
    });
  }

  createSparkles() {
    // Sun is in the upper-left area of the background
    // Position sparkles below and to the right of the sun
    const sunX = 80; // Approximate sun position from the background
    const sunY = 280;

    // Define the area where sparkles can appear
    const sparkleAreaX = sunX + 50; // To the right of sun
    const sparkleAreaY = sunY + 50; // Below the sun
    const areaWidth = 200; // Spread area width
    const areaHeight = 150; // Spread area height

    // Track active sparkles
    this.activeSparkles = [];

    // Create sparkles continuously
    this.sparkleTimer = this.time.addEvent({
      delay: 800, // Create a new sparkle every 0.8 seconds
      callback: () => {
        // Only create new sparkle if we have less than 6 active
        if (this.activeSparkles.length < 6) {
          this.createSingleSparkle(sparkleAreaX, sparkleAreaY, areaWidth, areaHeight);
        }
      },
      loop: true
    });
  }

  createSingleSparkle(baseX, baseY, areaWidth, areaHeight) {
    // Random position within the defined area
    const x = baseX + Phaser.Math.Between(-areaWidth / 2, areaWidth / 2);
    const y = baseY + Phaser.Math.Between(-areaHeight / 2, areaHeight / 2);

    // Random scale (256px image scaled down to 10-30px)
    const randomScale = Phaser.Math.FloatBetween(0.04, 0.12); // 10-30px from 256px

    // Create sparkle sprite
    const sparkle = this.add.image(x, y, 'sparkle');
    sparkle.setScale(randomScale);
    sparkle.setAlpha(0); // Start invisible
    sparkle.setDepth(5); // Behind sun (10) but in front of clouds

    // Add to active sparkles array
    this.activeSparkles.push(sparkle);

    // Fade in, sparkle (scale pulse), fade out, then remove
    this.tweens.add({
      targets: sparkle,
      alpha: 1,
      duration: 500,
      ease: 'Sine.easeIn',
      onComplete: () => {
        // Sparkle effect: pulse the scale
        this.tweens.add({
          targets: sparkle,
          scaleX: randomScale * 1.3,
          scaleY: randomScale * 1.3,
          duration: 400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: 1, // Pulse twice (once forward, once back)
          onComplete: () => {
            // Fade out
            this.tweens.add({
              targets: sparkle,
              alpha: 0,
              duration: 600,
              ease: 'Sine.easeOut',
              onComplete: () => {
                // Remove from active sparkles and destroy
                const index = this.activeSparkles.indexOf(sparkle);
                if (index > -1) {
                  this.activeSparkles.splice(index, 1);
                }
                sparkle.destroy();
              }
            });
          }
        });
      }
    });
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
    this.createClouds();

    // Create animated sun (in front of clouds, behind sparkles)
    this.createSun();

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
    this.createSparkles();

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
        this.flushSync();
      },
      onHapticToggle: (enabled) => {
        console.log('Haptic toggle:', enabled);
        // Haptic feedback is automatically handled in the modal component
        // based on the hapticEnabled state
        // Sync settings to the server when toggled
        this.flushSync();
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

  async initializeUser() {
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
        this.loadedSoundEnabled = true;
        this.loadedHapticEnabled = true;
      }
      return;
    }

    const s = res.stats;
    const b = this.syncBuffer;
    const paidChests = Math.max(b.chests_opened - b.auto_pop_chests, 0);

    const coins = (s.coins ?? 0) + b.coins_earned;
    const gems = (s.gems ?? 0) + b.gems_earned;
    const energy = Math.max((s.energy ?? 100) + b.energy_collected - paidChests, 0);
    const chests = (s.total_chests_opened ?? 0) + b.chests_opened;
    const xp = (s.xp ?? 0) + b.xp_earned;

    this.coinsState.set(coins);
    this.ticketsState.set(s.tickets ?? 0);
    this.gemsState.set(gems);
    this.batteryState.set(energy);
    this.xpState.set(xp);
    this.userLevelState.set(Math.max(s.user_level || 1, levelFromXp(xp)));
    this.totalChestsOpenedState.set(chests);
    if (typeof s.sticker_packs === 'number') gameState.stickerPacks.set(s.sticker_packs);
    if (typeof s.auto_pops === 'number') gameState.autoPops.set(s.auto_pops);

    // First-time flags: server state + anything set locally since last flush
    this.firstTimeEvents = {
      ...(s.first_time_events || this.firstTimeEvents),
      ...this.pendingFirstTimeEvents
    };

    if (res.next_grant_at) {
      this.nextGrantAt = new Date(res.next_grant_at).getTime();
    }

    if (initial) {
      this.loadedSoundEnabled = s.sound_enabled ?? true;
      this.loadedHapticEnabled = s.haptic_enabled ?? true;
      if (res.granted_energy > 0) {
        this.offlineEnergyGained = res.granted_energy;
      }
    } else {
      // Mid-play reconcile: refresh the visible pills
      if (this.statusBar) {
        this.statusBar.setResource('coins', coins, false);
        this.statusBar.setResource('gems', gems, false);
        this.statusBar.setResource('energy', energy, false);
        this.statusBar.setLevel(s.user_level || 1);
      }
      this.updateEnergyTimerVisibility();
      if (res.granted_energy > 0) {
        this.showOfflineRegenNotification(res.granted_energy);
      }
      if (res.clamped) {
        console.warn('Server clamped last sync batch (values corrected)');
      }
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
      this.updateEnergyTimerVisibility();
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

    this.flushSync();
  }

  /**
   * Flush accumulated gameplay deltas to the Worker. The server validates
   * the batch (energy accounting, rate caps, reward envelopes), applies
   * hourly grants, and returns authoritative stats for reconciliation.
   */
  async flushSync() {
    if (this.syncInFlight) {
      this.syncPending = true;
      return;
    }

    const buffer = this.syncBuffer;
    const firstTime = this.pendingFirstTimeEvents;
    this.syncBuffer = this.createEmptySyncBuffer();
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
        this.flushSync();
      }
    }
  }

  buildSyncPayload(buffer, firstTime) {
    let soundEnabled;
    let hapticEnabled;
    if (this.settingsModal) {
      soundEnabled = this.settingsModal.soundEnabledState.get();
      hapticEnabled = this.settingsModal.hapticEnabledState.get();
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
    const b = this.syncBuffer;
    for (const key of Object.keys(buffer)) {
      b[key] += buffer[key];
    }
    this.pendingFirstTimeEvents = { ...firstTime, ...this.pendingFirstTimeEvents };
  }

  startSyncLoop() {
    // Flush deltas every 10 seconds (skip when idle — hourly-grant flushes
    // are triggered separately by the countdown timer)
    this.autoSaveTimer = this.time.addEvent({
      delay: 10000,
      callback: () => {
        if (this.bufferHasDeltas()) this.flushSync();
      },
      loop: true
    });

    // Flush when the scene shuts down or is destroyed
    this.events.once('shutdown', () => this.flushSyncBeacon());
    this.events.once('destroy', () => this.flushSyncBeacon());

    // Flush when the tab/app is hidden (sendBeacon survives close)
    this.pageHideHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.flushSyncBeacon();
      }
    };
    document.addEventListener('visibilitychange', this.pageHideHandler);
    window.addEventListener('pagehide', this.pageHideHandler);
    this.events.once('destroy', () => {
      document.removeEventListener('visibilitychange', this.pageHideHandler);
      window.removeEventListener('pagehide', this.pageHideHandler);
    });
  }

  /** Fire-and-forget flush for page-hide/shutdown moments. */
  flushSyncBeacon() {
    if (!this.bufferHasDeltas()) return;
    const buffer = this.syncBuffer;
    const firstTime = this.pendingFirstTimeEvents;
    this.syncBuffer = this.createEmptySyncBuffer();
    this.pendingFirstTimeEvents = {};
    api.syncBeacon(this.buildSyncPayload(buffer, firstTime));
    this.lastFlushTime = Date.now();
  }

  startEnergyCountdownUpdate() {
    // Update countdown timer every second
    this.countdownUpdateTimer = this.time.addEvent({
      delay: 1000, // 1 second
      callback: () => {
        // Hourly grants are server-side: when the server-provided grant
        // time passes, flush a sync — the response applies the grant and
        // shows the "+N energy" notification via applyServerState()
        if (this.nextGrantAt && Date.now() >= this.nextGrantAt && !this.syncInFlight) {
          this.nextGrantAt = null; // reset until server sends the next one
          this.flushSync();
        }

        // Update countdown timer display
        if (this.energyCountdownTimer && this.energyCountdownTimer.visible) {
          this.energyCountdownTimer.updateCountdown();
        }
      },
      loop: true
    });

    // Clean up timer on scene shutdown
    this.events.once('shutdown', () => {
      if (this.countdownUpdateTimer) {
        this.countdownUpdateTimer.remove();
      }
    });

    // Clean up timer on scene destroy
    this.events.once('destroy', () => {
      if (this.countdownUpdateTimer) {
        this.countdownUpdateTimer.remove();
      }
    });
  }

  updateEnergyTimerVisibility() {
    if (!this.energyCountdownTimer) return;

    const currentEnergy = this.batteryState.get();
    const shouldBeVisible = currentEnergy < 100;

    // Only update if visibility needs to change
    if (this.energyCountdownTimer.visible !== shouldBeVisible) {
      this.energyCountdownTimer.setVisible(shouldBeVisible);
    }
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
    this.slideUIOut();

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
    this.updateEnergyTimerVisibility();

    // Increment total chests opened counter
    const chestsOpened = this.totalChestsOpenedState.get();
    this.totalChestsOpenedState.set(chestsOpened + 1);

    // Record delta for the next server sync (1 chest = 1 XP)
    this.syncBuffer.chests_opened++;
    this.syncBuffer.xp_earned++;
    this.gainXp(1);

    // Note: startUISlideBackMonitoring() is now called AFTER confetti spawns
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
      this.pendingFirstTimeEvents.guaranteed_mega_jackpot = true;
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
      this.syncBuffer.mega_jackpots++;

      // Start streaming mega jackpot immediately
      this.streamMegaJackpotCoins(coinReward);
    } else {
      // Normal/big payout flow
      // Play treasure chest sound (different sound for big payouts)
      this.sound.play(isBigPayout ? 'chest_sound_big' : 'chest_sound');

      // Restart chest opening animation (restarts if already playing)
      this.player.play('chest_open', true);

      // Trigger reward after 300ms delay
      this.time.delayedCall(300, () => {
        // Always spawn coin confetti
        this.createCoinConfetti(coinReward, isBigPayout);

        // 10% chance: ALSO spawn emerald (makes it harder to catch)
        if (isEmeraldReward) {
          this.createEmeraldReward();
        }

        // 10% chance: ALSO spawn energy (1-3 items randomly)
        if (isEnergyReward) {
          const energyCount = Phaser.Math.Between(1, 3);
          for (let i = 0; i < energyCount; i++) {
            // Stagger spawns slightly for better visual effect
            this.time.delayedCall(i * 50, () => {
              this.createEnergyReward();
            });
          }
        }

        // 50% chance: ALSO spawn Auto Pop item
        if (isAutoPopReward) {
          this.createAutoPopReward();
        }

        // Start monitoring AFTER confetti exists to prevent race condition
        this.startUISlideBackMonitoring();
      });

      // Play closing animation after opening completes
      this.time.delayedCall(500, () => {
        this.player.play('chest_close', true);
      });
    }

    // Flush immediately on the important moments; otherwise the 10s
    // sync loop picks the deltas up
    if (isMegaJackpot || newBattery <= 0) {
      this.flushSync();
    }
  }

  createCoinConfetti(coinAmount, isBigPayout = false, skipTotalUpdate = false) {
    // Get chest position
    const chestX = this.player.x;
    const chestY = this.player.y;

    // Create exact number of coins matching the reward amount
    const coinCount = coinAmount;

    for (let i = 0; i < coinCount; i++) {
      // Create coin sprite
      const coin = this.physics.add.sprite(chestX, chestY, 'statusbar_coin');

      // Track this sprite for UI slide-in monitoring
      this.activeConfettiSprites.add(coin);

      // Set depth in front of sun (10), sparkles (5), and chest (20)
      coin.setDepth(100);

      // Random scale for variety
      const scale = Phaser.Math.FloatBetween(0.3, 0.5);
      coin.setScale(scale);

      // Set random physics velocities for burst effect
      // Big payouts spread wider to prevent bunching
      const velocityX = isBigPayout
        ? Phaser.Math.Between(-350, 350) // Big payout: wider spread (700px range)
        : Phaser.Math.Between(-200, 200); // Normal: standard spread (400px range)
      // Random height variation for all coins
      const velocityY = isBigPayout
        ? Phaser.Math.Between(-400, -1000) // Big payout: random height (low to very high)
        : Phaser.Math.Between(-400, -1000); // Normal: same random range
      coin.setVelocity(velocityX, velocityY);

      // Apply gravity for realistic arc
      coin.setGravityY(900);

      // Random rotation for tumbling effect
      const angularVelocity = Phaser.Math.Between(-360, 360);
      coin.setAngularVelocity(angularVelocity);

      // Pop-in scale animation
      coin.setScale(0);
      this.tweens.add({
        targets: coin,
        scaleX: scale,
        scaleY: scale,
        duration: 150,
        ease: 'Back.out',
        onComplete: () => {
          // Random zoom effect - 50% chance towards camera (bigger), 50% away (smaller)
          const zoomTowards = Math.random() < 0.5;
          const zoomMultiplier = zoomTowards
            ? Phaser.Math.FloatBetween(1.5, 3.0)  // Zoom in: 1.5x to 3.0x
            : Phaser.Math.FloatBetween(0.3, 0.6); // Zoom out: 0.3x to 0.6x

          // If zooming away (getting smaller), move behind chest (depth 15)
          // If zooming towards (getting bigger), stay in front (depth 100)
          if (!zoomTowards) {
            coin.setDepth(15); // Behind chest (20) but in front of sun (10) and sparkles (5)
          }

          this.tweens.add({
            targets: coin,
            scaleX: scale * zoomMultiplier,
            scaleY: scale * zoomMultiplier,
            duration: 1000,
            ease: 'Power2.easeIn',
            delay: 200
          });
        }
      });

      // Destroy after falling off screen - big payouts stay longer
      const destroyDelay = isBigPayout ? 3000 : 2500; // Big payout: 3s total, Normal: 2.5s total
      this.time.delayedCall(destroyDelay, () => {
        // Remove from tracking set before destroying
        this.activeConfettiSprites.delete(coin);
        coin.destroy();
      });
    }

    // Create floating "+X" text that rises and fades (skip for streaming mode)
    if (!skipTotalUpdate) {
      const floatingText = this.add.text(chestX, chestY, `+${coinAmount}`, {
        fontFamily: 'Tilt Warp',
        fontSize: isBigPayout ? '72px' : '48px', // Larger for big payouts
        fill: isBigPayout ? '#FFD700' : '#FFFFFF', // Golden for big payouts, white for normal
        stroke: '#000000',
        strokeThickness: isBigPayout ? 8 : 6, // Thicker stroke for big payouts
        padding: { x: 20, y: 20 },
        resolution: 2
      }).setOrigin(0.5).setDepth(1200); // Same depth as mega jackpot text, in front of coins

      // Animate text floating upward and fading out
      // Big payouts go higher and stay longer
      this.tweens.add({
        targets: floatingText,
        y: isBigPayout ? chestY - 450 : chestY - 250, // Big payouts float much higher
        alpha: 0, // Fade to transparent
        duration: isBigPayout ? 2000 : 1000, // Big payouts stay 2 seconds, normal 1 second
        ease: 'Sine.easeOut', // Smooth deceleration
        onComplete: () => floatingText.destroy()
      });
    }

    // Update total coins (skip for streaming mode - updated manually)
    if (!skipTotalUpdate) {
      const currentCoins = this.coinsState.get();
      const newTotal = currentCoins + coinAmount;
      this.coinsState.set(newTotal);
      this.syncBuffer.coins_earned += coinAmount;

      // Update StatusBar with animation
      this.statusBar.setResource('coins', newTotal, true);
    }
  }

  createEmeraldReward() {
    // Get chest position
    const chestX = this.player.x;
    const chestY = this.player.y;

    // Create single emerald sprite with physics
    const emerald = this.physics.add.sprite(chestX, chestY, 'statusbar_gem');

    // Track this sprite for UI slide-in monitoring
    this.activeConfettiSprites.add(emerald);

    // Set depth in front of sun (10), sparkles (5), and chest (20)
    emerald.setDepth(100);

    // Larger scale for visibility (emerald is special/rare)
    const scale = 0.9;

    // Set upward physics velocity with random height variation
    const velocityX = Phaser.Math.Between(-200, 200); // Moderate horizontal drift
    const velocityY = Phaser.Math.Between(-400, -1000); // Random height: low to very high
    emerald.setVelocity(velocityX, velocityY);

    // Apply gravity for realistic arc
    emerald.setGravityY(900);

    // Gentle spin for visual interest
    emerald.setAngularVelocity(180);

    // Pop-in scale animation
    emerald.setScale(0);
    this.tweens.add({
      targets: emerald,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        // Make it interactive AFTER pop-in completes, so hit area is based on actual size
        emerald.setInteractive({ useHandCursor: true });

        // Random zoom effect - 50% chance towards camera (bigger), 50% away (smaller)
        const zoomTowards = Math.random() < 0.5;
        const zoomMultiplier = zoomTowards
          ? Phaser.Math.FloatBetween(1.5, 3.0)  // Zoom in: 1.5x to 3.0x
          : Phaser.Math.FloatBetween(0.3, 0.6); // Zoom out: 0.3x to 0.6x

        // If zooming away (getting smaller), move behind chest (depth 15)
        // If zooming towards (getting bigger), stay in front (depth 100)
        if (!zoomTowards) {
          emerald.setDepth(15); // Behind chest (20) but in front of sun (10) and sparkles (5)
        }

        this.tweens.add({
          targets: emerald,
          scaleX: scale * zoomMultiplier,
          scaleY: scale * zoomMultiplier,
          duration: 1000,
          ease: 'Power2.easeIn',
          delay: 200
        });
      }
    });

    // Click handler - collect emerald
    emerald.on('pointerdown', () => {
      // Prevent multiple clicks
      emerald.disableInteractive();

      // Unlock audio if needed
      if (!this.audioUnlocked) {
        this.sound.context.resume().then(() => {
          this.audioUnlocked = true;
        }).catch(err => {
          console.warn('Failed to unlock audio:', err);
        });
      }

      // Track combo BEFORE applying rewards
      this.handleSpecialtyItemClick('gems', 1);

      // Play emerald collection sound
      this.sound.play('emerald_sound');

      // Trigger success haptic feedback for specialty item collection
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      // Update gems state
      const currentGems = this.gemsState.get();
      const newTotal = currentGems + 1;
      this.gemsState.set(newTotal);
      this.syncBuffer.gems_earned += 1;

      // Update StatusBar with animation
      this.statusBar.setResource('gems', newTotal, true);

      // Create floating "+1 Emerald" text (bright green color)
      const floatingText = this.add.text(chestX, chestY, '+1 Gem', {
        fontFamily: 'Tilt Warp',
        fontSize: '48px',
        fill: '#a1fe26', // Bright green for emerald
        stroke: '#000000',
        strokeThickness: 6,
        padding: { x: 20, y: 20 },
        resolution: 2
      }).setOrigin(0.5).setDepth(1200);

      // Animate text floating upward and fading out (big payout style)
      this.tweens.add({
        targets: floatingText,
        y: chestY - 450, // Float much higher (same as big payout)
        alpha: 0,
        duration: 2000, // Stay 2 seconds (same as big payout)
        ease: 'Sine.easeOut',
        onComplete: () => floatingText.destroy()
      });

      // Bubble pop animation - scale up and fade out
      this.tweens.add({
        targets: emerald,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        angle: emerald.angle + 180, // Add rotation for dynamics
        duration: 250,
        ease: 'Back.easeIn',
        onComplete: () => {
          // Remove from tracking set and destroy after animation
          this.activeConfettiSprites.delete(emerald);
          emerald.destroy();
        }
      });
    });

    // Pulsing warning fade before disappearing
    this.time.delayedCall(2500, () => {
      // Only fade if emerald still exists (not clicked)
      if (emerald && emerald.active) {
        // Disable interactivity during fade warning
        emerald.disableInteractive();

        // Create pulsing fade effect - faster and faster
        // First pulse: 400ms
        this.tweens.add({
          targets: emerald,
          alpha: 0.3,
          duration: 400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          onComplete: () => {
            // Second pulse: 300ms (faster)
            this.tweens.add({
              targets: emerald,
              alpha: 0.3,
              duration: 300,
              ease: 'Sine.easeInOut',
              yoyo: true,
              onComplete: () => {
                // Third pulse: 200ms (even faster)
                this.tweens.add({
                  targets: emerald,
                  alpha: 0.3,
                  duration: 200,
                  ease: 'Sine.easeInOut',
                  yoyo: true,
                  onComplete: () => {
                    // Final fast fade out
                    this.tweens.add({
                      targets: emerald,
                      alpha: 0,
                      duration: 200,
                      ease: 'Power2',
                      onComplete: () => {
                        // Remove from tracking set before destroying
                        this.activeConfettiSprites.delete(emerald);
                        emerald.destroy();
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  createEnergyReward() {
    // Get chest position
    const chestX = this.player.x;
    const chestY = this.player.y;

    // Create single energy sprite with physics
    const energy = this.physics.add.sprite(chestX, chestY, 'statusbar_energy');

    // Track this sprite for UI slide-in monitoring
    this.activeConfettiSprites.add(energy);

    // Set depth in front of sun (10), sparkles (5), and chest (20)
    energy.setDepth(100);

    // Larger scale for visibility (same size as emerald)
    const scale = 0.9;

    // Set upward physics velocity with random height variation
    const velocityX = Phaser.Math.Between(-200, 200); // Moderate horizontal drift
    const velocityY = Phaser.Math.Between(-400, -1000); // Random height: low to very high
    energy.setVelocity(velocityX, velocityY);

    // Apply gravity for realistic arc
    energy.setGravityY(900);

    // Gentle spin for visual interest
    energy.setAngularVelocity(180);

    // Pop-in scale animation
    energy.setScale(0);
    this.tweens.add({
      targets: energy,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        // Make it interactive AFTER pop-in completes, so hit area is based on actual size
        energy.setInteractive({ useHandCursor: true });

        // Random zoom effect - 50% chance towards camera (bigger), 50% away (smaller)
        const zoomTowards = Math.random() < 0.5;
        const zoomMultiplier = zoomTowards
          ? Phaser.Math.FloatBetween(1.5, 3.0)  // Zoom in: 1.5x to 3.0x
          : Phaser.Math.FloatBetween(0.3, 0.6); // Zoom out: 0.3x to 0.6x

        // If zooming away (getting smaller), move behind chest (depth 15)
        // If zooming towards (getting bigger), stay in front (depth 100)
        if (!zoomTowards) {
          energy.setDepth(15); // Behind chest (20) but in front of sun (10) and sparkles (5)
        }

        this.tweens.add({
          targets: energy,
          scaleX: scale * zoomMultiplier,
          scaleY: scale * zoomMultiplier,
          duration: 1000,
          ease: 'Power2.easeIn',
          delay: 200
        });
      }
    });

    // Click handler - collect energy
    energy.on('pointerdown', () => {
      // Prevent multiple clicks
      energy.disableInteractive();

      // Unlock audio if needed
      if (!this.audioUnlocked) {
        this.sound.context.resume().then(() => {
          this.audioUnlocked = true;
        }).catch(err => {
          console.warn('Failed to unlock audio:', err);
        });
      }

      // Track combo BEFORE applying rewards
      this.handleSpecialtyItemClick('energy', 1);

      // Play energy collection sound
      this.sound.play('energy_collect_sound');

      // Trigger success haptic feedback for specialty item collection
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      // Update energy state (+1, no cap)
      const currentEnergy = this.batteryState.get();
      const newTotal = currentEnergy + 1;
      this.batteryState.set(newTotal);
      this.syncBuffer.energy_collected += 1;

      // Update StatusBar energy display (even if over 100)
      this.statusBar.setResource('energy', newTotal, true);

      // Update energy countdown timer visibility
      this.updateEnergyTimerVisibility();

      // Update BatteryBar display (will show over 100) - only if it exists
      if (this.batteryBar && this.batteryBar.setBattery) {
        this.batteryBar.setBattery(newTotal, 100, true);
      }

      // Create floating "+1 Energy" text (cyan color)
      const floatingText = this.add.text(chestX, chestY, '+1 Energy', {
        fontFamily: 'Tilt Warp',
        fontSize: '48px',
        fill: '#4df0ff', // Cyan color for energy
        stroke: '#000000',
        strokeThickness: 6,
        padding: { x: 20, y: 20 },
        resolution: 2
      }).setOrigin(0.5).setDepth(1200);

      // Animate text floating upward and fading out (big payout style)
      this.tweens.add({
        targets: floatingText,
        y: chestY - 450, // Float much higher (same as big payout)
        alpha: 0,
        duration: 2000, // Stay 2 seconds (same as big payout)
        ease: 'Sine.easeOut',
        onComplete: () => floatingText.destroy()
      });

      // Bubble pop animation - scale up and fade out
      this.tweens.add({
        targets: energy,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        angle: energy.angle + 180, // Add rotation for dynamics
        duration: 250,
        ease: 'Back.easeIn',
        onComplete: () => {
          // Remove from tracking set and destroy after animation
          this.activeConfettiSprites.delete(energy);
          energy.destroy();
        }
      });
    });

    // Pulsing warning fade before disappearing
    this.time.delayedCall(2500, () => {
      // Only fade if energy still exists (not clicked)
      if (energy && energy.active) {
        // Disable interactivity during fade warning
        energy.disableInteractive();

        // Create pulsing fade effect - faster and faster
        // First pulse: 400ms
        this.tweens.add({
          targets: energy,
          alpha: 0.3,
          duration: 400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          onComplete: () => {
            // Second pulse: 300ms (faster)
            this.tweens.add({
              targets: energy,
              alpha: 0.3,
              duration: 300,
              ease: 'Sine.easeInOut',
              yoyo: true,
              onComplete: () => {
                // Third pulse: 200ms (even faster)
                this.tweens.add({
                  targets: energy,
                  alpha: 0.3,
                  duration: 200,
                  ease: 'Sine.easeInOut',
                  yoyo: true,
                  onComplete: () => {
                    // Final fast fade out
                    this.tweens.add({
                      targets: energy,
                      alpha: 0,
                      duration: 200,
                      ease: 'Power2',
                      onComplete: () => {
                        // Remove from tracking set before destroying
                        this.activeConfettiSprites.delete(energy);
                        energy.destroy();
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  createAutoPopReward() {
    // Get chest position
    const chestX = this.player.x;
    const chestY = this.player.y;

    // Create single Auto Pop sprite with physics
    const autoPop = this.physics.add.sprite(chestX, chestY, 'autopop_icon');

    // Track this sprite for UI slide-in monitoring
    this.activeConfettiSprites.add(autoPop);

    // Set depth in front of sun (10), sparkles (5), and chest (20)
    autoPop.setDepth(100);

    // Larger scale for visibility (same size as emerald/energy)
    const scale = 0.9;

    // Set upward physics velocity with random height variation
    const velocityX = Phaser.Math.Between(-200, 200); // Moderate horizontal drift
    const velocityY = Phaser.Math.Between(-400, -1000); // Random height: low to very high
    autoPop.setVelocity(velocityX, velocityY);

    // Apply gravity for realistic arc
    autoPop.setGravityY(900);

    // Gentle spin for visual interest
    autoPop.setAngularVelocity(180);

    // Pop-in scale animation
    autoPop.setScale(0);
    this.tweens.add({
      targets: autoPop,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        // Make it interactive AFTER pop-in completes
        autoPop.setInteractive({ useHandCursor: true });

        // Random zoom effect - 50% chance towards camera (bigger), 50% away (smaller)
        const zoomTowards = Math.random() < 0.5;
        const zoomMultiplier = zoomTowards
          ? Phaser.Math.FloatBetween(1.5, 3.0)  // Zoom in: 1.5x to 3.0x
          : Phaser.Math.FloatBetween(0.3, 0.6); // Zoom out: 0.3x to 0.6x

        // If zooming away (getting smaller), move behind chest (depth 15)
        if (!zoomTowards) {
          autoPop.setDepth(15);
        }

        this.tweens.add({
          targets: autoPop,
          scaleX: scale * zoomMultiplier,
          scaleY: scale * zoomMultiplier,
          duration: 1000,
          ease: 'Power2.easeIn',
          delay: 200
        });
      }
    });

    // Click handler - activate Auto Pop
    autoPop.on('pointerdown', () => {
      // Prevent multiple clicks
      autoPop.disableInteractive();

      // Unlock audio if needed
      if (!this.audioUnlocked) {
        this.sound.context.resume().then(() => {
          this.audioUnlocked = true;
        }).catch(err => {
          console.warn('Failed to unlock audio:', err);
        });
      }

      // Play collection sound (reuse energy sound)
      this.sound.play('energy_collect_sound');

      // Trigger success haptic feedback
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      // Record the collected auto-pop for the next sync
      this.syncBuffer.auto_pops_collected++;

      // Start Auto Pop sequence
      this.startAutoPopSequence();

      // Bubble pop animation - scale up and fade out
      this.tweens.add({
        targets: autoPop,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        angle: autoPop.angle + 180,
        duration: 250,
        ease: 'Back.easeIn',
        onComplete: () => {
          // Remove from tracking set and destroy
          this.activeConfettiSprites.delete(autoPop);
          autoPop.destroy();
        }
      });
    });

    // Pulsing warning fade before disappearing (same as energy/emerald)
    this.time.delayedCall(2500, () => {
      if (autoPop && autoPop.active) {
        autoPop.disableInteractive();

        // Three accelerating pulses before final fade
        this.tweens.add({
          targets: autoPop,
          alpha: 0.3,
          duration: 400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          onComplete: () => {
            this.tweens.add({
              targets: autoPop,
              alpha: 0.3,
              duration: 300,
              ease: 'Sine.easeInOut',
              yoyo: true,
              onComplete: () => {
                this.tweens.add({
                  targets: autoPop,
                  alpha: 0.3,
                  duration: 200,
                  ease: 'Sine.easeInOut',
                  yoyo: true,
                  onComplete: () => {
                    this.tweens.add({
                      targets: autoPop,
                      alpha: 0,
                      duration: 200,
                      ease: 'Power2',
                      onComplete: () => {
                        this.activeConfettiSprites.delete(autoPop);
                        autoPop.destroy();
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  startAutoPopSequence() {
    // If already auto-popping, add 10 to the existing counter
    if (this.isAutoPopping && this.autoPopCountText) {
      // Add 10 more pops to the queue
      if (!this.autoPopPopsRemaining) {
        this.autoPopPopsRemaining = 10;
      }
      this.autoPopPopsRemaining += 10;

      // Update the text immediately to show new total
      this.autoPopCountText.setText(`Auto Pop ${this.autoPopPopsRemaining}`);

      // Flash the text to indicate addition
      this.tweens.add({
        targets: this.autoPopCountText,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 150,
        ease: 'Back.out',
        yoyo: true
      });

      return; // Don't start a new sequence
    }

    // Store original energy value to restore after sequence
    const originalEnergy = this.batteryState.get();

    // Set flag to prevent manual chest clicks
    this.isAutoPopping = true;

    // Disable chest interactivity
    this.player.disableInteractive();

    // Create countdown text at top of screen
    const centerX = this.cameras.main.width / 2;
    const topY = 75; // Closer to the top

    // Create spinning light in front of text
    this.autoPopLight = this.add.image(centerX, topY, 'jackpot_light')
      .setOrigin(0.5)
      .setDepth(3001) // In front of text (3000)
      .setScale(1.0); // Full size

    // Rotating animation for light
    this.tweens.add({
      targets: this.autoPopLight,
      angle: 360,
      duration: 2000, // 2 seconds per rotation
      ease: 'Linear',
      repeat: -1
    });

    this.autoPopCountText = this.add.text(centerX, topY, 'Auto Pop 10', {
      fontFamily: 'Tilt Warp',
      fontSize: '32px', // Smaller font size
      fill: '#FF0000', // Start with red (will cycle through rainbow)
      stroke: '#000000',
      strokeThickness: 4,
      padding: { x: 20, y: 20 },
      resolution: 2
    }).setOrigin(0.5).setDepth(3000); // Above everything

    // Rainbow color animation (ROYGBIV)
    const rainbowColors = [
      '#FF0000', // Red
      '#FF7F00', // Orange
      '#FFFF00', // Yellow
      '#00FF00', // Green
      '#0000FF', // Blue
      '#4B0082', // Indigo
      '#9400D3'  // Violet
    ];

    // Create color cycling timeline
    let colorIndex = 0;
    this.autoPopColorTimer = this.time.addEvent({
      delay: 150, // Change color every 150ms
      callback: () => {
        if (this.autoPopCountText && this.autoPopCountText.active) {
          colorIndex = (colorIndex + 1) % rainbowColors.length;
          this.autoPopCountText.setColor(rainbowColors[colorIndex]);
        }
      },
      loop: true
    });

    // Pulsing animation for countdown text (subtle now)
    this.tweens.add({
      targets: this.autoPopCountText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 300,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Auto-pop loop: starts at 10, but can increase if more Auto Pops are clicked
    this.autoPopPopsRemaining = 10;

    const autoPopTimer = this.time.addEvent({
      delay: 300, // 300ms between each pop
      callback: () => {
        // Update countdown text
        this.autoPopCountText.setText(`Auto Pop ${this.autoPopPopsRemaining}`);

        // Call openChest() but bypass energy consumption
        this.openChestAutoPop();

        this.autoPopPopsRemaining--;

        // Check if sequence complete
        if (this.autoPopPopsRemaining <= 0) {
          autoPopTimer.remove();

          // Wait 500ms before cleanup
          this.time.delayedCall(500, () => {
            // Restore energy (no net consumption during auto-pop)
            this.batteryState.set(originalEnergy);
            this.statusBar.setResource('energy', originalEnergy, true);

            // Stop rainbow color timer
            if (this.autoPopColorTimer) {
              this.autoPopColorTimer.remove();
              this.autoPopColorTimer = null;
            }

            // Fade out and remove countdown text and light
            this.tweens.add({
              targets: [this.autoPopCountText, this.autoPopLight],
              alpha: 0,
              duration: 300,
              onComplete: () => {
                this.autoPopCountText.destroy();
                this.autoPopCountText = null;

                if (this.autoPopLight) {
                  this.autoPopLight.destroy();
                  this.autoPopLight = null;
                }
              }
            });

            // Re-enable chest clicking
            this.isAutoPopping = false;
            this.autoPopPopsRemaining = 0;
            this.player.setInteractive({ useHandCursor: true });
          });
        }
      },
      loop: true
    });
  }

  openChestAutoPop() {
    // This is a modified version of openChest() that:
    // 1. Does NOT consume energy
    // 2. CAN spawn emerald, energy, and Auto Pop rewards (same as normal gameplay)

    // Record click time for battery regeneration logic
    this.lastClickTime = this.time.now;

    // Slide UI out (same as normal)
    this.slideUIOut();

    // Trigger haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    // NOTE: Energy is NOT consumed here (skip energy decrease)

    // Increment total chests opened counter (for stats tracking)
    const chestsOpened = this.totalChestsOpenedState.get();
    this.totalChestsOpenedState.set(chestsOpened + 1);

    // Record deltas: auto-pop chests are free (no energy) — the server
    // validates them against collected auto-pops (10 opens each)
    this.syncBuffer.chests_opened++;
    this.syncBuffer.auto_pop_chests++;
    this.syncBuffer.xp_earned++;
    this.gainXp(1);

    // Determine payout size (same probability as normal, level-scaled)
    const rand = Math.random();
    const playerLevel = this.userLevelState.get();
    let coinReward, isBigPayout = false;

    // NOTE: Mega jackpot disabled during auto-pop (too disruptive)
    if (rand < 0.10) {
      // 10% big payout
      isBigPayout = true;
      coinReward = scaleCoins(Phaser.Utils.Array.GetRandom([75, 100, 125, 150]), playerLevel);
    } else {
      // 90% normal payout
      coinReward = scaleCoins(Phaser.Math.Between(3, 49), playerLevel);
    }

    // Determine if emerald reward should spawn (10% chance)
    const isEmeraldReward = Math.random() < 0.1;

    // Determine if energy reward should spawn (25% chance)
    const isEnergyReward = Math.random() < 0.25;

    // Auto Pop rewards do NOT spawn during auto-pop sequences (prevents chaos)
    const isAutoPopReward = false;

    // Play chest sound
    this.sound.play(isBigPayout ? 'chest_sound_big' : 'chest_sound');

    // Play chest opening animation
    this.player.play('chest_open', true);

    // Trigger reward after 300ms delay
    this.time.delayedCall(300, () => {
      // Always spawn coin confetti
      this.createCoinConfetti(coinReward, isBigPayout);

      // 10% chance: ALSO spawn emerald
      if (isEmeraldReward) {
        this.createEmeraldReward();
      }

      // 25% chance: ALSO spawn energy (1-3 items randomly)
      if (isEnergyReward) {
        const energyCount = Phaser.Math.Between(1, 3);
        for (let i = 0; i < energyCount; i++) {
          // Stagger spawns slightly for better visual effect
          this.time.delayedCall(i * 50, () => {
            this.createEnergyReward();
          });
        }
      }

      // 50% chance: ALSO spawn Auto Pop item
      if (isAutoPopReward) {
        this.createAutoPopReward();
      }

      // Start monitoring for UI slide back
      this.startUISlideBackMonitoring();
    });

    // Play closing animation
    this.time.delayedCall(500, () => {
      this.player.play('chest_close', true);
    });

    // Deltas are picked up by the 10-second sync loop
  }

  /**
   * Handle specialty item click for combo tracking
   *
   * IMPORTANT: Combos work ACROSS multiple chest opens!
   * Example: Open chest 3 times quickly:
   *   - Chest 1 spawns 1 energy → click it
   *   - Chest 2 spawns 2 energies → click both within 350ms
   *   - Chest 3 spawns 2 energies → click both within 350ms
   * Result: 5x combo = +3 bonus energy (floor(5/3) * 3)
   *
   * The 350ms window only cares about time between specialty item clicks,
   * NOT about which chest they came from.
   *
   * @param {string} itemType - 'energy' or 'gems'
   * @param {number} rewardAmount - Amount to give (usually 1)
   */
  handleSpecialtyItemClick(itemType, rewardAmount) {
    // Skip combo tracking during mega jackpot only (combos work during auto-pop!)
    if (this.isJackpotPlaying) {
      return;
    }

    const now = this.time.now;
    const timeSinceLastClick = now - this.comboTracker.lastClickTime;

    // Check if this is the same item type within 350ms window
    if (this.comboTracker.itemType === itemType && timeSinceLastClick <= 700) {
      // Continue combo: increment count and store reward
      this.comboTracker.count++;
      this.comboTracker.pendingRewards.push(rewardAmount);
      this.comboTracker.lastClickTime = now;

      console.log(`🔥 Combo continued: ${itemType} x${this.comboTracker.count}`);
    } else {
      // Different item type or window expired: finalize previous combo
      this.finalizeCombo();

      // Start new combo tracking
      this.comboTracker.itemType = itemType;
      this.comboTracker.count = 1;
      this.comboTracker.lastClickTime = now;
      this.comboTracker.pendingRewards = [rewardAmount];

      console.log(`✨ New combo started: ${itemType}`);
    }

    // Clear existing combo timer
    if (this.comboTimer) {
      this.comboTimer.remove();
    }

    // Start new 350ms timer to finalize combo if no more clicks
    this.comboTimer = this.time.delayedCall(700, () => {
      this.finalizeCombo();
    });
  }

  /**
   * Finalize the current combo and apply rewards
   */
  finalizeCombo() {
    // Check if there's a combo to finalize
    if (this.comboTracker.count === 0) {
      return;
    }

    const totalCount = this.comboTracker.count;
    const itemType = this.comboTracker.itemType;
    const pendingRewards = this.comboTracker.pendingRewards;

    // Calculate total base rewards
    const totalBaseRewards = pendingRewards.reduce((sum, amount) => sum + amount, 0);

    // Check if combo qualifies (3 or more)
    if (totalCount >= 3) {
      // Bonus equals the total count (3x = +3, 4x = +4, 5x = +5, etc.)
      const bonusAmount = totalCount;

      console.log(`🎉 COMBO BONUS! ${itemType} x${totalCount} = +${bonusAmount} bonus`);

      // Apply base rewards + bonus
      this.applyComboRewards(itemType, totalBaseRewards, bonusAmount);
    } else {
      // No combo: apply base rewards only (already applied in click handler, so do nothing)
      console.log(`No combo: ${itemType} x${totalCount} (need 3+)`);
    }

    // Reset combo tracker
    this.resetComboTracker();
  }

  /**
   * Apply combo rewards and show UI
   * @param {string} itemType - 'energy' or 'gems'
   * @param {number} baseAmount - Base rewards already applied
   * @param {number} bonusAmount - Bonus rewards to apply
   */
  applyComboRewards(itemType, baseAmount, bonusAmount) {
    // Apply bonus rewards based on item type
    if (itemType === 'energy') {
      const currentEnergy = this.batteryState.get();
      const newEnergy = currentEnergy + bonusAmount;
      this.batteryState.set(newEnergy);
      this.syncBuffer.energy_collected += bonusAmount;
      this.statusBar.setResource('energy', newEnergy, true);
    } else if (itemType === 'gems') {
      const currentGems = this.gemsState.get();
      const newGems = currentGems + bonusAmount;
      this.gemsState.set(newGems);
      this.syncBuffer.gems_earned += bonusAmount;
      this.statusBar.setResource('gems', newGems, true);
    }

    // Show combo bonus UI (positioned higher on screen, closer to top)
    const centerX = this.cameras.main.width / 2;
    const topY = this.cameras.main.height * 0.25; // 25% from top (higher than center)

    const comboBonusDisplay = new ComboBonusDisplay(this, centerX, topY, {
      itemType: itemType,
      bonusAmount: bonusAmount
    });
    this.add.existing(comboBonusDisplay);
    comboBonusDisplay.setScrollFactor(0).setDepth(3000); // Top layer

    // Play combo sound effect only
    this.sound.play('combo_sound');

    // Trigger haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }

    // Deltas are picked up by the sync loop
  }

  /**
   * Reset combo tracker to initial state
   */
  resetComboTracker() {
    this.comboTracker.itemType = null;
    this.comboTracker.count = 0;
    this.comboTracker.lastClickTime = 0;
    this.comboTracker.pendingRewards = [];
  }

  streamMegaJackpotCoins(totalAmount) {
    // Set jackpot playing flag
    this.isJackpotPlaying = true;

    // Play mega jackpot sounds at the start (yeah_sound delayed by 400ms)
    this.sound.play('mega_jackpot_sound');
    this.time.delayedCall(400, () => {
      this.sound.play('yeah_sound');
    });

    // Create spinning light background centered on the chest
    const lightBg = this.add.image(this.player.x, this.player.y, 'jackpot_light')
      .setOrigin(0.5)
      .setDepth(1300); // In front of coins (1100) but behind status bar (2000)

    // Scale to cover entire screen
    const scaleX = this.cameras.main.width / lightBg.width;
    const scaleY = this.cameras.main.height / lightBg.height;
    const scale = Math.max(scaleX, scaleY) * 1.2; // 1.2x for extra coverage
    lightBg.setScale(scale);

    // Rotating animation
    this.tweens.add({
      targets: lightBg,
      angle: 360,
      duration: 3000,
      ease: 'Linear',
      repeat: -1
    });

    // Animate chest between frames 19 and 27 for bouncing effect
    const frames = ['chest_0019', 'chest_0021', 'chest_0023', 'chest_0025', 'chest_0027'];
    let currentFrameIndex = 0;
    let direction = 1; // 1 = forward, -1 = backward

    const textureKeeper = this.time.addEvent({
      delay: 150, // Change frame every 150ms
      callback: () => {
        if (this.isJackpotPlaying) {
          this.player.setTexture(frames[currentFrameIndex]);

          // Move to next frame
          currentFrameIndex += direction;

          // Reverse direction at ends (yoyo effect)
          if (currentFrameIndex >= frames.length - 1) {
            direction = -1;
          } else if (currentFrameIndex <= 0) {
            direction = 1;
          }
        }
      },
      loop: true
    });

    // Create "MEGA JACKPOT!" text announcement
    const centerX = this.cameras.main.width / 2;

    const megaText = this.add.text(centerX, 140, `MEGA JACKPOT!\n+${totalAmount}`, {
      fontFamily: 'Tilt Warp',
      fontSize: '42px',
      fill: '#FFD700', // Gold
      stroke: '#FF4500', // Orange-red outline
      strokeThickness: 5,
      align: 'center',
      padding: { x: 15, y: 15 },
      resolution: 2
    }).setOrigin(0.5).setDepth(1200); // In front of coins (1100) but behind status bar (2000)

    // Create second spinning light background behind the text
    const textLightBg = this.add.image(centerX, 140, 'jackpot_light')
      .setOrigin(0.5)
      .setDepth(1150); // Behind text (1200) but in front of coins (1100)

    // Scale to match chest light (same size)
    textLightBg.setScale(scale);

    // Rotating animation for text light
    this.tweens.add({
      targets: textLightBg,
      angle: 360,
      duration: 3000,
      ease: 'Linear',
      repeat: -1
    });

    // Pulsing text animation
    this.tweens.add({
      targets: megaText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Streaming configuration
    const coinsPerBurst = 50; // Spawn 100 coins per burst
    const burstInterval = 100; // Every 100ms
    const totalBursts = totalAmount / coinsPerBurst;
    let burstsCompleted = 0;

    // Start streaming timer after 700ms delay
    this.time.delayedCall(700, () => {
      // Start monitoring AFTER first confetti burst for mega jackpot
      this.startUISlideBackMonitoring();

      const burstTimer = this.time.addEvent({
        delay: burstInterval,
        callback: () => {
        // Play sound (overlapping allowed)
        this.sound.play('chest_sound_big');

        // Trigger haptic feedback synchronized with sound
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }

        // Spawn coin burst (skip total update - we'll update incrementally)
        this.createCoinConfetti(coinsPerBurst, true, true);

        // Spawn 1-5 random energy sprites per burst
        const energyCount = Phaser.Math.Between(1, 5);
        for (let i = 0; i < energyCount; i++) {
          this.createEnergyReward();
        }

        // Update coins incrementally with each burst
        const currentCoins = this.coinsState.get();
        const newTotal = currentCoins + coinsPerBurst;
        this.coinsState.set(newTotal);
        this.syncBuffer.coins_earned += coinsPerBurst;

        // Update StatusBar with animation
        this.statusBar.setResource('coins', newTotal, true);

        burstsCompleted++;

        // Check if done
        if (burstsCompleted >= totalBursts) {
          burstTimer.remove();

          // Wait 1 second after final burst
          this.time.delayedCall(1000, () => {
            // Stop texture keeper
            textureKeeper.remove();

            // Re-enable animations
            this.player.anims.resume();

            // Play close animation
            this.player.play('chest_close', true);

            // Remove mega text and light backgrounds
            this.tweens.add({
              targets: [megaText, lightBg, textLightBg],
              alpha: 0,
              duration: 500,
              onComplete: () => {
                megaText.destroy();
                lightBg.destroy();
                textLightBg.destroy();
              }
            });

            // Re-enable chest clicking and interactivity
            this.isJackpotPlaying = false;
            this.player.setInteractive({ useHandCursor: true });
          });
        }
      },
      loop: true
    });
    }); // Close delayedCall callback
  }

  /**
   * Slide UI elements out of screen (upward for top, downward for bottom)
   * Only slides clickable elements - keeps resource stats visible
   */
  slideUIOut() {
    // Slide only avatar and settings button from StatusBar (keep resource pills visible)
    // Use absolute position -180 (above screen)
    if (this.statusBar && this.statusBar.slideAvatarAndControls) {
      this.statusBar.slideAvatarAndControls(-180, 400, 'Power2.easeIn');
    }

    // Slide EnergyCountdownTimer up if visible
    if (this.energyCountdownTimer && this.energyCountdownTimer.visible) {
      this.tweens.add({
        targets: this.energyCountdownTimer,
        y: -100,
        duration: 400,
        ease: 'Power2.easeIn'
      });
    }


    // Slide BottomTabMenu down (out of screen at bottom)
    if (this.bottomTabMenu) {
      const screenHeight = this.cameras.main.height;
      const slideOutY = screenHeight + 150; // Slide down past screen edge

      this.tweens.add({
        targets: this.bottomTabMenu,
        y: slideOutY,
        duration: 400,
        ease: 'Power2.easeIn'
      });
    }
  }

  /**
   * Slide UI elements back into screen (downward for top, upward for bottom)
   * Brings back avatar and controls, keeps resource pills in place
   */
  slideUIIn() {
    // Slide avatar and settings button back to original position (y: 0)
    if (this.statusBar && this.statusBar.slideAvatarAndControls) {
      this.statusBar.slideAvatarAndControls(0, 500, 'Power2.easeOut');
    }

    // Slide EnergyCountdownTimer down to original position if visible
    if (this.energyCountdownTimer && this.energyCountdownTimer.visible) {
      this.tweens.add({
        targets: this.energyCountdownTimer,
        y: 70,
        duration: 500,
        ease: 'Power2.easeOut'
      });
    }


    // Slide BottomTabMenu up (back to original position at bottom)
    if (this.bottomTabMenu) {
      const screenHeight = this.cameras.main.height;
      const barHeight = 100;
      const originalY = screenHeight - (barHeight / 2); // Original position

      this.tweens.add({
        targets: this.bottomTabMenu,
        y: originalY,
        duration: 500,
        ease: 'Power2.easeOut'
      });
    }
  }

  /**
   * Start monitoring for when to slide UI back in
   * Checks every 100ms if all confetti sprites are cleared
   */
  startUISlideBackMonitoring() {
    // Clear any existing timer
    if (this.uiSlideCheckTimer) {
      this.uiSlideCheckTimer.remove();
    }

    this.uiSlideCheckTimer = this.time.addEvent({
      delay: 100, // Check every 100ms
      callback: () => {
        // Check if all confetti is cleared and not playing jackpot
        if (this.activeConfettiSprites.size === 0 && !this.isJackpotPlaying) {
          // Slide UI back in
          this.slideUIIn();

          // Stop checking
          if (this.uiSlideCheckTimer) {
            this.uiSlideCheckTimer.remove();
            this.uiSlideCheckTimer = null;
          }
        }
      },
      loop: true
    });
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