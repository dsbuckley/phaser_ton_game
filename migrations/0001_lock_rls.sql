-- ============================================================
-- MIGRATION 0001: Lock down Row Level Security
-- ============================================================
-- ⚠️ Deploy this AT THE SAME TIME as the Cloudflare Worker client.
-- The old client talks to Supabase directly with the anon key and
-- will BREAK the moment this runs. The new client only talks to the
-- Worker (service role key), which bypasses RLS.
--
-- After this migration: the anon key (which ships in the public JS
-- bundle) can read/write NOTHING. Only the Worker can.

-- Drop the permissive demo policies
DROP POLICY IF EXISTS "Allow all read access to user_stats" ON user_stats;
DROP POLICY IF EXISTS "Allow all insert access to user_stats" ON user_stats;
DROP POLICY IF EXISTS "Allow all update access to user_stats" ON user_stats;

-- users table: drop any existing policies and enable RLS
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' LOOP
    EXECUTE format('DROP POLICY %I ON users', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
-- RLS enabled + zero policies = anon/authenticated get nothing.
-- The service role bypasses RLS entirely.

-- Belt and braces: revoke direct table grants from the public roles
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- The user_profiles view would still be readable via its owner; drop it
-- (nothing uses it — it was a convenience view).
DROP VIEW IF EXISTS user_profiles;
