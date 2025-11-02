/**
 * BatteryBar Component
 *
 * A reusable horizontal battery/energy bar with icon and text overlay.
 * Uses NineSlice technique for scalable bar rendering without distortion.
 *
 * Features:
 * - Battery icon on the left side
 * - Progress bar with background and fill (NineSlice)
 * - Text overlay showing current/max format (e.g., "100/100")
 * - Smooth animations with tweens
 * - GeometryMask for progressive fill reveal
 *
 * Usage:
 * ```javascript
 * const batteryBar = new BatteryBar(scene, x, y, {
 *   width: 350,
 *   height: 50,
 *   iconTexture: 'battery_icon',
 *   currentValue: 100,
 *   maxValue: 100
 * });
 * scene.add.existing(batteryBar);
 * batteryBar.setBattery(75, 100, true); // Animate to 75%
 * ```
 */

export default class BatteryBar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    // Default configuration
    this.config = {
      bgTexture: config.bgTexture || 'slider_bg',
      fillTexture: config.fillTexture || 'slider_fill_green',
      iconTexture: config.iconTexture || 'battery_icon',
      width: config.width || 350,
      height: config.height || 50,
      iconSize: config.iconSize || 40,
      iconOffsetX: config.iconOffsetX || -20,
      showText: config.showText !== undefined ? config.showText : true,
      fontFamily: config.fontFamily || 'LINESeed',
      fontSize: config.fontSize || '20px',
      textColor: config.textColor || '#ffffff',
      textStroke: config.textStroke || '#000000',
      textStrokeThickness: config.textStrokeThickness || 4,
      currentValue: config.currentValue || 100,
      maxValue: config.maxValue || 100,
      ...config
    };

    this.currentProgress = 0;

    this.createBar();
    this.createIcon();
    this.createText();
    this.createMask();

    // Set initial battery values
    const initialProgress = this.config.currentValue / this.config.maxValue;
    this.setProgress(initialProgress, false);
  }

  /**
   * Creates the background and fill bars using NineSlice
   */
  createBar() {
    const { width, height, bgTexture, fillTexture } = this.config;

    // Background bar (NineSlice prevents distortion)
    // Adjusted slice values for thinner bars to prevent corner artifacts
    // Background asset: 26x68px, but we scale down vertical slices for thin bars
    this.background = this.scene.add.nineslice(
      0, 0,
      bgTexture, null,
      width, height,
      13, 13, 17, 17  // Reduced vertical slices to prevent black dots
    ).setOrigin(0.5);

    // Fill bar (NineSlice, left-aligned for mask reveal)
    // Fill asset: 18x60px, scaled down vertical slices
    this.fill = this.scene.add.nineslice(
      -width / 2, 0,
      fillTexture, null,
      width, height,
      9, 9, 15, 15  // Reduced vertical slices to prevent black dots
    ).setOrigin(0, 0.5);

    this.add([this.background, this.fill]);
  }

  /**
   * Creates the battery icon on the left side
   */
  createIcon() {
    const { iconTexture, iconSize, iconOffsetX, width } = this.config;

    // Position icon on the left edge of the bar, overlapping slightly
    // iconOffsetX should be positive to move icon to the right from the left edge
    const iconX = -width / 2 + iconSize / 2 + iconOffsetX;

    this.icon = this.scene.add.image(iconX, 0, iconTexture)
      .setOrigin(0.5)
      .setDisplaySize(iconSize, iconSize);

    this.add(this.icon);
  }

  /**
   * Creates the text overlay showing current/max values
   */
  createText() {
    const { showText, fontFamily, fontSize, textColor, textStroke, textStrokeThickness } = this.config;

    if (!showText) return;

    this.progressText = this.scene.add.text(0, 0, '', {
      fontFamily: fontFamily,
      fontSize: fontSize,
      fill: textColor,
      stroke: textStroke,
      strokeThickness: textStrokeThickness,
      align: 'center',
      resolution: 2,
      padding: { x: 10, y: 10 }
    }).setOrigin(0.5);

    this.add(this.progressText);
    this.updateText();
  }

  /**
   * Creates the geometry mask for progressive fill reveal
   */
  createMask() {
    // Graphics object for mask shape
    this.maskGraphics = this.scene.add.graphics();

    // Create geometry mask that controls fill visibility
    const mask = new Phaser.Display.Masks.GeometryMask(this.scene, this.maskGraphics);
    this.fill.setMask(mask);

    // Update mask to initial progress
    this.updateMask(this.currentProgress);
  }

  /**
   * Updates the geometry mask based on progress (0-1)
   */
  updateMask(progress) {
    const { width, height } = this.config;
    const fillWidth = width * progress;

    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);

    // Draw mask rectangle from left edge (reveals fill width-wise)
    const maskX = this.x - width / 2;
    const maskY = this.y - height / 2;
    this.maskGraphics.fillRect(maskX, maskY, fillWidth, height);
  }

  /**
   * Updates the text display with current/max format
   */
  updateText() {
    if (!this.progressText) return;

    const { currentValue, maxValue } = this.config;
    this.progressText.setText(`${currentValue}/${maxValue}`);
  }

  /**
   * Sets the battery level with optional animation
   * @param {number} current - Current battery value
   * @param {number} max - Maximum battery value (optional)
   * @param {boolean} animate - Whether to animate the change
   */
  setBattery(current, max = null, animate = true) {
    // Update max value if provided
    if (max !== null) {
      this.config.maxValue = max;
    }

    // Update current value
    this.config.currentValue = current;

    // Calculate progress (0-1)
    const progress = current / this.config.maxValue;

    // Update progress with or without animation
    this.setProgress(progress, animate);
  }

  /**
   * Sets the progress directly (0-1) with optional animation
   * @param {number} value - Progress value between 0 and 1
   * @param {boolean} animate - Whether to animate the change
   */
  setProgress(value, animate = true) {
    const clampedValue = Phaser.Math.Clamp(value, 0, 1);

    if (animate) {
      // Animate progress change
      this.scene.tweens.add({
        targets: this,
        currentProgress: clampedValue,
        duration: 500,
        ease: 'Power2',
        onUpdate: () => {
          this.updateVisuals();
        }
      });
    } else {
      // Instant update
      this.currentProgress = clampedValue;
      this.updateVisuals();
    }
  }

  /**
   * Updates all visual elements (mask and text)
   */
  updateVisuals() {
    this.updateMask(this.currentProgress);
    this.updateText();
  }

  /**
   * Gets the current progress value (0-1)
   * @returns {number}
   */
  getProgress() {
    return this.currentProgress;
  }

  /**
   * Gets the current battery values
   * @returns {object} { current, max, progress }
   */
  getBatteryValues() {
    return {
      current: this.config.currentValue,
      max: this.config.maxValue,
      progress: this.currentProgress
    };
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy(fromScene) {
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
    }
    super.destroy(fromScene);
  }
}
