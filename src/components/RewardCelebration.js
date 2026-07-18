import Phaser from 'phaser';
import { playSound, hapticNotify } from '../utils/feedback.js';

/**
 * RewardCelebration — overlay showing "+N [icon]" reward rows with
 * pop-in animation, used by wheel prizes, task claims, purchases,
 * set completions, and level-ups. Tap anywhere (or wait) to dismiss.
 *
 * @example
 * RewardCelebration.show(scene, {
 *   title: 'YOU WON!',
 *   rewards: [
 *     { icon: 'statusbar_energy', amount: 50, label: 'Energy' },
 *     { icon: 'statusbar_coin', amount: 1000, label: 'Coins' }
 *   ]
 * });
 */
export default class RewardCelebration extends Phaser.GameObjects.Container {
  static show(scene, config = {}) {
    const celebration = new RewardCelebration(scene, config);
    scene.add.existing(celebration);
    return celebration;
  }

  constructor(scene, config = {}) {
    super(scene, 0, 0);

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;
    const rewards = config.rewards ?? [];
    const title = config.title ?? 'REWARDS!';
    const autoCloseMs = config.autoCloseMs ?? 3500;
    this.onDone = config.onDone ?? (() => {});

    this.setDepth(3000);

    // Dim overlay
    this.overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setInteractive();
    this.add(this.overlay);

    // Spinning light burst behind the content
    this.light = scene.add.image(width / 2, height / 2 - 60, 'jackpot_light')
      .setScale(1.4)
      .setAlpha(0.9);
    this.add(this.light);
    scene.tweens.add({ targets: this.light, angle: 360, duration: 6000, repeat: -1, ease: 'Linear' });

    // Title
    this.titleText = scene.add.text(width / 2, height / 2 - 150, title, {
      fontFamily: 'Tilt Warp',
      fontSize: '48px',
      fill: '#FFD700',
      stroke: '#000000',
      strokeThickness: 8,
      padding: { x: 20, y: 20 },
      resolution: 2
    }).setOrigin(0.5).setScale(0);
    this.add(this.titleText);

    scene.tweens.add({
      targets: this.titleText,
      scale: 1,
      duration: 400,
      ease: 'Back.out'
    });

    // Reward rows
    rewards.forEach((reward, i) => {
      const rowY = height / 2 - 60 + i * 70;
      const row = scene.add.container(width / 2, rowY).setScale(0);

      const icon = scene.add.image(-60, 0, reward.icon).setDisplaySize(48, 48);
      const text = scene.add.text(-20, 0, `+${reward.amount} ${reward.label ?? ''}`.trim(), {
        fontFamily: 'Tilt Warp',
        fontSize: '32px',
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 6,
        padding: { x: 10, y: 10 },
        resolution: 2
      }).setOrigin(0, 0.5);
      row.add([icon, text]);
      this.add(row);

      scene.tweens.add({
        targets: row,
        scale: 1,
        duration: 350,
        delay: 200 + i * 150,
        ease: 'Back.out'
      });
    });

    playSound(scene, 'yeah_sound');
    hapticNotify('success');

    // Dismiss on tap or after timeout
    const dismiss = () => this.dismiss();
    this.overlay.once('pointerdown', dismiss);
    this.autoCloseTimer = scene.time.delayedCall(autoCloseMs, dismiss);
  }

  dismiss() {
    if (this.dismissed) return;
    this.dismissed = true;
    if (this.autoCloseTimer) this.autoCloseTimer.remove();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 250,
      ease: 'Power2',
      onComplete: () => {
        this.onDone();
        this.destroy();
      }
    });
  }
}
