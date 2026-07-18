import ModalShell from './ModalShell.js';
import ScrollContainer from './ScrollContainer.js';
import { api } from '../utils/api.js';

/**
 * LeaderboardModal — today's top players by gems earned.
 * Resets at 00:00 UTC (server-side; the countdown here is display
 * only). The player's own rank is pinned at the bottom.
 */
export default class LeaderboardModal extends ModalShell {
  constructor(scene) {
    const height = Math.min(scene.cameras.main.height - 160, 560);
    super(scene, {
      title: 'DAILY TOP 100',
      panelWidth: Math.min(scene.cameras.main.width - 30, 360),
      panelHeight: height
    });

    this.panelH = height;
    this.listBuilt = false;

    // Countdown to UTC midnight
    this.countdownText = scene.add.text(0, -height / 2 + 44, '', {
      fontFamily: 'LINESeed',
      fontSize: '13px',
      fill: '#94a3b8',
      resolution: 2
    }).setOrigin(0.5);
    this.panel.add(this.countdownText);

    this.statusText = scene.add.text(0, 0, 'Loading…', {
      fontFamily: 'LINESeed',
      fontSize: '16px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2
    }).setOrigin(0.5);
    this.panel.add(this.statusText);

    this.countdownTimer = scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.updateCountdown()
    });
    scene.events.once('shutdown', () => this.countdownTimer?.remove());
  }

  onShow() {
    this.refresh();
  }

  updateCountdown() {
    if (!this.isShown) return;
    const now = new Date();
    const reset = new Date(now);
    reset.setUTCHours(24, 0, 0, 0);
    const ms = reset - now;
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    this.countdownText.setText(`Resets in ${h}:${m}:${s}`);
  }

  async refresh() {
    this.updateCountdown();
    try {
      const data = await api.getLeaderboard(100);
      this.buildList(data);
    } catch (error) {
      console.error('Leaderboard load failed:', error);
      this.statusText.setText('Could not load the leaderboard');
    }
  }

  buildList(data) {
    const scene = this.scene;
    this.statusText.setVisible(false);
    this.scroll?.destroy();
    this.myRow?.destroy();

    const listWidth = this.config.panelWidth - 40;
    const listTop = -this.panelH / 2 + 64;
    const listHeight = this.panelH - 140;

    // ScrollContainer works in world space; the panel is centered, so
    // convert the panel-relative origin to world coordinates.
    const worldX = scene.cameras.main.width / 2 - listWidth / 2;
    const worldY = scene.cameras.main.height / 2 + listTop;
    this.scroll = new ScrollContainer(scene, {
      x: worldX,
      y: worldY,
      width: listWidth,
      height: listHeight
    });
    scene.add.existing(this.scroll);
    this.scroll.setDepth(this.depth + 1);
    this.add(this.scroll);

    const rows = data.top ?? [];
    const rowH = 52;
    if (rows.length === 0) {
      this.statusText.setVisible(true);
      this.statusText.setText('No players yet today.\nEarn gems to claim #1!');
    }
    rows.forEach((row, i) => {
      this.scroll.addItem(this.buildRow(scene, row, listWidth, rowH, i * (rowH + 6) + rowH / 2));
    });
    this.scroll.setContentHeight(rows.length * (rowH + 6) + 10);

    // Own rank pinned below the list
    const me = data.me ?? {};
    const myY = this.panelH / 2 - 40;
    this.myRow = scene.add.container(0, myY);
    const bg = scene.add.nineslice(0, 0, 'list_frame', null, listWidth, 48, 18, 18, 18, 18)
      .setOrigin(0.5)
      .setTint(0x3b82f6);
    const label = scene.add.text(-listWidth / 2 + 14, 0,
      me.rank ? `Your rank: #${me.rank}` : 'Earn gems today to get ranked!', {
        fontFamily: 'LINESeed', fontSize: '14px', fontStyle: 'bold', fill: '#FFFFFF',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }).setOrigin(0, 0.5);
    this.myRow.add([bg, label]);
    if (me.rank) {
      const gems = scene.add.text(listWidth / 2 - 40, 0, `${me.gems}`, {
        fontFamily: 'Tilt Warp', fontSize: '16px', fill: '#4ADE80',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }).setOrigin(1, 0.5);
      const icon = scene.add.image(listWidth / 2 - 24, 0, 'statusbar_gem').setDisplaySize(24, 24);
      this.myRow.add([gems, icon]);
    }
    this.panel.add(this.myRow);
  }

  buildRow(scene, row, width, height, y) {
    const container = scene.add.container(width / 2, y);

    const isTop3 = row.rank <= 3;
    const bg = scene.add.nineslice(0, 0, 'list_frame', null, width, height, 18, 18, 18, 18)
      .setOrigin(0.5)
      .setTint(isTop3 ? [0xb8860b, 0x8a8a8a, 0x7a4a2b][row.rank - 1] : 0x2a3550);
    container.add(bg);

    // Rank: trophy for top 3, number otherwise
    if (isTop3) {
      const trophy = scene.add.image(-width / 2 + 26, 0, 'icon_trophy').setDisplaySize(30, 30);
      trophy.setTint([0xffd700, 0xc0c0c0, 0xcd7f32][row.rank - 1]);
      container.add(trophy);
    } else {
      container.add(scene.add.text(-width / 2 + 26, 0, `${row.rank}`, {
        fontFamily: 'Tilt Warp', fontSize: '16px', fill: '#94a3b8',
        stroke: '#000000', strokeThickness: 3, resolution: 2
      }).setOrigin(0.5));
    }

    // Avatar circle with initial
    const avatar = scene.add.circle(-width / 2 + 62, 0, 16, 0x475569).setStrokeStyle(2, 0xffffff);
    const initial = (row.username ?? '?').charAt(0).toUpperCase();
    container.add(avatar);
    container.add(scene.add.text(-width / 2 + 62, 0, initial, {
      fontFamily: 'LINESeed', fontSize: '14px', fontStyle: 'bold', fill: '#FFFFFF', resolution: 2
    }).setOrigin(0.5));

    // Username (truncated) + level
    const name = (row.username ?? 'Player').slice(0, 14);
    container.add(scene.add.text(-width / 2 + 86, 0, `${name}  •  Lv ${row.level ?? 1}`, {
      fontFamily: 'LINESeed', fontSize: '13px', fill: '#FFFFFF',
      stroke: '#000000', strokeThickness: 2, resolution: 2
    }).setOrigin(0, 0.5));

    // Gems
    container.add(scene.add.text(width / 2 - 36, 0, `${row.gems}`, {
      fontFamily: 'Tilt Warp', fontSize: '15px', fill: '#4ADE80',
      stroke: '#000000', strokeThickness: 3, resolution: 2
    }).setOrigin(1, 0.5));
    container.add(scene.add.image(width / 2 - 20, 0, 'statusbar_gem').setDisplaySize(22, 22));

    return container;
  }

  onHide() {
    this.scroll?.destroy();
    this.scroll = null;
  }
}
