export interface Env {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  BOT_USERNAME?: string;
  APP_NAME?: string;
  DEV_ALLOW_MOCK?: string;
}

export interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

export interface AuthContext {
  telegramId: number;
  user: TgUser;
  startParam: string | null;
}

// Hono context variable typing
export type AppEnv = {
  Bindings: Env;
  Variables: {
    auth: AuthContext;
  };
};
