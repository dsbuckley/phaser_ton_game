# Phaser 3 + Telegram + TON + Supabase Boilerplate

A mobile-first game boilerplate built with Phaser 3, designed for Telegram WebApp with TON wallet integration and Supabase database support.

## Features

- **Phaser 3** game framework
- **Telegram WebApp** integration with user authentication
- **TON Connect** for crypto wallet connections
- **Supabase** backend database
- **Vite** for fast development and optimized builds
- **Mobile-first** design (480x800 portrait mode)
- **Touch-only** controls for mobile devices

## Project Structure

```
├── public/
│   ├── assets/              # Game assets (images, sprites, etc.)
│   └── tonconnect-manifest.json  # TON Connect configuration
├── src/
│   ├── scenes/
│   │   └── MainScene.js     # Main game scene
│   └── main.js              # Game initialization
├── index.html               # Entry point
├── vite.config.js           # Vite configuration
└── package.json             # Dependencies
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Set Up Supabase Database

Run this SQL in your Supabase SQL editor:

```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  wallet_address TEXT,
  high_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_telegram_id ON users(telegram_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert/update own data" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (true);
```

### 4. Configure TON Connect

Edit `public/tonconnect-manifest.json` with your app details:

```json
{
  "url": "https://your-game-url.com",
  "name": "Your Game Name",
  "iconUrl": "https://your-game-url.com/icon.png"
}
```

### 5. Add Game Assets

Place your game assets in `public/assets/`:
- `player.png` - Player sprite (recommended: 64x64 or 128x128 pixels)

## Development

```bash
npm run dev
```

Visit `http://localhost:3000`

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Testing in Telegram

1. Create a Telegram bot using [@BotFather](https://t.me/botfather)
2. Set up a Web App for your bot
3. Deploy your game to a public HTTPS URL
4. Configure the Web App URL in BotFather
5. Open the Web App through your bot

## Security Notes

⚠️ **IMPORTANT**: This boilerplate includes client-side code for demonstration purposes. In production:

1. **Telegram Authentication**: Verify `initData` hash on your backend using your bot token
2. **Wallet Verification**: Optionally verify wallet ownership with signed messages
3. **Database Operations**: Perform all sensitive operations on the backend after verification
4. **Row Level Security**: Configure proper RLS policies in Supabase

See comments in `MainScene.js` for detailed security implementation notes.

## Game Configuration

The game is configured for mobile Telegram WebApp:

- **Resolution**: 480x800 (portrait)
- **Scaling**: FIT mode with centered alignment
- **Input**: Touch/pointer only (no keyboard)
- **Physics**: Arcade physics (lightweight)

Modify `src/main.js` to adjust game configuration.

## TON Integration

The game uses `@tonconnect/ui` for wallet connections:

- Connect TON wallet with one tap
- Display wallet address
- Save wallet info to Supabase

## Telegram WebApp Features

- Read user data from `initDataUnsafe`
- Auto-expand to full screen
- Access user ID, username, etc.
- Production-ready auth verification (backend required)

## Next Steps

1. Add your game logic in `MainScene.js` `update()` method
2. Create additional scenes as needed
3. Implement backend verification for Telegram auth
4. Add TON transactions (payments, NFTs, etc.)
5. Expand Supabase schema for your game data

## Resources

- [Phaser 3 Documentation](https://photonstorm.github.io/phaser3-docs/)
- [Telegram WebApp API](https://core.telegram.org/bots/webapps)
- [TON Connect](https://docs.ton.org/develop/dapps/ton-connect/overview)
- [Supabase Documentation](https://supabase.com/docs)

## License

MIT
