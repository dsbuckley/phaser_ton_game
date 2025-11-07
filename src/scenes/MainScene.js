import Phaser from 'phaser';
import { TonConnectUI } from '@tonconnect/ui';
import { createClient } from '@supabase/supabase-js';
import { withPersistentState } from '../utils/persistentState.js';
import StatusBar from '../components/StatusBar.js';
import BottomTabMenu from '../components/BottomTabMenu.js';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.tonConnectUI = null;
    this.supabase = null;
    this.telegramUser = null;
    this.walletAddress = null;
    this.audioUnlocked = false;
    this.firstClick = false;
    this.lastClickTime = 0;
    this.batteryRegenTimer = null;
    this.isJackpotPlaying = false;
  }

  async create() {
    // Lock orientation to portrait mode
    this.scale.lockOrientation('portrait');

    // Setup orientation change handling
    this.setupOrientationHandling();

    // Initialize persistent coin state using phaser-hooks
    // This will automatically save to localStorage and persist across sessions
    this.coinsState = withPersistentState(this, 'totalCoins', 0);

    // Initialize persistent battery state (starts at 100)
    this.batteryState = withPersistentState(this, 'batteryEnergy', 100);

    // Initialize timestamp tracking for hourly energy grants (rounded to current hour)
    const currentHourTimestamp = new Date();
    currentHourTimestamp.setMinutes(0, 0, 0);
    this.lastEnergyGrantHour = withPersistentState(this, 'lastEnergyGrantHour', currentHourTimestamp.getTime());

    // Keep lastBatteryUpdateTime for tracking energy consumption
    this.lastBatteryUpdateTime = withPersistentState(this, 'lastBatteryUpdateTime', Date.now());

    // Initialize persistent state for tickets and gems (now tracked)
    this.ticketsState = withPersistentState(this, 'totalTickets', 0);
    this.gemsState = withPersistentState(this, 'totalGems', 0);
    this.userLevelState = withPersistentState(this, 'userLevel', 1);
    this.totalChestsOpenedState = withPersistentState(this, 'totalChestsOpened', 0);

    // Initialize persistent state for tab notifications
    // Each tab can have: { show: boolean, text: string|null }
    this.tabNotificationsState = withPersistentState(this, 'tabNotifications', {
      main: { show: false, text: null },
      stickers: { show: true, text: 'NEW' },
      wheel: { show: false, text: null },
      earn: { show: false, text: null },
      shop: { show: false, text: null }
    });

    // Calculate hourly energy grants (will show notification after UI is created)
    this.offlineEnergyGained = this.calculateHourlyEnergyGrants();

    // Initialize Supabase client
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get Telegram WebApp user data
    this.getTelegramUserData();

    // Initialize user in database and load stats from Supabase
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

    // Start auto-save timer (saves stats to Supabase every 5 seconds)
    this.startAutoSave();
  }

  calculateHourlyEnergyGrants() {
    const currentEnergy = this.batteryState.get();

    // Only grant energy if below 100 (auto-refill cap)
    if (currentEnergy >= 100) {
      console.log('Energy already at or above 100, no auto-refill needed');
      return 0;
    }

    // Get last grant hour from localStorage (fallback to current time if not set)
    const lastGrantHour = this.lastEnergyGrantHour.get() || Date.now();
    const currentTime = Date.now();

    // Calculate how many full hours have passed
    const lastHourDate = new Date(lastGrantHour);
    const currentHourDate = new Date(currentTime);

    // Truncate to hour boundaries (e.g., 10:45 becomes 10:00)
    lastHourDate.setMinutes(0, 0, 0);
    currentHourDate.setMinutes(0, 0, 0);

    // Calculate hours difference
    const hoursDiff = Math.floor((currentHourDate - lastHourDate) / (1000 * 60 * 60));

    if (hoursDiff > 0) {
      // Grant 5 energy per hour
      const energyToGrant = hoursDiff * 5;

      // Cap at 100 maximum
      const newEnergy = Math.min(currentEnergy + energyToGrant, 100);
      const actualGranted = newEnergy - currentEnergy;

      // Update energy state
      this.batteryState.set(newEnergy);

      // Update last grant hour to current hour
      this.lastEnergyGrantHour.set(currentHourDate.getTime());

      console.log(`Hourly energy grants: +${actualGranted} energy (${hoursDiff} hours passed)`);

      return actualGranted;
    }

    return 0;
  }

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

      // Make chest interactive
      this.player.setInteractive({ useHandCursor: true });

      // Add hover effect
      this.player.on('pointerover', () => {
        this.player.setTint(0xffddaa); // Slight golden tint on hover
      });

      this.player.on('pointerout', () => {
        this.player.clearTint();
      });

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
        console.log('Settings button clicked');
        // TODO: Open settings menu/popup
      },
      statusBarY: 30 // Pass Y position for HTML avatar positioning
    });

    this.add.existing(this.statusBar);

    // Set status bar to stay at top (fixed position)
    this.statusBar.setScrollFactor(0);
    this.statusBar.setDepth(2000); // Always in front of everything (coins, tab menu, etc.)

    // Battery bar removed - energy now shown in status bar
    // this.createBatteryBar();
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

    // Get current notification states from persistent storage
    const notifState = this.tabNotificationsState.get();

    // Create bottom tab menu with 5 tabs
    this.bottomTabMenu = new BottomTabMenu(this, centerX, menuY, {
      activeTab: 'main', // Set main as the default active tab
      tabs: [
        {
          key: 'main',
          icon: 'icon_heart',
          label: 'MAIN',
          showNotification: notifState.main.show,
          notificationText: notifState.main.text,
          onTap: (key) => {
            console.log(`${key} tab tapped`);
            // Already in MainScene, so just log for now
          }
        },
        {
          key: 'stickers',
          icon: 'icon_picture',
          label: 'STICKERS',
          showNotification: notifState.stickers.show,
          notificationText: notifState.stickers.text,
          onTap: (key) => {
            console.log(`${key} tab tapped`);
            // TODO: Navigate to StickersScene when created
            // this.scene.start('StickersScene');
          }
        },
        {
          key: 'wheel',
          icon: 'icon_setting',
          label: 'WHEEL',
          showNotification: notifState.wheel.show,
          notificationText: notifState.wheel.text,
          onTap: (key) => {
            console.log(`${key} tab tapped`);
            // TODO: Navigate to WheelScene when created
            // this.scene.start('WheelScene');
          }
        },
        {
          key: 'earn',
          icon: 'icon_gold',
          label: 'EARN',
          showNotification: notifState.earn.show,
          notificationText: notifState.earn.text,
          onTap: (key) => {
            console.log(`${key} tab tapped`);
            // TODO: Navigate to EarnScene when created
            // this.scene.start('EarnScene');
          }
        },
        {
          key: 'shop',
          icon: 'icon_shop',
          iconSize: 38, // Make shop icon larger (256px asset needs more size)
          label: 'SHOP',
          showNotification: notifState.shop.show,
          notificationText: notifState.shop.text,
          onTap: (key) => {
            console.log(`${key} tab tapped`);
            // TODO: Navigate to ShopScene when created
            // this.scene.start('ShopScene');
          }
        }
      ]
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
    // Get current state
    const notifState = this.tabNotificationsState.get();

    // Update the specified tab
    if (notifState[tabKey] !== undefined) {
      notifState[tabKey] = { show, text };

      // Persist to localStorage
      this.tabNotificationsState.set(notifState);

      // Update the visual notification badge if menu exists
      if (this.bottomTabMenu) {
        this.bottomTabMenu.setNotification(tabKey, show, text);
      }

      console.log(`Tab notification updated: ${tabKey} - show: ${show}, text: ${text}`);
    } else {
      console.warn(`Invalid tab key: ${tabKey}`);
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
          last_name: initData.user.last_name,
          auth_date: initData.auth_date,
          hash: initData.hash
        };

        console.log('Telegram user authenticated:', this.telegramUser);

        // Verify Telegram auth data
        // SECURITY NOTE: In production, this verification MUST be done on the backend
        // The hash should be verified using your bot token as the secret key
        // This is just a placeholder to show where verification would occur
        this.verifyTelegramAuth(window.Telegram.WebApp.initData);
      }
    } else {
      console.warn('Not running in Telegram WebApp or no user data available');
      // For development: create mock user
      this.telegramUser = {
        id: 123456789,
        username: 'dev_user',
        first_name: 'Dev',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'dev_hash'
      };
    }
  }

  verifyTelegramAuth(initData) {
    // CRITICAL SECURITY NOTE:
    // This is a CLIENT-SIDE placeholder for demonstration purposes only
    // In a production application, you MUST verify the Telegram auth data on your backend server
    //
    // Backend verification steps (DO THIS ON YOUR SERVER):
    // 1. Parse the initData query string
    // 2. Extract all fields except 'hash'
    // 3. Sort fields alphabetically and create data_check_string
    // 4. Calculate HMAC-SHA256 using your bot token as secret key
    // 5. Compare the calculated hash with the provided hash
    // 6. Check that auth_date is recent (e.g., within last 24 hours)
    //
    // Example backend (Node.js):
    // const crypto = require('crypto');
    // const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    // const hash = crypto.createHmac('sha256', secret).update(data_check_string).digest('hex');
    // if (hash !== receivedHash) throw new Error('Invalid hash');

    console.log('⚠️  TODO: Implement backend verification for Telegram auth data');
    console.log('Init data received:', initData);

    // Return true for development, but always verify on backend in production
    return true;
  }

  async initializeUser() {
    if (!this.supabase || !this.telegramUser) {
      console.warn('Missing Supabase or Telegram user data, skipping user initialization');
      return;
    }

    try {
      // Get Telegram photo URL if available
      let photoUrl = null;
      if (window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url) {
        photoUrl = window.Telegram.WebApp.initDataUnsafe.user.photo_url;
      }

      // Step 1: Upsert user to users table (creates if new, updates if exists)
      const userData = {
        telegram_id: this.telegramUser.id,
        username: this.telegramUser.username,
        profile_photo_url: photoUrl,
        wallet_address: this.walletAddress || null
      };

      console.log('Initializing user in database:', userData);

      const { data: user, error: userError } = await this.supabase
        .from('users')
        .upsert(userData, {
          onConflict: 'telegram_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (userError) {
        throw userError;
      }

      console.log('User initialized successfully:', user);

      // Step 2: Load user stats from user_stats table
      const { data: stats, error: statsError } = await this.supabase
        .from('user_stats')
        .select('*')
        .eq('telegram_id', this.telegramUser.id)
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is expected for new users
        throw statsError;
      }

      if (stats) {
        // User has existing stats - load them into the game
        console.log('Loading existing stats from database:', stats);

        this.coinsState.set(stats.coins || 0);
        this.ticketsState.set(stats.tickets || 0);
        this.gemsState.set(stats.gems || 0);
        this.batteryState.set(stats.energy || 100);
        this.userLevelState.set(stats.user_level || 1);
        this.totalChestsOpenedState.set(stats.total_chests_opened || 0);

        // Calculate server-side hourly energy grants using last_energy_grant_hour
        if (stats.last_energy_grant_hour && stats.energy < 100) {
          const lastGrantHour = new Date(stats.last_energy_grant_hour);
          const currentTime = new Date();

          // Truncate to hour boundaries
          lastGrantHour.setMinutes(0, 0, 0);
          currentTime.setMinutes(0, 0, 0);

          // Calculate hours difference
          const hoursDiff = Math.floor((currentTime - lastGrantHour) / (1000 * 60 * 60));

          if (hoursDiff > 0) {
            // Grant 5 energy per hour, cap at 100
            const energyToGrant = hoursDiff * 5;
            const newEnergy = Math.min(stats.energy + energyToGrant, 100);
            const actualGranted = newEnergy - stats.energy;

            if (actualGranted > 0) {
              console.log(`Server-calculated hourly grants: +${actualGranted} energy (${hoursDiff} hours passed)`);
              this.batteryState.set(newEnergy);
              this.offlineEnergyGained = actualGranted;

              // Update last grant hour in localStorage
              this.lastEnergyGrantHour.set(currentTime.getTime());
            }
          }
        }

        console.log('Stats loaded successfully from database');
      } else {
        // New user - create initial stats row using localStorage defaults
        console.log('New user detected, creating initial stats row');

        const initialStats = {
          telegram_id: this.telegramUser.id,
          coins: this.coinsState.get(),
          tickets: this.ticketsState.get(),
          gems: this.gemsState.get(),
          energy: this.batteryState.get(),
          user_level: this.userLevelState.get(),
          total_chests_opened: this.totalChestsOpenedState.get(),
          last_energy_update: new Date().toISOString()
        };

        const { data: newStats, error: createError } = await this.supabase
          .from('user_stats')
          .insert(initialStats)
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        console.log('Initial stats created successfully:', newStats);
      }

    } catch (error) {
      console.error('Failed to initialize user:', error);
      console.log('Continuing with localStorage values as fallback');
      // Don't throw - game should continue with localStorage values
    }
  }

  async saveStatsToSupabase() {
    if (!this.supabase || !this.telegramUser) {
      console.warn('Missing Supabase or Telegram user data, skipping stats save');
      return;
    }

    try {
      // Convert lastEnergyGrantHour timestamp to ISO string for database
      const lastGrantHourTimestamp = this.lastEnergyGrantHour.get();
      const lastGrantHourISO = new Date(lastGrantHourTimestamp).toISOString();

      const statsData = {
        telegram_id: this.telegramUser.id,
        coins: this.coinsState.get(),
        tickets: this.ticketsState.get(),
        gems: this.gemsState.get(),
        energy: this.batteryState.get(),
        user_level: this.userLevelState.get(),
        total_chests_opened: this.totalChestsOpenedState.get(),
        last_energy_update: new Date().toISOString(),
        last_energy_grant_hour: lastGrantHourISO
      };

      const { error } = await this.supabase
        .from('user_stats')
        .upsert(statsData, {
          onConflict: 'telegram_id',
          ignoreDuplicates: false
        });

      if (error) {
        throw error;
      }

      console.log('Stats saved to Supabase:', statsData);

    } catch (error) {
      console.error('Failed to save stats to Supabase:', error);
      // Don't throw - localStorage backup still exists
    }
  }

  startAutoSave() {
    // Save stats to Supabase every 5 seconds
    this.autoSaveTimer = this.time.addEvent({
      delay: 5000, // 5 seconds
      callback: () => {
        this.saveStatsToSupabase();
      },
      loop: true
    });

    // Also save when scene shuts down (user closes game)
    this.events.once('shutdown', () => {
      console.log('Scene shutting down, saving final stats...');
      this.saveStatsToSupabase();
    });

    // Also save when scene is destroyed
    this.events.once('destroy', () => {
      console.log('Scene destroyed, saving final stats...');
      this.saveStatsToSupabase();
    });
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

  openChest() {
    // Prevent opening chest during mega jackpot
    if (this.isJackpotPlaying) {
      return;
    }

    // Record the time of this click for battery regeneration logic
    this.lastClickTime = this.time.now;

    // Check if battery is too low (stop at 0/100)
    const currentBattery = this.batteryState.get();
    if (currentBattery <= 0) {
      console.log('Battery too low! Need more than 0 energy to open chest.');
      // TODO: Show "Low Energy" message to user
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

    // Update timestamp for offline regeneration tracking
    this.lastBatteryUpdateTime.set(Date.now());

    // Increment total chests opened counter
    const chestsOpened = this.totalChestsOpenedState.get();
    this.totalChestsOpenedState.set(chestsOpened + 1);

    // Determine payout size with new probability distribution
    const rand = Math.random();
    let coinReward, isMegaJackpot = false, isBigPayout = false;

    if (rand < 0.05) {
      // 5% mega jackpot
      isMegaJackpot = true;
      coinReward = Phaser.Utils.Array.GetRandom([1500, 2000, 2500, 3000, 5000]);
    } else if (rand < 0.20) {
      // 15% big payout
      isBigPayout = true;
      coinReward = Phaser.Utils.Array.GetRandom([50, 75, 100, 125, 150]);
    } else {
      // 80% normal payout
      coinReward = Phaser.Math.Between(1, 9);
    }

    // Determine if emerald reward should spawn (10% chance for non-mega jackpots)
    const isEmeraldReward = !isMegaJackpot && (Math.random() < 0.1);

    // Determine if energy reward should spawn (10% chance for non-mega jackpots)
    const isEnergyReward = !isMegaJackpot && (Math.random() < 0.1);

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

      // Start streaming mega jackpot immediately
      this.streamMegaJackpotCoins(coinReward);
    } else {
      // Normal/big payout flow
      // Play treasure chest sound (different sound for big payouts)
      this.sound.play(isBigPayout ? 'chest_sound' : 'chest_sound_big');

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
      });

      // Play closing animation after opening completes
      this.time.delayedCall(500, () => {
        this.player.play('chest_close', true);
      });
    }

    // Immediately save stats to Supabase after chest open (don't wait for auto-save)
    this.saveStatsToSupabase();
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

      // Set depth in front of bottom tab menu (1000) but behind status bar (2000)
      coin.setDepth(1100);

      // Random scale for variety
      const scale = Phaser.Math.FloatBetween(0.3, 0.5);
      coin.setScale(scale);

      // Set random physics velocities for burst effect
      // Big payouts spread wider to prevent bunching
      const velocityX = isBigPayout
        ? Phaser.Math.Between(-350, 350) // Big payout: wider spread (700px range)
        : Phaser.Math.Between(-200, 200); // Normal: standard spread (400px range)
      // Big payouts fly much higher
      const velocityY = isBigPayout
        ? Phaser.Math.Between(-700, -900) // Big payout: launch higher
        : Phaser.Math.Between(-400, -600); // Normal: same as before
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
          // Zoom towards camera effect - scale up 2.5x to simulate approaching
          this.tweens.add({
            targets: coin,
            scaleX: scale * 2.5,
            scaleY: scale * 2.5,
            duration: 1000,
            ease: 'Power2.easeIn',
            delay: 200
          });
        }
      });

      // Fade out and destroy - big payouts stay longer
      const fadeDelay = isBigPayout ? 2000 : 1500; // Big payout: 2.5s total, Normal: 2s total
      this.time.delayedCall(fadeDelay, () => {
        this.tweens.add({
          targets: coin,
          alpha: 0,
          duration: 500,
          ease: 'Power2',
          onComplete: () => {
            coin.destroy();
          }
        });
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

    // Set depth in front of bottom tab menu (1000) but behind status bar (2000)
    emerald.setDepth(1100);

    // Larger scale for visibility (emerald is special/rare)
    const scale = 0.9;

    // Set upward physics velocity (jackpot level - higher than normal coins)
    const velocityX = Phaser.Math.Between(-200, 200); // Moderate horizontal drift
    const velocityY = Phaser.Math.Between(-700, -900); // Launch high (jackpot level)
    emerald.setVelocity(velocityX, velocityY);

    // Apply gravity for realistic arc
    emerald.setGravityY(900);

    // Gentle spin for visual interest
    emerald.setAngularVelocity(180);

    // Make it interactive (clickable)
    emerald.setInteractive({ useHandCursor: true });

    // Pop-in scale animation
    emerald.setScale(0);
    this.tweens.add({
      targets: emerald,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        // Zoom towards camera effect - scale up 2x to simulate approaching
        this.tweens.add({
          targets: emerald,
          scaleX: scale * 2.0,
          scaleY: scale * 2.0,
          duration: 1000,
          ease: 'Power2.easeIn',
          delay: 200
        });
      }
    });

    // Click handler - collect emerald
    emerald.on('pointerdown', () => {
      // Unlock audio if needed
      if (!this.audioUnlocked) {
        this.sound.context.resume().then(() => {
          this.audioUnlocked = true;
        }).catch(err => {
          console.warn('Failed to unlock audio:', err);
        });
      }

      // Play emerald collection sound
      this.sound.play('emerald_sound');

      // Update gems state
      const currentGems = this.gemsState.get();
      const newTotal = currentGems + 1;
      this.gemsState.set(newTotal);

      // Update StatusBar with animation
      this.statusBar.setResource('gems', newTotal, true);

      // Create floating "+1 Emerald" text (bright green color)
      const floatingText = this.add.text(chestX, chestY, '+1 Emerald', {
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

      // Destroy emerald immediately on click
      emerald.destroy();
    });

    // Fade out and destroy if not clicked - 1500ms delay matches coin confetti
    this.time.delayedCall(1500, () => {
      // Only fade if emerald still exists (not clicked)
      if (emerald && emerald.active) {
        this.tweens.add({
          targets: emerald,
          alpha: 0,
          duration: 500,
          ease: 'Power2',
          onComplete: () => {
            emerald.destroy();
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

    // Set depth in front of bottom tab menu (1000) but behind status bar (2000)
    energy.setDepth(1100);

    // Larger scale for visibility (same size as emerald)
    const scale = 0.9;

    // Set upward physics velocity (jackpot level - higher than normal coins)
    const velocityX = Phaser.Math.Between(-200, 200); // Moderate horizontal drift
    const velocityY = Phaser.Math.Between(-700, -900); // Launch high (jackpot level)
    energy.setVelocity(velocityX, velocityY);

    // Apply gravity for realistic arc
    energy.setGravityY(900);

    // Gentle spin for visual interest
    energy.setAngularVelocity(180);

    // Make it interactive (clickable)
    energy.setInteractive({ useHandCursor: true });

    // Pop-in scale animation
    energy.setScale(0);
    this.tweens.add({
      targets: energy,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        // Zoom towards camera effect - scale up 2x to simulate approaching
        this.tweens.add({
          targets: energy,
          scaleX: scale * 2.0,
          scaleY: scale * 2.0,
          duration: 1000,
          ease: 'Power2.easeIn',
          delay: 200
        });
      }
    });

    // Click handler - collect energy
    energy.on('pointerdown', () => {
      // Unlock audio if needed
      if (!this.audioUnlocked) {
        this.sound.context.resume().then(() => {
          this.audioUnlocked = true;
        }).catch(err => {
          console.warn('Failed to unlock audio:', err);
        });
      }

      // Play energy collection sound
      this.sound.play('energy_collect_sound');

      // Update energy state (+1, no cap)
      const currentEnergy = this.batteryState.get();
      const newTotal = currentEnergy + 1;
      this.batteryState.set(newTotal);

      // Update StatusBar energy display (even if over 100)
      this.statusBar.setResource('energy', newTotal, true);

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

      // Destroy energy immediately on click
      energy.destroy();
    });

    // Fade out and destroy if not clicked - 1500ms delay matches coin confetti
    this.time.delayedCall(1500, () => {
      // Only fade if energy still exists (not clicked)
      if (energy && energy.active) {
        this.tweens.add({
          targets: energy,
          alpha: 0,
          duration: 500,
          ease: 'Power2',
          onComplete: () => {
            energy.destroy();
          }
        });
      }
    });
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
    const coinsPerBurst = 100; // Spawn 100 coins per burst
    const burstInterval = 100; // Every 100ms
    const totalBursts = totalAmount / coinsPerBurst;
    let burstsCompleted = 0;

    // Start streaming timer after 700ms delay
    this.time.delayedCall(700, () => {
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

        // Update coins incrementally with each burst
        const currentCoins = this.coinsState.get();
        const newTotal = currentCoins + coinsPerBurst;
        this.coinsState.set(newTotal);

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

  async onWalletConnected(wallet) {
    try {
      // Get wallet address
      this.walletAddress = wallet.account.address;

      console.log('Wallet connected:', this.walletAddress);

      // Update UI - show wallet address
      const shortAddress = this.walletAddress.slice(0, 6) + '...' + this.walletAddress.slice(-4);
      this.walletText.setText(`Wallet: ${shortAddress}`);

      // Save user data to Supabase
      await this.saveUserToSupabase();

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

  async saveUserToSupabase() {
    if (!this.supabase || !this.telegramUser || !this.walletAddress) {
      console.warn('Missing data for Supabase upsert');
      return;
    }

    try {
      // SECURITY NOTE: In production, this operation should be done on the backend
      // after verifying the Telegram authentication and wallet signature
      // Backend should:
      // 1. Verify Telegram auth hash
      // 2. Verify wallet ownership (optional: request signed message)
      // 3. Then perform database operations

      const userData = {
        telegram_id: this.telegramUser.id,
        username: this.telegramUser.username,
        wallet_address: this.walletAddress,
        // high_score will use default value of 0 if not provided
      };

      console.log('Saving user to Supabase:', userData);

      const { data, error } = await this.supabase
        .from('users')
        .upsert(userData, {
          onConflict: 'telegram_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        throw error;
      }

      console.log('User saved successfully:', data);
      this.showSuccess('Profile saved!');

      // TODO: Backend should handle this insert after verification
      // Example backend flow:
      // 1. Client sends: { telegramInitData, walletAddress, signedMessage }
      // 2. Server verifies Telegram hash
      // 3. Server verifies wallet signature (optional but recommended)
      // 4. Server performs database upsert
      // 5. Server returns success/failure

    } catch (error) {
      console.error('Failed to save user to Supabase:', error);
      this.showError('Failed to save profile');
    }
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