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
npm install              # Install dependencies
npm run dev             # Start dev server (localhost:3000)
npm run build           # Build for production (outputs to dist/)
npm run preview         # Preview production build
```

## Architecture

### Entry Point Flow
1. **index.html** → Loads Telegram WebApp SDK and imports `src/main.js`
2. **src/main.js** → Initializes Phaser, expands Telegram WebApp, registers scenes
3. **src/scenes/LoadingScene.js** → Loading screen with progress bar (environment-aware timing)
4. **src/scenes/MainScene.js** → Main game scene with all integration logic

**LoadingScene Behavior:**
- **Two-stage loading:** Progress bar assets load first, then all game assets load with visible progress
- **Stage 1 (preload):** Only loads slider background and fill textures (minimal assets for instant UI)
- **Stage 2 (create):** Creates UI immediately, then uses secondary LoaderPlugin to load all game assets
- **Localhost:** Skips artificial delays for fast development iteration
- **Production:** Maintains polished 1.5s minimum for branding/polish
- Detects environment via `window.location.hostname` check
- Real progress tracking shows actual asset loading status (not simulated animation)

### Phaser Configuration
- Resolution: Dynamic (`window.innerWidth/Height`)
- Scale: `Phaser.Scale.RESIZE` with `NO_CENTER` for responsive fullscreen
- Physics: Arcade (gravity disabled by default)
- Input: Touch/pointer only, single active pointer
- Renderer: WebGL with canvas fallback

### Integration Patterns

**Telegram Authentication:**
- Reads `window.Telegram.WebApp.initDataUnsafe` for user data
- `verifyTelegramAuth()` contains backend verification requirements
- Falls back to mock user in development

**TON Wallet Integration:**
- Uses `GameFi` from `@ton/phaser-sdk` (Phaser-native wrapper)
- SDK provides `createConnectButton()` for native button component
- `onWalletChange()` listener for wallet connect/disconnect
- Manifest at `public/tonconnect-manifest.json` (configure with production URL)
- SDK helpers: `buyWithTon()`, `transferTon()`, NFT/jetton interactions

**Supabase Database:**
- Client init with env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- User upsert: `telegram_id` (unique), `username`, `wallet_address`, `high_score`
- Schema in `src/scenes/MainScene.js` (run in Supabase SQL editor before use)

**Telegram WebApp APIs:**
- `window.Telegram.WebApp.expand()` - Full screen expansion (critical for mobile)
- `window.Telegram.WebApp.viewportHeight` - Actual viewport height
- `window.Telegram.WebApp.themeParams` - Access theme colors
- `window.Telegram.WebApp.HapticFeedback` - Vibration feedback

### Scene Management
- Register scenes in `src/main.js` config array: `scene: [LoadingScene, MainScene]`
- Launch: `this.scene.start('SceneKey')` or `this.scene.launch('SceneKey')` for parallel
- Design for portrait mobile (9:16 to 9:20 aspect ratio)
- Use `this.scale.width/height` for responsive positioning
- Touch targets: minimum 44x44 pixels
- Primary actions: bottom half of screen (thumb reach)

## Reusable Components

### LoadingSlider (`src/components/LoadingSlider.js`)
Progress bar using NineSlice technique with LayerLab assets.

```javascript
const slider = new LoadingSlider(scene, x, y, {
  bgTexture: 'slider_bg',
  fillTexture: 'slider_fill_magenta',
  width: 380,
  height: 60,
  textFormat: 'fraction' // or 'percentage'
});
scene.add.existing(slider);
slider.setProgress(0.75, true); // Animate to 75%
```

**Key features:** NineSlice for no distortion, GeometryMask for smooth reveal, configurable textures/colors/text
**Use for:** Health bars, XP bars, loading screens, stamina indicators

### StatusBar (`src/components/StatusBar.js`)
Top status bar with avatar, resources, and settings button.

```javascript
const statusBar = new StatusBar(scene, 0, 30, {
  avatarTexture: 'avatar_default',
  avatarUrl: telegramPhotoUrl, // Optional Telegram photo
  userLevel: 4,
  resources: [
    { key: 'coins', icon: 'statusbar_coin', value: 0 },
    { key: 'energy', icon: 'statusbar_energy', value: 37720 },
    { key: 'gems', icon: 'statusbar_gem', value: 0 }
  ],
  onSettingsClick: () => console.log('Settings clicked')
});
scene.add.existing(statusBar);
statusBar.setScrollFactor(0).setDepth(1000);

