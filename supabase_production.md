-- Create users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  wallet_address TEXT,
  high_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_users_telegram_id ON users(telegram_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: a user can only read their own row
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (telegram_id::text = auth.uid());

-- Policy: a user can only insert their own row
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (telegram_id::text = auth.uid());

-- Policy: a user can only update their own row
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (telegram_id::text = auth.uid());

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
