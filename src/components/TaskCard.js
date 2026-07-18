import Phaser from 'phaser';
import UIButton from './UIButton.js';

/**
 * TaskCard — one row in the Earn task list.
 * ListFrame background, left icon, title + reward line, right button.
 *
 * States: 'available' (GO/CLAIM green), 'claimable' (yellow, pulsing),
 * 'locked' (gray, shows progress), 'done'/'done_today' (dimmed check).
 *
 * @example
 * const card = new TaskCard(scene, x, y, {
 *   width: 340, icon: 'statusbar_energy', title: 'Watch an Ad',
 *   rewardText: '+5 Energy (2/3)', state: 'available',
 *   buttonLabel: 'GO', onAction: () => {...}
 * });
 */
export default class TaskCard extends Phaser.GameObjects.Container {
  static HEIGHT = 92;

  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    const width = config.width ?? scene.scale.width - 30;
    const height = config.height ?? TaskCard.HEIGHT;
    this.cardWidth = width;
    this.cardHeight = height;

    this.bg = scene.add.nineslice(0, 0, 'list_frame', null, width, height, 20, 20, 20, 20)
      .setOrigin(0.5)
      .setTint(0x2a3550);
    this.add(this.bg);

    this.icon = scene.add.image(-width / 2 + 40, 0, config.icon ?? 'statusbar_coin')
      .setDisplaySize(44, 44);
    this.add(this.icon);

    this.titleText = scene.add.text(-width / 2 + 72, -14, config.title ?? '', {
      fontFamily: 'LINESeed',
      fontSize: '16px',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2
    }).setOrigin(0, 0.5);
    this.add(this.titleText);

    this.rewardText = scene.add.text(-width / 2 + 72, 12, config.rewardText ?? '', {
      fontFamily: 'LINESeed',
      fontSize: '14px',
      fill: '#FFD700',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
      wordWrap: { width: width - 200 }
    }).setOrigin(0, 0.5);
    this.add(this.rewardText);

    this.buildAction(scene, config);
    this.applyState(scene, config.state ?? 'available');
  }

  buildAction(scene, config) {
    const buttonX = this.cardWidth / 2 - 62;
    const state = config.state ?? 'available';

    if (state === 'done' || state === 'done_today') {
      this.checkIcon = scene.add.image(buttonX, 0, 'icon_check').setDisplaySize(36, 36);
      this.add(this.checkIcon);
      return;
    }

    if (state === 'locked') {
      this.lockedText = scene.add.text(buttonX, 0, config.lockedText ?? '', {
        fontFamily: 'LINESeed',
        fontSize: '13px',
        fill: '#AAAAAA',
        align: 'center',
        resolution: 2
      }).setOrigin(0.5);
      this.add(this.lockedText);
      return;
    }

    const texture = state === 'claimable' ? 'btn_yellow' : 'btn_green';
    this.button = new UIButton(scene, buttonX, 0, {
      texture,
      label: config.buttonLabel ?? (state === 'claimable' ? 'CLAIM' : 'GO'),
      width: 100,
      height: 54,
      fontSize: 18,
      onTap: () => config.onAction?.(this)
    });
    this.add(this.button);

    if (state === 'claimable') {
      scene.tweens.add({
        targets: this.button,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  applyState(scene, state) {
    if (state === 'done' || state === 'done_today') {
      this.setAlpha(0.6);
    }
  }

  /** Disable the button while a claim request is in flight. */
  setBusy(busy) {
    this.button?.setEnabled(!busy);
  }
}
