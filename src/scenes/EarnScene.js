import Phaser from 'phaser';
import BaseTabScene from './BaseTabScene.js';
import ScrollContainer from '../components/ScrollContainer.js';
import TaskCard from '../components/TaskCard.js';
import UIButton from '../components/UIButton.js';
import RewardCelebration from '../components/RewardCelebration.js';
import { api } from '../utils/api.js';
import { ads } from '../services/ads.js';
import { gameState } from '../state/gameState.js';
import { setTabNotification } from '../config/tabs.js';

const REWARD_ICONS = {
  coins: 'statusbar_coin',
  gems: 'statusbar_gem',
  energy: 'statusbar_energy',
  tickets: 'statusbar_ticket',
  sticker_packs: 'icon_picture'
};

const REWARD_LABELS = {
  coins: 'Coins',
  gems: 'Gems',
  energy: 'Energy',
  tickets: 'Tickets',
  sticker_packs: 'Sticker Pack'
};

/**
 * EarnScene — free-to-play reward tasks:
 * daily check-in streak, rewarded ads (Adsgram), friend referrals,
 * one-time social follows. All rewards credited server-side.
 */
export default class EarnScene extends BaseTabScene {
  constructor() {
    super({
      key: 'EarnScene',
      tabKey: 'earn',
      title: 'EARN REWARDS',
      ribbonTexture: 'ribbon_yellow'
    });
  }

  createContent() {
    this.claimBusy = false;

    this.loadingText = this.add.text(
      this.cameras.main.width / 2,
      (this.contentBounds.top + this.contentBounds.bottom) / 2,
      'Loading tasks…',
      {
        fontFamily: 'LINESeed', fontSize: '18px', fill: '#FFFFFF',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }
    ).setOrigin(0.5);

    this.refresh();
  }

  async refresh() {
    try {
      const [tasksRes, referralsRes] = await Promise.all([api.getTasks(), api.getReferrals()]);
      this.tasksData = tasksRes;
      this.referralsData = referralsRes;
    } catch (error) {
      console.error('Failed to load tasks:', error);
      this.loadingText?.setText('Could not load tasks.\nCheck your connection!');
      return;
    }
    this.loadingText?.destroy();
    this.loadingText = null;
    this.buildList();
  }

  buildList() {
    const width = this.cameras.main.width;

    if (this.scroll) {
      this.scroll.destroy();
      this.scroll = null;
    }

    this.scroll = new ScrollContainer(this, {
      x: 0,
      y: this.contentBounds.top,
      width,
      height: this.contentBounds.bottom - this.contentBounds.top
    });
    this.add.existing(this.scroll);

    const centerX = width / 2;
    let y = 10;

    // ----- Daily check-in strip -----
    y = this.buildCheckinCard(centerX, y);

    // ----- Invite friends card -----
    y = this.buildInviteCard(centerX, y);

    // ----- Task cards -----
    const anyClaimable = [];
    for (const task of this.tasksData.tasks) {
      const card = new TaskCard(this, centerX, y + TaskCard.HEIGHT / 2, {
        width: width - 30,
        icon: task.icon,
        title: task.title,
        rewardText: this.rewardLine(task),
        state: task.state,
        lockedText: task.type === 'referral_milestone'
          ? `${this.tasksData.referrals.qualified}/${task.requiredReferrals}\nfriends`
          : '',
        buttonLabel: task.state === 'claimable' ? 'CLAIM'
          : task.requiresAd ? 'WATCH'
          : task.url ? 'GO' : 'CLAIM',
        onAction: (cardRef) => this.handleTask(task, cardRef)
      });
      this.scroll.addItem(card);
      y += TaskCard.HEIGHT + 12;
      if (task.state === 'claimable') anyClaimable.push(task.id);
    }

    this.scroll.setContentHeight(y + 20);

    // Notification dot on the EARN tab when something is claimable
    const showDot = anyClaimable.length > 0 ||
      (!this.tasksData.checkin.claimed_today);
    setTabNotification('earn', showDot, showDot ? '!' : null);
    this.bottomTabMenu.setNotification('earn', showDot, showDot ? '!' : null);
  }

  rewardLine(task) {
    const parts = [];
    for (const [key, amount] of Object.entries(task.reward)) {
      if (key === 'xp' || !amount) continue;
      parts.push(`+${amount} ${REWARD_LABELS[key] ?? key}`);
    }
    let line = parts.join('  ');
    if (task.type === 'daily' && task.dailyLimit) {
      line += `  (${task.claimsToday}/${task.dailyLimit} today)`;
    }
    return line;
  }

