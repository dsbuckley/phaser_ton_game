-- ============================================================
-- MIGRATION 0003: Server-authoritative game logic (functions)
-- ============================================================
-- Run after 0002. All economy mutations happen inside these
-- functions so they are atomic and enforce the anti-cheat envelopes.

-- ---------- Level curve ----------
-- XP to go from level n to n+1: round(60 * 1.35^(n-1))
-- Matches src/config/levels.js on the client.
CREATE OR REPLACE FUNCTION level_from_xp(p_xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  lvl INTEGER := 1;
  remaining INTEGER := GREATEST(p_xp, 0);
  cost INTEGER;
BEGIN
  LOOP
    cost := ROUND(60 * POWER(1.35, lvl - 1))::INTEGER;
    EXIT WHEN remaining < cost OR lvl >= 99;
    remaining := remaining - cost;
    lvl := lvl + 1;
  END LOOP;
  RETURN lvl;
END $$;

-- ---------- Level-up rewards ----------
-- Called whenever user_level rises. Grants, for each level crossed:
-- tickets = ceil(level/2) capped at 5, +1 sticker pack every 5 levels,
-- plus a one-time energy refill to 100 (if below).
-- Matches src/config/levels.js on the client.
CREATE OR REPLACE FUNCTION grant_level_rewards(
  p_telegram_id BIGINT,
  p_old_level INTEGER,
  p_new_level INTEGER
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  lvl INTEGER;
  v_tickets INTEGER := 0;
  v_packs INTEGER := 0;
BEGIN
  IF p_new_level <= p_old_level THEN RETURN; END IF;
  FOR lvl IN (p_old_level + 1)..p_new_level LOOP
    v_tickets := v_tickets + LEAST(CEIL(lvl / 2.0)::INTEGER, 5);
    IF lvl % 5 = 0 THEN v_packs := v_packs + 1; END IF;
  END LOOP;
  UPDATE user_stats SET
    tickets = tickets + v_tickets,
    sticker_packs = sticker_packs + v_packs,
    energy = GREATEST(energy, 100)
  WHERE telegram_id = p_telegram_id;
END $$;

-- ---------- Generic resource credit ----------
-- Used by wheel spins, task claims, purchases, referral rewards.
-- Gems also feed the daily leaderboard. Returns the updated stats row.
CREATE OR REPLACE FUNCTION credit_resources(
  p_telegram_id BIGINT,
  p_coins INTEGER DEFAULT 0,
  p_gems INTEGER DEFAULT 0,
  p_energy INTEGER DEFAULT 0,
  p_tickets INTEGER DEFAULT 0,
  p_auto_pops INTEGER DEFAULT 0,
  p_sticker_packs INTEGER DEFAULT 0,
  p_xp INTEGER DEFAULT 0
) RETURNS user_stats
LANGUAGE plpgsql AS $$
DECLARE
  v_row user_stats;
  v_old_level INTEGER;
BEGIN
  SELECT user_level INTO v_old_level FROM user_stats WHERE telegram_id = p_telegram_id;

  UPDATE user_stats SET
    coins = coins + GREATEST(p_coins, 0),
    gems = gems + GREATEST(p_gems, 0),
    energy = GREATEST(energy + p_energy, 0),   -- negative allowed for spends
    tickets = GREATEST(tickets + p_tickets, 0),
    auto_pops = auto_pops + GREATEST(p_auto_pops, 0),
    sticker_packs = GREATEST(sticker_packs + p_sticker_packs, 0),
    xp = xp + GREATEST(p_xp, 0),
    user_level = level_from_xp(xp + GREATEST(p_xp, 0))
  WHERE telegram_id = p_telegram_id
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'user % not found', p_telegram_id;
  END IF;

  IF v_row.user_level > COALESCE(v_old_level, 1) THEN
    PERFORM grant_level_rewards(p_telegram_id, v_old_level, v_row.user_level);
    SELECT * INTO v_row FROM user_stats WHERE telegram_id = p_telegram_id;
  END IF;

  IF p_gems > 0 THEN
    INSERT INTO leaderboard_daily (day, telegram_id, gems)
    VALUES ((NOW() AT TIME ZONE 'utc')::date, p_telegram_id, p_gems)
    ON CONFLICT (day, telegram_id) DO UPDATE SET gems = leaderboard_daily.gems + EXCLUDED.gems;
  END IF;

  RETURN v_row;
END $$;

-- ---------- Guarded spends ----------
-- Atomic "spend if affordable" — returns the new balance, or NULL if
-- the user can't afford it (no partial spend ever happens).
CREATE OR REPLACE FUNCTION spend_tickets(p_telegram_id BIGINT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_new INTEGER;
BEGIN
  UPDATE user_stats SET tickets = tickets - p_amount
  WHERE telegram_id = p_telegram_id AND tickets >= p_amount
  RETURNING tickets INTO v_new;
  RETURN v_new; -- NULL when no row matched (insufficient tickets)
END $$;

CREATE OR REPLACE FUNCTION spend_sticker_pack(p_telegram_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_new INTEGER;
BEGIN
  UPDATE user_stats SET sticker_packs = sticker_packs - 1
  WHERE telegram_id = p_telegram_id AND sticker_packs >= 1
  RETURNING sticker_packs INTO v_new;
  RETURN v_new; -- NULL when no packs available
END $$;

CREATE OR REPLACE FUNCTION spend_coins(p_telegram_id BIGINT, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_new INTEGER;
BEGIN
  UPDATE user_stats SET coins = coins - p_amount
  WHERE telegram_id = p_telegram_id AND coins >= p_amount
  RETURNING coins INTO v_new;
  RETURN v_new;
END $$;

-- ---------- User bootstrap ----------
-- Upserts identity, creates stats row for new users, records the
-- referral from start_param (only on first-ever auth, never self).
CREATE OR REPLACE FUNCTION ensure_user(
  p_telegram_id BIGINT,
  p_username TEXT,
  p_photo_url TEXT,
  p_referrer_id BIGINT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_is_new BOOLEAN := false;
BEGIN
  INSERT INTO users (telegram_id, username, profile_photo_url)
  VALUES (p_telegram_id, p_username, p_photo_url)
  ON CONFLICT (telegram_id) DO UPDATE SET
    username = COALESCE(EXCLUDED.username, users.username),
    profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, users.profile_photo_url),
    updated_at = NOW();

  INSERT INTO user_stats (telegram_id)
  VALUES (p_telegram_id)
  ON CONFLICT (telegram_id) DO NOTHING;
  v_is_new := FOUND;

  IF v_is_new AND p_referrer_id IS NOT NULL AND p_referrer_id <> p_telegram_id
     AND EXISTS (SELECT 1 FROM users WHERE telegram_id = p_referrer_id) THEN
    INSERT INTO referrals (referrer_id, referred_id)
    VALUES (p_referrer_id, p_telegram_id)
    ON CONFLICT (referred_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('is_new', v_is_new);
END $$;

-- ---------- The sync endpoint core ----------
-- Accepts a batch of client-side chest-tap deltas, validates them
-- against hard envelopes, clamps anything impossible, applies hourly
-- energy grants from SERVER time, updates the daily leaderboard, and
-- qualifies pending referrals at 25 chests.
--
-- Philosophy: clamp, don't reject. Legit users with clock skew never
-- get errors; cheaters silently get the maximum legitimate amount and
-- their raw claim is logged to sync_audit.
CREATE OR REPLACE FUNCTION apply_sync(
  p_telegram_id BIGINT,
  p_elapsed_ms INTEGER,
  p_chests INTEGER,
  p_auto_pop_chests INTEGER,
  p_coins INTEGER,
  p_gems INTEGER,
  p_energy_collected INTEGER,
  p_mega_jackpots INTEGER,
  p_auto_pops_collected INTEGER,
  p_xp INTEGER,
  p_sound BOOLEAN DEFAULT NULL,
  p_haptic BOOLEAN DEFAULT NULL,
  p_first_time JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v user_stats;
  v_now TIMESTAMPTZ := NOW();
  v_server_elapsed_ms BIGINT;
  v_elapsed_ms INTEGER;
  v_granted INTEGER := 0;
  v_hours INTEGER;
  v_pops_collected INTEGER;
  v_auto_chests INTEGER;
  v_pops_consumed INTEGER;
  v_new_auto_pops INTEGER;
  v_max_rate INTEGER;
  v_energy_collected INTEGER;
  v_paid_budget INTEGER;
  v_paid_chests INTEGER;
  v_chests INTEGER;
  v_mega INTEGER;
  v_mega_allowed INTEGER;
  v_coins INTEGER;
  v_gems INTEGER;
  v_gems_today INTEGER;
  v_xp INTEGER;
  v_new_energy INTEGER;
  v_clamped BOOLEAN;
  v_key TEXT;
  v_ft JSONB;
  v_referrer BIGINT;
  v_referral_bonus BOOLEAN := false;
  v_old_level INTEGER;
BEGIN
  SELECT * INTO v FROM user_stats WHERE telegram_id = p_telegram_id FOR UPDATE;
  IF v IS NULL THEN
    RAISE EXCEPTION 'user % not found', p_telegram_id;
  END IF;
  v_old_level := COALESCE(v.user_level, 1);

  -- Sanitize claims
  p_chests := GREATEST(COALESCE(p_chests, 0), 0);
  p_auto_pop_chests := LEAST(GREATEST(COALESCE(p_auto_pop_chests, 0), 0), p_chests);
  p_coins := GREATEST(COALESCE(p_coins, 0), 0);
  p_gems := GREATEST(COALESCE(p_gems, 0), 0);
  p_energy_collected := GREATEST(COALESCE(p_energy_collected, 0), 0);
  p_mega_jackpots := GREATEST(COALESCE(p_mega_jackpots, 0), 0);
  p_auto_pops_collected := GREATEST(COALESCE(p_auto_pops_collected, 0), 0);
  p_xp := GREATEST(COALESCE(p_xp, 0), 0);

  -- Elapsed time bounded by real server time since last sync (+3s skew slack)
  v_server_elapsed_ms := GREATEST(
    EXTRACT(EPOCH FROM (v_now - COALESCE(v.last_sync_at, v_now - INTERVAL '60 seconds'))) * 1000,
    1000
  )::BIGINT;
  v_elapsed_ms := LEAST(GREATEST(COALESCE(p_elapsed_ms, 0), 0)::BIGINT, v_server_elapsed_ms + 3000)::INTEGER;

  -- Hourly energy grants from server clock: +5 per full hour, cap 100
  v_hours := FLOOR(EXTRACT(EPOCH FROM (date_trunc('hour', v_now) - date_trunc('hour', COALESCE(v.last_energy_grant_hour, v_now)))) / 3600)::INTEGER;
  IF v_hours > 0 THEN
    IF v.energy < 100 THEN
      v_granted := LEAST(v_hours * 5, 100 - v.energy);
    END IF;
    v.last_energy_grant_hour := date_trunc('hour', v_now);
  END IF;

  -- Auto-pop accounting: drops are ~5% per chest (envelope 8% + 1);
  -- each auto-pop grants 10 free chest opens (see startAutoPopSequence)
  v_pops_collected := LEAST(p_auto_pops_collected, CEIL(p_chests * 0.08)::INTEGER + 1);
  v_auto_chests := LEAST(p_auto_pop_chests, (v.auto_pops + v_pops_collected) * 10);
  v_pops_consumed := CEIL(v_auto_chests / 10.0)::INTEGER;
  v_new_auto_pops := GREATEST(v.auto_pops + v_pops_collected - v_pops_consumed, 0);

  -- Energy pickups: ~25% chance of 1-3 items (+1 each) + combo bonus.
  -- Mega jackpots stream many tappable energy items, so allow 100 per
  -- claimed jackpot (bounded at 2 per batch).
  v_energy_collected := LEAST(
    p_energy_collected,
    CEIL(p_chests * 0.75)::INTEGER + 5 + LEAST(p_mega_jackpots, 2) * 100
  );

  -- Paid chests bounded by energy budget AND tap-rate cap (12/s + slack)
  v_max_rate := (v_elapsed_ms / 1000) * 12 + 5;
  v_paid_budget := v.energy + v_granted + v_energy_collected;
  v_paid_chests := LEAST(p_chests - v_auto_chests, v_paid_budget, v_max_rate);
  v_paid_chests := GREATEST(v_paid_chests, 0);
  v_chests := v_paid_chests + v_auto_chests;
  v_new_energy := v.energy + v_granted + v_energy_collected - v_paid_chests;

  -- Mega jackpots: lifetime count must stay within ~2x the 0.5% rate
  -- (+1 for the guaranteed first-timer)
  v_mega_allowed := CEIL((v.total_chests_opened + v_chests) * 0.01)::INTEGER + 1;
  v_mega := LEAST(p_mega_jackpots, GREATEST(v_mega_allowed - v.total_jackpots, 0));

  -- Coins: max normal payout is 150/chest, scaled by the level coin
  -- bonus (+10%/level, see src/config/levels.js). Envelope uses
  -- level+1 for headroom in case the player levels mid-batch.
  v_coins := LEAST(p_coins, CEIL(
    (v_chests * 160 + v_mega * 5000) * (1 + v.user_level * 0.10)
  )::INTEGER);

  -- Gems (leaderboard currency — strictest): ~10% drop of +1 + combo
  -- bonus, envelope 35% + 5, plus a hard daily cap of 500 from taps
  SELECT COALESCE(gems, 0) INTO v_gems_today
  FROM leaderboard_daily
  WHERE day = (v_now AT TIME ZONE 'utc')::date AND telegram_id = p_telegram_id;
  v_gems_today := COALESCE(v_gems_today, 0);
  v_gems := LEAST(p_gems, CEIL(v_chests * 0.35)::INTEGER + 5, GREATEST(500 - v_gems_today, 0));

  -- XP from taps: 1 per chest (other XP sources are credited server-side)
  v_xp := LEAST(p_xp, v_chests);

  -- First-time flags: only false -> true transitions
  v_ft := v.first_time_events;
  IF p_first_time IS NOT NULL THEN
    FOR v_key IN SELECT jsonb_object_keys(p_first_time) LOOP
      IF (p_first_time -> v_key) = 'true'::jsonb THEN
        v_ft := jsonb_set(COALESCE(v_ft, '{}'::jsonb), ARRAY[v_key], 'true'::jsonb);
      END IF;
    END LOOP;
  END IF;

  v_clamped := (v_chests < p_chests) OR (v_coins < p_coins) OR (v_gems < p_gems)
    OR (v_energy_collected < p_energy_collected) OR (v_mega < p_mega_jackpots)
    OR (v_pops_collected < p_auto_pops_collected);

  UPDATE user_stats SET
    coins = coins + v_coins,
    gems = gems + v_gems,
    energy = v_new_energy,
    auto_pops = v_new_auto_pops,
    total_chests_opened = total_chests_opened + v_chests,
    total_jackpots = total_jackpots + v_mega,
    xp = xp + v_xp,
    user_level = level_from_xp(xp + v_xp),
    first_time_events = v_ft,
    last_energy_grant_hour = v.last_energy_grant_hour,
    last_energy_update = v_now,
    last_sync_at = v_now,
    sound_enabled = COALESCE(p_sound, sound_enabled),
    haptic_enabled = COALESCE(p_haptic, haptic_enabled)
  WHERE telegram_id = p_telegram_id
  RETURNING * INTO v;

  -- Level-up rewards (energy refill, tickets, sticker packs)
  IF v.user_level > v_old_level THEN
    PERFORM grant_level_rewards(p_telegram_id, v_old_level, v.user_level);
    SELECT * INTO v FROM user_stats WHERE telegram_id = p_telegram_id;
  END IF;

  IF v_gems > 0 THEN
    INSERT INTO leaderboard_daily (day, telegram_id, gems)
    VALUES ((v_now AT TIME ZONE 'utc')::date, p_telegram_id, v_gems)
    ON CONFLICT (day, telegram_id) DO UPDATE SET gems = leaderboard_daily.gems + EXCLUDED.gems;
  END IF;

  IF v_clamped THEN
    INSERT INTO sync_audit (telegram_id, claimed, accepted)
    VALUES (p_telegram_id,
      jsonb_build_object('chests', p_chests, 'coins', p_coins, 'gems', p_gems,
        'energy_collected', p_energy_collected, 'mega', p_mega_jackpots,
        'auto_pops', p_auto_pops_collected, 'elapsed_ms', p_elapsed_ms),
      jsonb_build_object('chests', v_chests, 'coins', v_coins, 'gems', v_gems,
        'energy_collected', v_energy_collected, 'mega', v_mega,
        'auto_pops', v_pops_collected));
  END IF;

  -- Referral qualification: referred user crossed 25 lifetime chests
  IF v.total_chests_opened >= 25 AND (v.total_chests_opened - v_chests) < 25 THEN
    UPDATE referrals SET status = 'qualified', credited_at = v_now
    WHERE referred_id = p_telegram_id AND status = 'pending'
    RETURNING referrer_id INTO v_referrer;
    IF v_referrer IS NOT NULL THEN
      -- Referrer: +50 energy, +1000 coins, +1 auto-pop
      PERFORM credit_resources(v_referrer, p_coins => 1000, p_energy => 50, p_auto_pops => 1);
      -- Referred (this user): +50 energy, +500 coins
      v := credit_resources(p_telegram_id, p_coins => 500, p_energy => 50);
      v_referral_bonus := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'stats', to_jsonb(v),
    'granted_energy', v_granted,
    'next_grant_at', date_trunc('hour', v_now) + INTERVAL '1 hour',
    'clamped', v_clamped,
    'referral_bonus', v_referral_bonus
  );
END $$;

-- ---------- Daily leaderboard read ----------
CREATE OR REPLACE FUNCTION get_leaderboard(p_telegram_id BIGINT, p_limit INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'utc')::date;
  v_top JSONB;
  v_my_gems INTEGER;
  v_my_rank INTEGER;
BEGIN
  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_top
  FROM (
    SELECT jsonb_build_object(
      'rank', ROW_NUMBER() OVER (ORDER BY l.gems DESC, l.telegram_id),
      'telegram_id', l.telegram_id,
      'username', u.username,
      'photo_url', u.profile_photo_url,
      'level', COALESCE(s.user_level, 1),
      'gems', l.gems
    ) AS row_data
    FROM leaderboard_daily l
    JOIN users u ON u.telegram_id = l.telegram_id
    LEFT JOIN user_stats s ON s.telegram_id = l.telegram_id
    WHERE l.day = v_today AND l.gems > 0
    ORDER BY l.gems DESC, l.telegram_id
    LIMIT LEAST(GREATEST(p_limit, 1), 200)
  ) t;

  SELECT gems INTO v_my_gems
  FROM leaderboard_daily
  WHERE day = v_today AND telegram_id = p_telegram_id;

  IF v_my_gems IS NULL OR v_my_gems = 0 THEN
    v_my_rank := NULL;
    v_my_gems := 0;
  ELSE
    SELECT COUNT(*) + 1 INTO v_my_rank
    FROM leaderboard_daily
    WHERE day = v_today AND gems > v_my_gems;
  END IF;

  RETURN jsonb_build_object(
    'top', v_top,
    'me', jsonb_build_object('rank', v_my_rank, 'gems', v_my_gems),
    'resets_at', (v_today + 1)::timestamptz
  );
END $$;

-- ---------- Stars purchase crediting (idempotent) ----------
-- Called from the bot webhook on successful_payment. The UNIQUE
-- constraint on telegram_payment_charge_id means a retried webhook
-- inserts nothing and credits nothing.
CREATE OR REPLACE FUNCTION credit_purchase(
  p_telegram_id BIGINT,
  p_product_id TEXT,
  p_stars INTEGER,
  p_charge_id TEXT,
  p_coins INTEGER DEFAULT 0,
  p_gems INTEGER DEFAULT 0,
  p_energy INTEGER DEFAULT 0,
  p_tickets INTEGER DEFAULT 0,
  p_sticker_packs INTEGER DEFAULT 0,
  p_payload JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_row user_stats;
BEGIN
  INSERT INTO purchases (telegram_id, product_id, stars_amount, telegram_payment_charge_id, payload)
  VALUES (p_telegram_id, p_product_id, p_stars, p_charge_id, p_payload)
  ON CONFLICT (telegram_payment_charge_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'duplicate');
  END IF;

  v_row := credit_resources(p_telegram_id,
    p_coins => p_coins, p_gems => p_gems, p_energy => p_energy,
    p_tickets => p_tickets, p_sticker_packs => p_sticker_packs, p_xp => 100);

  RETURN jsonb_build_object('credited', true, 'stats', to_jsonb(v_row));
END $$;
