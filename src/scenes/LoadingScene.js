import Phaser from 'phaser';

export default class LoadingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoadingScene' });
  }

  preload() {
    // Store progress value for later use
    this.loadProgress = 0;

    // Load only the loading screen assets first
    this.load.image('slider_bg', '/assets/Components/Slider/Slider_Basic01_Bg.Png');
    this.load.image('slider_fill_magenta', '/assets/Components/Slider/Slider_Basic01_Fill_Magenta.Png');

    // Load all game assets together
    this.load.image('background', '/assets/Demo/Demo_Background/Background01.png');
    this.load.image('player', '/assets/Demo/Demo_Character/SampleCharacter_Knight01.png');

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

    // Show final progress
    this.updateProgress(this.loadProgress);

    // Transition to MainScene after a short delay
    this.time.delayedCall(800, () => {
      this.scene.start('MainScene');
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

    // Progress bar background
    const barWidth = 400;
    const barHeight = 50;
    const barY = centerY;

    this.progressBg = this.add.image(centerX, barY, 'slider_bg');
    this.progressBg.setDisplaySize(barWidth, barHeight);

    // Progress bar fill (magenta) - will be scaled based on progress
    // Use left origin for easier width scaling
    this.progressFill = this.add.image(centerX - barWidth/2, barY, 'slider_fill_magenta');
    this.progressFill.setDisplaySize(barWidth, barHeight);
    this.progressFill.setOrigin(0, 0.5);

    // Start with 0 width
    this.progressFill.setScale(0, 1);

    // Progress text (999 / 999 format)
    this.progressText = this.add.text(centerX, barY, '0 / 0', {
      fontFamily: 'LINESeed',
      fontSize: '20px',
      fill: '#fff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2
    }).setOrigin(0.5);

    // Loading text below progress bar
    this.loadingText = this.add.text(centerX, barY + 80, 'LOADING...', {
      fontFamily: 'LINESeed',
      fontSize: '24px',
      fill: '#fff',
      fontStyle: 'bold',
      resolution: 2
    }).setOrigin(0.5);
  }


  updateProgress(value) {
    // value is between 0 and 1
    const percentage = Math.floor(value * 100);

    // Update the scale to show progress (scaleX from 0 to 1)
    if (this.progressFill) {
      this.progressFill.setScale(value, 1);
    }

    // Update progress text
    if (this.progressText) {
      const total = 100;
      const current = percentage;
      this.progressText.setText(`${current} / ${total}`);
    }
  }
}
