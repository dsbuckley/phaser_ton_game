import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { serviceClient } from '../lib/supabase';
import { taskById } from '../config/tasks';
import { creditReward, utcToday } from '../lib/economy';

/**
 * Adsgram server-side postback (Reward URL).
 *
 * Configure the RewardedVideo block's server callback as:
 *   https://<worker>/api/adsgram/reward?userid={userid}&key=<TELEGRAM_WEBHOOK_SECRET>
 * ({userid} is substituted by Adsgram with the value passed to
 * AdController.init on the client.)
 *
 * NOTE: when this postback is configured, the client claim path for
 * watch_ad is redundant — use one or the other, not both (the client
 * falls back to POST /api/tasks/claim only in dev/mock mode).
 *
 * This route is mounted OUTSIDE the initData auth middleware because
 * Adsgram's servers call it directly.
 */
export const adsgramRoutes = new Hono<AppEnv>();

adsgramRoutes.get('/adsgram/reward', async (c) => {
  const key = c.req.query('key');
  if (!key || key !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: 'forbidden' }, 403);
  }
  const userId = Number(c.req.query('userid'));
  if (!Number.isFinite(userId)) return c.json({ error: 'bad_request' }, 400);

  const def = taskById('watch_ad');
  if (!def) return c.json({ error: 'server_error' }, 500);

  const db = serviceClient(c.env);
  const today = utcToday();

  const { count } = await db
    .from('task_completions')
    .select('*', { count: 'exact', head: true })
    .eq('telegram_id', userId).eq('task_id', 'watch_ad').eq('day', today);
  if ((count ?? 0) >= (def.dailyLimit ?? 3)) {
    // Cap reached — acknowledge so Adsgram doesn't retry, but credit nothing
    return c.json({ ok: true, credited: false });
  }

  const { error: insErr } = await db
    .from('task_completions')
    .insert({ telegram_id: userId, task_id: 'watch_ad', day: today });
  if (insErr) {
    console.error('adsgram completion insert failed:', insErr.message);
    return c.json({ error: 'server_error' }, 500);
  }

  try {
    await creditReward(db, userId, def.reward);
  } catch (err) {
    console.error('adsgram credit failed:', err);
    return c.json({ error: 'server_error' }, 500);
  }
  return c.json({ ok: true, credited: true });
});
