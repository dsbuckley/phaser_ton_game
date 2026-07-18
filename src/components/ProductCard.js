import Phaser from 'phaser';
import UIButton from './UIButton.js';

const CATEGORY_ICONS = {
  energy: 'statusbar_energy',
  tickets: 'statusbar_ticket',
  coins: 'statusbar_coin',
  packs: 'icon_picture'
};

const CATEGORY_TINTS = {
  energy: 0x2b4a7a,
  tickets: 0x2b6a5a,
  coins: 0x7a5a2b,
  packs: 0x5a2b7a
};

function formatAmount(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
  return `${amount}`;
}

/**
 * ProductCard — one Stars product in the shop grid.
 * Icon cluster (bigger packs = more icons), amount, bonus label,
 * POPULAR/BEST VALUE ribbon, and a "⭐ N" buy button.
 */
export default class ProductCard extends Phaser.GameObjects.Container {
  static WIDTH = 165;
  static HEIGHT = 200;

  constructor(scene, x, y, product, { onBuy } = {}) {
    super(scene, x, y);
    this.product = product;

    const w = ProductCard.WIDTH;
    const h = ProductCard.HEIGHT;

    this.bg = scene.add.nineslice(0, 0, 'item_frame_white', null, w, h, 20, 20, 20, 20)
      .setOrigin(0.5)
      .setTint(CATEGORY_TINTS[product.category] ?? 0x2a3550);
    this.add(this.bg);

    // Icon cluster: 1-3 icons based on package size
    const icon = CATEGORY_ICONS[product.category] ?? 'statusbar_coin';
    const iconCount = product.bonusPct >= 100 ? 3 : product.bonusPct >= 25 ? 2 : 1;
    const size = 44;
    for (let i = 0; i < iconCount; i++) {
      const offset = (i - (iconCount - 1) / 2) * 20;
      this.add(scene.add.image(offset, -h / 2 + 52 + (i % 2) * 6, icon).setDisplaySize(size, size));
    }

    // Amount
    this.add(scene.add.text(0, -18, formatAmount(product.amount), {
      fontFamily: 'Tilt Warp',
      fontSize: '26px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 5,
      resolution: 2
    }).setOrigin(0.5));

    // Bonus label
    if (product.bonusPct) {
      this.add(scene.add.text(0, 12, `+${product.bonusPct}% BONUS`, {
        fontFamily: 'LINESeed',
        fontSize: '13px',
        fontStyle: 'bold',
        fill: '#4ADE80',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: 2
      }).setOrigin(0.5));
    }

    // Buy button with Stars price
    this.buyButton = new UIButton(scene, 0, h / 2 - 34, {
      texture: 'btn_yellow',
      label: `⭐ ${product.stars}`,
      width: w - 30,
      height: 48,
      fontSize: 19,
      onTap: () => onBuy?.(product, this)
    });
    this.add(this.buyButton);

    // Ribbon
    if (product.ribbon) {
      const ribbonTexture = product.ribbon === 'best' ? 'ribbon_yellow' : 'ribbon_magenta';
      const label = product.ribbon === 'best' ? 'BEST VALUE' : 'POPULAR';
      this.add(scene.add.image(0, -h / 2 + 4, ribbonTexture).setDisplaySize(w - 10, 36));
      this.add(scene.add.text(0, -h / 2 + 1, label, {
        fontFamily: 'Tilt Warp',
        fontSize: '12px',
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: 2
      }).setOrigin(0.5));
    }
  }

  setBusy(busy) {
    this.buyButton.setEnabled(!busy);
  }
}
