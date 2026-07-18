import Phaser from 'phaser';

/**
 * ScrollContainer — vertically scrollable, masked content region with
 * drag + momentum + rubber-band clamping. The key list primitive for
 * Earn / Shop / Stickers / Leaderboard.
 *
 * Content is added with addItem(gameObject) — items keep their own x,
 * their y is treated as a position INSIDE the scroll space.
 *
 * @example
 * const scroll = new ScrollContainer(scene, {
 *   x: 0, y: 170, width: scene.scale.width, height: 500
 * });
 * scroll.addItem(card);       // card.y = position within content
 * scroll.setContentHeight(900);
 */
export default class ScrollContainer extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.viewWidth = config.width ?? scene.scale.width;
    this.viewHeight = config.height ?? 400;
    this.contentHeight = config.contentHeight ?? 0;

    // Drag hit zone FIRST (bottom of display list) so interactive
    // content items (buttons/cards) on top still receive their taps;
    // drags on empty areas fall through to the zone.
    this.hitZone = scene.add.zone(this.viewWidth / 2, this.viewHeight / 2, this.viewWidth, this.viewHeight)
      .setOrigin(0.5)
      .setInteractive();
    this.add(this.hitZone);

    // Inner container that actually moves
    this.content = scene.add.container(0, 0);
    this.add(this.content);

    // Geometry mask (same technique as LoadingSlider)
    this.maskShape = scene.add.graphics().setVisible(false);
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillRect(this.x, this.y, this.viewWidth, this.viewHeight);
    this.content.setMask(new Phaser.Display.Masks.GeometryMask(scene, this.maskShape));

    // Drag state
    this.isDragging = false;
    this.dragStartY = 0;
    this.contentStartY = 0;
    this.velocity = 0;
    this.lastMoveY = 0;
    this.lastMoveTime = 0;

    this.hitZone.on('pointerdown', (pointer) => {
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.contentStartY = this.content.y;
      this.velocity = 0;
      this.lastMoveY = pointer.y;
      this.lastMoveTime = scene.time.now;
      if (this.momentumTween) {
        this.momentumTween.stop();
        this.momentumTween = null;
      }
    });

    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);

    scene.events.once('shutdown', () => this.cleanup(scene));
    scene.events.once('destroy', () => this.cleanup(scene));
  }

  cleanup(scene) {
    scene.input.off('pointermove', this.onPointerMove, this);
    scene.input.off('pointerup', this.onPointerUp, this);
    if (this.maskShape) {
      this.maskShape.destroy();
      this.maskShape = null;
    }
  }

  onPointerMove(pointer) {
    if (!this.isDragging) return;
    const delta = pointer.y - this.dragStartY;
    let targetY = this.contentStartY + delta;

    // Rubber-band beyond bounds
    const minY = this.minContentY();
    if (targetY > 0) targetY = targetY * 0.35;
    if (targetY < minY) targetY = minY + (targetY - minY) * 0.35;
    this.content.y = targetY;

    // Velocity sampling
    const now = this.scene.time.now;
    const dt = now - this.lastMoveTime;
    if (dt > 0) {
      this.velocity = (pointer.y - this.lastMoveY) / dt; // px per ms
      this.lastMoveY = pointer.y;
      this.lastMoveTime = now;
    }
  }

  onPointerUp() {
    if (!this.isDragging) return;
    this.isDragging = false;

    const minY = this.minContentY();
    const outOfBounds = this.content.y > 0 || this.content.y < minY;
    if (outOfBounds) {
      this.snapBack();
      return;
    }

    // Momentum: decay velocity into a tween
    const momentum = this.velocity * 300; // px of travel
    if (Math.abs(momentum) > 10) {
      const target = Phaser.Math.Clamp(this.content.y + momentum, minY, 0);
      this.momentumTween = this.scene.tweens.add({
        targets: this.content,
        y: target,
        duration: 500,
        ease: 'Cubic.easeOut'
      });
    }
  }

  snapBack() {
    const minY = this.minContentY();
    const target = Phaser.Math.Clamp(this.content.y, minY, 0);
    this.momentumTween = this.scene.tweens.add({
      targets: this.content,
      y: target,
      duration: 300,
      ease: 'Cubic.easeOut'
    });
  }

  minContentY() {
    return Math.min(0, this.viewHeight - this.contentHeight);
  }

  /** Add a game object into the scroll space (its y = content-space position). */
  addItem(gameObject) {
    this.content.add(gameObject);
    return gameObject;
  }

  /** Remove all content items. */
  clearItems() {
    this.content.removeAll(true);
    this.content.y = 0;
  }

  setContentHeight(height) {
    this.contentHeight = height;
  }

  scrollTo(y, animate = false) {
    const target = Phaser.Math.Clamp(-y, this.minContentY(), 0);
    if (animate) {
      this.scene.tweens.add({ targets: this.content, y: target, duration: 300, ease: 'Cubic.easeOut' });
    } else {
      this.content.y = target;
    }
  }
}
