# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project

**Treasure Pop** (@treasurepop_bot) — a Phaser 3 chest-tapping game for Telegram Mini Apps,
monetized with Telegram Stars. Cloudflare Worker backend (Hono + TypeScript), Supabase
Postgres (server-only), TON Connect for wallet display, Vite bundles the client.

**Mobile only.** Built exclusively for the Telegram mobile app (iOS/Android): portrait
orientation, touch input only, minimum 44×44px touch targets, primary actions in the bottom
half of the screen (thumb reach). Use `this.scale.width/height` for responsive positioning.
No desktop or landscape support.

## Live infrastructure (as of 2026-07-18)

- **Worker:** https://phaser-ton-game.credicruncher.workers.dev (Cloudflare account `credicruncher@gmail.com`)
- **Supabase project:** `trbpiifjxaqfzwnrrlra` — server-only; the publishable/anon key is
  fully locked out (RLS enabled + grants revoked). The original project `vumzdtgmdlunhxyvvkkq`
  is dead (paused >90 days, backup contained no data).
- **Bot:** @treasurepop_bot (id 7814240082). Webhook registered at `/webhook` with a
  `secret_token`; unauthenticated posts get 403.
- **Worker secrets** (set, via `wrangler secret put`): `TELEGRAM_BOT_TOKEN`,
  `SUPABASE_SERVICE_ROLE_KEY` (new-style `sb_secret_…` key), `TELEGRAM_WEBHOOK_SECRET`.
- **Direct DB access** (for migrations): the DB host is IPv6-only; use
  `/opt/homebrew/opt/postgresql@16/bin/psql -h db.trbpiifjxaqfzwnrrlra.supabase.co -U postgres -d postgres`.
- **Outstanding:** repoint the Mini App URL in @BotFather to the Worker URL; confirm the Mini
  App short name matches `APP_NAME` in `wrangler.toml` (currently `"game"`, used in referral
  links); set `VITE_ADSGRAM_BLOCK_ID` in `.env` when Adsgram is configured.

Deploy runbook: `DEPLOYMENT.md`. Game design/economy: `GAME_DESIGN.md`.

## Commands

```bash
npm install
cp .dev.vars.example .dev.vars   # Worker secrets for local dev (already filled locally)
npm run dev              # vite (:3000, proxies /api + /webhook) + wrangler dev (:8787)
npm run build            # build client → dist/
npm run typecheck        # typecheck the Worker (server/)
npm run deploy           # vite build && wrangler deploy
```

## Architecture

One Cloudflare Worker (`server/`, Hono) serves the built game (`[assets]` binding → `dist/`,
SPA fallback), all API routes (`/api/*`), and the Telegram bot webhook (`/webhook`).
Config: `wrangler.toml`; the browser never talks to Supabase.

- **Auth is stateless.** Every API call carries `Authorization: tma <initData>`; the Worker
  verifies the HMAC (WebAppData scheme) + `auth_date` freshness in `server/middleware/auth.ts`.
  Local dev uses `tma mock:<id>`, only honored when `DEV_ALLOW_MOCK=1` (never in production).
- **Server-authoritative economy.** Chest-tap deltas batch into `POST /api/sync` every 10s;
  the `apply_sync` Postgres function validates energy accounting, tap-rate caps, and reward
  envelopes — **clamping** impossible claims (never rejecting) and logging them to `sync_audit`.
  Hourly energy grants (+5/hour, cap 100) use server time. Wheel spins, task claims, purchases,
  sticker packs, and level rewards are all rolled server-side.
- **Client sync layer:** `syncBuffer` / `flushSync` / `applyServerState` in
  `src/scenes/MainScene.js`, with the fetch wrapper in `src/utils/api.js` (falls back to a dev
  mock so the game runs offline; failed batches re-queue).
- **Monetization:** Telegram Stars catalog in `server/config/products.ts`; invoices via
  `createInvoiceLink` (currency XTR). Crediting happens ONLY in the webhook on
  `successful_payment`, idempotent on `telegram_payment_charge_id` (`credit_purchase`).
- **Progression:** XP/levels in `src/config/levels.js` (+ SQL `level_from_xp`); chest coin
  payouts scale +10%/level; level-ups grant energy refill + tickets + a sticker pack every
  5 levels (`grant_level_rewards`).
- **Stickers:** definitions in `shared/stickers.json` (single source for client + server);
  rolls/ownership are server-side (`server/routes/stickers.ts`).
- **Daily leaderboard:** `leaderboard_daily(day, telegram_id, gems)` — a new UTC day means
  new rows, so no reset cron; read via the `get_leaderboard` RPC.
