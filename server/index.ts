import { Hono } from 'hono';
import type { AppEnv } from './env';
import { requireAuth } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { syncRoutes } from './routes/sync';
import { taskRoutes } from './routes/tasks';
import { adsgramRoutes } from './routes/adsgram';
import { wheelRoutes } from './routes/wheel';
import { shopRoutes } from './routes/shop';
import { webhookRoutes } from './routes/webhook';
import { stickerRoutes } from './routes/stickers';
import { leaderboardRoutes } from './routes/leaderboard';

const app = new Hono<AppEnv>();

app.get('/api/health', (c) => c.json({ ok: true }));

// Telegram bot webhook — authenticated by its secret_token header
app.route('/', webhookRoutes);

// Adsgram postback authenticates with its own key (called by Adsgram's
// servers, no Telegram initData available)
app.route('/api', adsgramRoutes);

// All /api routes below require verified Telegram initData
app.use('/api/*', requireAuth);
app.route('/api', authRoutes);
app.route('/api', syncRoutes);
app.route('/api', taskRoutes);
app.route('/api', wheelRoutes);
app.route('/api', shopRoutes);
app.route('/api', stickerRoutes);
app.route('/api', leaderboardRoutes);

// Static game assets (Vite dist/) — everything that isn't /api or /webhook
app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
