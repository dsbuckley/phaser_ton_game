import data from '../../shared/stickers.json';

/**
 * Sticker album logic — definitions live in shared/stickers.json
 * (single source of truth for client + server).
 * Sticker ids are globally unique as "<setId>:<stickerId>".
 */

export interface StickerDef {
  id: string; // global id  "<setId>:<stickerId>"
  setId: string;
  name: string;
  icon: string;
  rarity: number;
}

export const PACK_SIZE: number = data.packSize;
export const DUPE_COINS_PER_RARITY: number = data.dupeCoinsPerRarity;
export const SET_REWARD = data.setReward as { coins: number; gems: number; tickets: number; xp: number };

export const ALL_STICKERS: StickerDef[] = data.sets.flatMap((set) =>
  set.stickers.map((sticker) => ({
    id: `${set.id}:${sticker.id}`,
    setId: set.id,
    name: sticker.name,
    icon: sticker.icon,
    rarity: sticker.rarity
  }))
);

export const SET_IDS: string[] = data.sets.map((s) => s.id);

export function stickersOfSet(setId: string): StickerDef[] {
  return ALL_STICKERS.filter((s) => s.setId === setId);
}

const RARITY_WEIGHTS = data.rarityWeights as Record<string, number>;

/** Roll one sticker: uniform set, then rarity-weighted within the set. */
export function rollSticker(): StickerDef {
  const setId = SET_IDS[Math.floor(Math.random() * SET_IDS.length)];
  const candidates = stickersOfSet(setId);
  const total = candidates.reduce((sum, s) => sum + (RARITY_WEIGHTS[String(s.rarity)] ?? 1), 0);
  let roll = Math.random() * total;
  for (const sticker of candidates) {
    roll -= RARITY_WEIGHTS[String(sticker.rarity)] ?? 1;
    if (roll <= 0) return sticker;
  }
  return candidates[0];
}
