-- ============================================================
-- MIGRATION 0002: New columns and tables for the finished game
-- ============================================================
-- Run after 0001. Safe to re-run (IF NOT EXISTS everywhere).

-- ---------- user_stats: new columns ----------
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0 CHECK (xp >= 0);
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS auto_pops INTEGER DEFAULT 0 CHECK (auto_pops >= 0);
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS total_jackpots INTEGER DEFAULT 0 CHECK (total_jackpots >= 0);
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- ---------- Daily leaderboard ----------
-- One row per (UTC day, user). A new day means new rows, so the
-- "00:00 UTC reset" needs no cron job at all.
CREATE TABLE IF NOT EXISTS leaderboard_daily (
  day DATE NOT NULL,
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  gems INTEGER NOT NULL DEFAULT 0 CHECK (gems >= 0),
  PRIMARY KEY (day, telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_daily_rank ON leaderboard_daily (day, gems DESC);

-- ---------- Sync audit (anti-cheat visibility) ----------
-- Raw client claims vs what the server accepted, logged when clamped.
CREATE TABLE IF NOT EXISTS sync_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  claimed JSONB NOT NULL,
  accepted JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_audit_user ON sync_audit (telegram_id, created_at DESC);

-- ---------- Telegram Stars purchases ----------
-- telegram_payment_charge_id UNIQUE makes webhook crediting idempotent:
-- a retried successful_payment update can never double-credit.
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  stars_amount INTEGER NOT NULL,
  telegram_payment_charge_id TEXT UNIQUE NOT NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'credited',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases (telegram_id, created_at DESC);

-- ---------- Referrals ----------
-- One referrer per referred user, forever (UNIQUE referred_id).
-- status: pending -> qualified (referred user opened 25 chests).
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  referred_id BIGINT UNIQUE NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  credited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id);

-- ---------- Earn tasks ----------
-- day = NULL for one-time tasks; a date for daily tasks.
CREATE TABLE IF NOT EXISTS task_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  day DATE,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);
-- Uniqueness: one claim per task per day; one claim ever when day IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_unique
  ON task_completions (telegram_id, task_id, COALESCE(day, '1970-01-01'::date));
CREATE INDEX IF NOT EXISTS idx_task_user_day ON task_completions (telegram_id, day);

CREATE TABLE IF NOT EXISTS checkin_state (
  telegram_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  streak INTEGER NOT NULL DEFAULT 0,
  last_day DATE
);

-- ---------- Stickers ----------
CREATE TABLE IF NOT EXISTS user_stickers (
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  sticker_id TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
  first_owned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (telegram_id, sticker_id)
);

CREATE TABLE IF NOT EXISTS sticker_set_claims (
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  set_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (telegram_id, set_id)
);

-- Sticker packs owned but not yet opened
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS sticker_packs INTEGER DEFAULT 0 CHECK (sticker_packs >= 0);

-- ---------- Wheel ----------
CREATE TABLE IF NOT EXISTS wheel_spins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  prize_type TEXT NOT NULL,
  prize_amount INTEGER NOT NULL,
  was_free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_user ON wheel_spins (telegram_id, created_at DESC);
