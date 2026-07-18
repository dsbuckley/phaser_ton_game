import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { serviceClient } from '../lib/supabase';
import { productById } from '../config/products';
import { botApi } from '../lib/telegram';

/**
 * Telegram bot webhook. Register once (see DEPLOYMENT.md):
 *   setWebhook url=https://<worker>/webhook secret_token=<TELEGRAM_WEBHOOK_SECRET>
 *              allowed_updates=["message","pre_checkout_query"]
 *
 * Handles the Telegram Stars payment lifecycle:
 * 1. pre_checkout_query — must be answered within 10 seconds; we
 *    validate the product + price and answer BEFORE any DB work.
 * 2. message.successful_payment — credits the purchase via the
 *    credit_purchase function, idempotent on telegram_payment_charge_id
 *    (webhook retries can never double-credit).
 */
export const webhookRoutes = new Hono<AppEnv>();

interface TgUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat?: { id: number };
    from?: { id: number };
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
    };
  };
  pre_checkout_query?: {
    id: string;
    from: { id: number };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
}

webhookRoutes.post('/webhook', async (c) => {
  if (c.req.header('X-Telegram-Bot-Api-Secret-Token') !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const update = await c.req.json<TgUpdate>().catch(() => null);
  if (!update) return c.json({ ok: true });

  // ---- Pre-checkout: answer fast, validate product + price ----
  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query;
    let ok = false;
    let errorMessage = 'This item is no longer available.';
    try {
      const payload = JSON.parse(query.invoice_payload) as { p?: string };
      const product = payload.p ? productById(payload.p) : undefined;
      ok = Boolean(product && query.currency === 'XTR' && query.total_amount === product.stars);
      if (!ok) errorMessage = 'Price changed — please reopen the shop.';
    } catch {
      ok = false;
    }
    await botApi(c.env.TELEGRAM_BOT_TOKEN, 'answerPreCheckoutQuery', {
      pre_checkout_query_id: query.id,
      ok,
      ...(ok ? {} : { error_message: errorMessage })
    });
    return c.json({ ok: true });
  }

  // ---- Successful payment: idempotent credit ----
  const payment = update.message?.successful_payment;
  if (payment) {
    try {
      const payload = JSON.parse(payment.invoice_payload) as { p?: string; u?: number };
      const product = payload.p ? productById(payload.p) : undefined;
      const telegramId = payload.u ?? update.message?.from?.id;
      if (product && telegramId) {
        const db = serviceClient(c.env);
        const { data, error } = await db.rpc('credit_purchase', {
          p_telegram_id: telegramId,
          p_product_id: product.id,
          p_stars: payment.total_amount,
          p_charge_id: payment.telegram_payment_charge_id,
          p_coins: product.reward.coins ?? 0,
          p_gems: 0,
          p_energy: product.reward.energy ?? 0,
          p_tickets: product.reward.tickets ?? 0,
          p_sticker_packs: product.reward.sticker_packs ?? 0,
          p_payload: payload
        });
        if (error) {
          console.error('credit_purchase failed:', error.message);
          // Return 500 so Telegram retries the webhook (credit is idempotent)
          return c.json({ error: 'credit_failed' }, 500);
        }
        console.log('purchase credited:', product.id, JSON.stringify(data));
      }
    } catch (err) {
      console.error('successful_payment handling failed:', err);
      return c.json({ error: 'server_error' }, 500);
    }
    return c.json({ ok: true });
  }

  // ---- Simple bot commands ----
  const text = update.message?.text;
  const chatId = update.message?.chat?.id;
  if (text && chatId) {
    if (text.startsWith('/paysupport')) {
      // Required by Telegram for bots accepting payments
      await botApi(c.env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        text: 'For payment support, contact us here and include your purchase details. Refunds are handled within 48 hours.'
      }).catch(() => {});
    } else if (text.startsWith('/start')) {
      const app = `https://t.me/${c.env.BOT_USERNAME ?? ''}/${c.env.APP_NAME ?? ''}`;
      await botApi(c.env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        text: `🏝️ Tap to play: ${app}`
      }).catch(() => {});
    }
  }

  return c.json({ ok: true });
});
