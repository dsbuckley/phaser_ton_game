import Phaser from 'phaser';

/**
 * EnergyCountdownTimer Component
 *
 * Compact countdown timer showing time until next hourly energy grant.
 * Uses NineSlice for clean scaling with text positioned below the bar.
 *
 * Features:
 * - Thin progress bar using NineSlice (no distortion)
 * - Text below bar for clean layout
 * - Auto-updates every second
 * - Only visible when energy < 100
 */

export default class EnergyCountdownTimer extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    // Configuration with defaults
    this.config = {
      width: config.width || 200,
      height: config.height || 30,
      bgTexture: config.bgTexture || 'slider_bg',
      fillTexture: config.fillTexture || 'slider_fill_blue'
    };

    this.currentProgress = 0;
    this.createProgressBar();
  }

  createProgressBar() {
    const { width, height, bgTexture, fillTexture } = this.config;

    // Background using NineSlice (13px corners, 34px top/bottom for 26x68 asset)
    this.background = this.scene.add.nineslice(0, 0, bgTexture, null, width, height, 13, 13, 34, 34);
    this.add(this.background);

    // Fill using NineSlice (9px corners, 30px top/bottom for 18x60 asset)
    this.fill = this.scene.add.nineslice(-width / 2, 0, fillTexture, null, width, height, 9, 9, 30, 30);
    this.fill.setOrigin(0, 0.5);
    this.add(this.fill);

    // Text positioned INSIDE the progress bar (centered)
    this.countdownText = this.scene.add.text(0, 0, 'Free energy in 59:59', {
      fontFamily: 'LINESeed',
      fontSize: '32px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 5,
      resolution: 2
    }).setOrigin(0.5, 0.5); // Center both horizontally and vertically
    this.add(this.countdownText);

    // Create mask graphics for fill reveal
    this.maskGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    this.updateMask(0);

    // Apply geometry mask to fill
    const mask = new Phaser.Display.Masks.GeometryMask(this.scene, this.maskGraphics);
    this.fill.setMask(mask);

    // Initial update
    this.updateCountdown();
  }

  /**
   * Update the mask to reveal the fill based on progress
   */
  updateMask(progress) {
    const { width, height } = this.config;
    const fillWidth = width * progress;

    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);

    // Draw mask rectangle from left edge (in world coordinates)
    // Get world position of container
    const worldX = this.x;
    const worldY = this.y;
    const maskX = worldX - (width * this.scale) / 2;
    const maskY = worldY - (height * this.scale) / 2;
    this.maskGraphics.fillRect(maskX, maskY, fillWidth * this.scale, height * this.scale);
  }

  /**
   * Set progress value (0 to 1)
   */
  setProgress(value) {
    this.currentProgress = Phaser.Math.Clamp(value, 0, 1);
    this.updateMask(this.currentProgress);
  }

  /**
   * Calculate time remaining until next hour and update display
   */
  updateCountdown() {
    const now = new Date();

    // Calculate next hour boundary
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);

    // Calculate milliseconds until next hour
    const msUntilNextHour = nextHour - now;

    // Calculate progress (0.0 = start of hour, 1.0 = end of hour)
    // Example: If 15 minutes left (900000ms), we've used 45 minutes (2700000ms) = 0.75 (75% full)
    const msInHour = 60 * 60 * 1000;
    const msElapsed = msInHour - msUntilNextHour;
    const progress = msElapsed / msInHour;

    // Update progress bar
    this.setProgress(progress);

    // Format time as MM:SS
    const totalSeconds = Math.floor(msUntilNextHour / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Update text
    this.countdownText.setText(`Free energy in ${timeString}`);
  }
}
