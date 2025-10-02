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
3. **src/scenes/LoadingScene.js** → Loading screen with progress bar (shows first)
4. **src/scenes/MainScene.js** → Main game scene with all integration logic

### Reusable Components

**LoadingSlider Component** (`src/components/LoadingSlider.js`):
- Reusable progress bar using LayerLab slider assets with NineSlice technique
- Extends `Phaser.GameObjects.Container` for easy positioning and scaling
- **Key features:**
  - Uses `scene.add.nineslice()` to prevent distortion (NEVER use sprite/tilesprite for sliders)
  - GeometryMask for smooth progress reveal
  - Configurable textures, colors, text format ("999/999" or "45%")
  - Smooth tween animations with `setProgress(value, animate)`
- **Usage example:**
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
- Can be reused for: Health bars, XP bars, loading screens, stamina indicators

**Custom Button Pattern** (TON Connect Button in `src/scenes/MainScene.js`):
- Uses NineSlice technique for scalable buttons with preserved rounded corners
- Built with LayerLab button assets from GUI Casual Fantasy pack
- **Implementation details:**
  - Asset: `/assets/Components/Button/Button01_Demo_Green.png`
  - NineSlice configuration: 20px slices on all sides to preserve corners
  - Dimensions: 280x80 pixels (width x height)
  - Text overlay: LINESeed font with stroke for readability
  - Interactive states: Normal, Hover (lighter tint), Connected (bright tint)
- **Usage example:**
  ```javascript
  // Create button with NineSlice
  this.connectButton = this.add.nineslice(
    centerX, buttonY,
    'btn_green',
    null,
    280, 80, // Width and height
    20, 20, 20, 20 // Left, right, top, bottom slices
  ).setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  // Add text overlay
  this.buttonText = this.add.text(centerX, buttonY, 'Button Text', {
    fontFamily: 'LINESeed',
    fontSize: '20px',
    fill: '#fff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
    resolution: 2
  }).setOrigin(0.5);

  // Hover effect
  this.connectButton.on('pointerover', () => {
    this.connectButton.setTint(0xddffdd); // Lighter tint
  });
  this.connectButton.on('pointerout', () => {
    this.connectButton.clearTint(); // Reset
  });
  ```
- **Why NineSlice:** Prevents distortion of rounded corners when scaling buttons to different sizes
- Can be reused for: Any game buttons, menu navigation, action buttons, dialog confirmations

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

### Fonts

Two custom fonts are loaded via CDN in `index.html`:

**1. Tilt Warp** (Google Fonts)
- Playful, warped display font
- CSS font-family: `'Tilt Warp', sans-serif`
- Use for: Game titles, flashy UI elements, special effects text

**2. LINE Seed** (LINE Corporation)
- Clean, modern sans-serif designed for multi-language support
- CSS font-family: `'LINESeed', sans-serif`
- Supports: English, Japanese, Korean, Thai, Traditional Chinese
- Use for: Body text, UI labels, readable game content
- License: SIL Open Font License 1.1

**Using fonts in Phaser:**
```javascript
// In scene create() method
this.add.text(x, y, 'Text', {
  fontFamily: 'Tilt Warp',
  fontSize: '48px',
  color: '#ffffff'
});

this.add.text(x, y, 'Text', {
  fontFamily: 'LINESeed',
  fontSize: '24px',
  color: '#ffffff'
});
```

**Font Usage Convention:**
- **ALWAYS specify fontFamily** in all text objects - never rely on browser defaults
- **Tilt Warp** for: Game titles, scene headers, achievement popups, flashy announcements
- **LINESeed** for: UI labels, body text, stats, user info, messages, tooltips, all readable content
- Example pattern:
  ```javascript
  // Title/Header
  fontFamily: 'Tilt Warp'

  // Everything else
  fontFamily: 'LINESeed'
  ```

## Phaser Text Rendering Best Practices

