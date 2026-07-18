import type { AuthContext } from '../env';

const AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

const encoder = new TextEncoder();

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifies a Telegram Mini App initData string (WebAppData HMAC scheme).
 * Returns the authenticated user context, or null if invalid/stale.
 */
export async function verifyInitData(initData: string, botToken: string): Promise<AuthContext | null> {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = await hmacSha256(encoder.encode('WebAppData'), botToken);
  const computed = toHex(await hmacSha256(secretKey, dataCheckString));

  if (!timingSafeEqualHex(computed, hash)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;
  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > AUTH_MAX_AGE_SECONDS || ageSeconds < -300) return null;

  const userJson = params.get('user');
  if (!userJson) return null;
  let user;
  try {
    user = JSON.parse(userJson);
  } catch {
    return null;
  }
  if (typeof user?.id !== 'number') return null;

  return {
    telegramId: user.id,
    user: {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      photo_url: user.photo_url,
    },
    startParam: params.get('start_param'),
  };
}

/** Minimal Telegram Bot API caller. Throws on transport errors; returns parsed result. */
export async function botApi<T = unknown>(
  botToken: string,
  method: string,
  payload: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) {
    throw new Error(`Bot API ${method} failed: ${data.description ?? res.status}`);
  }
  return data.result as T;
}
