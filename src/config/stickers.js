import data from '../../shared/stickers.json';

/**
 * Sticker album display config. Definitions come from
 * shared/stickers.json (single source of truth with the server).
 * Placeholder art = LayerLab item icons; when real sticker art
 * exists, only the icon->texture mapping changes.
 */

export const PACK_SIZE = data.packSize;
export const SET_REWARD = data.setReward;

export const STICKER_SETS = data.sets.map((set) => ({
  id: set.id,
  name: set.name,
  color: parseInt(set.color, 16),
  stickers: set.stickers.map((sticker) => ({
    id: `${set.id}:${sticker.id}`,
    shortId: sticker.id,
    name: sticker.name,
    texture: `sticker_${sticker.icon}`,
    icon: sticker.icon,
    rarity: sticker.rarity
  }))
}));

export const ALL_STICKERS = STICKER_SETS.flatMap((set) => set.stickers);

export function stickerById(globalId) {
  return ALL_STICKERS.find((s) => s.id === globalId);
}

/** Asset entries for LoadingScene: [key, path] for every sticker icon. */
export function stickerAssetList() {
  const seen = new Set();
  const list = [];
  for (const sticker of ALL_STICKERS) {
    if (seen.has(sticker.texture)) continue;
    seen.add(sticker.texture);
    list.push([sticker.texture, `/assets/Components/Icon_ItemIcons/128/${sticker.icon}.png`]);
  }
  return list;
}
