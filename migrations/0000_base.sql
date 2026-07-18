-- ============================================================
-- MIGRATION 0000: Base tables (fresh database only)
-- ============================================================
-- The original project grew these tables ad hoc (see supabase_schema.sql,
-- kept for history). A brand-new Supabase project needs them created
-- before 0002/0003/0001. Safe to re-run (IF NOT EXISTS everywhere).

-- ---------- users: identity ----------
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  wallet_address TEXT,
  profile_photo_url TEXT,
  high_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- user_stats: game progression and resources ----------
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,

  coins INTEGER DEFAULT 0 CHECK (coins >= 0),
  tickets INTEGER DEFAULT 0 CHECK (tickets >= 0),
  gems INTEGER DEFAULT 0 CHECK (gems >= 0),

  -- Energy can exceed 100 via collected items; auto-refill caps at 100
  energy INTEGER DEFAULT 100 CHECK (energy >= 0),
  last_energy_update TIMESTAMPTZ DEFAULT NOW(),
  last_energy_grant_hour TIMESTAMPTZ DEFAULT date_trunc('hour', NOW()),

  user_level INTEGER DEFAULT 1 CHECK (user_level >= 1),
  high_score INTEGER DEFAULT 0 CHECK (high_score >= 0),
  total_chests_opened INTEGER DEFAULT 0 CHECK (total_chests_opened >= 0),

  sound_enabled BOOLEAN DEFAULT true,
  haptic_enabled BOOLEAN DEFAULT true,

  -- One-time event flags (tutorial, guaranteed first jackpot, ...)
  first_time_events JSONB DEFAULT '{
    "guaranteed_mega_jackpot": false,
    "tutorial_completed": false,
    "welcome_bonus_claimed": false
  }'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_telegram_id FOREIGN KEY (telegram_id)
    REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_stats_telegram_id ON user_stats(telegram_id);
CREATE INDEX IF NOT EXISTS idx_first_time_events ON user_stats USING GIN (first_time_events);

-- ---------- updated_at maintenance ----------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;
CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON user_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
