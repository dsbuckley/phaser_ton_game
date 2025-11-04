import Phaser from 'phaser';
import { TonConnectUI } from '@tonconnect/ui';
import { createClient } from '@supabase/supabase-js';
import { withPersistentState } from '../utils/persistentState.js';
import StatusBar from '../components/StatusBar.js';
import BatteryBar from '../components/BatteryBar.js';

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
  }

  create() {
    // Initialize persistent coin state using phaser-hooks
    // This will automatically save to localStorage and persist across sessions
    this.coinsState = withPersistentState(this, 'totalCoins', 0);

    // Initialize persistent battery state (starts at 100)
    this.batteryState = withPersistentState(this, 'batteryEnergy', 100);

    // Initialize timestamp tracking for offline regeneration
    this.lastBatteryUpdateTime = withPersistentState(this, 'lastBatteryUpdateTime', Date.now());

    // Calculate offline energy regeneration (will show notification after UI is created)
    this.offlineEnergyGained = this.calculateOfflineRegeneration();

    // Initialize Supabase client
    // TODO: Replace with your actual Supabase credentials from environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get Telegram WebApp user data
    this.getTelegramUserData();

    // Create treasure chest animation
    this.createChestAnimation();

    // Create UI (assets and fonts already loaded by LoadingScene)
    this.createUI();

    // Show offline regeneration notification if energy was gained
    if (this.offlineEnergyGained > 0) {
      this.showOfflineRegenNotification(this.offlineEnergyGained);
    }

    // Start battery regeneration timer
    this.startBatteryRegeneration();
  }

  calculateOfflineRegeneration() {
    const currentTime = Date.now();
    const lastUpdateTime = this.lastBatteryUpdateTime.get();
    const currentBattery = this.batteryState.get();

    // Calculate elapsed time in seconds
    const elapsedSeconds = (currentTime - lastUpdateTime) / 1000;

    // Only apply if at least 1 second has passed and battery is below max
    if (elapsedSeconds >= 1 && currentBattery < 100) {
      // Regeneration rate: 3.3 energy per second (matching active regeneration)
      const energyGained = Math.floor(elapsedSeconds * 3.3);

      if (energyGained > 0) {
        // Calculate new battery value (clamped to max 100)
        const newBattery = Math.min(currentBattery + energyGained, 100);
        const actualGained = newBattery - currentBattery;

        // Update battery state
        this.batteryState.set(newBattery);
        this.lastBatteryUpdateTime.set(currentTime);

        // Log offline regeneration for debugging
        const minutesElapsed = Math.floor(elapsedSeconds / 60);
        console.log(`Offline regeneration: +${actualGained} energy (${minutesElapsed} minutes offline)`);

        return actualGained;
      }
    } else {
      // Still update timestamp even if no regeneration occurred
      this.lastBatteryUpdateTime.set(currentTime);
    }

    return 0;
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

    // Create battery icon
    const icon = this.add.image(-100, -5, 'battery_icon');
    icon.setScale(0.25); // Much smaller icon

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
    // Create a repeating timer that runs every second
    this.batteryRegenTimer = this.time.addEvent({
      delay: 300, // 0.3 second
      callback: () => {
        const currentTime = this.time.now;
        const timeSinceLastClick = currentTime - this.lastClickTime;

        // Only regenerate if user hasn't clicked for at least 1 second
        if (timeSinceLastClick >= 1000) {
          const currentBattery = this.batteryState.get();

          // Only increase if below max (100)
          if (currentBattery < 100) {
            const newBattery = currentBattery + 1;
            this.batteryState.set(newBattery);
            this.batteryBar.setBattery(newBattery, 100, true);

            // Update timestamp for offline regeneration tracking
            this.lastBatteryUpdateTime.set(Date.now());
          }
        }
      },
      loop: true
    });
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

  createUI() {
    // Display player sprite centered
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // Create status bar at top of screen
    this.createStatusBar();

    // Add background image
    if (this.textures.exists('background')) {
      const bg = this.add.image(centerX, centerY, 'background');
      // Scale background to cover the screen (with slight margin to prevent gaps)
      const scaleX = this.cameras.main.width / bg.width;
      const scaleY = this.cameras.main.height / bg.height;
      const scale = Math.max(scaleX, scaleY) * 1.01;
      bg.setScale(scale);
    }

    // Create treasure chest sprite (starts with first frame)
    if (this.textures.exists('chest_0001')) {
      this.player = this.add.sprite(centerX + 10, centerY + 80, 'chest_0001');
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

      // Press down effect
      this.player.on('pointerdown', () => {
        // Kill any existing tweens to prevent stacking
        this.tweens.killTweensOf(this.player);

        // Reset scale before starting new animation
        this.player.setScale(0.85);

        this.tweens.add({
          targets: this.player,
          scaleX: 0.80,
          scaleY: 0.80,
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

      this.tapMeText = this.add.text(centerX, centerY + 100, 'Tap Me', {
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

    // Create status bar with initial values - positioned at very top
    // Load persisted coin count from localStorage via phaser-hooks
    this.statusBar = new StatusBar(this, 0, 30, {
      avatarTexture: 'avatar_default',
      avatarUrl: avatarUrl,
      userLevel: 1, // TODO: Get from user data/database
      resources: [
        { key: 'coins', icon: 'statusbar_coin', value: this.coinsState.get(), width: 95 },
        { key: 'tickets', icon: 'statusbar_ticket', value: 0, width: 65 },
        { key: 'gems', icon: 'statusbar_gem', value: 0, width: 65 }
      ],
      onSettingsClick: () => {
        console.log('Settings button clicked');
        // TODO: Open settings menu/popup
      }
    });

    this.add.existing(this.statusBar);

    // Set status bar to stay at top (fixed position)
    this.statusBar.setScrollFactor(0);
    this.statusBar.setDepth(1000); // Ensure it's always on top

    // Create battery bar below the status bar
    this.createBatteryBar();
  }

  createBatteryBar() {
    // Calculate responsive width (span most of the screen with margins)
    const screenWidth = this.cameras.main.width;
    const barWidth = Math.min(screenWidth - 40, 400); // 20px margin on each side, max 400px
    const barHeight = 30; // Further reduced height for thinner bar

    // Position below the status bar (status bar is at y=30, height ~60px)
    const barX = screenWidth / 2;
    const barY = 90; // Below status bar with some spacing

    // Load current battery value from persistent state
    const currentBattery = this.batteryState.get();

    this.batteryBar = new BatteryBar(this, barX, barY, {
      width: barWidth,
      height: barHeight,
      iconTexture: 'battery_icon',
      fillTexture: 'slider_fill_green',
      bgTexture: 'slider_bg',
      currentValue: currentBattery,
      maxValue: 100,
      iconSize: 45,
      iconOffsetX: -10, // Moved further left to edge of bar
      showText: false, // Hide the numbers
      fontSize: '18px', // Smaller font for thinner bar
      textStrokeThickness: 3
    });

    this.add.existing(this.batteryBar);

    // Fixed position at top
    this.batteryBar.setScrollFactor(0);
    this.batteryBar.setDepth(999); // Below status bar but above game content
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
    // Record the time of this click for battery regeneration logic
    this.lastClickTime = this.time.now;

    // Check if battery is too low (stop at 6/100)
    const currentBattery = this.batteryState.get();
    if (currentBattery <= 6) {
      console.log('Battery too low! Need more than 6 energy to open chest.');
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

    // Decrease battery by 1
    const newBattery = currentBattery - 1;
    this.batteryState.set(newBattery);
    this.batteryBar.setBattery(newBattery, 100, true);

    // Update timestamp for offline regeneration tracking
    this.lastBatteryUpdateTime.set(Date.now());

    // Play treasure chest sound
    this.sound.play('chest_sound');

    // Visual feedback
    //this.connectButtonText.setText('Opening...');

    // Restart chest opening animation (restarts if already playing)
    this.player.play('chest_open', true);

    // 20% chance for big payout (20-50 coins), 80% chance for normal payout (1-9 coins)
    const isBigPayout = Math.random() < 0.10;
    const coinReward = isBigPayout
      ? Phaser.Math.Between(20, 50)  // Big payout
      : Phaser.Math.Between(1, 9);   // Normal payout

    // Trigger coin confetti after 300ms delay with the coin reward amount
    this.time.delayedCall(300, () => {
      this.createCoinConfetti(coinReward);
    });

    // Play closing animation after opening completes
    this.time.delayedCall(500, () => {
      this.player.play('chest_close', true);
    });

    // Reset button text after animation completes
    // this.time.delayedCall(300, () => {
    //   this.connectButtonText.setText('Tap to Open');
    // });
  }

  createCoinConfetti(coinAmount) {
    // Get chest position
    const chestX = this.player.x;
    const chestY = this.player.y;

    // Create exact number of coins matching the reward amount
    const coinCount = coinAmount;

    for (let i = 0; i < coinCount; i++) {
      // Create coin sprite
      const coin = this.physics.add.sprite(chestX, chestY, 'statusbar_coin');

      // Random scale for variety
      const scale = Phaser.Math.FloatBetween(0.3, 0.5);
      coin.setScale(scale);

      // Set random physics velocities for burst effect
      const velocityX = Phaser.Math.Between(-200, 200); // Horizontal spread
      const velocityY = Phaser.Math.Between(-400, -600); // Upward burst
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
        ease: 'Back.out'
      });

      // Fade out and destroy after 2 seconds
      this.time.delayedCall(1500, () => {
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

    // Create floating "+X" text that rises and fades
    const floatingText = this.add.text(chestX, chestY, `+${coinAmount}`, {
      fontFamily: 'Tilt Warp',
      fontSize: '48px',
      fill: '#FFFFFF', // White color
      stroke: '#000000',
      strokeThickness: 6,
      padding: { x: 20, y: 20 },
      resolution: 2
    }).setOrigin(0.5);

    // Animate text floating upward and fading out
    this.tweens.add({
      targets: floatingText,
      y: chestY - 250, // Float up 250 pixels
      alpha: 0, // Fade to transparent
      duration: 1000, // 1 second (faster)
      ease: 'Sine.easeOut', // Smooth deceleration
      onComplete: () => floatingText.destroy()
    });

    // Update total coins using phaser-hooks persistent state
    // This automatically saves to localStorage
    const currentCoins = this.coinsState.get();
    const newTotal = currentCoins + coinAmount;
    this.coinsState.set(newTotal);

    // Update StatusBar with animation
    this.statusBar.setResource('coins', newTotal, true);
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