import Phaser from 'phaser';
import LoadingSlider from '../components/LoadingSlider.js';

export default class LoadingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoadingScene' });
  }

  preload() {
    // Store start time
    this.loadStartTime = Date.now();

    // Skip artificial delays on localhost for faster development
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    this.minLoadTime = isLocalhost ? 0 : 1500; // Minimum 1.5 seconds in production only

    // ONLY load the progress bar assets and background in preload
    this.load.image('loading_screen_bg', '/assets/loading_screen.webp');
    this.load.image('slider_bg', '/assets/Components/Slider/Slider_Basic01_Bg.Png');
    this.load.image('slider_fill_magenta', '/assets/Components/Slider/Slider_Basic01_Fill_Magenta.Png');
    this.load.image('slider_fill_green', '/assets/Components/Slider/Slider_Basic01_Fill_Green.Png');

    // Handle loading errors gracefully
    this.load.on('loaderror', (file) => {
      console.warn(`Failed to load: ${file.key}`);
    });
  }

  async create() {
    // Wait for fonts to load
    await Promise.all([
      document.fonts.load('32px "Tilt Warp"'),
      document.fonts.load('24px "LINESeed"')
    ]);

    // Create the loading UI immediately
    this.createLoadingUI();

    // Now load all the game assets with visible progress
    this.loadGameAssets();
  }

  loadGameAssets() {
    // Create a new loader for the remaining assets
    const loader = new Phaser.Loader.LoaderPlugin(this);

    // Track progress
    loader.on('progress', (value) => {
      this.loadingSlider.setProgress(value, false);
    });

    loader.on('complete', () => {
      // Check if minimum load time has passed
      const elapsed = Date.now() - this.loadStartTime;
      const remaining = Math.max(0, this.minLoadTime - elapsed);

      // Wait for remaining time before transitioning
      this.time.delayedCall(remaining, () => {
        this.scene.start('MainScene');
      });
    });

    // Load all game assets
    loader.image('background', '/assets/main_scene8.webp');
    loader.image('btn_green', '/assets/Components/Button/Button01_Demo_Green.png');

    // Load treasure chest animation frames (every other frame: 1, 3, 5, ... 37)
    for (let i = 1; i <= 38; i += 2) {
      const frameNum = String(i).padStart(4, '0');
      loader.image(`chest_${frameNum}`, `/assets/sprites/open treasure/frame_${frameNum}.webp`);
    }

    // Load palm tree 2 animation frames (first 75 frames for smooth slow animation)
    for (let i = 1; i <= 75; i++) {
      const frameNum = String(i).padStart(3, '0');
      loader.image(`palm_${frameNum}`, `/assets/sprites/palm tree 2/frame_${frameNum}.webp`);
    }

    // Status bar assets
    loader.image('statusbar_bg', '/assets/Components/UI_Etc/Statusbar_Demo_Bg.Png');
    loader.image('statusbar_bg_small', '/assets/Components/UI_Etc/Statusbar_Demo_Bg Small.png');
    loader.image('statusbar_coin', '/assets/Components/UI_Etc/Statusbar_Demo_Icon_Coin.Png');
    loader.image('statusbar_energy', '/assets/Components/UI_Etc/Statusbar_Demo_Icon_Energy.Png');
    loader.image('statusbar_gem', '/assets/Components/UI_Etc/Statusbar_Demo_Icon_Gem.Png');
    loader.image('statusbar_ticket', '/assets/Components/Icon_ItemIcons/Original/Itemicon_Ticket_Blue.Png');
    loader.image('avatar_frame', '/assets/Components/Frame/BasicFrame_CircleSolid01_White.png');
    loader.image('avatar_default', '/assets/Components/IconMisc/Icon_Body.png');
    loader.image('settings_icon', '/assets/Components/IconMisc/Icon_Setting01.Png');

    // Pill-shaped container assets
    loader.image('label_oval_demo', '/assets/Components/Label/Label_Oval02_Demo.png');
    loader.image('label_oval_white', '/assets/Components/Label/Label_Oval02_White.png');

    // Battery bar icon
    loader.image('battery_icon', '/assets/Components/Icon_ItemIcons/512/ItemIcon_Battery.png');

    // Sounds
    loader.audio('chest_sound', '/assets/sounds/treasure_chest.mp3');
    loader.audio('chest_sound_big', '/assets/sounds/treasure_chest_4.mp3');
    loader.audio('mega_jackpot_sound', '/assets/sounds/mega_jackpot.mp3');

    // Sparkle effect
    loader.image('sparkle', '/assets/sparkle.webp');

    // Cloud images
    loader.image('cloud1', '/assets/clouds/1.webp');
    loader.image('cloud2', '/assets/clouds/2.webp');
    loader.image('cloud3', '/assets/clouds/3.webp');

    // Sun
    loader.image('sun', '/assets/sun.webp');

    // Start loading
    loader.start();
  }

  createLoadingUI() {
    const centerX = this.cameras.main.width / 2;
    const screenHeight = this.cameras.main.height;

    // Add background image that fills the entire screen
    const bg = this.add.image(centerX, screenHeight / 2, 'loading_screen_bg');

    // Scale the background to cover the entire screen
    const scaleX = this.cameras.main.width / bg.width;
    const scaleY = screenHeight / bg.height;
    const scale = Math.max(scaleX, scaleY);
    bg.setScale(scale);

    // Position slider closer to the bottom
    const sliderY = screenHeight * 0.85; // 85% down from top = near bottom

    // Create loading slider component with better proportions
    const barWidth = Math.min(280, this.cameras.main.width * 0.7); // Smaller width
    const barHeight = 40; // Better height for NineSlice scaling

    this.loadingSlider = new LoadingSlider(this, centerX, sliderY, {
      bgTexture: 'slider_bg',
      fillTexture: 'slider_fill_magenta',
      width: barWidth,
      height: barHeight,
      showText: false // Hide text overlay
    });

    this.add.existing(this.loadingSlider);

    // Scale down for thinner appearance while maintaining quality
    this.loadingSlider.setScale(0.75);

    // Set initial progress to 0
    this.loadingSlider.setProgress(0, false);
  }
}
