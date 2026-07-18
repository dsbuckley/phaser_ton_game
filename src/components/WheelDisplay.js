import Phaser from 'phaser';
import { WHEEL_SEGMENTS, SEGMENT_ANGLE } from '../config/wheel.js';

/**
 * WheelDisplay — the spinning prize wheel.
 *
 * The disc is drawn procedurally once (Graphics → generateTexture) so
 * no wheel art asset is needed; per-segment icons + labels are real
 * game objects inside the rotating container. Swapping in custom
 * wheel art later only means replacing the generated 'wheel_base'
 * texture — the spin logic doesn't change.
 *
 * spinToSegment(index) animates a multi-revolution deceleration that
 * lands on the given (server-decided) segment under the top pointer.
 */
export default class WheelDisplay extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    this.diameter = config.diameter ?? 320;
    this.onTick = config.onTick ?? (() => {});

    this.buildBaseTexture(scene);

    // Rotating part: disc + icons + labels
    this.wheel = scene.add.container(0, 0);
    this.add(this.wheel);

    const disc = scene.add.image(0, 0, 'wheel_base');
    disc.setDisplaySize(this.diameter, this.diameter);
    this.wheel.add(disc);

    const radius = this.diameter / 2;
    for (const segment of WHEEL_SEGMENTS) {
      // Center angle of this segment (segment 0 starts at the top)
      const angleDeg = -90 + segment.index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
      const angleRad = Phaser.Math.DegToRad(angleDeg);

      const iconR = radius * 0.72;
      const icon = scene.add.image(Math.cos(angleRad) * iconR, Math.sin(angleRad) * iconR, segment.icon)
        .setDisplaySize(34, 34)
        .setRotation(angleRad + Math.PI / 2);
      this.wheel.add(icon);

      const labelR = radius * 0.48;
      const label = scene.add.text(Math.cos(angleRad) * labelR, Math.sin(angleRad) * labelR, segment.label, {
        fontFamily: 'Tilt Warp',
        fontSize: segment.label.length > 4 ? '13px' : '18px',
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 4,
        resolution: 2
      }).setOrigin(0.5).setRotation(angleRad + Math.PI / 2);
      this.wheel.add(label);
    }

    // Static rim + hub + pointer (do not rotate)
    const rim = scene.add.graphics();
    rim.lineStyle(10, 0xffd700, 1);
    rim.strokeCircle(0, 0, radius + 2);
    rim.lineStyle(3, 0x7c4a03, 1);
    rim.strokeCircle(0, 0, radius + 8);
    this.add(rim);

    const hub = scene.add.circle(0, 0, radius * 0.16, 0xffd700)
      .setStrokeStyle(4, 0x7c4a03);
    this.add(hub);
    const hubIcon = scene.add.image(0, 0, 'statusbar_ticket').setDisplaySize(radius * 0.18, radius * 0.18);
    this.add(hubIcon);

    // Pointer at 12 o'clock
    this.pointer = scene.add.graphics();
    this.pointer.fillStyle(0xef4444, 1);
    this.pointer.lineStyle(3, 0x7f1d1d, 1);
    this.pointer.beginPath();
    this.pointer.moveTo(-16, -radius - 18);
    this.pointer.lineTo(16, -radius - 18);
    this.pointer.lineTo(0, -radius + 12);
    this.pointer.closePath();
    this.pointer.fillPath();
    this.pointer.strokePath();
    this.add(this.pointer);

    this.isSpinning = false;
  }

  buildBaseTexture(scene) {
    if (scene.textures.exists('wheel_base')) return;
    const size = 640;
    const r = size / 2;
    const g = scene.add.graphics().setVisible(false);
    for (const segment of WHEEL_SEGMENTS) {
      const start = Phaser.Math.DegToRad(-90 + segment.index * SEGMENT_ANGLE);
      const end = Phaser.Math.DegToRad(-90 + (segment.index + 1) * SEGMENT_ANGLE);
      g.fillStyle(segment.color, 1);
      g.slice(r, r, r - 4, start, end, false);
      g.fillPath();
      g.lineStyle(4, 0xffffff, 0.85);
      g.slice(r, r, r - 4, start, end, false);
      g.strokePath();
    }
    g.generateTexture('wheel_base', size, size);
    g.destroy();
  }

  /**
   * Spin to the given segment index. Resolves when the wheel stops.
   */
  spinToSegment(index, { revolutions = 5, duration = 3800 } = {}) {
    if (this.isSpinning) return Promise.resolve();
    this.isSpinning = true;

    // Angle that puts the CENTER of `index` under the top pointer
    const jitter = Phaser.Math.FloatBetween(-SEGMENT_ANGLE * 0.3, SEGMENT_ANGLE * 0.3);
    const target = 360 * revolutions - (index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2) + jitter;

    const startAngle = this.wheel.angle;
    let lastTickSegment = -1;

    return new Promise((resolve) => {
      this.activeTween = this.scene.tweens.add({
        targets: this.wheel,
        angle: startAngle + target - (startAngle % 360),
        duration,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          const seg = Math.floor(((-this.wheel.angle % 360) + 360) % 360 / SEGMENT_ANGLE);
          if (seg !== lastTickSegment) {
            lastTickSegment = seg;
            this.onTick();
          }
        },
        onComplete: () => {
          this.isSpinning = false;
          this.activeTween = null;
          // Pointer bounce
          this.scene.tweens.add({
            targets: this.pointer,
            y: 6,
            duration: 90,
            yoyo: true,
            ease: 'Bounce.easeOut'
          });
          resolve();
        }
      });
    });
  }

  /** Snap the current spin to its end (used when a throttled tab times out). */
  finishNow() {
    if (this.activeTween) {
      this.activeTween.complete();
    }
  }
}
