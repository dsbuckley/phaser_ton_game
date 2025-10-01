# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Phaser 3 game boilerplate designed specifically for Telegram WebApp deployment with TON blockchain wallet integration and Supabase database backend. The project uses `@ton/phaser-sdk` for game-optimized blockchain integration and Vite for bundling.

**Platform Target: Mobile Only**
- This game is exclusively for Telegram mobile app (iOS/Android)
- Portrait orientation with vertical aspect ratio (typical mobile phone dimensions)
- All UI elements, scenes, and interactions must be designed for touch input only
- No desktop/landscape support required

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on localhost:3000)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview production build
npm run preview
```

## Architecture

### Entry Point Flow
1. **index.html** → Loads Telegram WebApp SDK and imports `src/main.js`
2. **src/main.js** → Initializes Phaser game config, expands Telegram WebApp, registers scenes
3. **src/scenes/MainScene.js** → Main game scene with all integration logic

### Core Integration Pattern
The architecture follows a client-side demonstration pattern with extensive security comments indicating where backend verification is required:

**MainScene Initialization Flow:**
1. `preload()` - Load assets with graceful fallback for missing images
2. `create()` - Initialize in this order:
   - Supabase client (from env vars)
   - Telegram user data extraction
   - UI elements (sprites, text)
   - GameFi SDK initialization with Phaser-native connect button
3. Wallet connection triggers database upsert

### Key Design Patterns

**Telegram Authentication:**
- Reads `window.Telegram.WebApp.initDataUnsafe` for user data (id, username, auth_date, hash)
- `verifyTelegramAuth()` contains extensive comments explaining backend verification requirements
- Falls back to mock user data in development (non-Telegram environment)

**TON Wallet Integration:**
- Uses `GameFi` from `@ton/phaser-sdk` (game-optimized wrapper around TON Connect)
- SDK provides Phaser-native button component via `createConnectButton()`
- `onWalletChange()` listener pattern for wallet connect/disconnect events
- Manifest at `public/tonconnect-manifest.json` must be configured with production URL
- SDK includes game-specific helpers: `buyWithTon()`, `transferTon()`, NFT/jetton interactions

**Supabase Database:**
- Client initialized with Vite env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- User upsert pattern: `telegram_id` (unique), `username`, `wallet_address`, `high_score`
- Database schema must be created in Supabase (see README.md for SQL)
- Contains table definition, RLS policies, and automatic updated_at trigger

## Configuration Requirements

### Environment Setup
1. Copy `.env.example` to `.env`
2. Set Supabase credentials from dashboard
3. Edit `public/tonconnect-manifest.json` with production URL and app details
4. Add `player.png` to `public/assets/` (64x64 or 128x128 recommended)

### Supabase Database Schema
The complete schema is in `src/scenes/MainScene.js` (comment block at end). Must be run in Supabase SQL editor before first use. Includes:
- Users table with telegram_id unique constraint
- RLS policies (currently permissive for demo - tighten in production)
- Automatic updated_at trigger

## Phaser Configuration Details

**Game Config (src/main.js):**
- Resolution: Dynamic (uses `window.innerWidth` and `window.innerHeight`)
- Scale mode: `Phaser.Scale.RESIZE` with `NO_CENTER` for responsive fullscreen
- Physics: Arcade (gravity disabled by default)
- Input: Touch/pointer only, single active pointer
- Auto-renderer selection (WebGL with canvas fallback)

**Scene Management:**
- Scenes registered in config array: `scene: [MainScene]`
- Add new scenes by importing and adding to this array
- Game logic goes in `update()` method (currently empty placeholder)

## Security Architecture Notes

⚠️ **Critical: This is a client-side demo with extensive security comments**

Three verification layers needed for production (all marked with TODO/SECURITY NOTE comments):

1. **Telegram Auth Verification** (`verifyTelegramAuth()` method):
   - Must verify initData hash on backend using bot token
   - Comments include step-by-step HMAC-SHA256 verification process
   - Check auth_date freshness (< 24 hours)

2. **Wallet Ownership Verification** (`saveUserToSupabase()` method):
   - Optionally request signed message from wallet
   - Verify signature on backend before database operations

3. **Backend Database Operations**:
   - All Supabase writes should go through authenticated backend API
   - Current RLS policies are permissive for demo purposes
   - Production requires backend API between client and Supabase

## Adding New Scenes

1. Create new scene file in `src/scenes/` (extend `Phaser.Scene`)
2. Import in `src/main.js`
3. Add to scenes array in config
4. Access shared state via `this.registry` or scene data passing
5. Launch scenes with `this.scene.start('SceneKey')` or `this.scene.launch('SceneKey')` for parallel scenes

**Mobile-First Scene Design:**
- Design all scenes for portrait mobile aspect ratio (approximately 9:16 to 9:20)
- Use `this.scale.width` and `this.scale.height` for responsive positioning
- Center important UI elements vertically and horizontally relative to screen dimensions
- Account for safe areas at top (status bar/notch) and bottom (gesture bar)
- Test touch target sizes: minimum 44x44 pixels for buttons
- Consider thumb reach zones: place primary actions in bottom half of screen

## Telegram WebApp Specifics

**Viewport Configuration for Full Screen:**
- WebApp auto-expands to full screen on init (line 31-32 in main.js)
- Critical methods to ensure full expansion:
  - `window.Telegram.WebApp.expand()` - Expands to maximum available height
  - `window.Telegram.WebApp.isExpanded` - Check if fully expanded
  - `window.Telegram.WebApp.viewportHeight` - Get actual viewport height
  - `window.Telegram.WebApp.viewportStableHeight` - Get stable height (excludes keyboard)
- Some games may not expand fully if these methods aren't called properly
- Mobile viewport requires proper handling of safe areas and notches

**Other Telegram APIs:**
- Access Telegram theme via `window.Telegram.WebApp.themeParams`
- Vibration available via `window.Telegram.WebApp.HapticFeedback`
- Close app with `window.Telegram.WebApp.close()`

## Asset Loading Pattern

Assets load from `public/assets/` directory:
- Reference as `/assets/filename.png` in load calls
- Includes error handling with fallback graphics (`loaderror` listener in preload)
- Example fallback: circle shape if player sprite fails to load

## TON SDK Game Features

The `@ton/phaser-sdk` provides game-specific blockchain methods accessible via `this.gameFi`:

**Wallet Management:**
- `gameFi.createConnectButton({ scene, x, y })` - Create Phaser-native connect button
- `gameFi.wallet` - Get current wallet info
- `gameFi.onWalletChange(callback)` - Listen to connection changes

**In-Game Purchases:**
- `gameFi.buyWithTon({ amount, description })` - Accept TON payments
- `gameFi.transferTon({ to, amount })` - Send TON to addresses

**NFT/SBT Integration:**
- `gameFi.openNftCollection()` - Interact with NFT contracts
- Methods for minting, transferring, and querying NFTs

**Jetton (Token) Operations:**
- Support for custom game tokens
- Transfer and balance checking

See [@ton/phaser-sdk documentation](https://ton-org.github.io/game-engines-sdk/) for complete API reference.
