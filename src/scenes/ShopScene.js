import BaseTabScene from './BaseTabScene.js';
import ScrollContainer from '../components/ScrollContainer.js';
import ProductCard from '../components/ProductCard.js';
import UIButton from '../components/UIButton.js';
import RewardCelebration from '../components/RewardCelebration.js';
import { api } from '../utils/api.js';
import { gameState } from '../state/gameState.js';
import { playSound } from '../utils/feedback.js';

const CATEGORIES = [
  { key: 'energy', label: 'ENERGY', icon: 'statusbar_energy' },
  { key: 'tickets', label: 'TICKETS', icon: 'statusbar_ticket' },
  { key: 'coins', label: 'COINS', icon: 'statusbar_coin' },
  { key: 'packs', label: 'PACKS', icon: 'icon_picture' }
];

const REWARD_META = {
  energy: { icon: 'statusbar_energy', label: 'Energy' },
  tickets: { icon: 'statusbar_ticket', label: 'Tickets' },
  coins: { icon: 'statusbar_coin', label: 'Coins' },
  sticker_packs: { icon: 'icon_picture', label: 'Sticker Packs' }
};

/**
 * ShopScene — Telegram Stars store.
 * Catalog comes from the server; purchases run through the official
 * Stars flow: createInvoiceLink → WebApp.openInvoice → bot webhook
 * credits on successful_payment → client refreshes stats.
 */
export default class ShopScene extends BaseTabScene {
  constructor() {
    super({
      key: 'ShopScene',
      tabKey: 'shop',
      title: 'SHOP',
      ribbonTexture: 'ribbon_red',
      showTickets: true
    });
  }

  createContent() {
    this.activeCategory = 'energy';
    this.buyBusy = false;

    this.loadingText = this.add.text(
      this.cameras.main.width / 2,
      (this.contentBounds.top + this.contentBounds.bottom) / 2,
      'Loading shop…',
      {
        fontFamily: 'LINESeed', fontSize: '18px', fill: '#FFFFFF',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }
    ).setOrigin(0.5);

    this.loadCatalog();
  }

  async loadCatalog() {
    try {
      const res = await api.getCatalog();
      this.products = res.products ?? [];
    } catch (error) {
      console.error('Failed to load catalog:', error);
      this.loadingText?.setText('Could not load the shop.\nCheck your connection!');
      return;
    }
    this.loadingText?.destroy();
    this.loadingText = null;
    this.buildCategoryTabs();
    this.buildGrid();
  }

  buildCategoryTabs() {
    const width = this.cameras.main.width;
    const tabWidth = Math.min((width - 40) / CATEGORIES.length, 90);
    const startX = width / 2 - ((CATEGORIES.length - 1) * (tabWidth + 6)) / 2;
    const y = this.contentBounds.top + 24;

    this.categoryButtons = {};
    CATEGORIES.forEach((cat, i) => {
      const button = new UIButton(this, startX + i * (tabWidth + 6), y, {
        texture: cat.key === this.activeCategory ? 'btn_yellow' : 'btn_gray',
        label: cat.label,
        width: tabWidth,
        height: 46,
        fontSize: 13,
        onTap: () => this.selectCategory(cat.key)
      });
      this.add.existing(button);
      this.categoryButtons[cat.key] = button;
    });
  }

  selectCategory(key) {
    if (this.activeCategory === key) return;
    this.activeCategory = key;
    for (const [catKey, button] of Object.entries(this.categoryButtons)) {
      button.bg.setTexture(catKey === key ? 'btn_yellow' : 'btn_gray');
    }
    this.buildGrid();
  }

  buildGrid() {
    const width = this.cameras.main.width;

    if (this.scroll) {
      this.scroll.destroy();
      this.scroll = null;
    }

    const gridTop = this.contentBounds.top + 54;
    this.scroll = new ScrollContainer(this, {
      x: 0,
      y: gridTop,
      width,
      height: this.contentBounds.bottom - gridTop
    });
    this.add.existing(this.scroll);

    const items = this.products.filter((p) => p.category === this.activeCategory);
    const cols = 2;
    const gapX = 14;
    const gapY = 16;
    const startX = width / 2 - (ProductCard.WIDTH + gapX) / 2;

    items.forEach((product, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const card = new ProductCard(
        this,
        startX + col * (ProductCard.WIDTH + gapX),
        20 + ProductCard.HEIGHT / 2 + row * (ProductCard.HEIGHT + gapY),
        product,
        { onBuy: (p, cardRef) => this.buy(p, cardRef) }
      );
      this.scroll.addItem(card);
    });

    const rows = Math.ceil(items.length / cols);
    this.scroll.setContentHeight(40 + rows * (ProductCard.HEIGHT + gapY));
  }

  async buy(product, card) {
    if (this.buyBusy) return;
    this.buyBusy = true;
    card.setBusy(true);

    try {
      const res = await api.createInvoice(product.id);

      if (res.mock) {
        // Dev mode: simulate a successful payment
        await new Promise((resolve) => setTimeout(resolve, 800));
        this.applyPurchase(product);
        return;
      }

      await new Promise((resolve, reject) => {
        if (!window.Telegram?.WebApp?.openInvoice) {
          reject(new Error('not_in_telegram'));
          return;
        }
        window.Telegram.WebApp.openInvoice(res.invoice_link, (status) => {
          if (status === 'paid') resolve();
          else if (status === 'cancelled') reject(new Error('cancelled'));
          else reject(new Error(status));
        });
      });

      // Credit happens via the bot webhook — poll for the new balances
      await this.refreshStatsWithRetry();
      this.applyPurchase(product, { skipLocalCredit: true });
    } catch (error) {
      if (error.message !== 'cancelled') {
        console.error('Purchase failed:', error);
        this.showToast(error.message === 'not_in_telegram'
          ? 'Purchases only work inside Telegram'
          : 'Payment failed — you were not charged');
      }
    } finally {
      this.buyBusy = false;
      if (card.scene) card.setBusy(false);
    }
  }

  /** Pull authoritative stats until the webhook credit lands. */
  async refreshStatsWithRetry(tries = 4) {
    for (let i = 0; i < tries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      try {
        const res = await api.auth();
        const s = res.stats;
        if (s && typeof s.coins === 'number') {
          gameState.coins.set(s.coins);
          gameState.gems.set(s.gems ?? gameState.gems.get());
          gameState.energy.set(s.energy ?? gameState.energy.get());
          gameState.tickets.set(s.tickets ?? gameState.tickets.get());
          if (typeof s.xp === 'number') gameState.xp.set(s.xp);
          if (typeof s.user_level === 'number') gameState.level.set(s.user_level);
          if (typeof s.sticker_packs === 'number') gameState.stickerPacks.set(s.sticker_packs);
          return;
        }
      } catch { /* retry */ }
    }
  }

  applyPurchase(product, { skipLocalCredit = false } = {}) {
    const rows = [];
    for (const [key, amount] of Object.entries(product.reward)) {
      if (!amount) continue;
      const meta = REWARD_META[key];
      rows.push({ icon: meta.icon, amount, label: meta.label });
      if (!skipLocalCredit) {
        if (key === 'coins') gameState.coins.add(amount);
        if (key === 'energy') gameState.energy.add(amount);
        if (key === 'tickets') gameState.tickets.add(amount);
        if (key === 'sticker_packs') gameState.stickerPacks.add(amount);
      }
    }
    if (!skipLocalCredit) gameState.xp.add(100);

    playSound(this, 'mega_jackpot_sound');
    RewardCelebration.show(this, { title: 'THANK YOU!', rewards: rows });
  }
}
