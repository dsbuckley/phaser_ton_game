# Deployment Runbook — Cloudflare Worker + Supabase

The game now runs as a **single Cloudflare Worker**: it serves the built game
(`dist/`) at the edge and handles all API routes (`/api/*`) plus the Telegram
bot webhook (`/webhook`). The browser never talks to Supabase — only the
Worker does, using the service-role key.

## One-time setup

### 1. Secrets

```bash
npx wrangler login                       # if not already
npx wrangler secret put TELEGRAM_BOT_TOKEN        # from @BotFather
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY # Supabase > Settings > API > service_role
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # any long random string, e.g. `openssl rand -hex 32`
```

### 2. Database migrations

Run these in the Supabase SQL Editor **in order**:

1. `migrations/0002_tables.sql` — new tables/columns (safe anytime, additive)
2. `migrations/0003_functions.sql` — game-logic functions (safe anytime)
3. `migrations/0001_lock_rls.sql` — ⚠️ **run this LAST, right when you deploy
   the Worker.** It cuts off the anon key that the OLD client (current
   Cloudflare Pages site) uses. Old client + locked RLS = users can't save.
   New client + open RLS = cheating hole still open. Do 0001 and the deploy
   together.

### 3. First deploy

```bash
npm run deploy        # vite build && wrangler deploy
```

Note the Worker URL (e.g. `https://phaser-ton-game.<you>.workers.dev`) or
attach a custom domain in the Cloudflare dashboard.

### 4. Point Telegram at the Worker

- In @BotFather: **Bot Settings → Menu Button / Mini App URL** → set to the
  Worker URL (replaces the old `phaser-ton-game.pages.dev`).
- Update `public/tonconnect-manifest.json` `url`/`iconUrl` to the new domain,
  then redeploy.

### 5. Register the bot webhook (needed for Telegram Stars, Phase 6)

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://<your-worker-domain>/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET value>",
    "allowed_updates": ["message", "pre_checkout_query"]
  }'
```

### 6. Referral links + bot identity

Set your bot's username and Mini App short name in `wrangler.toml`
(`BOT_USERNAME`, `APP_NAME`) — referral share links are built as
`https://t.me/<BOT_USERNAME>/<APP_NAME>?startapp=ref_<id>`.

### 7. Adsgram (rewarded ads)

1. Create a RewardedVideo block at adsgram.ai for your bot.
2. Put the block id in `.env` as `VITE_ADSGRAM_BLOCK_ID=int-XXXX` and rebuild.
3. In the Adsgram dashboard, set the block's server-side Reward URL to:
   `https://<worker-domain>/api/adsgram/reward?userid={userid}&key=<TELEGRAM_WEBHOOK_SECRET>`
   The Worker credits +5 energy per completed ad, capped at 3/day per user.
   (Without the postback the client claim path still works, with the same
   server-enforced daily cap.)

### 8. Retire Cloudflare Pages

Once the Worker is verified in Telegram, delete (or just stop updating) the
old Pages project. `dist/` no longer needs to be committed to git — deploys
build it fresh.

## Local development

```bash
cp .dev.vars.example .dev.vars   # fill in real values; DEV_ALLOW_MOCK=1 stays
npm run dev                      # runs vite (:3000) + wrangler dev (:8787)
```

- Vite proxies `/api` and `/webhook` to wrangler.
- Outside Telegram there's no initData, so the client sends
  `Authorization: tma mock:123456789`; the Worker only accepts that when
  `DEV_ALLOW_MOCK=1` (never set in production).
- If wrangler/DB are unreachable, the game still plays from localStorage and
  re-queues sync batches — that's the designed offline behavior.

## Verifying security after go-live

```bash
# 1. No auth -> 401
curl -X POST https://<worker>/api/auth -o /dev/null -w '%{http_code}\n'

# 2. Anon key is dead (should return an empty array / permission error):
curl 'https://<supabase-project>.supabase.co/rest/v1/user_stats?select=*' \
  -H 'apikey: <the old anon key>'

# 3. The anon key no longer ships in the bundle:
grep -c 'supabase' dist/assets/index-*.js   # 0
```

Cheat attempts (editing localStorage, replaying /api/sync with huge numbers)
are clamped server-side by `apply_sync` and logged to the `sync_audit` table:

```sql
SELECT * FROM sync_audit ORDER BY created_at DESC LIMIT 20;
```
