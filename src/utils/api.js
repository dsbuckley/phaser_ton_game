/**
 * API client for the Cloudflare Worker backend.
 *
 * Every request carries `Authorization: tma <initData>` — the raw signed
 * Telegram initData string, verified server-side (HMAC) on every call.
 *
 * Outside Telegram (local dev in a plain browser) there is no initData, so
 * we send `tma mock:123456789`, which the Worker only accepts when
 * DEV_ALLOW_MOCK=1 is set in .dev.vars.
 *
 * Offline/mock fallback: if the API is unreachable in dev (e.g. `vite` is
 * running without `wrangler dev`), calls resolve with `{ mock: true }`
 * shapes so the game stays playable client-side.
 */

const MOCK_TELEGRAM_ID = 123456789;

function authHeader() {
  const initData = window.Telegram?.WebApp?.initData;
  if (initData && initData.length > 0) {
    return `tma ${initData}`;
  }
  return `tma mock:${MOCK_TELEGRAM_ID}`;
}

function nextHourIso() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

async function request(path, { method = 'GET', body, keepalive = false } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      keepalive,
      headers: {
        Authorization: authHeader(),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`API unreachable (${path}), using mock response`, err);
      return mockResponse(path, body);
    }
    throw err;
  }

  if (!response.ok) {
    // Dev fallback: a 5xx (e.g. Worker up but no real DB credentials in
    // .dev.vars) behaves like "offline" so the game stays testable
    if (import.meta.env.DEV && response.status >= 500) {
      console.warn(`API ${path} returned ${response.status}, using mock response`);
      return mockResponse(path, body);
    }
    const detail = await response.json().catch(() => ({}));
    const error = new Error(detail.error || `API ${path} failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

const mockState = {
  claimed: new Set(),
  adWatchesToday: 0,
  checkinClaimed: false,
  ownedStickers: {},
  claimedSets: new Set()
};

// Mock sticker pool mirrors shared/stickers.json ids (subset is fine for dev)
const MOCK_STICKER_IDS = [
  'pirates_armory:sword', 'pirates_armory:axe', 'pirates_armory:bow',
  'pirates_armory:hammer', 'pirates_armory:shield', 'pirates_armory:swordshield',
  'gem_hoard:gem_gray', 'gem_hoard:gem_green', 'gem_hoard:gem_blue',
  'royal_treasure:coin', 'royal_treasure:crown', 'beach_party:star',
  'explorers_kit:map', 'ghost_crew:fox', 'crystal_cache:tri_blue', 'arcane_library:memopad'
];

function mockResponse(path, body) {
  if (path === '/tasks' && !body) {
    return {
      mock: true,
      tasks: [
        { id: 'watch_ad', type: 'daily', title: 'Watch an Ad', icon: 'statusbar_energy', reward: { energy: 5, xp: 10 }, dailyLimit: 3, requiresAd: true, state: mockState.adWatchesToday < 3 ? 'available' : 'done_today', claimsToday: mockState.adWatchesToday },
        { id: 'ref_milestone_3', type: 'referral_milestone', title: 'Invite 3 Friends', icon: 'statusbar_gem', reward: { gems: 50, tickets: 5 }, requiredReferrals: 3, state: 'locked', claimsToday: 0 },
        { id: 'ref_milestone_5', type: 'referral_milestone', title: 'Invite 5 Friends', icon: 'statusbar_gem', reward: { gems: 250 }, requiredReferrals: 5, state: 'locked', claimsToday: 0 },
        { id: 'follow_tiktok', type: 'once', title: 'Follow on TikTok', icon: 'statusbar_ticket', reward: { tickets: 3 }, url: 'https://www.tiktok.com', state: mockState.claimed.has('follow_tiktok') ? 'done' : 'available', claimsToday: 0 },
        { id: 'like_youtube', type: 'once', title: 'Like our YouTube video', icon: 'statusbar_energy', reward: { energy: 25 }, url: 'https://www.youtube.com', state: mockState.claimed.has('like_youtube') ? 'done' : 'available', claimsToday: 0 },
        { id: 'join_channel', type: 'once', title: 'Join our Telegram channel', icon: 'statusbar_energy', reward: { energy: 25, tickets: 2 }, url: 'https://t.me', state: mockState.claimed.has('join_channel') ? 'done' : 'available', claimsToday: 0 }
      ],
      checkin: {
        streak: mockState.checkinClaimed ? 1 : 0,
        claimed_today: mockState.checkinClaimed,
        next_day: 1,
        rewards: [
          { energy: 25, coins: 500 }, { energy: 50 }, { energy: 75, tickets: 2 },
          { energy: 100, coins: 1000 }, { energy: 100, gems: 5 },
          { energy: 125, tickets: 3 }, { energy: 150, tickets: 5, gems: 10 }
        ]
      },
      referrals: { qualified: 0 }
    };
  }
  if (path === '/tasks/claim') {
    const taskId = body?.task_id;
    if (taskId === 'checkin') {
      mockState.checkinClaimed = true;
      return { mock: true, ok: true, task_id: taskId, streak: 1, day: 1, reward: { energy: 25, coins: 500 }, stats: null };
    }
    if (taskId === 'watch_ad') {
      mockState.adWatchesToday++;
      return { mock: true, ok: true, task_id: taskId, reward: { energy: 5 }, stats: null };
    }
    mockState.claimed.add(taskId);
    return { mock: true, ok: true, task_id: taskId, reward: { energy: 25 }, stats: null };
  }
  if (path === '/referrals') {
    return { mock: true, link: 'https://t.me/YOUR_BOT/game?startapp=ref_123456789', qualified: 0, pending: 0 };
  }
  if (path === '/shop/catalog') {
    return {
      mock: true,
      products: [
        { id: 'energy_small', category: 'energy', title: 'Small', amount: 400, stars: 100, reward: { energy: 400 } },
        { id: 'energy_xxl', category: 'energy', title: 'XXL', amount: 3600, bonusPct: 50, stars: 600, ribbon: 'popular', reward: { energy: 3600 } },
        { id: 'energy_treasure', category: 'energy', title: 'Treasure', amount: 16800, bonusPct: 200, stars: 1400, ribbon: 'best', reward: { energy: 16800 } },
        { id: 'tickets_4', category: 'tickets', title: '4 Spins', amount: 4, stars: 200, reward: { tickets: 4 } },
        { id: 'tickets_7', category: 'tickets', title: '7 Spins', amount: 7, bonusPct: 10, stars: 300, ribbon: 'popular', reward: { tickets: 7 } },
        { id: 'coins_small', category: 'coins', title: 'Small', amount: 50000, stars: 100, reward: { coins: 50000 } },
        { id: 'coins_large', category: 'coins', title: 'Large', amount: 300000, bonusPct: 25, stars: 300, ribbon: 'popular', reward: { coins: 300000 } },
        { id: 'packs_1', category: 'packs', title: '1 Pack', amount: 1, stars: 50, reward: { sticker_packs: 1 } },
        { id: 'packs_6', category: 'packs', title: '5+1 Packs', amount: 6, bonusPct: 20, stars: 225, ribbon: 'popular', reward: { sticker_packs: 6 } }
      ]
    };
  }
  if (path === '/shop/invoice') {
    return { mock: true, invoice_link: 'mock://invoice/' + (body?.product_id ?? 'unknown') };
  }
  if (path === '/stickers/album') {
    return {
      mock: true,
      owned: { ...mockState.ownedStickers },
      claimed_sets: [...mockState.claimedSets],
      packs: null, // null => keep local gameState value
      set_reward: { coins: 2000, gems: 25, tickets: 2, xp: 150 }
    };
  }
  if (path === '/stickers/open') {
    const stickers = [];
    let dupeCoins = 0;
    for (let i = 0; i < 3; i++) {
      const id = MOCK_STICKER_IDS[Math.floor(Math.random() * MOCK_STICKER_IDS.length)];
      const isNew = !mockState.ownedStickers[id];
      mockState.ownedStickers[id] = (mockState.ownedStickers[id] ?? 0) + 1;
      const coins = isNew ? 0 : 250;
      dupeCoins += coins;
      stickers.push({ id, is_new: isNew, dupe_coins: coins });
    }
    return { mock: true, ok: true, stickers, dupe_coins: dupeCoins, packs_left: null, stats: null };
  }
  if (path === '/stickers/claim-set') {
    mockState.claimedSets.add(body?.set_id);
    return { mock: true, ok: true, set_id: body?.set_id, reward: { coins: 2000, gems: 25, tickets: 2, xp: 150 }, stats: null };
  }
  if (path.startsWith('/leaderboard')) {
    const names = ['CoralQueen', 'SandyToes', 'WaveRider', 'PalmPirate', 'ShellSeeker', 'TideTurner', 'SunnySide'];
    const top = names.map((username, i) => ({
      rank: i + 1,
      telegram_id: 1000 + i,
      username,
      photo_url: null,
      level: 12 - i,
      gems: 320 - i * 41
    }));
    return {
      mock: true,
      top,
      me: { rank: 23, gems: 12 },
      resets_at: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString()
    };
  }
  if (path === '/wheel/state') {
    return { mock: true, tickets: null, free_spins_left: 3 - (mockState.freeSpinsUsed ?? 0) };
  }
  if (path === '/wheel/spin') {
    const weights = [30, 25, 20, 13, 5, 3, 2.5, 1.5];
    const prizes = [
      { type: 'energy', energy: 10 }, { type: 'energy', energy: 25 },
      { type: 'energy', energy: 50 }, { type: 'energy', energy: 100 },
      { type: 'gems', gems: 5 }, { type: 'gems', gems: 10 },
      { type: 'coins', coins: 500 }, { type: 'jackpot', coins: 3000, sticker_packs: 1 }
    ];
    let roll = Math.random() * 100;
    let idx = 0;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { idx = i; break; }
    }
    if (body?.use_free) mockState.freeSpinsUsed = (mockState.freeSpinsUsed ?? 0) + 1;
    return { mock: true, ok: true, segment_index: idx, prize: prizes[idx], stats: null };
  }
  // stats: null tells callers "no authoritative data — keep local values"
  if (path === '/auth') {
    return {
      mock: true,
      user: { telegram_id: MOCK_TELEGRAM_ID, username: 'dev_user', photo_url: null },
      stats: null,
      granted_energy: 0,
      next_grant_at: nextHourIso(),
      clamped: false,
      referral_bonus: false
    };
  }
  if (path === '/sync') {
    return { mock: true, stats: null, granted_energy: 0, next_grant_at: nextHourIso(), clamped: false, referral_bonus: false };
  }
  return { mock: true, ok: true };
}

export const api = {
  /** Authenticate + load authoritative stats. Call once on game load. */
  auth() {
    return request('/auth', { method: 'POST', body: {} });
  },

  /** Flush a batch of gameplay deltas. See server/routes/sync.ts for the shape. */
  sync(deltas, { keepalive = false } = {}) {
    return request('/sync', { method: 'POST', body: deltas, keepalive });
  },

  /** Best-effort flush on page hide — sendBeacon survives tab close. */
  syncBeacon(deltas) {
    try {
      const blob = new Blob(
        [JSON.stringify({ ...deltas, _auth: authHeader() })],
        { type: 'application/json' }
      );
      // sendBeacon can't set headers, so auth rides in the body (_auth);
      // the Worker's sync route accepts either. Fall back to keepalive fetch.
      if (!navigator.sendBeacon || !navigator.sendBeacon('/api/sync', blob)) {
        this.sync(deltas, { keepalive: true }).catch(() => {});
      }
    } catch {
      this.sync(deltas, { keepalive: true }).catch(() => {});
    }
  },

  /** Save connected TON wallet address (display only). */
  saveWallet(address) {
    return request('/wallet', { method: 'POST', body: { address } });
  },

  /** Earn tab: task list with per-user state. */
  getTasks() {
    return request('/tasks');
  },

  /** Claim a task reward ('checkin' claims the daily check-in). */
  claimTask(taskId) {
    return request('/tasks/claim', { method: 'POST', body: { task_id: taskId } });
  },

  /** Referral share link + progress. */
  getReferrals() {
    return request('/referrals');
  },

  /** Wheel: tickets + free spins remaining. */
  getWheelState() {
    return request('/wheel/state');
  },

  /** Spin the wheel — server rolls and returns the winning segment. */
  spinWheel({ useFree = false } = {}) {
    return request('/wheel/spin', { method: 'POST', body: { use_free: useFree } });
  },

  /** Daily leaderboard (gems earned today, resets 00:00 UTC). */
  getLeaderboard(limit = 100) {
    return request(`/leaderboard?limit=${limit}`);
  },

  /** Sticker album: ownership + claim state + pack count. */
  getAlbum() {
    return request('/stickers/album');
  },

  /** Open one sticker pack — server rolls the contents. */
  openStickerPack() {
    return request('/stickers/open', { method: 'POST', body: {} });
  },

  /** Claim a completed set's reward. */
  claimStickerSet(setId) {
    return request('/stickers/claim-set', { method: 'POST', body: { set_id: setId } });
  },

  /** Shop: Telegram Stars product catalog. */
  getCatalog() {
    return request('/shop/catalog');
  },

  /** Shop: create a Stars invoice link for a product. */
  createInvoice(productId) {
    return request('/shop/invoice', { method: 'POST', body: { product_id: productId } });
  },

  /** Dev-only stat reset (server enforces who may call this). */
  devReset() {
    return request('/dev/reset', { method: 'POST', body: {} });
  }
};
