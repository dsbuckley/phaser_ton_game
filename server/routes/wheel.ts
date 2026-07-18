import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { serviceClient } from '../lib/supabase';
import { WHEEL_SEGMENTS, FREE_SPINS_PER_DAY, SPIN_XP, rollSegment } from '../config/wheel';
import { creditReward } from '../lib/economy';

export const wheelRoutes = new Hono<AppEnv>();

async function freeSpinsUsedToday(db: ReturnType<typeof serviceClient>, telegramId: number) {
  const since = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';
  const { count } = await db
    .from('wheel_spins')
    .select('*', { count: 'exact', head: true })
    .eq('telegram_id', telegramId)
    .eq('was_free', true)
    .gte('created_at', since);
  return count ?? 0;
}

/** GET /api/wheel/state — tickets + free ad spins remaining today. */
wheelRoutes.get('/wheel/state', async (c) => {
  const { telegramId } = c.get('auth');
  const db = serviceClient(c.env);

  const [{ data: stats, error }, usedFree] = await Promise.all([
    db.from('user_stats').select('tickets').eq('telegram_id', telegramId).maybeSingle(),
    freeSpinsUsedToday(db, telegramId)
  ]);
  if (error || !stats) {
    // Never report a made-up balance — the client treats this value
    // as authoritative
    console.error('wheel state failed:', error?.message ?? 'no stats row');
    return c.json({ error: 'server_error' }, 500);
  }

  return c.json({
    tickets: stats.tickets ?? 0,
    free_spins_left: Math.max(FREE_SPINS_PER_DAY - usedFree, 0),
    segments: WHEEL_SEGMENTS // client uses this to stay in sync with weights/prizes
  });
});

/**
 * POST /api/wheel/spin { use_free?: boolean }
 * Paid spins debit 1 ticket atomically; free spins are capped per day
 * (client shows a rewarded ad first). Server rolls the outcome.
 */
wheelRoutes.post('/wheel/spin', async (c) => {
  const { telegramId } = c.get('auth');
  const body = await c.req.json<{ use_free?: boolean }>().catch(() => ({ use_free: false }));
  const useFree = body.use_free === true;
  const db = serviceClient(c.env);

  if (useFree) {
    const used = await freeSpinsUsedToday(db, telegramId);
    if (used >= FREE_SPINS_PER_DAY) {
      return c.json({ error: 'no_free_spins' }, 409);
    }
  } else {
    // Guarded atomic ticket spend — returns null at insufficient balance
    const { data: row, error } = await db.rpc('spend_tickets', {
      p_telegram_id: telegramId,
      p_amount: 1
    });
    if (error) {
      console.error('spend_tickets failed:', error.message);
      return c.json({ error: 'server_error' }, 500);
    }
    if (!row) {
      return c.json({ error: 'not_enough_tickets' }, 409);
    }
  }

  const segment = rollSegment();
  const prize = segment.prize;

  try {
    const stats = await creditReward(db, telegramId, {
      coins: prize.coins ?? 0,
      gems: prize.gems ?? 0,
      energy: prize.energy ?? 0,
      sticker_packs: prize.sticker_packs ?? 0,
      xp: SPIN_XP
    });

    await db.from('wheel_spins').insert({
      telegram_id: telegramId,
      prize_type: prize.type,
      prize_amount: prize.coins ?? prize.gems ?? prize.energy ?? 0,
      was_free: useFree
    });

    return c.json({ ok: true, segment_index: segment.index, prize, stats });
  } catch (err) {
    console.error('wheel credit failed:', err);
    return c.json({ error: 'server_error' }, 500);
  }
});
