-- ============================================
-- SUPABASE DATABASE SCHEMA FOR PHASER TELEGRAM GAME
-- ============================================
-- Run these commands in your Supabase SQL Editor
-- Order matters: Run from top to bottom

-- ============================================
-- STEP 1: Update existing users table
-- ============================================
-- Add profile_photo_url column to store Telegram avatar URL
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- ============================================
-- STEP 2: Create user_stats table
-- ============================================
-- Stores game progress and resources for each user
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,

  -- Resource counters
  coins INTEGER DEFAULT 0 CHECK (coins >= 0),
  tickets INTEGER DEFAULT 0 CHECK (tickets >= 0),
  gems INTEGER DEFAULT 0 CHECK (gems >= 0),

  -- Energy/stamina system
  energy INTEGER DEFAULT 100 CHECK (energy >= 0 AND energy <= 100),
  last_energy_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Progression
  user_level INTEGER DEFAULT 1 CHECK (user_level >= 1),
  high_score INTEGER DEFAULT 0 CHECK (high_score >= 0),
  total_chests_opened INTEGER DEFAULT 0 CHECK (total_chests_opened >= 0),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Foreign key to users table
  CONSTRAINT fk_telegram_id FOREIGN KEY (telegram_id)
    REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- ============================================
-- STEP 3: Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_stats_telegram_id
ON user_stats(telegram_id);

-- ============================================
-- STEP 4: Create updated_at trigger function
-- ============================================
-- This function automatically updates the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 5: Attach trigger to user_stats table
-- ============================================
DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;

CREATE TRIGGER update_user_stats_updated_at
BEFORE UPDATE ON user_stats
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 6: Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 7: Create RLS Policies
-- ============================================
-- Note: These are permissive policies for demo/development.
-- For production, you should implement proper backend authentication.

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all read access to user_stats" ON user_stats;
DROP POLICY IF EXISTS "Allow all insert access to user_stats" ON user_stats;
DROP POLICY IF EXISTS "Allow all update access to user_stats" ON user_stats;

-- Policy: Allow all reads (for demo purposes)
CREATE POLICY "Allow all read access to user_stats" ON user_stats
  FOR SELECT USING (true);

-- Policy: Allow all inserts (for demo purposes)
CREATE POLICY "Allow all insert access to user_stats" ON user_stats
  FOR INSERT WITH CHECK (true);

-- Policy: Allow all updates (for demo purposes)
CREATE POLICY "Allow all update access to user_stats" ON user_stats
  FOR UPDATE USING (true);

-- ============================================
-- STEP 8: Create helpful view (optional)
-- ============================================
-- Combines user identity with stats for easy querying
CREATE OR REPLACE VIEW user_profiles AS
SELECT
  u.id,
  u.telegram_id,
  u.username,
  u.wallet_address,
  u.profile_photo_url,
  us.coins,
  us.tickets,
  us.gems,
  us.energy,
  us.last_energy_update,
  us.user_level,
  us.high_score,
  us.total_chests_opened,
  u.created_at as account_created,
  us.updated_at as stats_updated
FROM users u
LEFT JOIN user_stats us ON u.telegram_id = us.telegram_id;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify everything was created correctly

-- Check if user_stats table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'user_stats';

-- Check columns in user_stats
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_stats'
ORDER BY ordinal_position;

-- Check if indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'user_stats';

-- Check RLS policies
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'user_stats';

-- ============================================
-- EXAMPLE QUERIES FOR TESTING
-- ============================================

-- Insert a test user (if not exists)
INSERT INTO users (telegram_id, username, profile_photo_url)
VALUES (123456789, 'test_user', 'https://example.com/avatar.jpg')
ON CONFLICT (telegram_id) DO NOTHING;

-- Insert test stats for the user
INSERT INTO user_stats (telegram_id, coins, energy, user_level)
VALUES (123456789, 100, 75, 2)
ON CONFLICT (telegram_id)
DO UPDATE SET
  coins = EXCLUDED.coins,
  energy = EXCLUDED.energy,
  user_level = EXCLUDED.user_level;

-- Query the combined view
SELECT * FROM user_profiles WHERE telegram_id = 123456789;

-- ============================================
-- PRODUCTION SECURITY NOTES
-- ============================================
-- ⚠️ WARNING: The RLS policies above use USING (true) which allows
-- any authenticated user to read/write ANY user's data.
--
-- For production, you should:
-- 1. Implement backend API for Telegram auth verification
-- 2. Use Supabase Auth to create authenticated sessions
-- 3. Replace policies with proper user isolation:
--
-- CREATE POLICY "Users can read own stats" ON user_stats
--   FOR SELECT USING (telegram_id::text = auth.uid());
--
-- CREATE POLICY "Users can update own stats" ON user_stats
--   FOR UPDATE USING (telegram_id::text = auth.uid());
--
-- 4. Route all database operations through your backend API
-- 5. Verify Telegram initData hash on backend before allowing access
