import Phaser from 'phaser';
import BaseTabScene from './BaseTabScene.js';
import ScrollContainer from '../components/ScrollContainer.js';
import UIButton from '../components/UIButton.js';
import RewardCelebration from '../components/RewardCelebration.js';
import { STICKER_SETS, stickerById, SET_REWARD } from '../config/stickers.js';
import { api } from '../utils/api.js';
import { gameState } from '../state/gameState.js';
import { setTabNotification } from '../config/tabs.js';
import { playSound, hapticNotify } from '../utils/feedback.js';

const RARITY_COLORS = {
  1: 0x9ca3af, // gray
  2: 0x4ade80, // green
  3: 0x38a3e0, // blue
  4: 0xa78bfa, // purple
  5: 0xfbbf24  // gold
};

/**
 * StickersScene — Boinkers-style sticker album:
 * themed sets of 6, star rarities, pack openings with card flips,
 * complete-a-set rewards. Ownership + rolls are 100% server-side;
 * duplicates auto-convert to coins.
 */
export default class StickersScene extends BaseTabScene {
  constructor() {
    super({
      key: 'StickersScene',
      tabKey: 'stickers',
      title: 'STICKER ALBUM',
      ribbonTexture: 'ribbon_green'
    });
  }

  createContent() {
    this.owned = {};
    this.claimedSets = new Set();
    this.busy = false;

    this.loadingText = this.add.text(
      this.cameras.main.width / 2,
      (this.contentBounds.top + this.contentBounds.bottom) / 2,
      'Loading album…',
      {
        fontFamily: 'LINESeed', fontSize: '18px', fill: '#FFFFFF',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }
    ).setOrigin(0.5);

    this.refresh();
  }

  async refresh() {
    try {
      const album = await api.getAlbum();
      this.owned = album.owned ?? {};
      this.claimedSets = new Set(album.claimed_sets ?? []);
      if (typeof album.packs === 'number') {
        gameState.stickerPacks.set(album.packs);
      }
    } catch (error) {
      console.error('Failed to load album:', error);
      this.loadingText?.setText('Could not load the album.\nCheck your connection!');
      return;
    }
    this.loadingText?.destroy();
    this.loadingText = null;
    this.buildAlbum();
  }

  ownedCountInSet(set) {
    return set.stickers.filter((s) => this.owned[s.id]).length;
  }

  totalOwned() {
    return STICKER_SETS.reduce((sum, set) => sum + this.ownedCountInSet(set), 0);
  }

  // ---------------------------------------------------------------
  // Album view
  // ---------------------------------------------------------------