// Update resources
statusBar.setResource('coins', 1500, true); // Animate
statusBar.setLevel(5);
```

**Architecture:** Compact pill layout - 75px wide × 40px high pills with icon (30px) and value text, 15px spacing between pills
**Layout:** Avatar (left) → Centered resource pills → Settings button (right)
**Background Asset:** Uses `statusbar_bg_small` (22×30px) scaled with NineSlice (11,11,15,15) to eliminate visible seams
**Design:** Icons positioned at x+5 with 30px size, text left-aligned at x+20 in 14px font
**Spacing Tuning:** 15px gap provides optimal balance between compactness and readability
**Methods:** `setResource()`, `getResource()`, `setLevel()`, `formatNumber()`, `loadTelegramPhoto()`

### NineSlice Button Pattern
Scalable buttons preserving rounded corners.

```javascript
// Create button with NineSlice
const button = this.add.nineslice(
  x, y, 'btn_green', null,
  280, 80,           // Width x height
  20, 20, 20, 20     // Slices (left, right, top, bottom)
).setOrigin(0.5).setInteractive({ useHandCursor: true });

// Add text overlay
const text = this.add.text(x, y, 'Button Text', {
  fontFamily: 'LINESeed',
  fontSize: '20px',
  fill: '#fff',
  fontStyle: 'bold',
  stroke: '#000000',
  strokeThickness: 3,
  resolution: 2
}).setOrigin(0.5);

// Hover effect
button.on('pointerover', () => button.setTint(0xddffdd));
button.on('pointerout', () => button.clearTint());
```

**Why NineSlice:** Prevents corner distortion when scaling
**Use for:** All game buttons, menus, dialogs

## Fonts & Text Rendering

### Font Usage Convention
Two custom fonts loaded via CDN in `index.html`:

**1. Tilt Warp** - `fontFamily: 'Tilt Warp'`
- Playful display font for titles, headers, achievements, flashy UI

**2. LINESeed** - `fontFamily: 'LINESeed'`
- Clean sans-serif for body text, UI labels, stats, messages, tooltips
- Multi-language support (EN, JP, KR, TH, ZH)

**ALWAYS specify fontFamily** - never rely on browser defaults

### Text Rendering Best Practices
For crisp mobile text:
- `resolution: 2` for high-DPI screens
- `padding: { x: 20, y: 20 }` to prevent stroke/shadow clipping
- `blur: 0` in shadow for crisp edges
- Wait for fonts to load (see `waitForFont()` in MainScene)

```javascript
this.add.text(x, y, 'Title', {
  fontFamily: 'Tilt Warp',
  fontSize: '32px',
  fill: '#fff',
  stroke: '#000000',
  strokeThickness: 6,
  padding: { x: 20, y: 20 },
  shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 0, stroke: false, fill: true },
  resolution: 2
}).setOrigin(0.5);
```

## UI Asset Pack (LayerLab GUI Casual Fantasy)

**Location:** `public/assets/Components/`
**Total:** 415+ PNG files across 10 categories

### Asset Categories

**1. Buttons** (`/Components/Button/`) - 55 files
- Button01_Demo_[Color] - 17 colors (Blue, Green, Red, Purple, Yellow, etc.)
- Button01_White1/White2 - For tinting
- Button_Square[01-05] - Icon/action buttons
- Button_SquareGradient/Solid - Special variants
- Button_Side01 - Navigation arrows

**2. Frames** (`/Components/Frame/`) - 98 files
- BasicFrame_Circle/Square/Octagon - Outline/Solid variants
- CardFrame01 - Complete character card system (8 rarity variants)
- ItemFrame01-05 - Inventory slots (7 color-coded rarities)
- ListFrame01 - List item backgrounds
- SpeechFrame01 - Dialog bubbles
- SplitFrame01/02 - Multi-section panels

**3. Labels** (`/Components/Label/`) - 50 files
- Label_Ribbon01_[Color] - 15 colors, decorative banners
- Label_Trapezoidal01/02 - Angled tab labels (8 colors)
- Label_Oval01/02 - Pill-shaped labels
- Label_SpeechBubble01 - Compact tooltips
- Label_Coner01 - Corner badges

**4. Sliders** (`/Components/Slider/`) - 73 files
- Slider_Basic01/02 - Horizontal progress bars (11 colors)
- Slider_Diagonal[angle] - Angled bars (37°, 42°, 48°, 51°, 70°, 71°)
- Slider_HandleType01 - Draggable slider
- **CRITICAL:** Use `scene.add.nineslice()` NOT sprite/tilesprite

**5. Icons - Misc** (`/Components/IconMisc/`) - 96 files
- Icon_Star/Heart/Fire - Ratings, health, energy
- Icon_Arrow_[direction] - Navigation
- Icon_Menu/Home/Info/Check - Standard UI
- Icon_Sword/Shield/Helmet/Boots/Bow - Equipment (256/512px variants)

**6. Icons - Items** (`/Components/Icon_ItemIcons/`) - 200+ files
- Available in 128px/256px/512px/Original sizes
- ItemIcon_Coin/Gem/Weapon/Book/Bag/Crown/Trophy
- Use 128px for grids, 256px for tooltips, 512px for displays

**7. Icons - Flags** (`/Components/Icon_Flag/`) - 62 files
- Language/country flags for localization (20+ languages)

**8. Popups** (`/Components/Popup/`) - 4 files
- popup02_Demo1/Demo2 - Modal dialogs
- popup02_White1/White2 - For tinting

**9. UI Extras** (`/Components/UI_Etc/`) - 10 files
- Alert_Count/Dot/Text - Notifications
- Toggle01/Switch01 - Checkboxes/switches

**10. Catalog** (`/assets/Catalog/`) - Visual references
- CasualFantasy_Button/Frame/Label/Slider/Popup/UI_Etc.png
- Shows assembly patterns and layering techniques

### Asset Usage Patterns

```javascript
// Load in preload()
this.load.image('btn_blue', '/assets/Components/Button/Button01_Demo_Blue.png');
this.load.image('slider_bg', '/assets/Components/Slider/Slider_Basic01_Bg.png');
this.load.image('icon_coin', '/assets/Components/Icon_ItemIcons/128/ItemIcon_Coin.png');

