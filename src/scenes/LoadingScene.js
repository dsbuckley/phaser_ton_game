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

    // ONLY load the progress bar assets in preload
    this.load.image('slider_bg', '/assets/Components/Slider/Slider_Basic01_Bg.Png');
    this.load.image('slider_fill_magenta', '/assets/Components/Slider/Slider_Basic01_Fill_Magenta.Png');

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
    loader.image('background', '/assets/Demo/Demo_Background/Background01.png');
    loader.image('btn_green', '/assets/Components/Button/Button01_Demo_Green.png');

    // Load treasure chest animation frames (every other frame: 1, 3, 5, ... 37)
    for (let i = 1; i <= 38; i += 2) {
      const frameNum = String(i).padStart(4, '0');
      loader.image(`chest_${frameNum}`, `/assets/sprites/open treasure/frame_${frameNum}.webp`);
    }

    // Status bar assets
    loader.image('statusbar_bg', '/assets/Components/UI_Etc/Statusbar_Demo_Bg.Png');
    loader.image('statusbar_bg_small', '/assets/Components/UI_Etc/Statusbar_Demo_Bg Small.png');
    loader.image('statusbar_coin', '/assets/Components/UI_Etc/Statusbar_Demo_Icon_Coin.Png');
    loader.image('statusbar_energy', '/assets/Components/UI_Etc/Statusbar_Demo_Icon_Energy.Png');
    loader.image('statusbar_gem', '/assets/Components/UI_Etc/Statusbar_Demo_Icon_Gem.Png');
    loader.image('avatar_frame', '/assets/Components/Frame/BasicFrame_CircleSolid01_White.png');
    loader.image('avatar_default', '/assets/Components/IconMisc/Icon_Body.png');
    loader.image('settings_icon', '/assets/Components/IconMisc/Icon_Setting01.Png');

    // Pill-shaped container assets
    loader.image('label_oval_demo', '/assets/Components/Label/Label_Oval02_Demo.png');
    loader.image('label_oval_white', '/assets/Components/Label/Label_Oval02_White.png');

    // Sounds
    loader.audio('chest_sound', '/assets/sounds/treasure_chest.mp3');

    // Start loading
    loader.start();
  }

  createLoadingUI() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // Title text with Tilt Warp font
    this.add.text(centerX, centerY - 200, 'Telegram TON Game', {
      fontFamily: 'Tilt Warp',
      fontSize: '42px',
      fill: '#fff',
      stroke: '#000000',
      strokeThickness: 6,
      padding: { x: 20, y: 20 },
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: '#000000',
        blur: 0,
        stroke: false,
        fill: true
      },
      resolution: 2
    }).setOrigin(0.5);

    // Create loading slider component
    // TileSprite will repeat the pattern, so we can use any size
    const barWidth = Math.min(380, this.cameras.main.width * 0.85); // Responsive width
    const barHeight = 60; // Height that shows the pattern well

    this.loadingSlider = new LoadingSlider(this, centerX, centerY, {
      bgTexture: 'slider_bg',
      fillTexture: 'slider_fill_magenta',
      width: barWidth,
      height: barHeight,
      textFormat: 'fraction', // Shows "999 / 999" format
      fontFamily: 'LINESeed',
      fontSize: '20px',
      textColor: '#ffffff',
      textStroke: '#000000',
      textStrokeThickness: 3
    });

    this.add.existing(this.loadingSlider);

    // Set initial progress to 0
    this.loadingSlider.setProgress(0, false);

    // Loading text below progress bar
    this.loadingText = this.add.text(centerX, centerY + 80, 'LOADING...', {
      fontFamily: 'LINESeed',
      fontSize: '24px',
      fill: '#fff',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5);
  }
}
