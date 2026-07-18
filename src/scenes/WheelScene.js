import BaseTabScene from './BaseTabScene.js';
import WheelDisplay from '../components/WheelDisplay.js';
import UIButton from '../components/UIButton.js';
import RewardCelebration from '../components/RewardCelebration.js';
import { WHEEL_SEGMENTS } from '../config/wheel.js';
import { api } from '../utils/api.js';
import { ads } from '../services/ads.js';
import { gameState } from '../state/gameState.js';
import { navigateToTab } from '../config/tabs.js';
import { playSound, hapticImpact, hapticNotify } from '../utils/feedback.js';

/**
 * WheelScene — spin the wheel for energy/gems/coins/jackpot.
 * Paid spins cost 1 ticket (server debits atomically); 3 free spins
 * per day via rewarded ads. Outcomes are 100% server-rolled — the
 * animation just lands on the returned segment.
 */
export default class WheelScene extends BaseTabScene {
  constructor() {
    super({
      key: 'WheelScene',
      tabKey: 'wheel',
      title: 'LUCKY WHEEL',
      ribbonTexture: 'ribbon_purple',
      showTickets: true
    });
  }

  createContent() {
    const width = this.cameras.main.width;
    const centerX = width / 2;
    const contentTop = this.contentBounds.top;
    const contentBottom = this.contentBounds.bottom;

    this.freeSpinsLeft = 0;
    this.spinBusy = false;

    // Wheel
    const diameter = Math.min(width - 50, 340);
    const wheelY = contentTop + diameter / 2 + 40;
    this.wheelDisplay = new WheelDisplay(this, centerX, wheelY, {
      diameter,
      onTick: () => {
        playSound(this, 'button_sound', { volume: 0.25, rate: 1.6 });
        hapticImpact('light');
      }
    });
    this.add.existing(this.wheelDisplay);

    // Spin button (1 ticket)
    this.spinButton = new UIButton(this, centerX, contentBottom - 120, {
      texture: 'btn_green',
      label: 'SPIN — 1',
      icon: 'statusbar_ticket',
      width: 260,
      height: 70,
      fontSize: 24,
      onTap: () => this.spin(false)
    });
    this.add.existing(this.spinButton);

    // Free spin via ad
    this.freeSpinButton = new UIButton(this, centerX, contentBottom - 45, {
      texture: 'btn_sky',
      label: 'FREE SPIN (3)',
      width: 220,
      height: 56,
      fontSize: 18,
      onTap: () => this.spin(true)
    });
    this.add.existing(this.freeSpinButton);

    this.hintText = this.add.text(centerX, contentBottom - 4, 'Earn tickets from tasks, levels and the shop', {
      fontFamily: 'LINESeed',
      fontSize: '13px',
      fill: '#CCCCCC',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2
    }).setOrigin(0.5);

    gameState.onChange(this, 'tickets', () => this.updateButtons());

    this.refreshState();
  }

  async refreshState() {
    try {
      const state = await api.getWheelState();
      if (typeof state.tickets === 'number') {
        gameState.tickets.set(state.tickets);
      }
      this.freeSpinsLeft = state.free_spins_left ?? 0;
    } catch (error) {
      console.error('Failed to load wheel state:', error);
    }
    this.updateButtons();
  }

  updateButtons() {
    if (!this.spinButton?.scene) return;
    const tickets = gameState.tickets.get();
    this.spinButton.setLabel('SPIN — 1');
    this.spinButton.setEnabled(!this.spinBusy);
    // 0 tickets: button becomes a shortcut to the shop
    this.noTickets = tickets < 1;

    this.freeSpinButton.setLabel(`FREE SPIN (${this.freeSpinsLeft})`);
    this.freeSpinButton.setVisible(this.freeSpinsLeft > 0);
    this.freeSpinButton.setEnabled(!this.spinBusy && this.freeSpinsLeft > 0);
  }

  async spin(useFree) {
    if (this.spinBusy || this.wheelDisplay.isSpinning) return;

    if (!useFree && gameState.tickets.get() < 1) {
      this.showToast('No tickets — get more in the shop!', '#ffd700', '#332600');
      navigateToTab(this, 'shop');
      return;
    }

    this.spinBusy = true;
    this.updateButtons();

    try {
      if (useFree) {
        // Watch a rewarded ad first (mocked in dev)
        await ads.showRewarded();
      }

      const res = await api.spinWheel({ useFree });

      // Optimistic ticket debit for paid spins (server already debited)
      if (!useFree && !res.mock) {
        // authoritative stats below
      } else if (!useFree && res.mock) {
        gameState.tickets.add(-1);
      }
      if (useFree) this.freeSpinsLeft = Math.max(this.freeSpinsLeft - 1, 0);

      // Safety net: browsers throttle RAF in background tabs, which
      // stretches the tween far beyond 3.8s. The prize must never
      // depend on the animation finishing — time out and credit anyway.
      await Promise.race([
        this.wheelDisplay.spinToSegment(res.segment_index),
        new Promise((resolve) => setTimeout(resolve, 6500))
      ]);
      this.wheelDisplay.finishNow(); // no-op if the tween already ended

      this.celebrate(res);
    } catch (error) {
      console.error('Spin failed:', error);
      if (error.status === 409) {
        this.showToast(useFree ? 'No free spins left today!' : 'Not enough tickets!');
      } else {
        this.showToast('Spin failed — try again');
      }
    } finally {
      this.spinBusy = false;
      this.updateButtons();
    }
  }

  celebrate(res) {
    const prize = res.prize ?? {};
    const segment = WHEEL_SEGMENTS[res.segment_index];
    const rows = [];

    if (prize.energy) {
      rows.push({ icon: 'statusbar_energy', amount: prize.energy, label: 'Energy' });
      gameState.energy.add(prize.energy);
    }
    if (prize.gems) {
      rows.push({ icon: 'statusbar_gem', amount: prize.gems, label: 'Gems' });
      gameState.gems.add(prize.gems);
    }
    if (prize.coins) {
      rows.push({ icon: 'statusbar_coin', amount: prize.coins, label: 'Coins' });
      gameState.coins.add(prize.coins);
    }
    if (prize.sticker_packs) {
      rows.push({ icon: 'icon_picture', amount: prize.sticker_packs, label: 'Sticker Pack' });
      gameState.stickerPacks.add(prize.sticker_packs);
    }
    gameState.xp.add(15);

    // Server stats are authoritative when present
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

    const isJackpot = prize.type === 'jackpot';
    if (isJackpot) {
      playSound(this, 'mega_jackpot_sound');
      hapticNotify('success');
    }
    RewardCelebration.show(this, {
      title: isJackpot ? 'JACKPOT!!!' : (segment?.prizeText ?? 'YOU WON!'),
      rewards: rows
    });

    this.refreshState();
  }
}
