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
- **Two tables:** `users` (identity) and `user_stats` (game data)
- **Schema:** See `supabase_schema.sql` - run in Supabase SQL editor to create tables
- **Auto-save:** Stats save every 5 seconds + on critical events (chest open, scene shutdown)
- **Dual-write strategy:** localStorage (instant/offline) + Supabase (persistent/cross-device)
- **Data tracked:** coins, tickets, gems, energy, user_level, total_chests_opened, profile_photo_url

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

**Telegram Avatar Loading:**
The StatusBar automatically loads and displays Telegram user profile photos using an HTML overlay approach to bypass CORS restrictions:

- **CORS Workaround:** Telegram's CDN (`cdn1.telesco.pe`) blocks cross-origin canvas access, preventing direct Phaser texture loading
- **Solution:** Creates an HTML `<div>` with `<img>` positioned absolutely over the Phaser canvas
- **Circular Masking:** Uses CSS `border-radius: 50%` and `overflow: hidden` for circular avatar display
- **Positioning:** Automatically calculates screen coordinates from Phaser world coordinates
- **Responsive:** Updates position on window resize via `scale.on('resize')` event
- **Fallback:** If photo fails to load, keeps default Phaser avatar visible
- **Implementation:** Pass `avatarUrl: window.Telegram.WebApp.initDataUnsafe.user.photo_url` to constructor

This pattern is recommended for any external user-generated images (avatars, photos) that may have CORS restrictions.

### BatteryBar (`src/components/BatteryBar.js`)
Energy/stamina bar with battery icon, auto-regeneration, and persistent state.

```javascript
// Initialize persistent state in create()
this.batteryState = withPersistentState(this, 'batteryEnergy', 100);

// Create battery bar
const batteryBar = new BatteryBar(scene, x, y, {
  width: 350,
  height: 30,
  iconTexture: 'battery_icon',
  fillTexture: 'slider_fill_green',
  bgTexture: 'slider_bg',
  currentValue: this.batteryState.get(),
  maxValue: 100,
  iconSize: 45,
  iconOffsetX: -10,
  showText: false // Hide numbers overlay
});
scene.add.existing(batteryBar);
batteryBar.setScrollFactor(0).setDepth(999);

// Update battery (with animation)
batteryBar.setBattery(75, 100, true);

// Get current values
const values = batteryBar.getBatteryValues();
// { current: 75, max: 100, progress: 0.75 }
```

**Architecture:** Container-based component with NineSlice bars, battery icon, optional text, and GeometryMask for fill reveal
**Asset Requirements:**
- Background: `Slider_Basic01_Bg.Png` (26×68px)
- Fill: `Slider_Basic01_Fill_Green.Png` (18×60px)
- Icon: `ItemIcon_Battery.png` (512×512px)
**NineSlice Values:** Background (13,13,17,17), Fill (9,9,15,15) - optimized for thin bars (30-40px height)
**Icon Positioning:** Uses `iconOffsetX` to overlap left edge of bar (negative values move left)
**Methods:** `setBattery(current, max, animate)`, `setProgress(value, animate)`, `getBatteryValues()`, `getProgress()`

**Auto-Regeneration System:**
```javascript
// In MainScene create()
this.lastClickTime = 0;
this.startBatteryRegeneration();

startBatteryRegeneration() {
  this.batteryRegenTimer = this.time.addEvent({
    delay: 300, // Check every 0.3 seconds
    callback: () => {
      const timeSinceLastClick = this.time.now - this.lastClickTime;

      // Only regen if idle for 1+ second
      if (timeSinceLastClick >= 1000) {
        const current = this.batteryState.get();
        if (current < 100) {
          const newBattery = current + 1;
          this.batteryState.set(newBattery);
          this.batteryBar.setBattery(newBattery, 100, true);
        }
      }
    },
    loop: true
  });
}

// On any action that consumes energy
openChest() {
  this.lastClickTime = this.time.now; // Reset regen timer

  const current = this.batteryState.get();
  if (current <= 5) return; // Stop at 5/100 minimum

  const newBattery = current - 1;
  this.batteryState.set(newBattery);
  this.batteryBar.setBattery(newBattery, 100, true);
}
```

**Regeneration Behavior:**
- Checks every 300ms if user has been idle for 1+ second
- Regenerates 1 energy per second when idle
- Stops at 100 (max energy)
- Stops consuming at 5 (minimum energy threshold)
- Persists to localStorage automatically via `withPersistentState`

**Use Cases:** Energy systems, stamina bars, action cooldowns, daily limits