  // ---------------------------------------------------------------
  // Check-in
  // ---------------------------------------------------------------

  buildCheckinCard(centerX, y) {
    const width = this.cameras.main.width - 30;
    const height = 150;
    const checkin = this.tasksData.checkin;

    const card = this.add.container(centerX, y + height / 2);
    const bg = this.add.nineslice(0, 0, 'list_frame', null, width, height, 20, 20, 20, 20)
      .setOrigin(0.5).setTint(0x2a3550);
    card.add(bg);

    const title = this.add.text(-width / 2 + 20, -height / 2 + 22,
      `DAILY CHECK-IN  •  Day ${checkin.next_day}`, {
        fontFamily: 'Tilt Warp', fontSize: '17px', fill: '#FFFFFF',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }).setOrigin(0, 0.5);
    card.add(title);

    // 7 day slots
    const slotSize = 38;
    const gap = (width - 60 - slotSize * 7) / 6;
    const startX = -width / 2 + 30 + slotSize / 2;
    const currentIdx = checkin.next_day - 1;
    for (let i = 0; i < 7; i++) {
      const sx = startX + i * (slotSize + gap);
      const sy = 2;
      const done = checkin.claimed_today ? i <= currentIdx : i < currentIdx;
      const isToday = !checkin.claimed_today && i === currentIdx;

      const slot = this.add.nineslice(sx, sy, 'item_frame_white', null, slotSize, slotSize, 12, 12, 12, 12)
        .setOrigin(0.5)
        .setTint(done ? 0x4ade80 : isToday ? 0xffd700 : 0x556080);
      card.add(slot);

      const dayText = this.add.text(sx, sy - 2, `${i + 1}`, {
        fontFamily: 'Tilt Warp', fontSize: '16px', fill: '#FFFFFF',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }).setOrigin(0.5);
      card.add(dayText);

      if (done) {
        card.add(this.add.image(sx + 10, sy + 10, 'icon_check').setDisplaySize(18, 18));
      }
      if (isToday) {
        this.tweens.add({
          targets: slot, scaleX: 1.12, scaleY: 1.12,
          duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      }
    }

    // Claim button / done state
    if (checkin.claimed_today) {
      const doneText = this.add.text(0, height / 2 - 22, 'Come back tomorrow!', {
        fontFamily: 'LINESeed', fontSize: '14px', fill: '#AAAAAA',
        stroke: '#000000', strokeThickness: 2, resolution: 2
      }).setOrigin(0.5);
      card.add(doneText);
    } else {
      const claimBtn = new UIButton(this, 0, height / 2 - 26, {
        texture: 'btn_yellow',
        label: 'CLAIM',
        width: 140,
        height: 44,
        fontSize: 17,
        onTap: () => this.claimCheckin()
      });
      card.add(claimBtn);
      this.checkinButton = claimBtn;
    }

    this.scroll.addItem(card);
    return y + height + 12;
  }

  async claimCheckin() {
    if (this.claimBusy) return;
    this.claimBusy = true;
    this.checkinButton?.setEnabled(false);
    try {
      const res = await api.claimTask('checkin');
      this.applyClaim(res, `DAY ${res.day ?? 1} REWARD!`);
    } catch (error) {
      console.error('Check-in claim failed:', error);
      this.showToast(error.status === 409 ? 'Already claimed today!' : 'Claim failed — try again');
    } finally {
      this.claimBusy = false;
      this.refresh();
    }
  }

  // ---------------------------------------------------------------
  // Invite friends
  // ---------------------------------------------------------------

  buildInviteCard(centerX, y) {
    const width = this.cameras.main.width - 30;
    const height = 92;
    const referrals = this.referralsData;

    const card = this.add.container(centerX, y + height / 2);
    const bg = this.add.nineslice(0, 0, 'list_frame', null, width, height, 20, 20, 20, 20)
      .setOrigin(0.5).setTint(0x2a3550);
    card.add(bg);

    card.add(this.add.image(-width / 2 + 40, 0, 'icon_heart').setDisplaySize(44, 44));

    card.add(this.add.text(-width / 2 + 72, -14, 'Invite Friends', {
      fontFamily: 'LINESeed', fontSize: '16px', fontStyle: 'bold', fill: '#FFFFFF',
      stroke: '#000000', strokeThickness: 3, resolution: 2
    }).setOrigin(0, 0.5));

    const line = `+50 Energy each  •  ${referrals.qualified} invited`;
    card.add(this.add.text(-width / 2 + 72, 12, line, {
      fontFamily: 'LINESeed', fontSize: '14px', fill: '#FFD700',
      stroke: '#000000', strokeThickness: 2, resolution: 2,
      wordWrap: { width: width - 200 }
    }).setOrigin(0, 0.5));

    const inviteBtn = new UIButton(this, width / 2 - 62, 0, {
      texture: 'btn_blue',
      label: 'INVITE',
      width: 100,
      height: 54,
      fontSize: 16,
      onTap: () => this.shareInvite()
    });
    card.add(inviteBtn);

    this.scroll.addItem(card);
    return y + height + 12;
  }

  shareInvite() {
    const link = this.referralsData?.link;
    if (!link) return;
    const text = 'Join me on the beach — open chests, win gems! 🏝️';
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  }

  // ---------------------------------------------------------------
  // Generic tasks
  // ---------------------------------------------------------------

  async handleTask(task, card) {
    if (this.claimBusy) return;

    if (task.requiresAd) {
      return this.watchAdTask(task, card);
    }

    if (task.type === 'once' && task.url && !this.startedTasks?.has(task.id)) {
      // Two-step: first tap opens the link, second tap (after return) claims
      this.startedTasks = this.startedTasks ?? new Set();
      this.startedTasks.add(task.id);
      if (task.url.startsWith('https://t.me') && window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(task.url);
      } else if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(task.url);
      } else {
        window.open(task.url, '_blank');
      }
      card.button?.setLabel('CLAIM');
      return;
    }

    this.claimBusy = true;
    card.setBusy(true);
    try {
      const res = await api.claimTask(task.id);
      this.applyClaim(res, 'TASK COMPLETE!');
    } catch (error) {
      console.error('Task claim failed:', error);
      this.showToast(error.status === 409 ? 'Already claimed!' : 'Claim failed — try again');
    } finally {
      this.claimBusy = false;
      this.refresh();
    }
  }

  async watchAdTask(task, card) {
    this.claimBusy = true;
    card.setBusy(true);
    try {
      const result = await ads.showRewarded();
      if (result.mock || !ads.isAvailable()) {
        // Dev / no server postback: claim through the capped task endpoint
        const res = await api.claimTask(task.id);
        this.applyClaim(res, 'AD REWARD!');
      } else {
        // Production: the Adsgram postback credits server-side; just refresh
        this.showToast('Reward incoming…', '#4ade80', '#003300');
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    } catch (error) {
      console.error('Ad watch failed:', error);
      this.showToast('Ad not completed');
    } finally {
      this.claimBusy = false;
      this.refresh();
    }
  }

  /** Apply a successful claim: update local balances + celebrate. */
  applyClaim(res, title) {
    const reward = res.reward ?? {};
    const rows = [];
    for (const [key, amount] of Object.entries(reward)) {
      if (key === 'xp' || !amount) continue;
      rows.push({ icon: REWARD_ICONS[key], amount, label: REWARD_LABELS[key] });
      // Optimistic local update; authoritative stats reconcile on next sync
      if (key === 'coins') gameState.coins.add(amount);
      if (key === 'gems') gameState.gems.add(amount);
      if (key === 'energy') gameState.energy.add(amount);
      if (key === 'tickets') gameState.tickets.add(amount);
      if (key === 'sticker_packs') gameState.stickerPacks.add(amount);
    }
    if (reward.xp) gameState.xp.add(reward.xp);

    // Server returns authoritative stats — prefer them when present
    const stats = res.stats;
    if (stats && typeof stats === 'object' && typeof stats.coins === 'number') {
      gameState.coins.set(stats.coins);
      gameState.gems.set(stats.gems ?? gameState.gems.get());
      gameState.energy.set(stats.energy ?? gameState.energy.get());
      gameState.tickets.set(stats.tickets ?? gameState.tickets.get());
      if (typeof stats.xp === 'number') gameState.xp.set(stats.xp);
      if (typeof stats.user_level === 'number') gameState.level.set(stats.user_level);
      if (typeof stats.sticker_packs === 'number') gameState.stickerPacks.set(stats.sticker_packs);
    }

    if (rows.length > 0) {
      RewardCelebration.show(this, { title, rewards: rows });
    }
  }
}