- **Earn:** task catalog in `server/config/tasks.ts` — check-in streak, Adsgram rewarded ads
  (server postback credits +5 energy, 3/day cap), referrals via `start_param`
  (`ref_<id>`, qualify at 25 chests), social follows.

### Repo map

```
server/            Worker: index.ts, middleware/auth.ts, routes/*, config/*, lib/*
src/scenes/        LoadingScene, MainScene (chest tapping; sleeps/wakes),
                   BaseTabScene + WheelScene/StickersScene/EarnScene/ShopScene (start/stop fresh)
src/components/    Reusable UI (see below)
src/config/        tabs.js (navigation), levels.js, wheel.js, stickers.js
src/state/         gameState.js — registry-style cross-scene state; server values reconcile in
src/utils/         api.js, persistentState.js, feedback.js (sound/haptics)
shared/            stickers.json (client + server single source)
migrations/        SQL migrations (see below)
public/assets/     LayerLab "GUI Casual Fantasy" pack (415+ PNGs) + fonts + sprites
```

### Database migrations

Run in order via psql or the Supabase SQL editor (all are idempotent):

1. `0000_base.sql` — base `users`/`user_stats` tables (fresh project only)
2. `0002_tables.sql` — game tables (leaderboard, purchases, referrals, tasks, stickers, wheel, audit)
3. `0003_functions.sql` — game-logic functions (`ensure_user`, `apply_sync`, `credit_purchase`, …)
4. `0001_lock_rls.sql` — locks RLS + revokes anon grants (run last, at go-live)

All four have been applied to the live project.

## Client conventions

**Fonts** (self-hosted in `public/assets/fonts/`, declared in `index.html`; always specify
`fontFamily`): **Tilt Warp** for titles/flashy display text, **LINESeed** for body/UI labels.
For crisp mobile text: `resolution: 2`, `padding: {x:20, y:20}`, stroke with `blur: 0` shadows.
Wait for fonts before creating text (`document.fonts.load`).

**NineSlice** (WebGL) for all scalable UI — buttons, bars, panels: `scene.add.nineslice(x, y,
tex, null, w, h, left, right, top, bottom)`. Slice values must match the corner size in the
texture; width ≥ left+right, height ≥ top+bottom; use `setScale()` for sizes below the minimum.
Never use sprite/tilesprite for slider bars.

**UI asset pack:** `public/assets/Components/` (Buttons, Frames, Labels, Sliders, Icons,
Popups). Fixed colors use `_Demo_[Color]` variants; tint `_White` variants for dynamic colors.
Rarity colors: gray/green/blue/purple/yellow/red = common→unique.

**Persistent state:** `withPersistentState(scene, key, default)` from
`src/utils/persistentState.js` — localStorage-backed get/set/reset, scene-lifecycle aware.
Server state reconciles into it on auth/sync.

**Audio:** browsers block audio until a user gesture — call `this.sound.context.resume()` on
first tap before playing (see the `audioUnlocked` pattern in MainScene).

**Loading:** LoadingScene is two-stage — preload only the progress-bar textures, then load all
game assets through a secondary `LoaderPlugin` with real progress. Localhost skips the
production minimum display time.

### Components (`src/components/`)

| Component | Purpose |
|---|---|
| StatusBar | Top bar: avatar (Telegram photo via HTML overlay for CORS), resource pills, settings |
| BatteryBar | Energy bar with icon; pairs with regen/consumption logic in MainScene |
| BottomTabMenu | 5-tab bottom navigation with notification dots (`src/config/tabs.js`) |
| LoadingSlider | NineSlice progress bar (loading, XP) |
| EnergyCountdownTimer | "Free energy in MM:SS" countdown to the next hourly grant |
| SettingsModal | Sound/haptic toggles (persisted), dev-only reset button |
| LeaderboardModal | Daily gems leaderboard UI |
| ModalShell / ScrollContainer / UIButton | Building blocks for modals, scrolling lists, buttons |
| WheelDisplay / ProductCard / TaskCard | Wheel, shop, and earn-tab item UIs |
| ComboBonusDisplay / RewardCelebration | Floating combo/reward animations |

## Gotchas

- The game must stay fully playable offline — localStorage first, server reconciles later.
  Never gate rewards on network success.
- Telegram avatar CDN blocks canvas CORS — load avatars as an HTML `<img>` overlay, not a
  Phaser texture.
- `dist/` is gitignored build output — `npm run deploy` rebuilds it fresh and the Worker
  serves it via the `[assets]` binding. Never edit files in `dist/` directly.
- Destroy every temporary sprite/tween/text after its animation (confetti, floating text,
  sparkles) to prevent leaks on a long-lived MainScene.
- The webhook must answer `pre_checkout_query` within 10 seconds — validate and answer before
  any DB work.
