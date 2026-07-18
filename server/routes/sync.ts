import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { serviceClient } from '../lib/supabase';

export const syncRoutes = new Hono<AppEnv>();

interface SyncBody {
  elapsed_ms?: number;
  chests_opened?: number;
  auto_pop_chests?: number;
  coins_earned?: number;
  gems_earned?: number;
  energy_collected?: number;
  mega_jackpots?: number;
  auto_pops_collected?: number;
  xp_earned?: number;
  sound_enabled?: boolean;
  haptic_enabled?: boolean;
  first_time_events?: Record<string, boolean>;
}

const int = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
};

/**
 * POST /api/sync — batched chest-tap deltas from the client.
 * All validation/clamping happens atomically in the apply_sync
 * Postgres function; this route just sanitizes shape.
 */
syncRoutes.post('/sync', async (c) => {
  const { telegramId } = c.get('auth');
  const body = await c.req.json<SyncBody>().catch(() => ({}) as SyncBody);

  const db = serviceClient(c.env);
  const { data, error } = await db.rpc('apply_sync', {
    p_telegram_id: telegramId,
    p_elapsed_ms: int(body.elapsed_ms),
    p_chests: int(body.chests_opened),
    p_auto_pop_chests: int(body.auto_pop_chests),
    p_coins: int(body.coins_earned),
    p_gems: int(body.gems_earned),
    p_energy_collected: int(body.energy_collected),
    p_mega_jackpots: int(body.mega_jackpots),
    p_auto_pops_collected: int(body.auto_pops_collected),
    p_xp: int(body.xp_earned),
    p_sound: typeof body.sound_enabled === 'boolean' ? body.sound_enabled : null,
    p_haptic: typeof body.haptic_enabled === 'boolean' ? body.haptic_enabled : null,
    p_first_time: body.first_time_events && typeof body.first_time_events === 'object'
      ? body.first_time_events
      : null,
  });

  if (error) {
    console.error('apply_sync failed:', error.message);
    return c.json({ error: 'server_error' }, 500);
  }
  return c.json(data as Record<string, unknown>);
});
