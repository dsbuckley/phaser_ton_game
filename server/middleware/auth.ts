import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { verifyInitData } from '../lib/telegram';

/**
 * Requires `Authorization: tma <initData>` on every protected route.
 * Verification is stateless: HMAC check + auth_date freshness per request.
 *
 * Local dev only (DEV_ALLOW_MOCK=1 in .dev.vars): `Authorization: tma mock:<id>`
 * bypasses verification with a fake user so the game runs outside Telegram.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  let header = c.req.header('Authorization') ?? '';
  if (!header.startsWith('tma ') && c.req.method === 'POST') {
    // navigator.sendBeacon can't set headers, so the page-hide sync flush
    // carries auth in the body as `_auth`. Hono caches the parsed body, so
    // the route handler can still read it afterwards.
    const body = await c.req.json<{ _auth?: string }>().catch(() => null);
    if (typeof body?._auth === 'string') header = body._auth;
  }
  if (!header.startsWith('tma ')) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const initData = header.slice(4);

  if (initData.startsWith('mock:')) {
    if (c.env.DEV_ALLOW_MOCK !== '1') {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const id = Number(initData.slice(5));
    if (!Number.isFinite(id)) return c.json({ error: 'unauthorized' }, 401);
    c.set('auth', {
      telegramId: id,
      user: { id, username: 'dev_user', first_name: 'Dev' },
      startParam: null,
    });
    return next();
  }

  const auth = await verifyInitData(initData, c.env.TELEGRAM_BOT_TOKEN);
  if (!auth) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  c.set('auth', auth);
  return next();
};
