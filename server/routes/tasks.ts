import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { serviceClient } from '../lib/supabase';
import { TASKS, CHECKIN_REWARDS, taskById } from '../config/tasks';
import { creditReward, utcToday, utcYesterday } from '../lib/economy';

export const taskRoutes = new Hono<AppEnv>();

async function qualifiedReferrals(db: ReturnType<typeof serviceClient>, telegramId: number) {
  const { count, error } = await db
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', telegramId)
    .eq('status', 'qualified');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * GET /api/tasks — the full earn-task list merged with per-user state.
 */
taskRoutes.get('/tasks', async (c) => {
  const { telegramId } = c.get('auth');
  const db = serviceClient(c.env);
  const today = utcToday();

  const [completionsRes, checkinRes, refCount] = await Promise.all([
    db.from('task_completions').select('task_id, day').eq('telegram_id', telegramId),
    db.from('checkin_state').select('*').eq('telegram_id', telegramId).maybeSingle(),
    qualifiedReferrals(db, telegramId)
  ]);
  if (completionsRes.error) {
    console.error(completionsRes.error.message);
    return c.json({ error: 'server_error' }, 500);
  }
  const completions = completionsRes.data ?? [];
  const checkin = checkinRes.data ?? { streak: 0, last_day: null };

  const tasks = TASKS.map((def) => {
    const claims = completions.filter((row) => row.task_id === def.id);
    let state: string;
    let claimsToday = 0;
    if (def.type === 'daily') {
      claimsToday = claims.filter((row) => row.day === today).length;
      state = claimsToday < (def.dailyLimit ?? 1) ? 'available' : 'done_today';
    } else if (def.type === 'once') {
      state = claims.length > 0 ? 'done' : 'available';
    } else {
      // referral milestone
      const claimed = claims.length > 0;
      const reached = refCount >= (def.requiredReferrals ?? 0);
      state = claimed ? 'done' : reached ? 'claimable' : 'locked';
    }
    return { ...def, state, claimsToday };
  });

  // Check-in: next day in the 7-day cycle, claimable once per UTC day
  const claimedToday = checkin.last_day === today;
  const continues = checkin.last_day === utcYesterday() || claimedToday;
  const streak = continues ? checkin.streak : 0;
  const nextDayIndex = claimedToday ? (streak - 1) % 7 : streak % 7;

  return c.json({
    tasks,
    checkin: {
      streak,
      claimed_today: claimedToday,
      next_day: nextDayIndex + 1, // 1-7 (day currently claimable / just claimed)
      rewards: CHECKIN_REWARDS
    },
    referrals: { qualified: refCount }
  });
});

/**
 * POST /api/tasks/claim { task_id } — validates and credits server-side.
 * task_id 'checkin' claims the daily check-in.
 */
taskRoutes.post('/tasks/claim', async (c) => {
  const { telegramId } = c.get('auth');
  const body = await c.req.json<{ task_id?: string }>().catch(() => ({ task_id: undefined }));
  const taskId = body.task_id;
  if (!taskId) return c.json({ error: 'bad_request' }, 400);

  const db = serviceClient(c.env);
  const today = utcToday();

  try {
    if (taskId === 'checkin') {
      const { data: checkin } = await db
        .from('checkin_state').select('*').eq('telegram_id', telegramId).maybeSingle();
      if (checkin?.last_day === today) {
        return c.json({ error: 'already_claimed' }, 409);
      }
      const streak = checkin?.last_day === utcYesterday() ? (checkin.streak ?? 0) + 1 : 1;
      const reward = CHECKIN_REWARDS[(streak - 1) % 7];

      const { error: upsertErr } = await db.from('checkin_state').upsert(
        { telegram_id: telegramId, streak, last_day: today },
        { onConflict: 'telegram_id' }
      );
      if (upsertErr) throw new Error(upsertErr.message);

      const result = await creditReward(db, telegramId, reward);
      return c.json({ ok: true, task_id: taskId, streak, day: ((streak - 1) % 7) + 1, reward, stats: result });
    }

    const def = taskById(taskId);
    if (!def) return c.json({ error: 'unknown_task' }, 404);

    if (def.type === 'daily') {
      const { count } = await db
        .from('task_completions')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_id', telegramId).eq('task_id', taskId).eq('day', today);
      if ((count ?? 0) >= (def.dailyLimit ?? 1)) {
        return c.json({ error: 'daily_limit_reached' }, 409);
      }
      const { error: insErr } = await db
        .from('task_completions')
        .insert({ telegram_id: telegramId, task_id: taskId, day: today });
      if (insErr) throw new Error(insErr.message);
    } else if (def.type === 'once') {
      const { error: insErr } = await db
        .from('task_completions')
        .insert({ telegram_id: telegramId, task_id: taskId, day: null });
      if (insErr) {
        // unique violation = already claimed
        return c.json({ error: 'already_claimed' }, 409);
      }
    } else if (def.type === 'referral_milestone') {
      const refCount = await qualifiedReferrals(db, telegramId);
      if (refCount < (def.requiredReferrals ?? Infinity)) {
        return c.json({ error: 'not_reached' }, 409);
      }
      const { error: insErr } = await db
        .from('task_completions')
        .insert({ telegram_id: telegramId, task_id: taskId, day: null });
      if (insErr) {
        return c.json({ error: 'already_claimed' }, 409);
      }
    }

    const result = await creditReward(db, telegramId, def.reward);
    return c.json({ ok: true, task_id: taskId, reward: def.reward, stats: result });
  } catch (err) {
    console.error('task claim failed:', err);
    return c.json({ error: 'server_error' }, 500);
  }
});

/**
 * GET /api/referrals — share link + progress.
 * BOT_USERNAME/APP_NAME come from wrangler vars once the bot is live.
 */
taskRoutes.get('/referrals', async (c) => {
  const { telegramId } = c.get('auth');
  const db = serviceClient(c.env);

  const [{ count: qualified }, { count: pending }] = await Promise.all([
    db.from('referrals').select('*', { count: 'exact', head: true })
      .eq('referrer_id', telegramId).eq('status', 'qualified'),
    db.from('referrals').select('*', { count: 'exact', head: true })
      .eq('referrer_id', telegramId).eq('status', 'pending')
  ]);

  const botUsername = c.env.BOT_USERNAME ?? 'YOUR_BOT';
  const appName = c.env.APP_NAME ?? 'game';

  return c.json({
    link: `https://t.me/${botUsername}/${appName}?startapp=ref_${telegramId}`,
    qualified: qualified ?? 0,
    pending: pending ?? 0
  });
});