**For crisp, readable text on mobile:**
- Set `resolution: 2` for high-DPI rendering on mobile screens
- Use `padding: { x: 20, y: 20 }` to prevent stroke/shadow clipping
- Minimize shadow blur (use `blur: 0` for crisp edges)
- Background scaling: Use scale multiplier of `1.01` to prevent 1px gaps from float rounding
- Always wait for fonts to load before creating text objects (see `waitForFont()` in MainScene)

**Example crisp title text:**
```javascript
this.add.text(centerX, 100, 'Game Title', {
  fontFamily: 'Tilt Warp',
  fontSize: '32px',
  fill: '#fff',
  stroke: '#000000',
  strokeThickness: 6,
  padding: { x: 20, y: 20 },
  shadow: {
    offsetX: 3,
    offsetY: 3,
    color: '#000000',
    blur: 0,  // Zero blur for crisp edges
    stroke: false,
    fill: true
  },
  resolution: 2  // 2x resolution for sharp rendering
}).setOrigin(0.5);
```

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

## UI Asset Pack Inventory

This project uses the **"GUI Casual Fantasy"** asset pack from [LayerLab](https://layerlab.itch.io/gui-casual-fantasy). All components are located in `public/assets/Components/`.

### Asset Organization

**Total: 415+ UI elements across 10 categories**

#### 1. Buttons (`/Components/Button/`) - 55 files
Standard game buttons with multiple color variants and styles:
- **Button01_Demo_[Color].png** - Main button style in 17 colors (Black, Blue, DarkGray, Gray, Green, LightGray, Magenta, Navy, OffWhite, Orange, Pink, Purple, Red, Rose, Sky, Teal, Yellow)
- **Button01_White1.png / White2.png / Line.png** - White/outline variants for tinting
- **Button_Square01/05/Gradient[size]** - Square buttons with gradient effects
- **Button_SquareSolid01** - Flat square buttons
- **Button_Side01** - Side-mounted UI buttons

**Usage**: Reference as `/assets/Components/Button/Button01_Demo_Blue.png` in preload

#### 2. Frames (`/Components/Frame/`) - 98 files
Container frames for UI panels, cards, and item displays:
- **BasicFrame_[Shape][Type]** - Circles, squares, octagons (outline/solid variants)
  - CircleOutline01/02, CircleSolid01
  - SquareOutline01/02/03, SquareSolid01
  - Octagon01/02 (with mask variants)
- **CardFrame01** - Full card layouts with background, slider, and badge components
- **ItemFrame01-05** - Item slot frames in multiple colors and states (normal/focused/disabled)
- **ListFrame01** - List item backgrounds (focused/normal states)
- **ProfileFrame01** - Character/avatar frame
- **SpeechFrame01** - Dialog bubble frames
- **SplitFrame01/02** - Multi-section panel frames
- **HorizontalFrame01** - Wide horizontal container

**Color Variants**: Blue, Gray, Green, Purple, Red, Sky, Teal, Yellow
**Special Features**: Many include `_n` (normal), `_f` (focused), `_d` (disabled) state variants

#### 3. Labels (`/Components/Label/`) - 50 files
Text container labels and ribbons:
- **Label_Ribbon01_[Color]** - 15 colors with optional `_Deco` decorated variants (Blue, Brown, Gray, Green, LightGreen, Magenta, Orange, Pink, Purple, Red, Rose, Sky, Teal, White, Yellow)
- **Label_Trapezoidal01/02** - Angled label backgrounds (Blue, Gray, Green, Purple, Red, Teal, White, Yellow)
- **Label_Oval01/02** - Rounded label containers
- **Label_SpeechBubble01** - Compact speech bubbles
- **Label_Coner01** - Corner notification labels (Red, White)

**Usage Pattern**: Ideal for score displays, level indicators, achievement notifications

#### 4. Sliders (`/Components/Slider/`) - 73 files
Progress bars and slider controls:
- **Slider_Basic01/02** - Horizontal sliders with separate Bg/Fill components
  - Fill colors: Blue, Darkorange, Green, Magenta, OffWhite, Orange, Pink, Purple, Red, Sky, Teal, Yellow
- **Slider_Diagonal[angle]** - Angled sliders at various degrees (37°, 42°, 48°, 51°, 70°, 71°)
  - Separate Bg, Fill, Icon/Handle components for each
- **Slider_HandleType01** - Slider with draggable handle (On/Off states)

**Component Structure**: Most sliders have 3 parts:
1. `_Bg.png` - Background track
2. `_Fill.png` - Filled portion (crop/scale for progress)
3. `_Icon.png` or `_Handle.png` - Draggable element

#### 5. Icons - Miscellaneous (`/Components/IconMisc/`) - 96 files
General game icons and UI symbols:
- **Icon_Star01/02/03** - Star ratings (small/medium/large variants)
- **Icon_Heart01/02/03** - Health/lives indicators
- **Icon_Fire01/02** - Energy/power icons
- **Icon_Gold, Icon_Trophy** - Currency and achievements
- **Icon_Lock01/02/03** - Locked content indicators
- **Icon_Arrow_[direction]** - Navigation arrows (Back, Next, Prev, Down01/02)
- **Icon_Menu01/02** - Hamburger menu icons (256px and 512px variants)
- **Icon_Home, Icon_Info, Icon_Check, Icon_Flag** - Standard UI icons
- **Icon_Sound, Icon_Music** - Audio controls
- **Icon_Add02/03** - Plus/increment buttons
- **Icon_Bell, Icon_Timer, Icon_Skip** - Notification and time icons
- **Icon_Picture, Icon_Body** - Avatar placeholders

**Equipment Icons** (256px and 512px variants):
- **Icon_Sword01-07** - Various sword types
- **Icon_Shield01-05** - Shield variants
- **Icon_Helmet01/02** - Helmet icons
- **Icon_Boots01/02** - Boot equipment (Purple/White variants)
- **Icon_Bow01/02** - Ranged weapons

#### 6. Icons - Item Collection (`/Components/Icon_ItemIcons/`) - 200+ files
Game items available in 4 size variants (128px, 256px, 512px, Original):
- **ItemIcon_Coin** - Currency
- **ItemIcon_Gem_[shape]_[color]** - Gems in Pentagon and Triangle shapes
  - Colors: Blue, Gray, Green, Purple, Red, Yellow
- **ItemIcon_Weapon_[type]** - Axe, Bow, Hammer, Shield, Sword, SwordShield
- **ItemIcon_Book01/02** - Books (Blue, Red, Brown, Teal)
- **ItemIcon_Bag01/02** - Inventory bags
- **ItemIcon_Badge_[type]** - Crown, Energy badges
- **ItemIcon_Crown, ItemIcon_Trophy, ItemIcon_Cup** - Achievements
- **ItemIcon_Helmet, ItemIcon_Skull, ItemIcon_Star** - Character items
- **ItemIcon_Key, ItemIcon_Map, ItemIcon_Letter, ItemIcon_Scroll** - Quest items
- **ItemIcon_Ticket_[color]** - Blue, Yellow tickets
- **ItemIcon_Shop01/02, ItemIcon_Anvil** - Building/crafting icons
- **ItemIcon_Fox, ItemIcon_Grain, ItemIcon_Battery** - Resource icons
- **ItemIcon_MemoPad, ItemIcon_Megaphone, ItemIcon_Medalstand** - Misc items

**Size Selection**: Use 128px for inventory grids, 256px for equipped items, 512px for featured displays

#### 7. Icons - Flags (`/Components/Icon_Flag/`) - 62 files
Language/country flags for localization:
- **Icon_Flag_[code].Png** - Small flags (e.g., Eng, Fra, Deu, Jpn, Kor, Chn, Rus, Esp, etc.)
- **Icon_LanguageFlag_Small_[code].png** - Small format language flags
- **Icon_LanguageFlag_Large_[code].png** - Large format language flags

**Supported Languages**: Arabic, Chinese, German, English, Spanish, French, Greek, Indonesian, Italian, Japanese, Korean, Polish, Portuguese (Pra/Prt), Romanian, Russian, Swedish, Thai, Turkish, Vietnamese, Ukrainian

#### 8. Popups (`/Components/Popup/`) - 4 files
Modal dialog backgrounds:
- **popup02_Demo1/Demo2.png** - Example popup designs
- **popup02_White1/White2.png** - White versions for tinting

#### 9. UI Extras (`/Components/UI_Etc/`) - 10 files
Notification and toggle elements:
- **Alert_Count_White.png** - Numeric notification badges
- **Alert_Dot_White.png** - Simple notification dot
- **Alert_Text_[color].png** - Text notification backgrounds (Red, White, Yellow)
- **Toggle01_White_On/Off.png** - Toggle switch states
- **Toggle01_White_ChenkIcon.png / Toggle01_Demo_ChenkIcon_Green.png** - Checkmark icons
- **Switch01_White_Bg.png** - Switch background

### Usage Patterns

**Loading Assets in Phaser:**
```javascript
// In preload() method
this.load.image('btn_blue', '/assets/Components/Button/Button01_Demo_Blue.png');
this.load.image('frame_card', '/assets/Components/Frame/CardFrame01_White1.png');
this.load.image('icon_coin', '/assets/Components/Icon_ItemIcons/128/ItemIcon_Coin.png');
```

**Color Variants Strategy:**
- Use `_Demo_[Color]` files for fixed colors
- Use `_White` files with Phaser tinting for dynamic recoloring:
  ```javascript
  const button = this.add.image(x, y, 'btn_white');
  button.setTint(0x00ff00); // Tint to green
  ```

**State Management:**
- Files ending in `_n` = normal state
- Files ending in `_f` = focused/selected state
- Files ending in `_d` = disabled state
- Files ending in `_On/_Off` = toggle states

**Responsive Sizing:**
- Use `Icon_ItemIcons/128/` for small UI (inventory grids)
- Use `Icon_ItemIcons/256/` for medium UI (tooltips, equipped items)
- Use `Icon_ItemIcons/512/` for large UI (shop displays, rewards)
- Icon sizes: Most IconMisc are available in base, 256px, and 512px variants

### Asset Pack Reference
- **Source**: [GUI Casual Fantasy by LayerLab](https://layerlab.itch.io/gui-casual-fantasy)
- **License**: Check asset pack license for usage terms
- **Base Path**: `public/assets/Components/`
- **Total Files**: 415+ PNG images

## UI Assembly Catalog

Visual reference images showing how components combine into complete UI elements are located in `public/assets/Catalog/`. These demonstrate professional assembly patterns and layering techniques.

### Button Assemblies (`Catalog/CasualFantasy_Button.png`)

**Button01 - Standard Buttons:**
- Simple text-on-button layout with rounded rectangle background
- 17 color variants (Blue, Orange, Gray, Pink, Green, Magenta, Yellow, Purple, Black, etc.)
- Text should be white with black outline/shadow for readability

**Button_Square01 - Icon Buttons:**
- Dropdown-style buttons combining button background + icon + dropdown arrow
- Example: Grid icon button with down arrow for view switchers
- Layout: [Icon] TEXT [▼]

**Button_Square02/03 - Action Buttons:**
- Circular icon buttons for checkmarks, close buttons
- Square02: Checkmark buttons (checked/unchecked states)
- Square03: Close/X buttons (red for cancel, white for neutral)

**Button_Square04 - Add/Plus Buttons:**
- Small square buttons with plus icon
- Dark and light variants for different backgrounds

**Button_Square05 - Tab Buttons:**
- Rectangular button with colored fill
- Multiple states shown (normal/selected)

**Button_SquareGradient106 - Calendar/Badge Buttons:**
- Calendar icon with text label below
- Gradient background (dark and light variants)
- Pattern: Icon at top, text below

**Button_SquareGradient156 - Multi-Layer Buttons:**
- Complex layered design with background + icon frame + text
- Three-tier assembly: Base gradient → Icon badge → Text label
- Color variants: Blue, Navy, White

**Button_SquareGradient188 - Map/Feature Buttons:**
- Large square button with prominent centered icon (map/shield)
- Icon overlays button background
- Text label below icon
- Variants: Gray and Yellow

**Button_SquareSolid01/02/03 - Media/Icon Buttons:**
- SolidO1: Play/pause media controls (black and white variants)
- Solid02: Close/X buttons (red X on dark, outlined X on light)
- Solid03: Badge buttons with icon and text label

**Button_SquareLine01 - Outline Buttons:**
- Text-only buttons with outline border (no fill)
- Example: "SKIP" button for dismissible content

**Button_Side01 - Navigation Arrows:**
- Small side buttons with arrow icons
- For pagination, carousels, navigation
- Chat/comment bubble icon variant shown

**Button_Circle01 - Circular Icon Buttons:**
- Simple circular button with centered icon
- Example: Settings/gear icon

### Frame Assemblies (`Catalog/CasualFantasy_Frame.png`)

**BasicFrame_CircleOutline01/02:**
- Simple circular frames for avatars/icons
- Outline01: Thin border in various sizes
- Outline02: Two-tone border (inner + outer rings) with info icon example

**BasicFrame_CircleSolid01:**
- Filled circular backgrounds
- Shown with lock icon and coin icon examples

**BasicFrame_Octagon01/02:**
- Octagonal frames with fire/energy icon examples
- 01: Simple octagon shape
- 02: Multi-layered with center icon + decorative border + action buttons (plus/settings)

**ProfileFrame:**
- Avatar frame with character portrait
- Suitable for profile pictures, character cards

**BasicFrame_SquareOutline01/02:**
- Square frames with thin borders
- 01: Single border in dark/light variants
- 02: Double border (inner frame + outer frame) in dark/light variants

**BasicFrame_SquareSolid01:**
- Filled square backgrounds with icon + text
- Example shows gem icon with "999" text label
- Three variants: dark, medium, light backgrounds

**CardFrame01 - Character Cards:**
- **Complex multi-component assembly** - most detailed frame system
- Complete RPG/game character card with multiple data layers
- **Assembly layers (bottom to top):**
  1. Background image (character portrait)
  2. Frame border (top banner area)
  3. Star rating badges (top left corner - 1-5 stars)
  4. Status icons (top right - currency/level indicators)
  5. Name label (bottom section with text)
  6. Lock icon overlay (for locked characters)
  7. Currency counter (coins shown: "16/20")
  8. Progress sliders at bottom

- **8 complete variants shown:**
  - Gray locked card (with lock icon, 0/0 currency)
  - Green common card (2 stars, blue slider)
  - Blue rare card (3 stars, green slider)
  - Purple epic card (4 stars, purple/yellow slider)
  - Yellow legendary card (5 stars, yellow slider)
  - White/silver variant (grayscale with lock, 0/0)
  - Plus locked placeholder cards

- **Slider sub-components:**
  - CardFrame01_Demo_Slider_Bg.png - Slider background track
  - CardFrame01_Demo_Slider_Fill_Blue/Green.png - Progress bars
  - CardFrame01_Demo_Slider_Badge.png - Star/level indicator badge
  - CardFrame01_Demo_Slider_Icon.png - Currency icon

- **Color coding system:**
  - Gray = Locked/unavailable
  - Green = Common rarity
  - Blue = Rare rarity
  - Purple = Epic rarity
  - Yellow = Legendary rarity

**HorizontalFrame01:**
- Wide horizontal banner with centered text
- Title bar shown: "TEXT TITLE"
- Dark background variant with light text

**ItemFrame01 - Inventory Slots:**
- **Most versatile item frame** - 7+ color-coded variants
- Square frames for items/equipment with multiple states
- **Assembly pattern:** Frame border + inner item icon + optional lock/plus icon
- Shown with sword item examples in different colors
- **Color variants indicate rarity:**
  - Gray (common)
  - Green (uncommon)
  - Sky blue (rare)
  - Teal (special)
  - Purple (epic)
  - Yellow (legendary)
  - Red (unique/cursed)
- **State indicators:**
  - Normal: Just frame + item
  - Add/Empty: Frame + plus icon (for empty slots)
  - Locked: Frame + item + lock icon overlay

**ItemFrame02 - Simple Item Display:**
- Circular item frames with quantity counter
- Example: Gem icon with "999" text below
- Dark and light background variants

**ItemFrame03 - Outlined Item Slots:**
- Square outlined frames (no fill)
- Example: Key item with yellow/golden glow effect
- Transparent center allows background to show

**ItemFrame04 - Selected Item Frames:**
- Three-state system: normal, focused, selected
- Shows equipment (sword) in gray frame
- Normal (_n), Focused (_f), Disabled (_d) states
- Optional lock icon overlay for locked items
- White/light variants shown

**ItemFrame05 - Detailed Item Cards:**
- Vertical item cards with quantity display
- Key item icon with "999" counter
- Four color states (matching rarity system)
- Yellow outline indicates focus/selection

**ListFrame01:**
- Horizontal list item backgrounds
- **Four color-coded variants with gem icons:**
  - Dark gray/black (default)
  - Bright green (selected/active)
  - White/light gray (hover)
  - Medium gray (disabled)
- Each row shows: TEXT label + gem icon (999 quantity)
- Used for scrollable lists, menus, inventory rows

**SpeechFrame01:**
- Dialog/chat bubbles for NPC conversations
- Two variants: dark and light backgrounds
- Shows "TEXT Message" with dropdown arrow indicator
- Suitable for: Quest dialogs, tooltips, instructions

**SplitFrame01:**
- Two-section frame with diagonal split
- Icon badge in top left corner
- Text label in main area
- Dark and light variants shown

**SplitFrame02:**
- Vertical split layout for side-by-side content
- "TEXT TITLE" header section
- "Text Info" content section below
- Dark navy and light gray/white variants

### Label Assemblies (`Catalog/CasualFantasy_Label.png`)

**Label_Coner01 - Corner Badges:**
- Small corner notification labels
- Text: "TEXT"
- Red alert variant and white neutral variant
- Position: Top-right corner of cards/buttons

**Label_Oval01/02 - Pill Labels:**
- Rounded oval/capsule shaped labels
- 01: Small compact pills with "Text Title"
- 02: Larger ovals for longer text
- Dark and white background variants

**Label_SpeechBubble01:**
- Compact rounded speech bubbles
- "TEXT" label in bubble
- Green and white color variants
- For quick callouts, tooltips

**Label_Trapezoidal01 - Tab Labels:**
- Angled trapezoidal labels (wider at top)
- **8 color variants shown:** Blue, Gray, Green, Purple, Red, Teal, Yellow, White
- Perfect for: Category tabs, level indicators, chapter markers
- Text: "TEXT" in each variant

**Label_Trapezoidal02 - Wider Tab Labels:**
- Similar to 01 but with more horizontal space
- Larger text capacity: "TEXT"
- Blue and white variants shown

**Label_Ribbon01 - Decorative Banners:**
- **Most prominent label type** - 15+ color variants
- Full-width ribbon banners with decorative diamond accents
- Text: "TEXT TITLE" in bold outlined font
- **Complete color palette:**
  1. Blue (primary)
  2. Sky blue (light blue)
  3. Teal (cyan)
  4. Light green
  5. Green (emerald)
  6. Yellow (gold)
  7. Orange
  8. Brown (bronze)
  9. Red (crimson)
  10. Pink (magenta)
  11. Purple (violet)
  12. Rose (light pink)
  13. Magenta (hot pink)
  14. White (silver)
  15. Gray (neutral)

- **Design features:**
  - Ribbon tails on both sides
  - Diamond/gem decorative accents (4 total - 2 on each side)
  - Gradient shading for depth
  - Bold white text with dark outline
  - Shadow/glow effect behind ribbon

- **Use cases:**
  - Scene titles ("Level 1", "Chapter 3")
  - Achievement headers ("Quest Complete!")
  - Section dividers in menus
  - Event banners ("New Update")
  - Leaderboard headers

### Popup Assemblies (`Catalog/CasualFantasy_Popup.png`)

**Popup01 - Full Screen Modal:**
- Large rectangular modal dialog
- **Assembly components:**
  - Background panel (dark or light variant)
  - Title bar with "TEXT TITLE"
  - Close button (red X) in top-right corner
  - Large content area for messages/forms
- Dark variant: Dark gray/black background
- Light variant: White/off-white background
- Rounded corners with border accent

**Popup02 - Compact Header Modal:**
- Medium-sized modal with distinct header section
- **Two-section layout:**
  - Top header: "Text" label + "TEXT TITLE" in contrasting colors
  - Bottom content: Main message area (larger space)
- Close button (X) in top-right
- Dark and light variants
- Header uses accent color (yellow/orange in demo)

**SlidePopup - Side Panel:**
- Narrow vertical side panel (slide-in drawer)
- Dark background
- Close button (red X) in top-right
- Minimal width - suitable for quick actions, settings, filters
- Appears to slide from screen edge

**Common Popup Patterns:**
- All popups include close button in top-right
- Title centered at top
- Content area below title
- Dark variants for night mode/focus
- Light variants for day mode/accessibility

### Slider Assemblies (`Catalog/CasualFantasy_Slider.png`)

**Slider_Basic01 - Standard Progress Bars:**
- Horizontal bars with fill indicating progress
- **Assembly:** Background track + colored fill bar
- Text overlay: "999 / 999" centered
- **11 color variants:** Red, Orange, Yellow, Green, Teal, Light Blue, Blue, Purple, Magenta, Brown, White/Gray
- Use for: Health bars, XP progress, loading bars

**Slider_Basic02 - Compact Bars:**
- Shorter, more compact versions
- Same color system but smaller size
- Less text space (no numeric display in example)

**Slider_Basic01_IconType - Labeled Progress:**
- Progress bars with text labels on sides
- "99m" on left, "999m" on right (shows min/max or current/goal)
- Triangle marker (▲) indicates current position on track
- All 11 colors available
- Assembly: Bg + Fill + Text labels + Position marker

**Slider_Diagonal37/42/48/51 - Angled Progress:**
- Progress bars at various diagonal angles
- **Diagonal37:** Slight angle with circular badge icon (shows level/number)
- **Diagonal42:** Steeper angle, numbered badge (2) with blue/gray variants
- **Diagonal48:** Medium angle, numbered badge (7) with orange/gray variants
- **Diagonal51:** Steeper angle, numbered badge (3) with "999/999" text
- Use for: Stamina bars, special meters, skill cooldowns

**Slider_Diagonal70_01/02 - High-Angle Bars:**
- Very steep diagonal (almost vertical)
- **Type 01:** Numbered badge (2) + "999/999" text display
- **Type 02:** Resource icon (potion/elixir) + time display "0h 34m"
- Blue and white/gray variants
- Suitable for: Timers, brewing/crafting progress, regeneration

**Slider_HandleType01 - Interactive Slider:**
- Draggable slider with handle control
- Assembly: Background track + Fill + Handle (On/Off states)
- Large circular handle for touch input
- Use for: Settings (volume, brightness), adjustable values

**Slider Design Patterns:**
- **Two-part system:** Most sliders use separate Bg and Fill images
- **CRITICAL: Use NineSlice, NOT TileSprite or Sprite scaling:**
  - Slider assets are small pill shapes (18x60px fill, 26x68px bg) designed for 9-slice scaling
  - **NEVER use `scene.add.sprite()` or `scene.add.tileSprite()`** - these will stretch/tile and look bad
  - **ALWAYS use `scene.add.nineslice()`** to preserve rounded corners while stretching middle
  - Example for Slider_Basic01:
    ```javascript
    // Background (26x68px): corners = 13px, top/bottom = 34px
    this.bg = scene.add.nineslice(x, y, 'slider_bg', null, width, height, 13, 13, 34, 34);

    // Fill (18x60px): corners = 9px, top/bottom = 30px
    this.fill = scene.add.nineslice(x, y, 'slider_fill', null, width, height, 9, 9, 30, 30);
    ```
- **Mask technique for progress:** Use GeometryMask to reveal fill progressively (see `src/components/LoadingSlider.js`)
- **Layering order:** Bg → Fill (masked) → Text/Icons/Markers on top
- **Color consistency:** Use same color family for related stats (health=red, mana=blue, stamina=green)

### UI Extras Assemblies (`Catalog/CasualFantasy_UI_Etc.png`)

**StatusBar - Resource Display:**
- Top-bar resource indicators combining multiple components
- **Assembly pattern:** Icon + Label background + Text + Optional "+" button
- Example layout: [Gem icon][5/5] [Coin icon][1257000] [Green gem icon][100][+]
- Two color schemes shown:
  - Dark labels with white text
  - White labels with dark text
- **Components per resource:**
  - Resource icon (gem, coin, energy, etc.)
  - Label_Oval or rounded rectangle background
  - Numeric text (quantity or fraction)
  - Optional "+" button for purchase/add more

**Alert_Count - Notification Badges:**
- Small circular badges with numbers
- Three color variants: Green (1), Red (1), White (1)
- Position: Top-right corner of icons/buttons
- Use for: Unread messages, new items, quest updates
 
**Alert_Dot - Simple Indicators:**
- Minimal dot notifications
- Red (alert/warning) and White (neutral) variants
- Smaller than Alert_Count - just a dot, no number
- Use for: "New" indicators, status dots

**Alert_Text - "New" Labels:**
- Capsule-shaped text labels
- Text: "New"
- Three variants: Red (urgent), Yellow (attention), White (neutral)
- Use for: New features, new items, new content markers

**Switch01 - On/Off Toggle:**
- Sliding switch control with background + handle
- **Three variants shown:**
  - Yellow ON state (handle on left, yellow fill)
  - Gray OFF state (handle on right, no fill)
  - White OFF state (outlined version)
- Handle shows "ON" or "OFF" text
- Assembly: Background track + Sliding handle

**Toggle01 - Checkbox/Radio:**
- Circular toggle buttons with checkmark icon
- **Four states shown:**
  - Dark checked (green checkmark, dark background)
  - Dark unchecked (empty, dark background)
  - Light checked (black checkmark, white background)
  - Light unchecked (empty, white background)
- Text label "TEXT" appears next to toggle
- Use for: Settings, preferences, multi-select lists

**TabMenu - Bottom Navigation:**
- Horizontal tab bar with icon buttons
- **Two color schemes:**
  - Dark theme: Black background, blue selected tab
  - Light theme: Light gray background, white selected tab
- **5 tab slots shown with equipment icons:**
  - Grid/menu icon (selected in example)
  - Sword/weapon icon
  - Shield/armor icon
  - Boot/accessory icon
  - Helmet/head icon
- Selected tab has colored background (blue or white)
- Unselected tabs show just icon on transparent/dark background
- **Assembly:** Background bar + Individual tab buttons + Icons
- Use for: Game navigation (inventory, skills, map, shop, profile)

### Assembly Best Practices

**Layering Order (back to front):**
1. Background panels/frames
2. Content (text, images)
3. Foreground decorations (borders, ribbons)
4. Interactive elements (buttons, close X)
5. Notifications/badges (top layer)

**Component Combinations:**
- **Status displays:** Frame + Icon + Label + Text
- **Interactive cards:** Frame + Image + Text + Button + Badge
- **Progress indicators:** Slider_Bg + Slider_Fill + Text + Icon
- **Navigation buttons:** Button + Icon + Text
- **Notifications:** Any component + Alert badge overlay

**Mobile Touch Targets:**
- Buttons should be minimum 44x44 pixels
- Tab menu icons scaled appropriately for thumb reach
- Slider handles large enough for drag interactions
- Close buttons (X) sized for easy tapping

**Color Consistency:**
- Use rarity colors consistently: Gray→Green→Blue→Purple→Yellow→Red
- Match slider colors to resource type (health=red, mana=blue)
- Keep text readable: white text on dark, dark text on light
- Use Alert_Count colors meaningfully: Red=urgent, Yellow=attention, Green=positive
