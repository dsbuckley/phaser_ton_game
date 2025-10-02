import Phaser from 'phaser';

/**
 * LoadingSlider - A reusable progress bar component using LayerLab UI assets
 * Uses GeometryMask to avoid stretching/distorting the fill texture
 */
export default class LoadingSlider extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    // Configuration with defaults
    this.config = {
      bgTexture: config.bgTexture || 'slider_bg',
      fillTexture: config.fillTexture || 'slider_fill',
      width: config.width || 400,
      height: config.height || 50,
      textFormat: config.textFormat || 'fraction', // 'fraction' (999/999) or 'percentage' (45%)
      showText: config.showText !== false, // Show text by default
      fontFamily: config.fontFamily || 'LINESeed',
      fontSize: config.fontSize || '20px',
      textColor: config.textColor || '#ffffff',
      textStroke: config.textStroke || '#000000',
      textStrokeThickness: config.textStrokeThickness || 3
    };

    this.currentProgress = 0;
    this.targetProgress = 0;

    this.createSlider();
  }

  createSlider() {
    const { width, height, bgTexture, fillTexture } = this.config;

    // Background using NineSlice to stretch middle while preserving rounded corners
    // Parameters: x, y, texture, frame, width, height, leftWidth, rightWidth, topHeight, bottomHeight
    // Bg asset is 26x68px - use 13px corners (half width) and 34px top/bottom (half height)
    this.background = this.scene.add.nineslice(0, 0, bgTexture, null, width, height, 13, 13, 34, 34);
    this.add(this.background);

    // Fill using NineSlice (aligned to left edge for masking)
    // Fill asset is 18x60px - use 9px corners (half width) and 30px top/bottom (half height)
    this.fill = this.scene.add.nineslice(-width / 2, 0, fillTexture, null, width, height, 9, 9, 30, 30);
    this.fill.setOrigin(0, 0.5); // Left-aligned for mask reveal
    this.add(this.fill);

    // Create mask graphics (initially 0 width)
    this.maskGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    this.updateMask(0);

    // Apply geometry mask to fill
    const mask = new Phaser.Display.Masks.GeometryMask(this.scene, this.maskGraphics);
    this.fill.setMask(mask);

    // Progress text overlay (if enabled)
    if (this.config.showText) {
      this.progressText = this.scene.add.text(0, 0, '0 / 100', {
        fontFamily: this.config.fontFamily,
        fontSize: this.config.fontSize,
        fill: this.config.textColor,
        stroke: this.config.textStroke,
        strokeThickness: this.config.textStrokeThickness,
        fontStyle: 'bold',
        resolution: 2
      }).setOrigin(0.5);
      this.add(this.progressText);
    }
  }

  /**
   * Update the mask to reveal the fill based on progress
   * @param {number} progress - Value between 0 and 1
   */
  updateMask(progress) {
    const { width, height } = this.config;
    const fillWidth = width * progress;

    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);

    // Draw mask rectangle from left edge
    const maskX = this.x - width / 2;
    const maskY = this.y - height / 2;
    this.maskGraphics.fillRect(maskX, maskY, fillWidth, height);
  }

  /**
   * Set progress value (0 to 1)
   * @param {number} value - Progress value between 0 and 1
   * @param {boolean} animate - Whether to tween to the value (default: false)
   */
  setProgress(value, animate = false) {
    this.targetProgress = Phaser.Math.Clamp(value, 0, 1);

    if (animate) {
      // Tween for smooth animation
      this.scene.tweens.add({
        targets: this,
        currentProgress: this.targetProgress,
        duration: 300,
        ease: 'Power2',
        onUpdate: () => {
          this.updateVisuals();
        }
      });
    } else {
      // Instant update
      this.currentProgress = this.targetProgress;
      this.updateVisuals();
    }
  }

  /**
   * Update mask and text based on current progress
   */
  updateVisuals() {
    // Update mask
    this.updateMask(this.currentProgress);

    // Update text
    if (this.progressText) {
      const percentage = Math.floor(this.currentProgress * 100);

      if (this.config.textFormat === 'percentage') {
        this.progressText.setText(`${percentage}%`);
      } else {
        // Fraction format (999 / 999 style)
        this.progressText.setText(`${percentage} / 100`);
      }
    }
  }

  /**
   * Get current progress value
   * @returns {number} Current progress (0 to 1)
   */
  getProgress() {
    return this.currentProgress;
  }

  /**
   * Clean up resources
   */
  destroy(fromScene) {
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
    }
    super.destroy(fromScene);
  }
}