  buildAlbum() {
    const width = this.cameras.main.width;
    const centerX = width / 2;

    this.detailContainer?.destroy();
    this.detailContainer = null;
    this.albumUI?.destroy();

    this.albumUI = this.add.container(0, 0);

    // Header: overall progress + open-pack button
    const total = STICKER_SETS.length * 6;
    const collected = this.totalOwned();
    const headerY = this.contentBounds.top + 16;

    const progressBg = this.add.nineslice(centerX - 60, headerY, 'slider_bg', null, 200, 34, 13, 13, 17, 17).setOrigin(0.5);
    const fraction = collected / total;
    const fillW = Math.max(200 * fraction, 20);
    const progressFill = this.add.nineslice(centerX - 60 - 100 + fillW / 2, headerY, 'slider_fill_green', null, fillW, 26, 9, 9, 15, 15).setOrigin(0.5);
    const progressText = this.add.text(centerX - 60, headerY, `${collected}/${total}`, {
      fontFamily: 'LINESeed', fontSize: '14px', fontStyle: 'bold', fill: '#FFFFFF',
      stroke: '#000000', strokeThickness: 3, resolution: 2
    }).setOrigin(0.5);
    this.albumUI.add([progressBg, progressFill, progressText]);

    const packs = gameState.stickerPacks.get();
    this.openPackButton = new UIButton(this, centerX + 105, headerY, {
      texture: packs > 0 ? 'btn_yellow' : 'btn_gray',
      label: `OPEN (${packs})`,
      width: 130,
      height: 46,
      fontSize: 15,
      onTap: () => this.openPack()
    });
    this.albumUI.add(this.openPackButton);
    if (packs > 0) {
      this.tweens.add({
        targets: this.openPackButton, scaleX: 1.06, scaleY: 1.06,
        duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    // Set grid (2 columns)
    const gridTop = this.contentBounds.top + 46;
    this.scroll = new ScrollContainer(this, {
      x: 0, y: gridTop, width,
      height: this.contentBounds.bottom - gridTop
    });
    this.add.existing(this.scroll);
    this.albumUI.add(this.scroll);

    const cardW = 165;
    const cardH = 150;
    const gapX = 14;
    const gapY = 14;
    const startX = centerX - (cardW + gapX) / 2;

    let claimableAny = false;
    STICKER_SETS.forEach((set, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardW + gapX);
      const y = 16 + cardH / 2 + row * (cardH + gapY);
      const card = this.buildSetCard(set, cardW, cardH);
      card.setPosition(x, y);
      this.scroll.addItem(card);

      const complete = this.ownedCountInSet(set) === set.stickers.length;
      if (complete && !this.claimedSets.has(set.id)) claimableAny = true;
    });
    this.scroll.setContentHeight(30 + Math.ceil(STICKER_SETS.length / 2) * (cardH + gapY));

    const showDot = claimableAny || gameState.stickerPacks.get() > 0;
    setTabNotification('stickers', showDot, showDot ? '!' : null);
    this.bottomTabMenu.setNotification('stickers', showDot, showDot ? '!' : null);
  }

  buildSetCard(set, w, h) {
    const card = this.add.container(0, 0);
    const ownedCount = this.ownedCountInSet(set);
    const complete = ownedCount === set.stickers.length;
    const claimed = this.claimedSets.has(set.id);

    const bg = this.add.nineslice(0, 0, 'item_frame_white', null, w, h, 20, 20, 20, 20)
      .setOrigin(0.5)
      .setTint(claimed ? 0x334155 : 0x1e293b);
    card.add(bg);

    // Cover: the set's 5-star chase sticker
    const chase = set.stickers.find((s) => s.rarity === 5) ?? set.stickers[0];
    const cover = this.add.image(0, -h / 2 + 46, chase.texture).setDisplaySize(56, 56);
    if (!this.owned[chase.id]) cover.setTintFill(0x0f172a);
    card.add(cover);

    // Name banner tinted with the set color
    const banner = this.add.nineslice(0, 8, 'label_oval_white', null, w - 24, 30, 14, 14, 14, 14)
      .setOrigin(0.5)
      .setTint(set.color);
    card.add(banner);
    card.add(this.add.text(0, 8, set.name, {
      fontFamily: 'LINESeed', fontSize: '12px', fontStyle: 'bold', fill: '#FFFFFF',
      stroke: '#000000', strokeThickness: 3, resolution: 2
    }).setOrigin(0.5));

    // Progress
    card.add(this.add.text(0, 34, `${ownedCount}/${set.stickers.length}`, {
      fontFamily: 'Tilt Warp', fontSize: '16px', fill: complete ? '#4ADE80' : '#FFFFFF',
      stroke: '#000000', strokeThickness: 3, resolution: 2
    }).setOrigin(0.5));

    // Status badge
    if (claimed) {
      card.add(this.add.image(w / 2 - 22, -h / 2 + 20, 'icon_check').setDisplaySize(28, 28));
      card.setAlpha(0.75);
    } else if (complete) {
      const claimLabel = this.add.text(0, h / 2 - 18, 'TAP TO CLAIM!', {
        fontFamily: 'Tilt Warp', fontSize: '13px', fill: '#FFD700',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }).setOrigin(0.5);
      card.add(claimLabel);
      this.tweens.add({
        targets: claimLabel, scaleX: 1.1, scaleY: 1.1,
        duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      playSound(this, 'button_sound');
      this.showSetDetail(set);
    });

    return card;
  }

  // ---------------------------------------------------------------
  // Set detail view (slides in over the album)
  // ---------------------------------------------------------------

  showSetDetail(set) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const centerX = width / 2;

    this.detailContainer?.destroy();
    const panel = this.add.container(width, 0).setDepth(500);
    this.detailContainer = panel;

    // Backdrop
    const backdrop = this.add.rectangle(centerX, height / 2, width, height, 0x0a1230, 0.92)
      .setInteractive(); // block taps to the album behind
    panel.add(backdrop);

    // Header: back arrow + set name (panel covers the whole screen,
    // so it can start higher than the album content area)
    const top = 110;
    const backButton = new UIButton(this, 44, top + 10, {
      texture: 'btn_blue', label: '<', width: 56, height: 46, fontSize: 22,
      onTap: () => {
        panel.destroy();
        this.detailContainer = null;
      }
    });
    panel.add(backButton);

    const nameBanner = this.add.nineslice(centerX, top + 10, 'label_oval_white', null, 220, 40, 14, 14, 14, 14)
      .setOrigin(0.5).setTint(set.color);
    panel.add(nameBanner);
    panel.add(this.add.text(centerX, top + 10, set.name, {
      fontFamily: 'Tilt Warp', fontSize: '16px', fill: '#FFFFFF',
      stroke: '#000000', strokeThickness: 3, resolution: 2
    }).setOrigin(0.5));

    // 2x3 sticker slots
    const slotW = 150;
    const slotH = 132;
    const gap = 10;
    const gridTop = top + 46;
    set.stickers.forEach((sticker, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = centerX - (slotW + gap) / 2 + col * (slotW + gap);
      const y = gridTop + slotH / 2 + row * (slotH + gap);
      panel.add(this.buildStickerSlot(sticker, x, y, slotW, slotH));
    });

    // Reward + claim
    const bottomY = gridTop + 3 * (slotH + gap) + 18;
    const complete = this.ownedCountInSet(set) === set.stickers.length;
    const claimed = this.claimedSets.has(set.id);

    panel.add(this.add.text(centerX, bottomY,
      `Complete to win: ${SET_REWARD.coins} coins, ${SET_REWARD.gems} gems, ${SET_REWARD.tickets} tickets`, {
        fontFamily: 'LINESeed', fontSize: '13px', fill: '#FFD700',
        stroke: '#000000', strokeThickness: 2, resolution: 2,
        wordWrap: { width: width - 60 }, align: 'center'
      }).setOrigin(0.5));

    if (claimed) {
      panel.add(this.add.text(centerX, bottomY + 36, '✓ Reward claimed', {
        fontFamily: 'LINESeed', fontSize: '15px', fill: '#4ADE80',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }).setOrigin(0.5));
    } else {
      const claimButton = new UIButton(this, centerX, bottomY + 44, {
        texture: complete ? 'btn_yellow' : 'btn_gray',
        label: 'COMPLETE TO CLAIM',
        width: 260, height: 54, fontSize: 16,
        enabled: complete,
        onTap: () => this.claimSet(set, panel)
      });
      panel.add(claimButton);
    }

    // Slide in from the right
    this.tweens.add({ targets: panel, x: 0, duration: 250, ease: 'Cubic.easeOut' });
  }

  buildStickerSlot(sticker, x, y, w, h) {
    const slot = this.add.container(x, y);
    const isOwned = Boolean(this.owned[sticker.id]);
    const rarityColor = RARITY_COLORS[sticker.rarity];

    const frame = this.add.nineslice(0, 0, 'item_frame_white', null, w, h, 16, 16, 16, 16)
      .setOrigin(0.5)
      .setTint(isOwned ? rarityColor : 0x1e293b);
    slot.add(frame);

    const icon = this.add.image(0, -18, sticker.texture).setDisplaySize(64, 64);
    if (!isOwned) icon.setTintFill(0x0f172a); // silhouette
    slot.add(icon);
    if (!isOwned) {
      slot.add(this.add.text(0, -18, '?', {
        fontFamily: 'Tilt Warp', fontSize: '30px', fill: '#64748b',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }).setOrigin(0.5));
    }

    // Name
    slot.add(this.add.text(0, 26, sticker.name, {
      fontFamily: 'LINESeed', fontSize: '12px', fill: isOwned ? '#FFFFFF' : '#94a3b8',
      stroke: '#000000', strokeThickness: 2, resolution: 2
    }).setOrigin(0.5));

    // Rarity stars
    for (let i = 0; i < sticker.rarity; i++) {
      const star = this.add.image(
        (i - (sticker.rarity - 1) / 2) * 16, 46, 'icon_star'
      ).setDisplaySize(14, 14);
      if (!isOwned) star.setTint(0x475569);
      slot.add(star);
    }

    // Duplicate count badge
    const count = this.owned[sticker.id] ?? 0;
    if (count > 1) {
      slot.add(this.add.image(w / 2 - 16, -h / 2 + 16, 'alert_count').setDisplaySize(30, 30));
      slot.add(this.add.text(w / 2 - 16, -h / 2 + 15, `x${count}`, {
        fontFamily: 'LINESeed', fontSize: '11px', fontStyle: 'bold', fill: '#FFFFFF',
        resolution: 2
      }).setOrigin(0.5));
    }

    return slot;
  }

  async claimSet(set, panel) {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await api.claimStickerSet(set.id);
      this.claimedSets.add(set.id);

      const reward = res.reward ?? SET_REWARD;
      gameState.coins.add(reward.coins ?? 0);
      gameState.gems.add(reward.gems ?? 0);
      gameState.tickets.add(reward.tickets ?? 0);
      gameState.xp.add(reward.xp ?? 0);
      this.applyAuthoritativeStats(res.stats);

      panel.destroy();
      this.detailContainer = null;
      RewardCelebration.show(this, {
        title: 'SET COMPLETE!',
        rewards: [
          { icon: 'statusbar_coin', amount: reward.coins, label: 'Coins' },
          { icon: 'statusbar_gem', amount: reward.gems, label: 'Gems' },
          { icon: 'statusbar_ticket', amount: reward.tickets, label: 'Tickets' }
        ],
        onDone: () => this.buildAlbum()
      });
      hapticNotify('success');
    } catch (error) {
      console.error('Set claim failed:', error);
      this.showToast(error.status === 409 ? 'Already claimed!' : 'Claim failed — try again');
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------
  // Pack opening
  // ---------------------------------------------------------------

  async openPack() {
    if (this.busy) return;
    if (gameState.stickerPacks.get() < 1) {
      this.showToast('No packs! Win them from the wheel, levels and the shop', '#ffd700', '#332600');
      return;
    }
    this.busy = true;
    try {
      const res = await api.openStickerPack();
      gameState.stickerPacks.add(-1);
      if (typeof res.packs_left === 'number') {
        gameState.stickerPacks.set(res.packs_left);
      }
      for (const rolled of res.stickers) {
        this.owned[rolled.id] = (this.owned[rolled.id] ?? 0) + 1;
      }
      if (res.dupe_coins > 0) {
        gameState.coins.add(res.dupe_coins);
      }
      this.applyAuthoritativeStats(res.stats);
      this.showPackReveal(res.stickers);
    } catch (error) {
      console.error('Pack open failed:', error);
      this.showToast(error.status === 409 ? 'No packs left!' : 'Could not open the pack');
      this.busy = false;
    }
  }

  showPackReveal(rolledStickers) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const overlay = this.add.container(0, 0).setDepth(2800);
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setInteractive();
    overlay.add(dim);

    overlay.add(this.add.text(width / 2, height * 0.2, 'PACK OPENED!', {
      fontFamily: 'Tilt Warp', fontSize: '34px', fill: '#FFD700',
      stroke: '#000000', strokeThickness: 6, resolution: 2
    }).setOrigin(0.5));

    const cardW = Math.min(Math.floor((width - 50) / 3), 130);
    const cardH = Math.round(cardW * 1.3);
    const gap = 10;
    const startX = width / 2 - (cardW + gap);

    rolledStickers.forEach((rolled, i) => {
      const sticker = stickerById(rolled.id);
      const x = startX + i * (cardW + gap);
      const y = height / 2;

      // Face-down card
      const card = this.add.container(x, y).setScale(0);
      const back = this.add.nineslice(0, 0, 'card_frame_dim', null, cardW, cardH, 20, 20, 20, 20).setOrigin(0.5);
      const question = this.add.text(0, 0, '?', {
        fontFamily: 'Tilt Warp', fontSize: '46px', fill: '#94a3b8',
        stroke: '#000000', strokeThickness: 4, resolution: 2
      }).setOrigin(0.5);
      card.add([back, question]);
      overlay.add(card);

      // Deal in, then flip to reveal (staggered)
      this.tweens.add({
        targets: card, scale: 1, duration: 250, delay: i * 120, ease: 'Back.out'
      });
      this.time.delayedCall(700 + i * 450, () => {
        this.tweens.add({
          targets: card, scaleX: 0, duration: 140, ease: 'Cubic.easeIn',
          onComplete: () => {
            card.removeAll(true);
            const rarityColor = RARITY_COLORS[sticker?.rarity ?? 1];
            const face = this.add.nineslice(0, 0, 'item_frame_white', null, cardW, cardH, 16, 16, 16, 16)
              .setOrigin(0.5).setTint(rarityColor);
            const art = this.add.image(0, -24, sticker?.texture ?? 'statusbar_coin').setDisplaySize(64, 64);
            const name = this.add.text(0, 30, sticker?.name ?? '?', {
              fontFamily: 'LINESeed', fontSize: '12px', fontStyle: 'bold', fill: '#FFFFFF',
              stroke: '#000000', strokeThickness: 2, resolution: 2,
              wordWrap: { width: cardW - 16 }, align: 'center'
            }).setOrigin(0.5);
            const status = this.add.text(0, 58, rolled.is_new ? 'NEW!' : `+${rolled.dupe_coins} coins`, {
              fontFamily: 'Tilt Warp', fontSize: '13px',
              fill: rolled.is_new ? '#4ADE80' : '#FFD700',
              stroke: '#000000', strokeThickness: 3, resolution: 2
            }).setOrigin(0.5);
            card.add([face, art, name, status]);
            this.tweens.add({ targets: card, scaleX: 1, duration: 160, ease: 'Cubic.easeOut' });
            playSound(this, (sticker?.rarity ?? 1) >= 5 ? 'mega_jackpot_sound' : 'chest_sound_big');
          }
        });
      });
    });

    // Tap to dismiss (after the last flip)
    this.time.delayedCall(700 + rolledStickers.length * 450 + 400, () => {
      const hint = this.add.text(width / 2, height * 0.78, 'Tap to continue', {
        fontFamily: 'LINESeed', fontSize: '15px', fill: '#FFFFFF',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }).setOrigin(0.5);
      overlay.add(hint);
      dim.once('pointerdown', () => {
        overlay.destroy();
        this.busy = false;
        this.buildAlbum();
      });
    });
  }

  applyAuthoritativeStats(stats) {
    if (stats && typeof stats === 'object' && typeof stats.coins === 'number') {
      gameState.coins.set(stats.coins);
      gameState.gems.set(stats.gems ?? gameState.gems.get());
      gameState.energy.set(stats.energy ?? gameState.energy.get());
      gameState.tickets.set(stats.tickets ?? gameState.tickets.get());
      if (typeof stats.xp === 'number') gameState.xp.set(stats.xp);
      if (typeof stats.user_level === 'number') gameState.level.set(stats.user_level);
      if (typeof stats.sticker_packs === 'number') gameState.stickerPacks.set(stats.sticker_packs);
    }
  }
}
