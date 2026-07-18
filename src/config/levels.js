/**
 * Progression config — MUST stay in sync with the server
 * (migrations/0003_functions.sql: level_from_xp, grant_level_rewards,
 * and the coin envelope in apply_sync).
 *
 * XP sources: +1 per chest (via /api/sync), +15 wheel spin, +40 task
 * claim, +20 daily check-in, +150 sticker set, +100 purchase (all
 * credited server-side by their endpoints).
 */

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level) {
  return Math.round(60 * Math.pow(1.35, level - 1));
}

/** Current level for a total XP amount (level 1 at 0 XP, cap 99). */
export function levelFromXp(xp) {
  let level = 1;
  let remaining = Math.max(xp, 0);
  while (level < 99) {
    const cost = xpToNext(level);
    if (remaining < cost) break;
    remaining -= cost;
    level++;
  }
  return level;
}

/** Progress within the current level: { level, current, needed, fraction }. */
export function progressToNext(xp) {
  let level = 1;
  let remaining = Math.max(xp, 0);
  while (level < 99) {
    const cost = xpToNext(level);
    if (remaining < cost) {
      return { level, current: remaining, needed: cost, fraction: remaining / cost };
    }
    remaining -= cost;
    level++;
  }
  return { level, current: 0, needed: xpToNext(level), fraction: 0 };
}

/**
 * Coin bonus multiplier — chests pay more as you level (+10%/level).
 * A level 10 player earns ~1.9x the coins of a level 1 player.
 */
export function coinMultiplier(level) {
  return 1 + (Math.max(level, 1) - 1) * 0.10;
}

/** Scale a rolled coin reward by the player's level bonus. */
export function scaleCoins(amount, level) {
  return Math.ceil(amount * coinMultiplier(level));
}

/**
 * Rewards granted when reaching `level` (mirrors grant_level_rewards):
 * energy refilled to 100, tickets = ceil(level/2) capped at 5,
 * +1 sticker pack every 5 levels.
 */
export function levelUpRewards(level) {
  return {
    energyRefill: true,
    tickets: Math.min(Math.ceil(level / 2), 5),
    stickerPacks: level % 5 === 0 ? 1 : 0
  };
}
