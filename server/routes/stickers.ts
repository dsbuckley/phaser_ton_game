import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { serviceClient } from '../lib/supabase';
import {
  PACK_SIZE,
  DUPE_COINS_PER_RARITY,
  SET_REWARD,
  rollSticker,
  stickersOfSet,
  SET_IDS
} from '../config/stickers';
import { creditReward } from '../lib/economy';

export const stickerRoutes = new Hono<AppEnv>();

/** GET /api/stickers/album — ownership map + set claim state + packs. */
stickerRoutes.get('/stickers/album', async (c) => {
  const { telegramId } = c.get('auth');
  const db = serviceClient(c.env);

  const [ownedRes, claimsRes, statsRes] = await Promise.all([
    db.from('user_stickers').select('sticker_id, count').eq('telegram_id', telegramId),
    db.from('sticker_set_claims').select('set_id').eq('telegram_id', telegramId),
    db.from('user_stats').select('sticker_packs').eq('telegram_id', telegramId).maybeSingle()
  ]);
  if (ownedRes.error || claimsRes.error || statsRes.error || !statsRes.data) {
    console.error('album load failed:', ownedRes.error?.message ?? claimsRes.error?.message ?? statsRes.error?.message);
    return c.json({ error: 'server_error' }, 500);
  }

  return c.json({
    owned: Object.fromEntries((ownedRes.data ?? []).map((row) => [row.sticker_id, row.count])),
    claimed_sets: (claimsRes.data ?? []).map((row) => row.set_id),
    packs: statsRes.data.sticker_packs ?? 0,
    set_reward: SET_REWARD
  });
});

/**
 * POST /api/stickers/open — consumes one pack, rolls PACK_SIZE
 * stickers server-side. Duplicates auto-convert to coins by rarity.
 */
stickerRoutes.post('/stickers/open', async (c) => {
  const { telegramId } = c.get('auth');
  const db = serviceClient(c.env);

  // Guarded pack spend
  const { data: packsLeft, error: spendErr } = await db.rpc('spend_sticker_pack', {
    p_telegram_id: telegramId
  });
  if (spendErr) {
    console.error('spend_sticker_pack failed:', spendErr.message);
    return c.json({ error: 'server_error' }, 500);
  }
  if (packsLeft === null) {
    return c.json({ error: 'no_packs' }, 409);
  }

  const results: Array<{ id: string; is_new: boolean; dupe_coins: number }> = [];
  let dupeCoins = 0;

  for (let i = 0; i < PACK_SIZE; i++) {
    const sticker = rollSticker();
    // Upsert ownership; count>1 means duplicate
    const { data: existing } = await db
      .from('user_stickers')
      .select('count')
      .eq('telegram_id', telegramId)
      .eq('sticker_id', sticker.id)
      .maybeSingle();

    if (existing) {
      await db
        .from('user_stickers')
        .update({ count: existing.count + 1 })
        .eq('telegram_id', telegramId)
        .eq('sticker_id', sticker.id);
      const coins = sticker.rarity * DUPE_COINS_PER_RARITY;
      dupeCoins += coins;
      results.push({ id: sticker.id, is_new: false, dupe_coins: coins });
    } else {
      await db
        .from('user_stickers')
        .insert({ telegram_id: telegramId, sticker_id: sticker.id, count: 1 });
      results.push({ id: sticker.id, is_new: true, dupe_coins: 0 });
    }
  }

  let stats = null;
  if (dupeCoins > 0) {
    stats = await creditReward(db, telegramId, { coins: dupeCoins });
  }

  return c.json({ ok: true, stickers: results, dupe_coins: dupeCoins, packs_left: packsLeft, stats });
});

/**
 * POST /api/stickers/claim-set { set_id } — one-time set completion
 * reward, idempotent via the sticker_set_claims primary key.
 */
stickerRoutes.post('/stickers/claim-set', async (c) => {
  const { telegramId } = c.get('auth');
  const body = await c.req.json<{ set_id?: string }>().catch(() => ({ set_id: undefined }));
  const setId = body.set_id;
  if (!setId || !SET_IDS.includes(setId)) return c.json({ error: 'unknown_set' }, 404);

  const db = serviceClient(c.env);

  // Verify completion server-side
  const setStickers = stickersOfSet(setId);
  const { data: owned, error } = await db
    .from('user_stickers')
    .select('sticker_id')
    .eq('telegram_id', telegramId)
    .in('sticker_id', setStickers.map((s) => s.id));
  if (error) {
    console.error('claim-set check failed:', error.message);
    return c.json({ error: 'server_error' }, 500);
  }
  if ((owned ?? []).length < setStickers.length) {
    return c.json({ error: 'set_incomplete' }, 409);
  }

  const { error: claimErr } = await db
    .from('sticker_set_claims')
    .insert({ telegram_id: telegramId, set_id: setId });
  if (claimErr) {
    return c.json({ error: 'already_claimed' }, 409);
  }

  const stats = await creditReward(db, telegramId, SET_REWARD);
  return c.json({ ok: true, set_id: setId, reward: SET_REWARD, stats });
});