### NineSlice Pattern (WebGL Only)
**Critical for scalable UI elements that preserve corner/edge integrity.**

**How NineSlice Works:**
A NineSlice divides your texture into a 3×3 grid (9 regions):
- **Corners (1, 3, 7, 9):** Never scale - preserve rounded corners and decorative elements
- **Edges (2, 8):** Stretch horizontally only
- **Sides (4, 6):** Stretch vertically only
- **Center (5):** Stretches in both directions

**Slice Parameters (in pixels from edges):**
```javascript
scene.add.nineslice(
  x, y, texture, frame,
  width, height,
  leftWidth,    // Distance from left edge to vertical divider
  rightWidth,   // Distance from right edge to vertical divider
  topHeight,    // Distance from top edge to horizontal divider
  bottomHeight  // Distance from bottom edge to horizontal divider
);
```

**Critical Rules:**
1. Width must be ≥ (leftWidth + rightWidth)
2. Height must be ≥ (topHeight + bottomHeight)
3. Slice values should match where corners/edges end in the original texture
4. For pill shapes: set left/right to half the height to preserve rounded ends
5. Use `setScale()` on the NineSlice object if you need sizes smaller than minimum dimensions

**Example: Button with NineSlice**
```javascript
const button = this.add.nineslice(
  x, y, 'btn_green', null,
  280, 80,           // Target width × height
  20, 20, 20, 20     // Slices: left, right, top, bottom (20px corners)
).setOrigin(0.5).setInteractive({ useHandCursor: true });
```

**Example: Pill-shaped toggle (150×94px original)**
```javascript
// For a horizontal pill, left/right should be ~47px (half the height)
// to preserve the rounded caps on both ends
const toggle = this.add.nineslice(
  x, y, 'toggle_bg', null,
  200, 94,           // Stretch width to 200px, keep height
  47, 47, 10, 10     // Large left/right preserves rounded ends
).setScale(0.5);     // Scale entire object down for final size
```

**3-Slice Alternative (horizontal only):**
```javascript
// Omit topHeight and bottomHeight for horizontal-only stretching
const bar = this.add.nineslice(x, y, 'health_bar', null, width, height, leftWidth, rightWidth);
```

**Common Mistakes:**
- ❌ Setting slice values too small → corners get stretched and distorted
- ❌ Setting slice values too large → no middle section to stretch
- ❌ Trying to make NineSlice smaller than minimum dimensions → use setScale() instead
- ❌ Not matching slice values to actual corner size in texture → warped appearance

**Use Cases:** Buttons, dialog boxes, panels, health bars, bordered frames, pill-shaped toggles

## Fonts & Text Rendering

### Font Usage Convention
Two custom fonts self-hosted in `public/assets/fonts/` with @font-face declarations in `index.html`:

**1. Tilt Warp** - `fontFamily: 'Tilt Warp'`
- Playful display font for titles, headers, achievements, flashy UI
- File: `TiltWarp-Regular.ttf` (65KB, downloaded from Google Fonts)
- Source: https://fonts.google.com/specimen/Tilt+Warp

**2. LINESeed** - `fontFamily: 'LINESeed'`
- Clean sans-serif for body text, UI labels, stats, messages, tooltips
- Multi-language support (EN, JP, KR, TH, ZH)
- Files: `LINESeedSans_A_Rg.ttf` (Regular, 400 weight), `LINESeedSans_A_Bd.ttf` (Bold, 700 weight)

**Self-Hosted Benefits:**
- No external CDN dependencies or tracking
- Faster loading (same domain, no DNS lookup)
- Works offline
- Consistent with Vite's public directory pattern

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

## Audio & Sound

### Web Audio Autoplay Policy
Browsers require AudioContext to be resumed after a user gesture before playing audio.

**Pattern: Unlock audio on first interaction**

```javascript
constructor() {
  super({ key: 'MainScene' });
  this.audioUnlocked = false;
}

playSound() {
  // Resume AudioContext on first interaction (required by browsers)
  if (!this.audioUnlocked) {
    this.sound.context.resume().then(() => {
      this.audioUnlocked = true;
      console.log('Audio unlocked');
    }).catch(err => {
      console.warn('Failed to unlock audio:', err);
    });
  }

  // Now safe to play sounds
  this.sound.play('sound_key');
}
```

**Why this is needed:**
- Chrome/Safari block autoplay audio until user interacts with page
- Prevents "AudioContext was not allowed to start" console warnings
- Must call `context.resume()` in response to click/tap event
- Only needs to happen once per session (tracked with `audioUnlocked` flag)

