import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskReward } from '../config/tasks';

/** Credit a reward bundle atomically via the credit_resources function. */
export async function creditReward(db: SupabaseClient, telegramId: number, reward: TaskReward) {
  const { data, error } = await db.rpc('credit_resources', {
    p_telegram_id: telegramId,
    p_coins: reward.coins ?? 0,
    p_gems: reward.gems ?? 0,
    p_energy: reward.energy ?? 0,
    p_tickets: reward.tickets ?? 0,
    p_auto_pops: 0,
    p_sticker_packs: reward.sticker_packs ?? 0,
    p_xp: reward.xp ?? 0,
  });
  if (error) throw new Error(`credit_resources failed: ${error.message}`);
  return data as Record<string, unknown>;
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function utcYesterday(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}
