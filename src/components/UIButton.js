import Phaser from 'phaser';
import { playSound, hapticImpact } from '../utils/feedback.js';

/**
 * UIButton — NineSlice button with Tilt Warp label, optional icon,
 * press tween, button sound + haptics, and a disabled state.
 *
 * Textures: any Button01_Demo_[Color] key loaded in LoadingScene
 * (btn_green, btn_yellow, btn_blue, btn_red, btn_gray, btn_sky).
 *
 * @example
 * const btn = new UIButton(scene, x, y, {
 *   texture: 'btn_green', label: 'SPIN — 1', icon: 'statusbar_ticket',
 *   width: 280, height: 80, onTap: () => this.spin()
 * });
 * scene.add.existing(btn);
 */
export default class UIButton extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    this.config = {
      texture: config.texture || 'btn_green',
      label: config.label ?? '',
      icon: config.icon || null,
      iconSize: config.iconSize || 32,
      width: config.width || 240,
      height: config.height || 72,
      fontSize: config.fontSize || 24,
      textColor: config.textColor || '#FFFFFF',
      sound: config.sound !== false,
      haptic: config.haptic !== false,
      onTap: config.onTap || (() => {})
    };
    this.enabled = config.enabled !== false;

    this.bg = scene.add.nineslice(
      0, 0, this.config.texture, null,
      this.config.width, this.config.height,
      20, 20, 20, 20
    ).setOrigin(0.5);
    this.add(this.bg);

    this.labelText = scene.add.text(0, -2, this.config.label, {
      fontFamily: 'Tilt Warp',
      fontSize: `${this.config.fontSize}px`,
      fill: this.config.textColor,
      stroke: '#000000',
      strokeThickness: 4,
      padding: { x: 10, y: 10 },
      resolution: 2
    }).setOrigin(0.5);
    this.add(this.labelText);

    if (this.config.icon) {
      this.iconImage = scene.add.image(0, 0, this.config.icon)
        .setDisplaySize(this.config.iconSize, this.config.iconSize);
      this.add(this.iconImage);
      this.layoutIconAndLabel();
    }

    this.setSize(this.config.width, this.config.height);
    this.setInteractive({ useHandCursor: true });

    this.on('pointerdown', () => {
      if (!this.enabled) return;
      scene.tweens.add({
        targets: this,
        scaleX: 0.92,
        scaleY: 0.92,
        duration: 80,
        yoyo: true,
        ease: 'Back.out'
      });
      if (this.config.sound) playSound(scene, 'button_sound');
      if (this.config.haptic) hapticImpact('light');
      this.config.onTap();
    });

    this.applyEnabledVisuals();
  }

  layoutIconAndLabel() {
    // Center icon + text as one group
    const gap = 8;
    const textWidth = this.labelText.width;
    const total = this.config.iconSize + gap + textWidth;
    this.iconImage.setPosition(-total / 2 + this.config.iconSize / 2, 0);
    this.labelText.setPosition(-total / 2 + this.config.iconSize + gap + textWidth / 2, -2);
  }

  setLabel(text) {
    this.labelText.setText(text);
    if (this.iconImage) this.layoutIconAndLabel();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.applyEnabledVisuals();
  }

  applyEnabledVisuals() {
    if (this.enabled) {
      this.bg.clearTint();
      this.setAlpha(1);
    } else {
      this.bg.setTint(0x888888);
      this.setAlpha(0.75);
    }
  }
}
