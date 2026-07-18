import Phaser from 'phaser';
import { playSound, hapticImpact } from '../utils/feedback.js';

/**
 * ModalShell — base class for modal dialogs, generalized from the
 * SettingsModal pattern: fullscreen dim overlay + popup panel +
 * ribbon title + close button, with fade/scale show/hide animations.
 *
 * Subclasses (or callers) add content into `this.panel` (a container
 * centered on screen). Coordinates inside the panel are relative to
 * its center.
 *
 * Required textures (already loaded): settings_modal_bg,
 * settings_header_ribbon, settings_close_btn.
 *
 * @example
 * class MyModal extends ModalShell {
 *   constructor(scene) {
 *     super(scene, { title: 'DAILY TOP 100', panelWidth: 340, panelHeight: 520 });
 *     // add content: this.panel.add(...)
 *   }
 * }
 */
export default class ModalShell extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    super(scene, 0, 0);

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;

    this.config = {
      title: config.title ?? '',
      panelWidth: config.panelWidth ?? Math.min(width - 40, 360),
      panelHeight: config.panelHeight ?? 480,
      ribbonTexture: config.ribbonTexture ?? 'settings_header_ribbon',
      panelTexture: config.panelTexture ?? 'settings_modal_bg',
      closeButton: config.closeButton !== false,
      onClose: config.onClose ?? (() => {})
    };

    // Dim overlay — blocks input to the scene behind
    this.overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setInteractive();
    this.add(this.overlay);

    // Centered panel container
    this.panel = scene.add.container(width / 2, height / 2);
    this.add(this.panel);

    this.panelBg = scene.add.nineslice(
      0, 0, this.config.panelTexture, null,
      this.config.panelWidth, this.config.panelHeight,
      30, 30, 40, 40
    ).setOrigin(0.5);
    this.panel.add(this.panelBg);

    // Ribbon title across the top of the panel
    if (this.config.title) {
      this.ribbon = scene.add.image(0, -this.config.panelHeight / 2 + 6, this.config.ribbonTexture)
        .setOrigin(0.5)
        .setDisplaySize(Math.min(this.config.panelWidth * 0.85, 300), 64);
      this.panel.add(this.ribbon);

      this.titleText = scene.add.text(0, -this.config.panelHeight / 2 + 2, this.config.title, {
        fontFamily: 'Tilt Warp',
        fontSize: '22px',
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 4,
        padding: { x: 10, y: 10 },
        resolution: 2
      }).setOrigin(0.5);
      this.panel.add(this.titleText);
    }

    if (this.config.closeButton) {
      this.closeBtn = scene.add.image(
        this.config.panelWidth / 2 - 14,
        -this.config.panelHeight / 2 + 14,
        'settings_close_btn'
      ).setDisplaySize(44, 44).setInteractive({ useHandCursor: true });
      this.closeBtn.on('pointerdown', () => {
        playSound(scene, 'button_sound');
        hapticImpact('light');
        this.hide();
      });
      this.panel.add(this.closeBtn);
    }

    this.setDepth(2500);
    this.setVisible(false);
    this.setAlpha(0);
    this.isShown = false;
  }

  show() {
    if (this.isShown) return;
    this.isShown = true;
    this.setVisible(true);
    this.panel.setScale(0.8);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 200, ease: 'Power2' });
    this.scene.tweens.add({
      targets: this.panel,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      ease: 'Back.out'
    });
    this.onShow();
  }

  hide() {
    if (!this.isShown) return;
    this.isShown = false;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.setVisible(false);
        this.config.onClose();
        this.onHide();
      }
    });
  }

  /** Hooks for subclasses (e.g. refresh data on open). */
  onShow() {}
  onHide() {}
}
