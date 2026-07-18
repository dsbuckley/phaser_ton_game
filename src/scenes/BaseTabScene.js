import Phaser from 'phaser';
import StatusBar from '../components/StatusBar.js';
import BottomTabMenu from '../components/BottomTabMenu.js';
import SettingsModal from '../components/SettingsModal.js';
import { gameState } from '../state/gameState.js';
import { buildTabs } from '../config/tabs.js';

/**
 * BaseTabScene — shared chrome for the satellite tab scenes
 * (Wheel / Stickers / Earn / Shop).
 *
 * Provides: darkened background, StatusBar (live-updating from
 * gameState), BottomTabMenu with working navigation, title ribbon,
 * and a content region between the chrome.
 *
 * Subclasses set `tabKey` + `title` via super() config and override
 * createContent(). These scenes are started fresh on every visit
 * (state comes from the server), while MainScene sleeps underneath.
 */
export default class BaseTabScene extends Phaser.Scene {
  /**
   * @param {object} config { key, tabKey, title, ribbonTexture, showTickets }
   */
  constructor(config) {
    super({ key: config.key });
    this.tabKey = config.tabKey;
    this.sceneTitle = config.title ?? '';
    this.ribbonTexture = config.ribbonTexture ?? 'settings_header_ribbon';
    this.showTickets = config.showTickets ?? false;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background: same beach art, dimmed to visually separate from play field
    if (this.textures.exists('background')) {
      const bg = this.add.image(width / 2, height / 2, 'background');
      const scale = Math.max(width / bg.width, height / bg.height);
      bg.setScale(scale);
    }
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a1230, 0.55);

    this.createStatusBar();
    this.createTitle();
    this.createTabMenu();

    // Content region between title and tab menu
    this.contentBounds = {
      top: this.sceneTitle ? 170 : 120,
      bottom: height - 110,
      width
    };

    this.createContent();
  }

  createStatusBar() {
    // Each satellite scene owns a SettingsModal instance (persistent
    // state is shared via localStorage, server sync happens on
    // MainScene's flush loop)
    this.settingsModal = new SettingsModal(this, {
      onSoundToggle: (enabled) => this.sound.setMute(!enabled),
      onHapticToggle: () => {}
    });
    this.add.existing(this.settingsModal);

    const resources = [
      { key: 'coins', icon: 'statusbar_coin', value: gameState.coins.get(), width: 75 },
      { key: 'energy', icon: 'statusbar_energy', value: gameState.energy.get(), width: 75 },
      { key: 'gems', icon: 'statusbar_gem', value: gameState.gems.get(), width: 65 }
    ];
    if (this.showTickets) {
      resources.push({ key: 'tickets', icon: 'statusbar_ticket', value: gameState.tickets.get(), width: 65 });
    }

    const avatarUrl = window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url ?? null;
    const username = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name ?? 'Player';

    this.statusBar = new StatusBar(this, 0, 30, {
      avatarTexture: 'avatar_default',
      avatarUrl,
      username,
      userLevel: gameState.level.get(),
      resources,
      onSettingsClick: () => this.settingsModal.show(),
      statusBarY: 30
    });
    this.add.existing(this.statusBar);
    this.statusBar.setScrollFactor(0).setDepth(2000);

    // Keep pills current while this scene is up
    for (const name of ['coins', 'energy', 'gems', 'tickets']) {
      gameState.onChange(this, name, (value) => {
        this.statusBar.setResource(name, value, true);
      });
    }
    gameState.onChange(this, 'level', (value) => this.statusBar.setLevel(value));
  }

  createTitle() {
    if (!this.sceneTitle) return;
    const centerX = this.cameras.main.width / 2;
    this.titleRibbon = this.add.image(centerX, 120, this.ribbonTexture)
      .setDisplaySize(280, 64)
      .setDepth(10);
    this.titleText = this.add.text(centerX, 114, this.sceneTitle, {
      fontFamily: 'Tilt Warp',
      fontSize: '24px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 4,
      padding: { x: 10, y: 10 },
      resolution: 2
    }).setOrigin(0.5).setDepth(11);
  }

  createTabMenu() {
    const centerX = this.cameras.main.width / 2;
    const menuY = this.cameras.main.height - 50;
    this.bottomTabMenu = new BottomTabMenu(this, centerX, menuY, {
      activeTab: this.tabKey,
      tabs: buildTabs(this)
    });
    this.add.existing(this.bottomTabMenu);
    this.bottomTabMenu.setScrollFactor(0).setDepth(1000);
  }

  /** Subclasses build their content here (chrome already exists). */
  createContent() {}

  /** Toast helper (same pattern as MainScene.showError). */
  showToast(message, color = '#ff4444', bgColor = '#330000') {
    const toast = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 130,
      message,
      {
        fontFamily: 'LINESeed',
        fontSize: '16px',
        fill: color,
        backgroundColor: bgColor,
        padding: { x: 12, y: 8 },
        resolution: 2
      }
    ).setOrigin(0.5).setDepth(2600);
    this.time.delayedCall(2500, () => toast.destroy());
  }
}
