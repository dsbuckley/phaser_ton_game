import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { serviceClient } from '../lib/supabase';

export const leaderboardRoutes = new Hono<AppEnv>();

/**
 * GET /api/leaderboard — today's top players by gems earned (UTC day).
 * Gems only enter leaderboard_daily through server-accepted syncs and
 * server-rolled rewards, so ranks can't be spoofed.
 */
leaderboardRoutes.get('/leaderboard', async (c) => {
  const { telegramId } = c.get('auth');
  const limit = Number(c.req.query('limit') ?? 100);
  const db = serviceClient(c.env);

  const { data, error } = await db.rpc('get_leaderboard', {
    p_telegram_id: telegramId,
    p_limit: Number.isFinite(limit) ? limit : 100
  });
  if (error) {
    console.error('get_leaderboard failed:', error.message);
    return c.json({ error: 'server_error' }, 500);
  }
  return c.json(data as Record<string, unknown>);
});
