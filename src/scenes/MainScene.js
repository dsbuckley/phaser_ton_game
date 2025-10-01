import Phaser from 'phaser';
import { TonConnectUI } from '@tonconnect/ui';
import { createClient } from '@supabase/supabase-js';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.tonConnectUI = null;
    this.supabase = null;
    this.telegramUser = null;
    this.walletAddress = null;
  }

  preload() {
    // Load background image
    console.log('Loading background from /assets/background.png');
    this.load.image('background', '/assets/background.png');

    // Load player sprite
    this.load.image('player', '/assets/player.png');

    // Handle loading errors gracefully
    this.load.on('loaderror', (file) => {
      console.error(`Failed to load: ${file.key} from ${file.src}`);
    });

    // Confirm successful loads
    this.load.on('filecomplete', (key, type, data) => {
      console.log(`Loaded: ${key} (${type})`);
    });
  }

  create() {
    // Add background image first (scaled to cover entire screen)
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    if (this.textures.exists('background')) {
      const background = this.add.image(centerX, centerY, 'background');
      // Scale to cover the screen while maintaining aspect ratio
      const scaleX = this.scale.width / background.width;
      const scaleY = this.scale.height / background.height;
      const scale = Math.max(scaleX, scaleY);
      background.setScale(scale);
      background.setDepth(-1); // Ensure background is behind everything
      console.log('Background loaded and scaled:', { width: background.width, height: background.height, scale });
    } else {
      console.error('Background texture not found!');
    }

    // Initialize Supabase client
    // TODO: Replace with your actual Supabase credentials from environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get Telegram WebApp user data
    this.getTelegramUserData();

    // Display player sprite centered

    // Create player sprite (will show placeholder if image fails to load)
    if (this.textures.exists('player')) {
      this.player = this.add.sprite(centerX, centerY - 100, 'player');
      this.player.setScale(2);
    } else {
      // Fallback: create a simple circle if image doesn't load
      this.player = this.add.circle(centerX, centerY - 100, 30, 0x00ff00);
    }

    // Title text
    this.add.text(centerX, 100, 'Telegram TON Game', {
      fontSize: '28px',
      fill: '#fff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

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

    // Initialize TON Connect
    this.initTonConnect();
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
      // Create a DOM element for the button FIRST
      const buttonContainer = document.createElement('div');
      buttonContainer.id = 'ton-connect-button';
      buttonContainer.style.position = 'absolute';
      buttonContainer.style.bottom = '150px';
      buttonContainer.style.left = '50%';
      buttonContainer.style.transform = 'translateX(-50%)';
      buttonContainer.style.zIndex = '1000';
      document.body.appendChild(buttonContainer);

      console.log('TonConnect button container created');

      // Initialize TonConnect UI
      const manifestUrl = window.location.origin + '/tonconnect-manifest.json';
      console.log('Initializing TonConnect with manifestUrl:', manifestUrl);

      this.tonConnectUI = new TonConnectUI({
        manifestUrl: manifestUrl,
        buttonRootId: 'ton-connect-button'
      });

      console.log('TonConnect UI created successfully');

      // Listen for wallet connection changes
      this.tonConnectUI.onStatusChange((wallet) => {
        console.log('Wallet status change:', wallet);
        if (wallet) {
          this.onWalletConnected(wallet);
        } else {
          this.onWalletDisconnected();
        }
      });

      // Check if wallet is already connected
      const currentWallet = this.tonConnectUI.wallet;
      if (currentWallet) {
        console.log('Wallet already connected:', currentWallet);
        this.onWalletConnected(currentWallet);
      }

      console.log('TonConnect UI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TonConnect UI:', error);
      console.error('Error details:', error.message, error.stack);

      // Show error message to user
      const centerX = this.cameras.main.width / 2;
      const centerY = this.cameras.main.height - 150;
      this.add.text(centerX, centerY, 'Failed to initialize wallet connection', {
        fontSize: '16px',
        fill: '#ff4444',
        backgroundColor: '#330000',
        padding: { x: 10, y: 5 }
      }).setOrigin(0.5);
    }
  }

  async onWalletConnected(wallet) {
    try {
      // Get wallet address
      this.walletAddress = wallet.account.address;

      console.log('Wallet connected:', this.walletAddress);

      // Update wallet address display
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