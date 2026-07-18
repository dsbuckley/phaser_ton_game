import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { serviceClient } from '../lib/supabase';

export const authRoutes = new Hono<AppEnv>();

/**
 * POST /api/auth — called once on game load.
 * Upserts identity from the VERIFIED initData, creates stats for new
 * users, records referral from start_param, then runs a zero-delta
 * sync so hourly energy grants apply and the client gets the full
 * authoritative state in one round trip.
 */
authRoutes.post('/auth', async (c) => {
  const { telegramId, user, startParam } = c.get('auth');
  const db = serviceClient(c.env);

  let referrerId: number | null = null;
  const refMatch = startParam?.match(/^ref_(\d+)$/);
  if (refMatch) referrerId = Number(refMatch[1]);

  const username =
    user.username ?? [user.first_name, user.last_name].filter(Boolean).join(' ') ?? null;

  const { error: ensureError } = await db.rpc('ensure_user', {
    p_telegram_id: telegramId,
    p_username: username,
    p_photo_url: user.photo_url ?? null,
    p_referrer_id: referrerId,
  });
  if (ensureError) {
    console.error('ensure_user failed:', ensureError.message);
    return c.json({ error: 'server_error' }, 500);
  }

  const { data, error: syncError } = await db.rpc('apply_sync', {
    p_telegram_id: telegramId,
    p_elapsed_ms: 0,
    p_chests: 0,
    p_auto_pop_chests: 0,
    p_coins: 0,
    p_gems: 0,
    p_energy_collected: 0,
    p_mega_jackpots: 0,
    p_auto_pops_collected: 0,
    p_xp: 0,
  });
  if (syncError) {
    console.error('apply_sync (auth) failed:', syncError.message);
    return c.json({ error: 'server_error' }, 500);
  }

  return c.json({
    user: { telegram_id: telegramId, username, photo_url: user.photo_url ?? null },
    ...(data as Record<string, unknown>),
  });
});

// Telegram id allowed to use the in-game "Reset Stats" dev button
const DEV_TELEGRAM_ID = 253305963;

/** POST /api/dev/reset — dev-only stat reset (mirrors the SettingsModal button). */
authRoutes.post('/dev/reset', async (c) => {
  const { telegramId } = c.get('auth');
  if (telegramId !== DEV_TELEGRAM_ID && c.env.DEV_ALLOW_MOCK !== '1') {
    return c.json({ error: 'forbidden' }, 403);
  }
  const db = serviceClient(c.env);
  const { error } = await db
    .from('user_stats')
    .update({
      coins: 0,
      gems: 0,
      tickets: 0,
      energy: 100,
      xp: 0,
      user_level: 1,
      auto_pops: 0,
      sticker_packs: 0,
      total_chests_opened: 0,
      total_jackpots: 0,
      last_energy_update: new Date().toISOString(),
      first_time_events: {
        guaranteed_mega_jackpot: false,
        tutorial_completed: false,
        welcome_bonus_claimed: false,
      },
    })
    .eq('telegram_id', telegramId);
  if (error) {
    console.error('dev reset failed:', error.message);
    return c.json({ error: 'server_error' }, 500);
  }
  return c.json({ ok: true });
});

/** POST /api/wallet — stores the connected TON wallet address (display only, unverified). */
authRoutes.post('/wallet', async (c) => {
  const { telegramId } = c.get('auth');
  const body = await c.req.json<{ address?: string }>().catch(() => ({ address: undefined }));
  const address = typeof body.address === 'string' ? body.address.slice(0, 128) : null;

  const db = serviceClient(c.env);
  const { error } = await db
    .from('users')
    .update({ wallet_address: address })
    .eq('telegram_id', telegramId);
  if (error) {
    console.error('wallet save failed:', error.message);
    return c.json({ error: 'server_error' }, 500);
  }
  return c.json({ ok: true });
});