// Fixed colors: Use _Demo_[Color]
// Dynamic colors: Use _White with tinting
button.setTint(0x00ff00); // Tint to green

// State variants
// _n = normal, _f = focused, _d = disabled, _On/_Off = toggle states

// Slider NineSlice (NEVER use sprite/tilesprite)
const bg = scene.add.nineslice(x, y, 'slider_bg', null, width, height, 13, 13, 34, 34);
const fill = scene.add.nineslice(x, y, 'slider_fill', null, width, height, 9, 9, 30, 30);
```

### Rarity Color System
- Gray = Common
- Green = Uncommon
- Blue = Rare
- Purple = Epic
- Yellow = Legendary
- Red = Unique/Cursed

### Component Assembly Layers (back to front)
1. Background panels/frames
2. Content (text, images)
3. Foreground decorations (borders, ribbons)
4. Interactive elements (buttons)
5. Notifications/badges (top layer)

## Configuration & Security

### Environment Setup
1. Copy `.env.example` to `.env`
2. Set Supabase credentials: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. Configure `public/tonconnect-manifest.json` with production URL

### Security Architecture
⚠️ **This is a client-side demo with security comments**

Three verification layers needed for production (marked in code):

1. **Telegram Auth** - Verify initData hash on backend (HMAC-SHA256)
2. **Wallet Ownership** - Request signed message, verify on backend
3. **Database Operations** - Route all Supabase writes through authenticated backend API

Current RLS policies are permissive for demo - tighten in production.

## TON SDK Game Features

The `@ton/phaser-sdk` provides blockchain methods via `this.gameFi`:

**Wallet:** `createConnectButton()`, `wallet`, `onWalletChange(callback)`
**Payments:** `buyWithTon({ amount, description })`, `transferTon({ to, amount })`
**NFTs:** `openNftCollection()`, minting/transferring/querying
**Jettons:** Custom game tokens, transfer, balance checking

See [@ton/phaser-sdk docs](https://ton-org.github.io/game-engines-sdk/) for complete API.

## Sprite Animations

### Frame-Based Animations
Phaser supports sprite sheet animations built from individual image frames.

**Pattern: Loading animation frames from a sequence**

```javascript
// In LoadingScene.js preload()
// Load every other frame to reduce animation time
for (let i = 1; i <= 60; i += 2) {
  const frameNum = String(i).padStart(4, '0');
  this.load.image(`chest_${frameNum}`, `/assets/sprites/open treasure/frame_${frameNum}.webp`);
}
```

**Pattern: Creating animation from loaded frames**

```javascript
// In MainScene.js create()
createChestAnimation() {
  const frames = [];
  for (let i = 1; i <= 60; i += 2) {
    const frameNum = String(i).padStart(4, '0');
    frames.push({ key: `chest_${frameNum}` });
  }

  this.anims.create({
    key: 'chest_open',
    frames: frames,
    frameRate: 20, // 30 frames at 20fps = 1.5 seconds
    repeat: 0 // Play once
  });
}
```

**Pattern: Playing animations with safeguards**

```javascript
openChest() {
  // Prevent animation restart if already playing
  if (this.player.anims && this.player.anims.isPlaying) {
    return;
  }

  // Play animation
  this.player.play('chest_open');

  // Reset to first frame after delay
  this.time.delayedCall(3000, () => {
    this.player.setTexture('chest_0001');
  });
}
```

**Frame Optimization Tips:**
- Skip frames to reduce animation time (use every 2nd or 3rd frame)
- Use `frameRate` to control animation speed
- Optimize file size: WebP format recommended for smaller file sizes
- For 60fps source video, use every 2nd frame for 30fps playback, or every 4th for 15fps

### Particle/Confetti Effects
Create burst effects using physics sprites for visual polish.

**Pattern: Coin confetti burst effect**

```javascript
createCoinConfetti() {
  const chestX = this.player.x;
  const chestY = this.player.y;
  const coinCount = Phaser.Math.Between(15, 20);

  for (let i = 0; i < coinCount; i++) {
    const coin = this.physics.add.sprite(chestX, chestY, 'statusbar_coin');

    // Random properties for variety
    const scale = Phaser.Math.FloatBetween(0.3, 0.5);
    coin.setScale(scale);

    // Physics for burst effect
    const velocityX = Phaser.Math.Between(-200, 200);
    const velocityY = Phaser.Math.Between(-400, -600);
    coin.setVelocity(velocityX, velocityY);
    coin.setGravityY(900);
    coin.setAngularVelocity(Phaser.Math.Between(-360, 360));

    // Pop-in animation
    coin.setScale(0);
    this.tweens.add({
      targets: coin,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Back.out'
    });

    // Fade out and cleanup
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: coin,
        alpha: 0,
        duration: 500,
        onComplete: () => coin.destroy()
      });
    });
  }
}

