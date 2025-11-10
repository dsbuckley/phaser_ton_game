/**
 * ComboBonusDisplay.js
 *
 * Displays a combo bonus notification with two lines:
 * - Line 1: "Combo Bonus"
 * - Line 2: "+X Energy" or "+X Gems"
 *
 * Animates with scale pop-in, floats upward, and fades out.
 */

import Phaser from 'phaser';

export default class ComboBonusDisplay extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene - The scene this component belongs to
   * @param {number} x - X position (center)
   * @param {number} y - Y position (starting position)
   * @param {Object} config - Configuration options
   * @param {string} config.itemType - 'energy' or 'gems'
   * @param {number} config.bonusAmount - Amount of bonus items awarded
   */
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    this.scene = scene;
    this.config = {
      itemType: config.itemType || 'energy',
      bonusAmount: config.bonusAmount || 3,
      ...config
    };

    this.createDisplay();
    this.animateDisplay();
  }

  createDisplay() {
    // Line 1: "Combo Bonus" text
    this.titleText = this.scene.add.text(0, 0, 'Combo Bonus', {
      fontFamily: 'Tilt Warp',
      fontSize: '40px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 6,
      padding: { x: 20, y: 20 },
      resolution: 2
    }).setOrigin(0.5);

    // Line 2: "+X Energy" or "+X Gems" text
    const bonusText = this.config.itemType === 'energy'
      ? `+${this.config.bonusAmount} Energy`
      : `+${this.config.bonusAmount} Gems`;

    // Color-code based on item type
    const fillColor = this.config.itemType === 'energy' ? '#00FF00' : '#FF00FF'; // Green for energy, magenta for gems

    this.bonusText = this.scene.add.text(0, 50, bonusText, {
      fontFamily: 'Tilt Warp',
      fontSize: '48px',
      fill: fillColor,
      stroke: '#000000',
      strokeThickness: 6,
      padding: { x: 20, y: 20 },
      resolution: 2
    }).setOrigin(0.5);

    // Add texts to container
    this.add([this.titleText, this.bonusText]);

    // Start invisible for pop-in animation
    this.setScale(0);
    this.setAlpha(1);
  }

  animateDisplay() {
    // Pop-in animation: scale from 0 → 1.2 → 1.0
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Settle to normal size
        this.scene.tweens.add({
          targets: this,
          scaleX: 1.0,
          scaleY: 1.0,
          duration: 100,
          ease: 'Sine.easeOut'
        });
      }
    });

    // Float upward and fade out
    this.scene.tweens.add({
      targets: this,
      y: this.y - 200, // Float up 200 pixels
      alpha: 0, // Fade to transparent
      duration: 1500, // 1.5 seconds
      delay: 300, // Wait for pop-in to finish
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.destroy(); // Clean up after animation
      }
    });
  }

  /**
   * Show the combo bonus display
   * This is called automatically in the constructor
   */
  show() {
    this.setVisible(true);
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.titleText) this.titleText.destroy();
    if (this.bonusText) this.bonusText.destroy();
    super.destroy();
  }
}
