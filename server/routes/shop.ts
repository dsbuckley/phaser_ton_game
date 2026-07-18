import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { PRODUCTS, productById } from '../config/products';
import { botApi } from '../lib/telegram';

export const shopRoutes = new Hono<AppEnv>();

/** GET /api/shop/catalog — the Stars product list. */
shopRoutes.get('/shop/catalog', (c) => {
  return c.json({ products: PRODUCTS });
});

/**
 * POST /api/shop/invoice { product_id } — creates a Telegram Stars
 * invoice link via the Bot API. The client opens it with
 * WebApp.openInvoice; crediting happens in the webhook on
 * successful_payment (never here).
 */
shopRoutes.post('/shop/invoice', async (c) => {
  const { telegramId } = c.get('auth');
  const body = await c.req.json<{ product_id?: string }>().catch(() => ({ product_id: undefined }));
  const product = body.product_id ? productById(body.product_id) : undefined;
  if (!product) return c.json({ error: 'unknown_product' }, 404);

  try {
    const link = await botApi<string>(c.env.TELEGRAM_BOT_TOKEN, 'createInvoiceLink', {
      title: `${product.title} — ${product.category}`,
      description: `Purchase for the game: ${product.amount} ${product.category}`,
      payload: JSON.stringify({ p: product.id, u: telegramId }),
      currency: 'XTR', // Telegram Stars — no provider token needed
      prices: [{ label: product.title, amount: product.stars }]
    });
    return c.json({ invoice_link: link });
  } catch (err) {
    console.error('createInvoiceLink failed:', err);
    return c.json({ error: 'invoice_failed' }, 502);
  }
});
