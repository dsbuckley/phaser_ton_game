import Phaser from 'phaser';
import { TonConnectUI } from '@tonconnect/ui';
import { createClient } from '@supabase/supabase-js';
import StatusBar from '../components/StatusBar.js';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.tonConnectUI = null;
    this.supabase = null;
    this.telegramUser = null;
    this.walletAddress = null;
  }

  create() {
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
  }

  createChestAnimation() {
    // Build frame array for animation (frames 1, 3, 5, ... 37)
    const frames = [];
    for (let i = 1; i <= 38; i += 2) {
      const frameNum = String(i).padStart(4, '0');
      frames.push({ key: `chest_${frameNum}` });
    }

    // Create the animation
    this.anims.create({
      key: 'chest_open',
      frames: frames,
      frameRate: 38, // 19 frames at 30fps = ~0.6 seconds
      repeat: 0 // Play once
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
      this.player = this.add.sprite(centerX, centerY - 0, 'chest_0001');
      this.player.setScale(0.75);
    } else {
      // Fallback: create a simple circle if image doesn't load
      this.player = this.add.circle(centerX, centerY - 100, 30, 0x00ff00);
    }


    // Telegram user info text
    if (this.telegramUser) {
      this.userInfoText = this.add.text(centerX, 180,
        `User: ${this.telegramUser.username || 'Anonymous'}\nID: ${this.telegramUser.id}`, {
        fontSize: '16px',
        fill: '#aaa',
        align: 'center'
      }).setOrigin(0.5);
    }

    // Wallet address display (initially hidden)
    this.walletText = this.add.text(centerX, centerY + 100, '', {
      fontSize: '14px',
      fill: '#0088cc',
      align: 'center',
      wordWrap: { width: 400 }
    }).setOrigin(0.5);

    // Create "Connect TON Wallet" button
    this.createConnectButton();

    // Initialize TON Connect
    this.initTonConnect();
  }

  createStatusBar() {
    // Get Telegram user photo URL if available
    let avatarUrl = null;
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url) {
      avatarUrl = window.Telegram.WebApp.initDataUnsafe.user.photo_url;
    }

    // Create status bar with initial values - positioned at very top
    this.statusBar = new StatusBar(this, 0, 30, {
      avatarTexture: 'avatar_default',
      avatarUrl: avatarUrl,
      userLevel: 4, // TODO: Get from user data/database
      resources: [
        { key: 'coins', icon: 'statusbar_coin', value: 0 },
        { key: 'energy', icon: 'statusbar_energy', value: 37720 }, // Example: 37.72K
        { key: 'gems', icon: 'statusbar_gem', value: 0 }
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

  createConnectButton() {
    const centerX = this.cameras.main.width / 2;
    const buttonY = this.cameras.main.height - 150;

    // Store original position for press animation
    this.buttonOriginalY = buttonY;

    // Button background using NineSlice to preserve rounded corners
    // Button asset is approximately 200x68px with rounded corners (~20px radius)
    this.connectButton = this.add.nineslice(
      centerX, buttonY,
      'btn_green',
      null,
      280, 80, // Width and height
      20, 20, 20, 20 // Left, right, top, bottom slices to preserve corners
    ).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Button text overlay
    this.connectButtonText = this.add.text(centerX, buttonY, 'Tap to Open', {
      fontFamily: 'Tilt Warp',
      fill: '#fff',
      fontStyle: 'bold',
      // stroke: '#000000',
      // strokeThickness: 3,
      padding: { x: 10, y: 10 },
      resolution: 3
    }).setOrigin(0.5).setFontSize(28).setStroke('#000000', 3);

    // Button hover effects
    this.connectButton.on('pointerover', () => {
      this.connectButton.setTint(0xddffdd); // Lighter green tint on hover
    });

    this.connectButton.on('pointerout', () => {
      this.connectButton.clearTint(); // Remove tint
    });

    // Button press down effect
    this.connectButton.on('pointerdown', () => {
      // Animate button press (scale down, move down, darker tint)
      this.tweens.add({
        targets: [this.connectButton, this.connectButtonText],
        scaleX: 0.95,
        scaleY: 0.95,
        y: this.buttonOriginalY + 4,
        duration: 100,
        ease: 'Power2'
      });
      this.connectButton.setTint(0x88cc88); // Darker green when pressed

      this.openChest();
    });

    // Button release effect (restore original state)
    this.connectButton.on('pointerup', () => {
      this.tweens.add({
        targets: [this.connectButton, this.connectButtonText],
        scaleX: 1.0,
        scaleY: 1.0,
        y: this.buttonOriginalY,
        duration: 100,
        ease: 'Back.out'
      });
      this.connectButton.clearTint();
    });

    // Also restore on pointerout (in case user drags off button)
    this.connectButton.on('pointerout', () => {
      this.tweens.add({
        targets: [this.connectButton, this.connectButtonText],
        scaleX: 1.0,
        scaleY: 1.0,
        y: this.buttonOriginalY,
        duration: 100,
        ease: 'Back.out'
      });
      this.connectButton.clearTint();
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
    // Don't play animation if already playing
    if (this.player.anims && this.player.anims.isPlaying) {
      return;
    }

    // Play treasure chest sound
    this.sound.play('chest_sound');

    // Visual feedback
    this.connectButtonText.setText('Opening...');

    // Play chest opening animation
    this.player.play('chest_open');

    // Trigger coin confetti after 300ms delay
    this.time.delayedCall(300, () => {
      this.createCoinConfetti();
    });

    // Reset button text after animation completes (1.5 seconds)
    this.time.delayedCall(1000, () => {
      this.connectButtonText.setText('Tap to Open');
    });

    // Reset chest to first frame after a short delay
    this.time.delayedCall(1000, () => {
      this.player.setTexture('chest_0001');
    });
  }

  createCoinConfetti() {
    // Get chest position
    const chestX = this.player.x;
    const chestY = this.player.y;

    // Create 15-20 coins bursting from chest
    const coinCount = Phaser.Math.Between(15, 20);

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
  }

  async connectWallet() {
    try {
      this.connectButtonText.setText('Connecting...');

      // Open TON Connect modal
      await this.tonConnectUI.openModal();

    } catch (error) {
      console.error('Wallet connection failed:', error);
      this.showError('Failed to connect wallet: ' + error.message);
      this.connectButtonText.setText('Connect TON Wallet');
    }
  }

  async onWalletConnected(wallet) {
    try {
      // Get wallet address
      this.walletAddress = wallet.account.address;

      console.log('Wallet connected:', this.walletAddress);

      // Update UI
      this.connectButton.setTint(0x88ffaa); // Bright green tint for connected state
      this.connectButtonText.setText('Wallet Connected');

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
    this.connectButton.clearTint(); // Reset to original green color
    this.connectButtonText.setText('Connect TON Wallet');
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