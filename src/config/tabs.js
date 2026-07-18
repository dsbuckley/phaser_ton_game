/**
 * Single source of truth for the 5-tab bottom navigation.
 * Used by MainScene and every satellite tab scene, so navigation
 * logic lives in exactly one place.
 */

export const TAB_SCENES = {
  main: 'MainScene',
  stickers: 'StickersScene',
  wheel: 'WheelScene',
  earn: 'EarnScene',
  shop: 'ShopScene'
};

const TAB_DEFS = [
  { key: 'main', icon: 'icon_heart', label: 'MAIN' },
  { key: 'stickers', icon: 'icon_picture', label: 'STICKERS' },
  { key: 'wheel', icon: 'icon_setting', label: 'WHEEL' },
  { key: 'earn', icon: 'icon_gold', label: 'EARN' },
  { key: 'shop', icon: 'icon_shop', iconSize: 38, label: 'SHOP' }
];

const NOTIF_STORAGE_KEY = 'tabNotifications';

export function getTabNotifications() {
  try {
    const stored = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* fall through */ }
  return {
    main: { show: false, text: null },
    stickers: { show: true, text: 'NEW' },
    wheel: { show: false, text: null },
    earn: { show: false, text: null },
    shop: { show: false, text: null }
  };
}

export function setTabNotification(tabKey, show, text = null) {
  const state = getTabNotifications();
  if (!state[tabKey]) return state;
  state[tabKey] = { show, text };
  try {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(state));
  } catch { /* non-fatal */ }
  return state;
}

/**
 * Navigate between tab scenes.
 *
 * MainScene is expensive to build (auth round-trip, animations, DOM
 * avatar), so it sleeps/wakes instead of restarting. Satellites are
 * cheap and server-driven, so they start/stop and refetch on entry.
 */
export function navigateToTab(scene, key) {
  const target = TAB_SCENES[key];
  const current = scene.scene.key;
  if (!target || target === current) return;

  if (current === 'MainScene') {
    scene.scene.sleep('MainScene');
    scene.scene.run(target);
  } else if (target === 'MainScene') {
    scene.scene.stop(current);
    scene.scene.wake('MainScene');
  } else {
    scene.scene.start(target);
  }
}

/**
 * Build the BottomTabMenu tab config for a scene.
 * @param {Phaser.Scene} scene - the scene the menu lives in
 */
export function buildTabs(scene) {
  const notifState = getTabNotifications();
  return TAB_DEFS.map((def) => ({
    ...def,
    showNotification: notifState[def.key]?.show ?? false,
    notificationText: notifState[def.key]?.text ?? null,
    onTap: (key) => navigateToTab(scene, key)
  }));
}