**Best practice:** Call resume on first button tap, then all subsequent sounds work normally.

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

### Floating Text Effects
Display reward amounts or damage numbers that float upward and fade away.

**Pattern: Floating "+X" reward text**

```javascript
createCoinConfetti(coinAmount) {
  const chestX = this.player.x;
  const chestY = this.player.y;

  // ... coin physics sprites code ...

  // Create floating "+X" text that rises and fades
  const floatingText = this.add.text(chestX, chestY, `+${coinAmount}`, {
    fontFamily: 'Tilt Warp',
    fontSize: '48px',
    fill: '#FFFFFF', // White color
    stroke: '#000000',
    strokeThickness: 6,
    padding: { x: 20, y: 20 },
    resolution: 2
  }).setOrigin(0.5);

  // Animate text floating upward and fading out
  this.tweens.add({
    targets: floatingText,
    y: chestY - 250, // Float up 250 pixels
    alpha: 0, // Fade to transparent
    duration: 1000, // 1 second
    ease: 'Sine.easeOut', // Smooth deceleration
    onComplete: () => floatingText.destroy()
  });
}
```

**Floating Text Tips:**
- Use Tilt Warp font for playful display text, LINESeed for UI labels
- White text (#FFFFFF) with black stroke provides maximum contrast
- Combine with particle effects (coins fall down, text floats up)
- Use `Sine.easeOut` for natural deceleration
- Always destroy text after animation completes
- Adjust duration (1000ms = fast, 2000ms = slow) based on readability needs
- Position text centered on the action source for clarity

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

## State Management

### Dual-Write Persistence Strategy
The game uses a **dual-write** approach combining localStorage (client-side) and Supabase (server-side) for optimal reliability:

**localStorage (Fast, Offline)**
- Instant read/write operations (no network latency)
- Works offline without internet connection
- Game remains playable in all conditions
- Automatic via `withPersistentState` utility

**Supabase (Persistent, Cross-Device)**
- Syncs across devices using Telegram ID
- Survives browser cache clearing
- Server-calculated offline energy regeneration
- Auto-saves every 5 seconds + on critical events

**Data Flow:**
1. User action (tap chest) → localStorage updated instantly
2. UI updates immediately (no lag)
3. Stats save to Supabase asynchronously (5s timer or immediate)
4. On game load → Supabase values override localStorage (authoritative)
5. If offline → localStorage continues to work, syncs when back online

### Custom Persistent State Utility
**Location:** `src/utils/persistentState.js`

A lightweight, localStorage-backed state management system with automatic persistence and modern Phaser events API (no deprecation warnings).

**Pattern: Basic usage with object API**

```javascript
import { withPersistentState } from '../utils/persistentState.js';

// In scene create()
this.coinsState = withPersistentState(this, 'totalCoins', 0);

// Get current value
const coins = this.coinsState.get();

// Set new value (automatically saves to localStorage)
this.coinsState.set(coins + 50);

// Reset to default value
this.coinsState.reset();
```

**Pattern: React-style tuple API (optional)**

```javascript
import { usePersistentState } from '../utils/persistentState.js';

// In scene create()
const [getCoins, setCoins] = usePersistentState(this, 'totalCoins', 0);

// Get and set
const current = getCoins();
setCoins(current + 50);
```

**Features:**
- ✅ **Automatic persistence** - Syncs to localStorage on every `set()`
- ✅ **Scene lifecycle aware** - Cleans up on scene destroy
- ✅ **Modern Phaser API** - Uses `scene.events.emit()` (no deprecation warnings)
- ✅ **Type-safe** - Works with any JSON-serializable value
- ✅ **Debug mode** - Pass `{ debug: true }` for console logging
- ✅ **Event emitter** - Emits `'persistentstate:change'` events

**Example: Coin counting with persistence**

```javascript
// Initialize in create()
this.coinsState = withPersistentState(this, 'totalCoins', 0);

// Load saved value into StatusBar
this.statusBar = new StatusBar(this, 0, 30, {
  resources: [
    { key: 'coins', icon: 'statusbar_coin', value: this.coinsState.get() }
  ]
});

// Update coins on chest click
openChest() {
  const reward = Phaser.Math.Between(10, 50);
  const newTotal = this.coinsState.get() + reward;
  this.coinsState.set(newTotal); // Automatically saved to localStorage
  this.statusBar.setResource('coins', newTotal, true);
}
```

**Why use this instead of phaser-hooks library:**
- No external dependencies
- No deprecation warnings
- Smaller bundle size
- Full control over implementation
- Better error handling with try/catch blocks

**Implementation Details:**
- Uses `JSON.stringify/parse` for storage serialization
- Automatically handles scene cleanup via `shutdown` and `destroy` events
- Gracefully handles localStorage errors (quota exceeded, private browsing, etc.)
- State persists across browser refreshes and sessions

### Supabase Integration & Auto-Save System
**Location:** `src/scenes/MainScene.js`

The game automatically syncs all stats to Supabase for cross-device persistence and server-side features.

**Setup Instructions:**
1. Run `supabase_schema.sql` in Supabase SQL Editor to create tables
2. Set environment variables in `.env`:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key
3. Tables are automatically populated when users play the game

**Database Tables:**
```sql
-- users: Identity and authentication
- telegram_id (primary key, BIGINT)
- username (TEXT)
- profile_photo_url (TEXT) - Telegram avatar URL
- wallet_address (TEXT) - TON wallet address
- created_at, updated_at

-- user_stats: Game progression and resources
- telegram_id (primary key, links to users)
- coins, tickets, gems (INTEGER)
- energy (INTEGER, 0-100)
- last_energy_update (TIMESTAMP) - For offline regeneration
- user_level (INTEGER)
- high_score (INTEGER) - For future leaderboards
- total_chests_opened (INTEGER) - Activity tracking
- created_at, updated_at
```

**Key Functions in MainScene:**

```javascript
// Called once on game load - initializes user and loads stats
async initializeUser() {
  // 1. Upsert user to users table (telegram_id, username, photo_url)
  // 2. Load stats from user_stats table
  // 3. If stats exist: Load into game
  // 4. If new user: Create initial stats row
  // 5. Calculate server-side offline energy regeneration
  // 6. Fallback to localStorage if database unavailable
}

// Called every 5 seconds + on critical events
async saveStatsToSupabase() {
  // Upserts current stats to user_stats table
  // Updates: coins, tickets, gems, energy, user_level,
  //          total_chests_opened, last_energy_update
  // Gracefully handles errors (localStorage continues working)
}

// Starts auto-save timer system
startAutoSave() {
  // Timer: Saves every 5 seconds
  // Event: Saves on scene shutdown
  // Event: Saves on scene destroy
}
```

**Tracked State Variables:**
```javascript
this.coinsState = withPersistentState(this, 'totalCoins', 0);
this.ticketsState = withPersistentState(this, 'totalTickets', 0);
this.gemsState = withPersistentState(this, 'totalGems', 0);
this.batteryState = withPersistentState(this, 'batteryEnergy', 100);
this.userLevelState = withPersistentState(this, 'userLevel', 1);
this.totalChestsOpenedState = withPersistentState(this, 'totalChestsOpened', 0);
this.lastBatteryUpdateTime = withPersistentState(this, 'lastBatteryUpdateTime', Date.now());
```

**When Stats Are Saved:**
1. **Game Load** - User initialized, stats loaded from database
2. **Every 5 seconds** - Auto-save timer (background)
3. **Chest opened** - Immediate save after action
4. **Game close** - Final save on scene shutdown/destroy

**Offline Energy Regeneration:**
The system uses server timestamps for more accurate offline regeneration:
- Client-side: Uses `lastBatteryUpdateTime` localStorage value
- Server-side: Uses `last_energy_update` database timestamp
- On load: Calculates elapsed time since `last_energy_update`
- Rate: 3.3 energy per second (matches active regeneration)
- Shows notification if energy was gained while away

**Error Handling:**
- All Supabase operations are wrapped in try/catch blocks
- Errors are logged but don't break the game
- localStorage continues to work as backup if database fails
- Game is fully playable offline

**Security Notes:**
- Current RLS policies are permissive for demo (`USING (true)`)
- For production: Implement backend API with Telegram auth verification
- See security warnings in code comments and `SUPABASE_INTEGRATION.md`
- Route all database operations through authenticated backend in production

**Querying User Data:**
Use the `user_profiles` view for convenient access to combined user + stats data:
```sql
SELECT * FROM user_profiles WHERE telegram_id = 123456789;
-- Returns: username, wallet_address, profile_photo_url, coins, energy, etc.
```

**Documentation:**
- Full setup guide: `SUPABASE_INTEGRATION.md`
- SQL schema: `supabase_schema.sql`
- Testing checklist and troubleshooting in integration docs