// Trigger with delay
this.time.delayedCall(400, () => this.createCoinConfetti());
```

**Confetti Effect Tips:**
- Use `physics.add.sprite()` for gravity-based trajectories
- Randomize velocities, rotation, and scale for natural variety
- Apply gravity (800-1000) for realistic arcing motion
- Stagger spawn with delays for more organic feel
- Always destroy sprites after animation completes to prevent memory leaks
- Layer effects with tween animations (scale, alpha, rotation)

## Asset Loading & Error Handling

### Two-Stage Loading Pattern
For optimal UX, show loading UI immediately before loading bulk assets.

**Pattern: LoadingScene with instant progress bar**

```javascript
// Stage 1: preload() - Load ONLY loading UI assets
preload() {
  this.loadStartTime = Date.now();

  // Only progress bar assets in initial preload
  this.load.image('slider_bg', '/assets/Components/Slider/Slider_Basic01_Bg.Png');
  this.load.image('slider_fill_magenta', '/assets/Components/Slider/Slider_Basic01_Fill_Magenta.Png');

  this.load.on('loaderror', (file) => console.warn(`Failed to load: ${file.key}`));
}

// Stage 2: create() - Show UI, then load everything else
async create() {
  await document.fonts.load('32px "Tilt Warp"'); // Wait for fonts

  this.createLoadingUI(); // Progress bar appears immediately

  // Now load all game assets with visible progress
  this.loadGameAssets();
}

loadGameAssets() {
  // Secondary loader for bulk assets
  const loader = new Phaser.Loader.LoaderPlugin(this);

  // Real-time progress updates
  loader.on('progress', (value) => {
    this.loadingSlider.setProgress(value, false);
  });

  loader.on('complete', () => {
    this.scene.start('MainScene');
  });

  // Load all game assets
  loader.image('background', '/assets/background.png');
  loader.image('sprite1', '/assets/sprite1.png');
  // ... all other assets

  loader.start(); // Begin loading
}
```

**Why two-stage loading:**
- Progress bar appears instantly (only 2 small images to load first)
- User sees real loading progress, not a blank screen
- Better perceived performance and user experience
- Progress accurately reflects actual asset loading

### Basic Asset Loading

```javascript
// Assets load from public/assets/
this.load.image('sprite', '/assets/filename.png');

// Graceful fallback for missing assets
this.load.on('loaderror', (file) => {
  console.error('Failed to load:', file.key);
  // Create fallback graphics
});
```
