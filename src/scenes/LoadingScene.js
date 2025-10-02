import Phaser from 'phaser';
import LoadingSlider from '../components/LoadingSlider.js';

export default class LoadingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoadingScene' });
  }

  preload() {
    // Store progress value and start time
    this.loadProgress = 0;
    this.loadStartTime = Date.now();

    // Skip artificial delays on localhost for faster development
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    this.minLoadTime = isLocalhost ? 0 : 1500; // Minimum 1.5 seconds in production only
    this.animDuration = isLocalhost ? 100 : 1000; // Fast animation on localhost

    // Load only the loading screen assets first
    this.load.image('slider_bg', '/assets/Components/Slider/Slider_Basic01_Bg.Png');
    this.load.image('slider_fill_magenta', '/assets/Components/Slider/Slider_Basic01_Fill_Magenta.Png');

    // Load all game assets together
    this.load.image('background', '/assets/Demo/Demo_Background/Background01.png');
    this.load.image('player', '/assets/Demo/Demo_Character/SampleCharacter_Knight01.png');
    this.load.image('btn_green', '/assets/Components/Button/Button01_Demo_Green.png');

    // Status bar assets
    this.load.image('statusbar_bg', '/assets/Components/UI_Etc/Statusbar_Demo_Bg.Png');
    this.load.image('statusbar_bg_small', '/assets/Components/UI_Etc/Statusbar_Demo_Bg Small.png');
    this.load.image('statusbar_coin', '/assets/Components/UI_Etc/Statusbar_Demo_Icon_Coin.Png');
    this.load.image('statusbar_energy', '/assets/Components/UI_Etc/Statusbar_Demo_Icon_Energy.Png');
    this.load.image('statusbar_gem', '/assets/Components/UI_Etc/Statusbar_Demo_Icon_Gem.Png');
    this.load.image('avatar_frame', '/assets/Components/Frame/BasicFrame_CircleSolid01_White.png');
    this.load.image('avatar_default', '/assets/Components/IconMisc/Icon_Body.png');
    this.load.image('settings_icon', '/assets/Components/IconMisc/Icon_Setting01.Png');

    // Pill-shaped container assets for individual resource displays
    this.load.image('label_oval_demo', '/assets/Components/Label/Label_Oval02_Demo.png');
    this.load.image('label_oval_white', '/assets/Components/Label/Label_Oval02_White.png');

    // Track loading progress
    this.load.on('progress', (value) => {
      this.loadProgress = value;
    });

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

    this.createLoadingUI();

    // Simulate progressive loading animation over 1 second
    this.animateProgress();
  }

  animateProgress() {
    // Animate from 0 to 100% (fast on localhost, slower in production)
    this.tweens.add({
      targets: { value: 0 },
      value: 1,
      duration: this.animDuration,
      ease: 'Power2',
      onUpdate: (tween) => {
        const progress = tween.getValue();
        this.loadingSlider.setProgress(progress, false);
      },
      onComplete: () => {
        // Check if minimum load time has passed
        const elapsed = Date.now() - this.loadStartTime;
        const remaining = Math.max(0, this.minLoadTime - elapsed);

        // Wait for remaining time before transitioning
        this.time.delayedCall(remaining, () => {
          this.scene.start('MainScene');
        });
      }
    });
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

    // Set initial progress from preload
    this.loadingSlider.setProgress(this.loadProgress, false);

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
