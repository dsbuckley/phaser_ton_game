# Game Design Document - Chest Tapping Telegram Mini-App

**Version:** 1.0
**Last Updated:** 2025-01-12
**Platform:** Telegram WebApp (Mobile Only - Portrait)
**Genre:** Idle/Clicker with Collection Meta-Game
**Monetization:** Freemium (Telegram Stars IAP + Ads)

---

## Table of Contents

1. [Core Game Loop](#core-game-loop)
2. [Navigation Structure](#navigation-structure)
3. [Scene Breakdown](#scene-breakdown)
4. [Progression Systems](#progression-systems)
5. [Economy Design](#economy-design)
6. [Leaderboard & Leagues](#leaderboard--leagues)
7. [Monetization Strategy](#monetization-strategy)
8. [Retention Mechanics](#retention-mechanics)
9. [Social & Viral Features](#social--viral-features)
10. [Technical Implementation](#technical-implementation)
11. [Asset Requirements](#asset-requirements)
12. [Balancing Parameters](#balancing-parameters)
13. [Development Roadmap](#development-roadmap)

---

## Core Game Loop

### Primary Mechanic: Chest Tapping

**Action:** Tap treasure chest → Receive randomized rewards
**Constraint:** Energy system (100 starting, 1 per tap, hard stop at 0)
**Session Length:** 2-5 minutes (100 taps at comfortable pace)

### Reward Distribution (Per Tap)

#### Coin Rewards (Primary Currency)
- **80% Normal Payout:** 3-49 coins (random range)
- **20% Big Payout:** 50-150 coins (picks from [50, 75, 100, 125, 150])
- **0.5% Mega Jackpot:** 3,000-5,000 coins (picks from [3000, 4000, 5000])
  - First-time players: **Guaranteed mega jackpot** (5,000 coins) when energy drops to ≤10
  - Visual spectacle: Spinning lights, streaming coin animations, special sound effects

#### Secondary Rewards (Physics-Based Collectibles)
- **10% Emerald Spawn:** +1 gem (green emerald, 3-second catch window)
- **25% Energy Spawn:** 1-3 energy items (+1 each, can exceed 100 cap)
- **5% Auto Pop Spawn:** Collectible that triggers 5 automatic chest opens (no energy cost)

#### Special Gem Types (Unlock at Higher Levels)
- **Ruby (+5 Gems):** Unlocks at Level 10, 2% spawn rate (replaces emerald)
- **Sapphire (+10 Gems):** Unlocks at Level 20, 0.5% spawn rate
- **Diamond (+25 Gems):** Unlocks at Level 50, 0.1% spawn rate

### Combo System

**Mechanics:**
- Tracks consecutive taps with same collectible type (energy OR gems)
- **Timing Window:** 700ms between taps to continue combo
- **Processing Delay:** 350ms before finalizing combo (allows combos to build)
- Works across multiple chest opens

**Bonus Structure:**
- **3x Combo:** +3 bonus items
- **4x Combo:** +4 bonus items
- **5x+ Combo:** +5 bonus items (capped)

**Feedback:**
- Animated "Combo Bonus +X" text (floats upward)
- Special combo sound effect
- Haptic feedback (Telegram WebApp API)

### Auto-Pop System

**Trigger:** Collect Auto Pop item (5% spawn rate)
**Effect:** 5 rapid automatic chest opens (10 per second)
**Energy Cost:** Zero (free taps)
**Stacking:** Multiple Auto Pops add to queue
**UI:** Countdown text showing remaining pops

**Note:** Auto Pops are **collectible items only** (not sold directly). Players can obtain more through:
- Random 5% chest drops
- Daily rewards
- Ad rewards
- VIP Pass daily grants (5-20 per day)

---

## Navigation Structure

### 5-Tab Bottom Menu

```
[Wheel] [Shop] [Items] [POP] [Earn]
                         ^^^
                      (Center, Highlighted)
```

**Tab Details:**

1. **Wheel** (Tab 1) - Spin-to-win minigame
2. **Shop** (Tab 2) - Avatar customization (parrot + clothes/skins)
3. **Items** (Tab 3) - IAP store (energy, tickets, gold via Telegram Stars)
4. **POP** (Tab 4 - Center) - Main chest tapping game
5. **Earn** (Tab 5) - Task list for free rewards

**Implementation Notes:**
- POP tab always highlighted when active
- Red notification dots on Wheel/Earn tabs for available rewards
- Tabs persist across all scenes
- Smooth scene transitions (fade or slide)

---

## Scene Breakdown

### 1. POP Scene (Main Game)

**Layout:**
```
┌─────────────────────────────────┐
│ [Avatar]  Coins  Energy  Gems   │ ← StatusBar (top)
│   [Badge]                [⚙️]   │
│                                 │
│  [Daily Gem]                    │ ← Daily gem counter (leaderboard)
│  [Leaderboard]                  │ ← Rank display (below avatar)
│                                 │
│                                 │
│        🎁 [CHEST]               │ ← Tappable chest (center)
│                                 │
│                                 │
│  [Energy Timer]                 │ ← Countdown to next free energy
│                                 │
│ [🎡][🛒][💎][🎯][💰]           │ ← Bottom tab menu
└─────────────────────────────────┘
```

**Key Elements:**

**StatusBar:**
- **Avatar:** Profile picture (Telegram photo or default)
  - Red notification badge (upper right) when mail is unread
  - Tappable → Opens Inbox Modal
- **Coins:** Animated counter (current gold)
- **Energy:** Current/Max (e.g., "75/100")
- **Gems:** Daily gem count (resets at 00:00 UTC)
- **Settings Button:** Opens SettingsModal

**Leaderboard Widget (Below Avatar):**
- Compact display: "🏆 Rank #23 | Bronze League"
- Shows player's current daily rank
- Tappable → Opens full Leaderboard Modal
- Updates in real-time when gems collected

**Daily Gem Counter:**
- Large text above leaderboard widget
- Shows gems collected TODAY (resets daily)
- Format: "💎 12" (animated when gems collected)

**Chest (Center):**
- 38-frame open/close animation
- Scale + tint on tap (press feedback)
- Spawns physics-based collectibles (gems, energy, Auto Pops)
- Mega jackpot: Full-screen light effects + coin confetti

**Energy Timer:**
- Shows countdown to next hourly energy grant
- Format: "Free energy in MM:SS"
- Only visible when energy < 100

**Background:**
- Animated parallax clouds
- Swaying palm tree (75-frame loop)
- Sparkles around sun (ambient effects)

---

### 2. Wheel Scene

**Purpose:** Ticket-based spin-to-win minigame (additional energy source)

**Layout:**
```
┌─────────────────────────────────┐
│         WHEEL SPINNER           │
│                                 │
│          [WHEEL]                │ ← Animated spinning wheel
│         /   |   \               │
│        /    |    \              │
│       /     ↓     \             │
│      Prize Display              │
│                                 │
│   Tickets: 3  [SPIN - 1 🎟️]    │ ← Spin button (costs 1 ticket)
│                                 │
│ "Watch Ad for Free Spin (3/3)" │ ← Ad reward option
│                                 │
│ [🎡][🛒][💎][🎯][💰]           │
└─────────────────────────────────┘
```

**Wheel Rewards (Weighted Probabilities):**

| Prize | Probability | Display |
|-------|-------------|---------|
| +10 Energy | 30% | Common |
| +25 Energy | 25% | Common |
| +50 Energy | 20% | Uncommon |
| +100 Energy | 15% | Rare |
| +5 Gems | 5% | Rare |
| +10 Gems | 3% | Epic |
| +500 Coins | 1.5% | Epic |
| 1 TON Token | 0.5% | Legendary (requires wallet connection) |

**Mechanics:**
- **Cost:** 1 ticket per spin
- **Animation:** 3-second spin with deceleration
- **Sound:** Clicking sounds during spin, special jingle for rare prizes
- **TON Reward:** Only available if TON wallet connected (shows "Connect Wallet" if not)
- **Ad Rewards:** 3 free spins per day (watch ad → 1 free spin)

**Ticket Acquisition:**
- Daily login rewards (1-3 tickets)
- Earn scene tasks (1-5 tickets per task)
- IAP purchases (Items scene)
- Weekly leaderboard prizes (5-50 tickets based on rank)

---

### 3. Shop Scene (Avatar Customization)

**Purpose:** Spend coins to customize parrot avatar and level up

**Layout:**
```
┌─────────────────────────────────┐
│          MY PARROT              │
│                                 │
│       [AVATAR DISPLAY]          │ ← 3D parrot with current outfit
│      /  Rotate Buttons  \       │
│                                 │
│  Level 5 | 12,450 Total Value   │ ← Shows level + outfit value
│                                 │
│  ┌───────────────────────────┐  │
│  │ CATEGORIES                │  │
│  │ [Hats] [Shirts] [Pants]   │  │ ← Category tabs
│  │ [Accessories] [Backgrounds]│  │
│  │                           │  │
│  │ ┌─────┐ ┌─────┐ ┌─────┐  │  │
│  │ │ 🎩  │ │ 👔  │ │ 🎀  │  │  │ ← Scrollable grid
│  │ │ 500 │ │ 1200│ │ 800 │  │  │
│  │ │ BUY │ │OWNED│ │ BUY │  │  │
│  │ └─────┘ └─────┘ └─────┘  │  │
│  └───────────────────────────┘  │
│                                 │
│ [🎡][🛒][💎][🎯][💰]           │
└─────────────────────────────────┘
```

**Avatar System:**

**Character:** Parrot (customizable mascot)

**Customization Categories:**
1. **Hats:** Pirate hat, crown, baseball cap, wizard hat, etc. (15 items)
2. **Shirts:** T-shirts, hoodies, pirate coat, tuxedo, etc. (20 items)
3. **Pants:** Shorts, jeans, pirate pants, formal pants, etc. (15 items)
4. **Accessories:** Sunglasses, necklace, eyepatch, scarf, etc. (20 items)
5. **Backgrounds:** Beach, jungle, treasure cave, sky, etc. (10 items)

**Pricing Structure:**
- **Common Items:** 500-2,000 coins
- **Uncommon Items:** 3,000-8,000 coins
- **Rare Items:** 10,000-25,000 coins
- **Epic Items:** 30,000-75,000 coins
- **Legendary Items:** 100,000-500,000 coins

**Progression Mechanics:**

**Level System:**
- **Formula:** `Player Level = floor(Total Value / 10,000) + 1`
- **Total Value:** Sum of all purchased outfit prices + current coin balance
- **Example:** Player has 8,500 coins + owns 15,000 worth of outfits = 23,500 total value = Level 3

**Why This System:**
- Players never lose level when spending coins (outfits retain value)
- Creates long-term goal (collect all legendary items)
- Encourages spending (buying outfits = leveling up)
- Fair progression (can't game system by hoarding coins)

**Level Benefits (Dynamic Difficulty Scaling):**

| Level | Coin Spawn Rate | Gem Drop Rate | Energy Drop Rate | Auto Pop Rate | Special Gems Unlocked |
|-------|----------------|---------------|------------------|---------------|----------------------|
| 1-5   | 3-49 base      | 10%           | 25%              | 5%            | Emerald only (+1) |
| 6-10  | 5-60 base      | 12%           | 27%              | 6%            | Ruby (+5) unlocked |
| 11-20 | 8-75 base      | 15%           | 30%              | 7%            | Ruby common |
| 21-30 | 10-100 base    | 18%           | 32%              | 8%            | Sapphire (+10) unlocked |
| 31-50 | 15-125 base    | 22%           | 35%              | 10%           | Sapphire common |
| 51+   | 20-150 base    | 25%           | 40%              | 12%           | Diamond (+25) unlocked |

**Progressive Difficulty:**
- **More Coins:** Screen cluttered with more coin sprites (visual challenge)
- **More Gems:** Better leaderboard performance (competitive advantage)
- **More Energy Items:** Longer sessions without IAP (retention)
- **More Auto Pops:** More "free" chest opens (dopamine hits)

**UI Features:**
- **Preview Mode:** Tap item to preview on parrot before buying
- **Owned Items:** Checkmark + "OWNED" label
- **Equipped Items:** Star icon + "EQUIPPED" label
- **Rarity Indicators:** Color-coded borders (gray/green/blue/purple/gold)
- **Locked Items:** "Unlock at Level X" for high-tier items

---

### 4. Items Scene (IAP Store)

**Purpose:** Telegram Stars IAP purchases (energy, tickets, gold)

**Layout:**
```
┌─────────────────────────────────┐
│         BOINK SHOP              │
│    (Cartoon mascot header)      │
│                                 │
│  [SPINS] [WHEELSPIN] [GOLD]     │ ← Category tabs
│                                 │
│  ┌─────┐  ┌─────┐  ┌─────┐     │
│  │ 400 │  │ 880 │  │ 1.5K│     │ ← Energy packs
│  │  ⚡  │  │  ⚡  │  │ ⚡⚡ │     │
│  │$1.99│  │$3.99│  │$5.99│     │
│  └─────┘  └─────┘  └─────┘     │
│                                 │
│  ┌─────┐  ┌─────┐  ┌─────┐     │
│  │ 2.5K│  │ 3.6K│  │ 5.2K│     │
│  │ ⚡⚡ │  │ ⚡⚡ │  │ ⚡⚡ │     │
│  │$8.99│  │$11.99  │$14.99    │
│  └─────┘  └─────┘  └─────┘     │
│           POPULAR               │
│                                 │
│  ┌─────┐  ┌─────┐  ┌─────┐     │
│  │ 7.6K│  │11.5K│  │16.8K│     │
│  │ ⚡⚡⚡│  │ 🛒  │  │ 💰  │     │
│  │$18.99  │$22.99  │$27.99    │
│  └─────┘  └─────┘  └─────┘     │
│           BEST VALUE            │
│                                 │
│ [🎡][🛒][💎][🎯][💰]           │
└─────────────────────────────────┘
```

**Product Catalog (Based on Competitor Screenshots):**

#### SPINS (Energy) Tab

| Package | Energy | Bonus | Price (USD) | Price (Stars) |
|---------|--------|-------|-------------|---------------|
| Small   | 400    | -     | $1.99       | 100 Stars     |
| Medium  | 880    | 10%   | $3.99       | 200 Stars     |
| Large   | 1,500  | 25%   | $5.99       | 300 Stars     |
| XL      | 2,500  | 40%   | $8.99       | 450 Stars     |
| XXL     | 3,600  | 50%   | $11.99 ⭐POPULAR | 600 Stars |
| Mega    | 5,200  | 75%   | $14.99      | 750 Stars     |
| Ultra   | 7,600  | 100%  | $18.99      | 950 Stars     |
| Basket  | 11,500 | 150%  | $22.99      | 1150 Stars    |
| Treasure| 16,800 | 200%  | $27.99 🏆BEST | 1400 Stars |

#### WHEELSPIN (Tickets) Tab

| Package | Tickets | Bonus | Price (USD) | Price (Stars) |
|---------|---------|-------|-------------|---------------|
| 4 Spins | 4       | -     | $3.99       | 200 Stars     |
| 7 Spins | 7       | 10%   | $5.99 ⭐POPULAR | 300 Stars |
| 15 Spins| 15      | 25%   | $11.99      | 600 Stars     |
| 27 Spins| 27      | 40%   | $18.99      | 950 Stars     |
| 35 Spins| 35      | 50%   | $22.99      | 1150 Stars    |
| 56 Spins| 56      | 100%  | $27.99 🏆BEST | 1400 Stars |

#### GOLD (Coins) Tab

| Package | Coins   | Bonus | Price (USD) | Price (Stars) |
|---------|---------|-------|-------------|---------------|
| Small   | 21.1M   | -     | $1.99       | 100 Stars     |
| Medium  | 46.4M   | 10%   | $3.99       | 200 Stars     |
| Large   | 79.1M   | 25%   | $5.99 ⭐POPULAR | 300 Stars |

**Note on Coin Packages:**
- Coin values (21M+) seem inflated compared to current game economy
- **Recommendation:** Adjust to match actual game economy or implement coin sink features first
- Alternative pricing: 50K ($1.99), 150K ($3.99), 300K ($5.99), etc.

**UI Features:**
- **"POPULAR" Banner:** Middle-tier packages (pink ribbon)
- **"BEST VALUE" Banner:** Highest-tier packages (gold ribbon)
- **Bonus Percentage:** Shows % bonus over base rate
- **Visual Progression:** More items per icon as packages increase
- **Telegram Stars Integration:** Native payment flow (no external processors)

**First Purchase Incentives:**
- **2x Value:** First purchase of any package gives 2x items
- **Exclusive Badge:** "Supporter" avatar frame unlocked
- **Thank You Modal:** Personal message from developers

---

### 5. Earn Scene (Task List)

**Purpose:** Free-to-play rewards (watch ads, referrals, social tasks, cross-promotion)

**Layout:**
```
┌─────────────────────────────────┐
│         EARN REWARDS            │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 📺 Watch Ad             │   │
│  │ Reward: +5 Energy       │   │
│  │ [WATCH] (3/3 today)     │   │ ← Limits shown
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 👥 Invite Friends        │   │
│  │ +50 Energy per friend   │   │
│  │ [INVITE] (2 invited)    │   │ ← Progress tracking
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🎵 Follow on TikTok      │   │
│  │ Reward: +3 Tickets      │   │
│  │ [FOLLOW]                │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ ▶️ Like YouTube Video    │   │
│  │ Reward: +25 Energy      │   │
│  │ [WATCH & LIKE]          │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🎮 Play [Game Name]      │   │
│  │ Reward: +5 Energy       │   │
│  │ [PLAY NOW]              │   │ ← Cross-promo
│  └─────────────────────────┘   │
│                                 │
│ [🎡][🛒][💎][🎯][💰]           │
└─────────────────────────────────┘
```

**Task Categories:**

#### 1. Ad Rewards (Renewable Daily)
```javascript
{
  id: 'watch_ad_energy',
  type: 'ad',
  title: 'Watch Ad for Energy',
  reward: { energy: 5 },
  limit: 3, // per day
  icon: '📺',
  resetType: 'daily'
}
```

#### 2. Referral Tasks (Lifetime Progress)
```javascript
{
  id: 'invite_friends',
  type: 'referral',
  title: 'Invite Friends',
  reward: { energy: 50 }, // per friend
  requirementText: 'Friend must open 25 chests',
  icon: '👥',
  milestones: [
    { count: 5, reward: { gems: 10 } },
    { count: 10, reward: { tickets: 20 } },
    { count: 25, reward: { coins: 50000 } }
  ]
}
```

#### 3. Social Media Tasks (One-Time)
```javascript
[
  {
    id: 'follow_tiktok',
    type: 'social',
    title: 'Follow us on TikTok',
    reward: { tickets: 3 },
    url: 'https://tiktok.com/@yourgame',
    verificationMethod: 'honor_system', // or backend API check
    icon: '🎵'
  },
  {
    id: 'like_youtube',
    title: 'Like Our YouTube Video',
    reward: { energy: 25 },
    url: 'https://youtube.com/...',
    icon: '▶️'
  },
  {
    id: 'follow_instagram',
    title: 'Follow on Instagram',
    reward: { tickets: 2 },
    icon: '📷'
  },
  {
    id: 'join_telegram_channel',
    title: 'Join Telegram Channel',
    reward: { gems: 5 },
    icon: '✈️'
  }
]
```

#### 4. Cross-Promotion Tasks
```javascript
{
  id: 'play_partner_game',
  type: 'cross_promo',
  title: 'Play [Partner Game Name]',
  reward: { energy: 5 },
  url: 'https://t.me/partnergame_bot',
  requirement: 'Play for 5 minutes',
  icon: '🎮',
  verificationMethod: 'api_callback' // Partner game sends callback
}
```

#### 5. Daily Check-In (Special Task)
```javascript
{
  id: 'daily_checkin',
  type: 'daily',
  title: 'Daily Login Bonus',
  rewards: [
    { day: 1, energy: 25, coins: 500 },
    { day: 2, energy: 30, coins: 750 },
    { day: 3, energy: 40, tickets: 1 },
    { day: 4, energy: 50, coins: 1500 },
    { day: 5, energy: 75, tickets: 2 },
    { day: 6, energy: 100, gems: 5 },
    { day: 7, energy: 150, tickets: 5, gems: 10 } // Big reward
  ],
  streakProtection: false // Can be enabled with VIP Pass
}
```

**Task Verification Methods:**
1. **Honor System:** Player clicks "Done" → Reward granted (for low-value rewards)
2. **External Link Tracking:** Opens link → Detects return to app → Grants reward after 10s
3. **API Callbacks:** Partner integration sends verification (cross-promo)
4. **Backend Verification:** Check social API for follow/like status (advanced, requires backend)

**UI Features:**
- **Progress Tracking:** "2/5 friends invited" shows on referral tasks
- **Cooldown Timers:** "Available in 4h 23m" for daily resets
- **Completed State:** Checkmark + grayed out + "CLAIMED"
- **Notification Dots:** Red dot on Earn tab when tasks available
- **Category Filters:** "All | Daily | Social | Partners" tabs

**Reward Distribution:**
- **Energy:** 5-150 range (most common reward)
- **Tickets:** 1-5 range (valuable, limited)
- **Gems:** 5-10 range (rare, only for big tasks)
- **Coins:** 500-50,000 range (supplements shop purchases)

---

## Progression Systems

### 1. Player Level System

**Calculation:**
```javascript
// Formula
playerLevel = Math.floor((currentCoins + totalSkinValue) / 10000) + 1;

// Example
currentCoins = 8500;
totalSkinValue = 15000; // Sum of all owned skin prices
totalValue = 8500 + 15000 = 23500;
playerLevel = Math.floor(23500 / 10000) + 1 = 3;
```

**Key Properties:**
- **Never Decreases:** Spent coins convert to skin value (retained)
- **Visible Everywhere:** Shows in StatusBar, Profile Modal, Leaderboard
- **Dynamic Difficulty:** Higher levels = better rewards (see Shop Scene)

**Level Milestones (Unlock New Features):**
| Level | Unlocks |
|-------|---------|
| 1     | Default parrot, emerald gems only |
| 5     | New hat category unlocked |
| 10    | Ruby gems (+5) unlocked, new background category |
| 15    | Epic outfit items available |
| 20    | Sapphire gems (+10) unlocked |
| 30    | Legendary outfit items available |
| 50    | Diamond gems (+25) unlocked, prestige system available |

### 2. League System (Leaderboard Tiers)

**Purpose:** Matchmake players by lifetime gem count for fair competition

**League Tiers:**

| League | Lifetime Gems Required | Daily Prize Pool |
|--------|------------------------|------------------|
| **Bronze** | 0-99 | Top 10: 5-25 gems, 1-3 tickets |
| **Silver** | 100-499 | Top 10: 10-50 gems, 3-5 tickets |
| **Gold** | 500-1,999 | Top 10: 25-100 gems, 5-10 tickets |
| **Platinum** | 2,000-4,999 | Top 10: 50-200 gems, 10-20 tickets |
| **Diamond** | 5,000-9,999 | Top 10: 100-500 gems, 20-50 tickets |
| **Master** | 10,000-24,999 | Top 10: 250-1000 gems, 50-100 tickets |
| **Grandmaster** | 25,000+ | Top 10: 500-2500 gems, 100-250 tickets, exclusive cosmetics |

**Mechanics:**
- **Lifetime Gems:** Cumulative gems earned (never resets)
- **Daily Gems:** Resets at 00:00 UTC, used for ranking within league
- **Promotion:** Automatically move up leagues when reaching threshold
- **No Demotion:** Can't drop leagues (encourages long-term play)

**Daily Prize Distribution (Per League):**
```javascript
// Example: Gold League
{
  league: 'gold',
  resetTime: '00:00 UTC',
  prizes: [
    { rank: 1, gems: 100, tickets: 10, coins: 5000 },
    { rank: 2, gems: 75, tickets: 8, coins: 3000 },
    { rank: 3, gems: 50, tickets: 6, coins: 2000 },
    { rank: '4-10', gems: 25, tickets: 5, coins: 1000 },
    { rank: '11-50', gems: 10, tickets: 3, coins: 500 },
    { rank: '51-100', gems: 5, tickets: 1, coins: 250 }
  ]
}
```

**UI Display:**
- **League Badge:** Shows in leaderboard widget (🏆 Bronze, 🥈 Silver, 🥇 Gold, etc.)
- **Progress Bar:** "234/500 gems to Silver League"
- **Prize Preview:** "Finish Top 10 today: +25-100 gems"
- **Rank Changes:** "↑3" or "↓5" indicator (real-time updates)

### 3. Inbox/Mail System

**Purpose:** Time-limited claimable rewards and notifications

**Profile Modal Layout:**
```
┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │  [Profile Picture] 🔴     │  │ ← Red badge if unread
│  │  Username                 │  │
│  │  Level 5                  │  │
│  │  ▓▓▓▓▓░░░░░ 45%           │  │ ← Progress to Level 6
│  │  8,500 / 60,000 coins     │  │
│  └───────────────────────────┘  │
│                                 │
│  INBOX                          │
│  ┌───────────────────────────┐  │
│  │ 🎁 Daily Login Reward     │  │ ← Claimable
│  │ +50 Energy                │  │
│  │ [CLAIM] Expires in 23h    │  │
│  ├───────────────────────────┤  │
│  │ 🏆 Leaderboard Prize      │  │
│  │ Rank #3 - Gold League     │  │
│  │ +50 Gems, +6 Tickets      │  │
│  │ [CLAIM] Expires in 6h     │  │
│  ├───────────────────────────┤  │
│  │ 👥 Friend Joined!         │  │
│  │ @JohnDoe started playing  │  │
│  │ +50 Energy Bonus          │  │
│  │ [CLAIM]                   │  │
│  ├───────────────────────────┤  │
│  │ ✅ Task Complete          │  │
│  │ Followed TikTok           │  │
│  │ +3 Tickets                │  │
│  │ [CLAIMED]                 │  │ ← Already claimed
│  └───────────────────────────┘  │
│           [CLOSE]               │
└─────────────────────────────────┘
```

**Message Types:**

#### 1. Daily Rewards
```javascript
{
  id: 'daily_login_2025_01_12',
  type: 'daily_reward',
  title: 'Daily Login Reward',
  message: 'Day 3 Streak Bonus!',
  rewards: { energy: 50, coins: 1000 },
  expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  claimed: false
}
```

#### 2. Leaderboard Prizes
```javascript
{
  id: 'leaderboard_gold_2025_01_11',
  type: 'leaderboard_prize',
  title: 'Daily Leaderboard Prize',
  message: 'You ranked #3 in Gold League!',
  rewards: { gems: 50, tickets: 6, coins: 2000 },
  expiresAt: Date.now() + (6 * 60 * 60 * 1000), // 6 hours
  claimed: false
}
```

#### 3. Referral Bonuses
```javascript
{
  id: 'referral_user123',
  type: 'referral',
  title: 'Friend Joined!',
  message: '@FriendName started playing through your link',
  rewards: { energy: 50, coins: 1000 },
  expiresAt: null, // Never expires
  claimed: false
}
```

#### 4. Task Completion
```javascript
{
  id: 'task_tiktok_follow',
  type: 'task_complete',
  title: 'Task Complete',
  message: 'Followed us on TikTok',
  rewards: { tickets: 3 },
  expiresAt: null,
  claimed: true // Already claimed
}
```

#### 5. System Announcements
```javascript
{
  id: 'announcement_new_feature',
  type: 'announcement',
  title: 'New Feature: Wheel Spinner!',
  message: 'Try your luck on the wheel. Here\'s 3 free tickets!',
  rewards: { tickets: 3 },
  expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
  claimed: false
}
```

**Message Mechanics:**
- **Expiration:** Messages auto-delete after expiry (show countdown timer)
- **Claim Button:** Tap to receive rewards (animate + confetti)
- **Batch Claim:** "Claim All" button claims all unclaimed messages
- **Notification Badge:** Red circle with count (upper right of avatar)
- **Sound/Haptic:** Satisfying "cha-ching" on claim
- **History:** Claimed messages stay visible for 24h then auto-delete

**Database Schema Addition:**
```sql
CREATE TABLE user_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT REFERENCES users(telegram_id),
  message_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  rewards JSONB, -- { energy: 50, gems: 10, tickets: 5, coins: 1000 }
  expires_at TIMESTAMP,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inbox_user ON user_inbox(telegram_id, claimed, expires_at);
```

---

## Economy Design

### Currency Overview

| Currency | Earn Methods | Spend Methods | Scarcity |
|----------|-------------|---------------|----------|
| **Coins** | Chest taps (3-5000 per tap), leaderboard prizes, tasks | Avatar outfits (500-500k), future upgrades | Abundant |
| **Gems** | Chest collectibles (10-25% chance), combos, leaderboard prizes | Future: Sticker marketplace, premium items | Moderate |
| **Energy** | Hourly grants (10/hour), daily grants (100), ads, IAP, wheel | Chest taps (1 per tap) | Scarce (primary constraint) |
| **Tickets** | Daily rewards (1-3), Earn tasks, leaderboard prizes, IAP | Wheel spins (1 per spin) | Very scarce (premium) |

### Economy Balancing

#### Free-to-Play Player (F2P) Daily Income
```
Energy Sources:
- Hourly grants: 10/hour × 16 waking hours = 160 energy
- Daily grant: 100 energy (at reset)
- Ad rewards: 5 × 3 = 15 energy
- Daily tasks: ~25 energy average
- Wheel spins (3 free): ~50 energy average
TOTAL: ~350 energy per day = 350 chest taps

Coin Income (350 taps):
- Base rewards: ~8,000-12,000 coins (depends on level)
- Jackpots: ~1,000-3,000 coins (luck-based)
- Leaderboard: 250-5,000 coins (based on rank)
TOTAL: ~10,000-20,000 coins per day

Gem Income (350 taps):
- Emerald drops: ~35 gems (10% × 350)
- Combo bonuses: ~5-10 gems (skill-based)
- Leaderboard: 5-100 gems (based on rank)
TOTAL: ~45-145 gems per day

Ticket Income:
- Daily login: 1-2 tickets
- Earn tasks: 1-3 tickets
- Leaderboard: 1-5 tickets (if top 100)
TOTAL: ~3-10 tickets per day
```

#### Paying Player (Dolphin - $5/month)
```
Purchases:
- 1,500 energy pack ($5.99) = 1x per week
- Or VIP Pass ($5/month) = daily bonuses

Weekly Energy:
- F2P base: 2,450 energy
- 1,500 energy pack: +1,500
TOTAL: ~3,950 energy per week = 564 per day

Result: +60% more playtime than F2P
```

#### Whale Player ($50+/month)
```
Purchases:
- VIP Pass: $10/month (200 energy daily)
- Energy packs: 2-3× per week (~4,500 energy)
- Ticket packs: 1× per week (35 spins)
- Cosmetics: $10-20/month

Weekly Energy:
- F2P base: 2,450
- VIP Pass: 1,400 (200/day × 7)
- Energy packs: 4,500
TOTAL: ~8,350 energy per week = 1,193 per day

Result: +240% more playtime, full cosmetic collection, top leaderboard contender
```

### Monetization Conversion Funnel

**Step 1: Energy Depletion Modal (Progressive Offers)**

When player taps chest at 0 energy, show modal with 3-step progression:

#### First Depletion: Friend Referral
```
┌─────────────────────────────────┐
│      OUT OF ENERGY! ⚡          │
│                                 │
│  👥 Invite a friend to get      │
│     50 FREE ENERGY!             │
│                                 │
│  [INVITE FRIEND]                │
│                                 │
│  Wait 10 hours for free refill  │
│  Or buy energy below...         │
│                                 │
│  [Maybe Later]                  │
└─────────────────────────────────┘
```

**Logic:** First depletion always shows referral (highest value, zero cost)

#### Second Depletion: Ad Reward
```
┌─────────────────────────────────┐
│      OUT OF ENERGY! ⚡          │
│                                 │
│  📺 Watch a short ad to get     │
│     5 FREE ENERGY!              │
│                                 │
│  [WATCH AD] (2/3 today)         │
│                                 │
│  Or get more energy:            │
│  400 Energy - $1.99             │
│  [BUY NOW]                      │
│                                 │
│  [Maybe Later]                  │
└─────────────────────────────────┘
```

**Logic:** Second+ depletions show ad if ads remaining today (max 3)

#### Third+ Depletion: IAP Offer
```
┌─────────────────────────────────┐
│      OUT OF ENERGY! ⚡          │
│                                 │
│  ⚡ SPECIAL OFFER ⚡             │
│                                 │
│  400 Energy - Only $1.99        │
│  [BUY NOW]                      │
│                                 │
│  More options:                  │
│  880 Energy - $3.99 (BEST VALUE)│
│  [SEE ALL PACKS]                │
│                                 │
│  No ads remaining today         │
│  Wait 9 hours for free refill   │
│                                 │
│  [Maybe Later]                  │
└─────────────────────────────────┘
```

**Logic:** When ads exhausted, show IAP-focused modal

#### Implementation Pseudocode:
```javascript
onChestTapWhileEmpty() {
  const depleteCount = this.energyDepletionCount.get(); // Persistent state

  if (depleteCount === 0) {
    // First time - always show referral
    this.showReferralModal();
  } else if (this.adsWatchedToday < 3) {
    // Has ads remaining - show ad modal
    this.showAdRewardModal();
  } else {
    // No ads left - show IAP modal
    this.showIAPModal();
  }

  this.energyDepletionCount.set(depleteCount + 1); // Track for session
}
```

**Conversion Psychology:**
1. **Referral First:** No money commitment, player feels valued
2. **Ad Second:** Free but requires time investment (softens IAP ask)
3. **IAP Third:** Player already engaged, understands value, ready to pay

### Coin Sinks (Prevent Inflation)

**Current Problem:** Coins accumulate infinitely with no spending

**Solution: Avatar Shop**
- 80+ outfit items (500-500,000 coins each)
- Completionist goal: ~5,000,000 coins for full collection
- Levels tied to spending (encourages coin conversion)

**Future Sinks (Roadmap):**
1. **Upgrade System:** Chest level (increases base rewards), energy capacity, luck stat
2. **Sticker Marketplace:** Buy specific stickers with coins + gems
3. **Booster Shop:** Temporary buffs (2x coins for 1 hour, etc.)
4. **Gifting:** Send coins to friends (creates social obligation loop)

---

## Leaderboard & Leagues

### Daily Leaderboard Mechanics

**Reset Schedule:**
- **Daily Reset:** 00:00 UTC (all players reset simultaneously)
- **Grace Period:** 10 minutes after reset to claim previous day's prizes

**Ranking Formula:**
```javascript
// Daily gems only (resets at 00:00 UTC)
playerRank = sortByDailyGems(playersInSameLeague, descending);
```

**Leaderboard UI (Full Modal):**
```
┌─────────────────────────────────┐
│     🏆 GOLD LEAGUE 🏆           │
│   Daily Reset in 14:23:45       │
│                                 │
│  Your Rank: #23 ↑3              │ ← Player's current rank
│  Daily Gems: 💎 45              │
│  Prize if you hold: 10 gems     │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Rank | Player | Gems      │  │
│  ├───────────────────────────┤  │
│  │  1🥇 | @TopDog | 💎 284   │  │ ← Champion cosmetic shown
│  │  2🥈 | @Player2 | 💎 251  │  │
│  │  3🥉 | @You | 💎 234      │  │ ← Highlight player row
│  │  4   | @Player4 | 💎 198  │  │
│  │  5   | @Player5 | 💎 187  │  │
│  │  ... scrollable ...        │  │
│  │  23  | @You | 💎 45 ↑3    │  │
│  └───────────────────────────┘  │
│                                 │
│  [CLOSE]                        │
└─────────────────────────────────┘
```

**Real-Time Updates:**
- Leaderboard widget updates when player collects gems (local)
- Full leaderboard fetches from server every 60 seconds
- Rank change indicator (↑5 or ↓3) shows 24-hour trend

### League Matchmaking

**Promotion Logic:**
```javascript
// Check after every gem collection
if (lifetimeGems >= nextLeagueThreshold) {
  promoteToNextLeague();
  showPromotionModal(); // Celebration animation
  grantPromotionBonus(); // 50 energy + 5 tickets
}
```

**Promotion Modal:**
```
┌─────────────────────────────────┐
│     🎉 CONGRATULATIONS! 🎉      │
│                                 │
│   You've been promoted to       │
│      🥈 SILVER LEAGUE! 🥈       │
│                                 │
│  New daily prizes:              │
│  • Top 1: 50 gems + 5 tickets   │
│  • Top 10: 10-50 gems           │
│                                 │
│  Promotion Bonus:               │
│  +50 Energy, +5 Tickets         │
│                                 │
│  [AWESOME!]                     │
└─────────────────────────────────┘
```

**No Demotion:**
- Players stay in league even if they stop playing
- Encourages long-term retention (progress never lost)
- Creates aspirational goals (Master/Grandmaster status)

### Prize Distribution System

**Automated Flow:**
1. **Daily Reset (00:00 UTC):** Calculate final ranks for previous day
2. **Prize Calculation:** Determine rewards based on rank within league
3. **Inbox Delivery:** Send prizes to player's inbox (6-hour expiry)
4. **Notification:** Red badge on profile avatar + push notification (if enabled)

**Example Prize Calculation:**
```javascript
// Gold League prizes
const goldLeaguePrizes = {
  1: { gems: 100, tickets: 10, coins: 5000 },
  2: { gems: 75, tickets: 8, coins: 3000 },
  3: { gems: 50, tickets: 6, coins: 2000 },
  '4-10': { gems: 25, tickets: 5, coins: 1000 },
  '11-50': { gems: 10, tickets: 3, coins: 500 },
  '51-100': { gems: 5, tickets: 1, coins: 250 }
};

function calculatePrize(rank) {
  if (rank === 1) return goldLeaguePrizes[1];
  if (rank === 2) return goldLeaguePrizes[2];
  if (rank === 3) return goldLeaguePrizes[3];
  if (rank <= 10) return goldLeaguePrizes['4-10'];
  if (rank <= 50) return goldLeaguePrizes['11-50'];
  if (rank <= 100) return goldLeaguePrizes['51-100'];
  return null; // No prize
}
```

### Leaderboard Anti-Cheat

**Measures:**
1. **Server-Side Validation:** All gem collections verified by backend
2. **Rate Limiting:** Max 200 chest taps per minute (prevents bots)
3. **Energy Verification:** Can't open more chests than energy allows
4. **Anomaly Detection:** Flag accounts with impossible gem rates
5. **Manual Review:** Top 10 players reviewed before prize distribution

---

## Monetization Strategy

### Revenue Streams

#### 1. Telegram Stars IAP (Primary - 60% of revenue)
- Energy packs ($1.99-$27.99)
- Ticket packs ($3.99-$27.99)
- Coin packs ($1.99-$5.99)
- First purchase incentive (2x value)

#### 2. Subscriptions (Secondary - 25% of revenue)
- VIP Pass: $5/month (100 energy daily, 5 Auto Pops daily, ad-free, 10% coin boost)
- Elite Pass: $10/month (200 energy daily, 20 Auto Pops daily, 25% coin boost, exclusive cosmetics)

#### 3. Ad Revenue (Tertiary - 10% of revenue)
- Rewarded ads only (3 per day for energy)
- Wheel spin ads (3 per day for free spins)
- eCPM target: $5-15 (mobile game average)
- Daily ad impressions per DAU: 3-6 (non-intrusive)

#### 4. Cosmetics (Luxury - 5% of revenue)
- Premium avatar outfits (IAP-only, not available with coins)
- Limited-time seasonal items
- Exclusive leaderboard winner cosmetics (tradeable for prestige)

### Pricing Psychology

**Value Ladder (Ascending Commitment):**
1. **Free** → Ad rewards (3/day)
2. **$1.99** → Small energy pack (impulse buy)
3. **$3.99-$5.99** → Medium packs (best value per dollar)
4. **$5/month** → VIP Pass (daily player commitment)
5. **$10/month** → Elite Pass (whale tier)
6. **$10-27.99** → Large one-time packs (progress boost)

**"Popular" and "Best Value" Labels:**
- Anchor high prices to make mid-tier seem affordable
- 3.6K energy for $11.99 marked "POPULAR" (most purchases)
- 16.8K energy for $27.99 marked "BEST VALUE" (highest discount %)

**Bonus Percentages:**
- Small packs: 0-10% bonus (minimal incentive)
- Medium packs: 25-50% bonus (sweet spot)
- Large packs: 75-200% bonus (whale bait)

### First-Time User Experience (FTUE) Monetization

**Goal:** Hook players before asking for money

**Day 1-3: Generous Free Content**
- Tutorial gives 50 bonus energy
- First mega jackpot guaranteed (5,000 coins)
- Daily quests give 75+ energy
- Hourly grants feel fast (10/hour = full refill in 10 hours)
- **No IAP prompts** unless player initiates (taps at 0 energy)

**Day 4-7: Soft Paywall Introduction**
- Energy depletion becomes common (played enough to hit limit)
- Referral modal shown first (free alternative)
- Ad rewards introduced ("Watch ad for energy")
- First IAP offer shown after ads exhausted
- **Starter Pack** appears (2x value, one-time offer)

**Week 2+: Established Economy**
- Player understands value of energy/tickets
- Has favorite avatar outfits (wants legendary items)
- Sees leaderboard competition (wants to rank up)
- FOMO from limited-time cosmetics
- **Conversion likely** if not already monetized

### Whale Optimization

**High-Value Player Identification:**
- Purchased 3+ IAP packs in first week
- Elite Pass subscriber
- Top 10 leaderboard rank consistently
- Owns 50%+ of cosmetics

**Whale-Exclusive Content:**
1. **Ultra-Premium Cosmetics:** $20-50 one-time purchases (status symbols)
2. **VIP Customer Support:** Direct Telegram DM access
3. **Exclusive Tournaments:** Weekly whale-only leagues with TON prizes
4. **Early Access:** New features 1 week before general release
5. **Custom Avatar Frames:** Commission custom art ($100+)

**Retention for Whales:**
- Personal thank-you messages from developers
- "Top Supporter" badge (shown in leaderboards)
- Influence over future content (polls, beta testing)
- Sense of community (VIP Discord/Telegram channel)

---

## Retention Mechanics

### Daily Retention (D1 → D2)

**Goal:** Create habit of returning within 24 hours

**Mechanics:**
1. **Energy Timer:** "Free energy in 3h 42m" creates comeback point
2. **Daily Reset:** "New leaderboard starts in 8h" (competitive urgency)
3. **Inbox Rewards:** "You have 2 unclaimed rewards!" (red badge FOMO)
4. **Daily Quest:** "Complete 3 more tasks for 50 energy" (progress tracking)
5. **Streak Protection:** "Day 3 streak! Don't lose it!" (loss aversion)

**Push Notifications (Opt-In):**
- "Your energy is full! (100/100)" → Sent when energy = 100
- "Daily leaderboard ends in 1 hour!" → Sent at 23:00 UTC
- "You dropped to rank #15! Catch up now!" → Sent when rank drops 10+
- "Mail expiring soon! Claim 50 energy" → Sent 1 hour before expiry

### Weekly Retention (D7)

**Goal:** Create medium-term goals beyond daily play

**Mechanics:**
1. **League Promotion:** "124/500 gems to Silver League" (visible progress)
2. **Collection Goals:** "8/15 pirate outfit items collected" (completionism)
3. **Friend Competition:** "@BestFriend is rank #5, you're #12" (social pressure)
4. **Weekly Events:** "Pirate Week: 2x ticket rewards" (limited-time FOMO)

### Monthly Retention (D30)

**Goal:** Create long-term investment and sunken cost

**Mechanics:**
1. **VIP Pass Subscription:** Already paid for month (commitment consistency)
2. **High-Level Status:** Level 20+ (months of coin earning)
3. **Cosmetic Collection:** 50+ owned items = 500k+ coins invested
4. **Social Ties:** 10+ friends playing (network effects)
5. **Leaderboard History:** "Master League member since Week 3" (status)

### Retention Calculation

**Target Metrics:**
- **D1 Retention:** 45%+ (almost half return next day)
- **D7 Retention:** 25%+ (1 in 4 players stay week 1)
- **D30 Retention:** 12%+ (1 in 8 players become long-term)

**Comparison to Industry:**
- Casual mobile games: D1=40%, D7=20%, D30=10%
- Telegram mini-apps: D1=35%, D7=15%, D30=5% (lower due to platform)
- **Goal:** Exceed Telegram averages with strong retention loops

---

## Social & Viral Features

### Referral System

**Mechanics:**
1. Player shares unique referral link (Telegram share API)
2. Friend clicks link → Opens game → Must open 25 chests (anti-bot)
3. Both players receive rewards

**Rewards:**
- **Referrer:** 50 energy + 1,000 coins + 1 Auto Pop (immediate)
- **Referred Friend:** 50 energy + 500 coins (on top of tutorial bonus)

**Milestones:**
| Referrals | Reward |
|-----------|--------|
| 1 | 50 energy + 1,000 coins + 1 Auto Pop |
| 5 | 250 gems + "Recruiter" title |
| 10 | Exclusive "Golden Chest" skin + 10 Auto Pops |
| 25 | 500 gems + "Ambassador" title |
| 50 | 1 month Elite VIP Pass (free) |
| 100 | Custom avatar frame + 1,000 gems |

**UI:**
- Referral progress bar in Profile Modal
- "Invite Friends" button in StatusBar (when < 5 referrals)
- Share button in Earn scene
- Reminder modal when energy depleted (first depletion)

### Friend Leaderboard

**Feature:** See only Telegram friends who play the game

**UI (In Full Leaderboard Modal):**
```
Tabs: [ALL PLAYERS] [FRIENDS ONLY]

Friends Leaderboard:
┌─────────────────────────────────┐
│  1. @BestFriend     💎 187      │
│  2. @Coworker       💎 156      │
│  3. @You            💎 145 ↓1   │ ← Highlight player
│  4. @Cousin         💎 98       │
│  5. @Neighbor       💎 67       │
└─────────────────────────────────┘

"Invite more friends to compete!"
[INVITE FRIENDS]
```

**Social Pressure:**
- Shows friend ranks in daily leaderboard
- "You're #3 among friends!" (competitive framing)
- Push notification: "@Friend overtook you!" (urgency)

### Energy Gifting (Future Feature)

**Mechanics:**
- Can send 10 energy to any Telegram friend (free, once per day per friend)
- Limit: 3 friends per day (creates choices)
- Notification: "X sent you energy!" (brings friend back to app)
- "Send Back" button: Returns 5 energy to sender (reciprocity)

**Social Loop:**
1. Player A sends energy to Player B
2. Player B receives notification → Opens app
3. Player B sees "Send Back" button → Sends 5 energy to Player A
4. Player A receives notification → Opens app
5. Cycle repeats (drives daily engagement)

### Telegram Integration

**Current:**
- Avatar photos (HTML overlay for CORS bypass)
- Haptic feedback (WebApp API vibrations)
- User data (initDataUnsafe for username/ID)
- Theme colors (dark mode support)

**Future Integration:**
- **Share Achievements:** "I just hit rank #1 in Gold League!" (with screenshot)
- **Group Chat Bot:** Post daily leaderboard updates in Telegram groups
- **Mini-App Sharing:** "Play with me!" buttons in chat
- **TON Wallet:** Blockchain rewards for top players (1 TON = ~$2-3)

---

## Technical Implementation

### Database Schema Additions

```sql
-- Player levels and progression
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS
  total_skin_value INTEGER DEFAULT 0, -- Sum of purchased outfit prices
  player_level INTEGER DEFAULT 1,
  lifetime_gems INTEGER DEFAULT 0, -- Never resets (for league placement)
  daily_gems INTEGER DEFAULT 0, -- Resets at 00:00 UTC
  daily_gems_reset_date DATE DEFAULT CURRENT_DATE,
  league TEXT DEFAULT 'bronze', -- bronze, silver, gold, platinum, diamond, master, grandmaster
  league_rank INTEGER, -- Rank within league
  last_rank_update TIMESTAMP DEFAULT NOW();

-- Avatar customization
CREATE TABLE IF NOT EXISTS user_outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT REFERENCES users(telegram_id),
  outfit_id TEXT NOT NULL, -- e.g., 'hat_pirate', 'shirt_tuxedo'
  category TEXT NOT NULL, -- 'hat', 'shirt', 'pants', 'accessory', 'background'
  price INTEGER NOT NULL, -- Original purchase price
  equipped BOOLEAN DEFAULT FALSE,
  purchased_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(telegram_id, outfit_id)
);

CREATE INDEX idx_outfits_user ON user_outfits(telegram_id);

-- Inbox/mail system
CREATE TABLE IF NOT EXISTS user_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT REFERENCES users(telegram_id),
  message_type TEXT NOT NULL, -- 'daily_reward', 'leaderboard_prize', 'referral', 'task_complete', 'announcement'
  title TEXT NOT NULL,
  message TEXT,
  rewards JSONB, -- { energy: 50, gems: 10, tickets: 5, coins: 1000 }
  expires_at TIMESTAMP,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inbox_user ON user_inbox(telegram_id, claimed, expires_at);

-- Referral tracking
CREATE TABLE IF NOT EXISTS user_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_telegram_id BIGINT REFERENCES users(telegram_id),
  referred_telegram_id BIGINT REFERENCES users(telegram_id),
  referral_code TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE, -- Friend opened 25 chests
  rewards_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_referrals_referrer ON user_referrals(referrer_telegram_id);
CREATE INDEX idx_referrals_code ON user_referrals(referral_code);

-- Task completion tracking
CREATE TABLE IF NOT EXISTS user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT REFERENCES users(telegram_id),
  task_id TEXT NOT NULL, -- e.g., 'watch_ad_energy', 'follow_tiktok'
  task_type TEXT NOT NULL, -- 'ad', 'social', 'referral', 'daily', 'cross_promo'
  completed_count INTEGER DEFAULT 0, -- For repeatable tasks
  last_completed TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(telegram_id, task_id)
);

CREATE INDEX idx_tasks_user ON user_tasks(telegram_id);

-- Daily leaderboard (materialized view for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_leaderboard AS
SELECT
  telegram_id,
  daily_gems,
  league,
  RANK() OVER (PARTITION BY league ORDER BY daily_gems DESC) as league_rank
FROM user_stats
WHERE daily_gems > 0;

CREATE INDEX idx_daily_leaderboard ON daily_leaderboard(league, league_rank);

-- Refresh leaderboard every 60 seconds (via cron job or trigger)
```

### File Structure

```
src/
├── scenes/
│   ├── LoadingScene.js (existing)
│   ├── MainScene.js (existing - POP scene)
│   ├── WheelScene.js (NEW)
│   ├── ShopScene.js (NEW - avatar customization)
│   ├── ItemsScene.js (NEW - IAP store)
│   └── EarnScene.js (NEW - task list)
├── components/
│   ├── StatusBar.js (existing - add gems display)
│   ├── BottomTabMenu.js (existing)
│   ├── LoadingSlider.js (existing)
│   ├── SettingsModal.js (existing)
│   ├── ComboBonusDisplay.js (existing)
│   ├── EnergyCountdownTimer.js (existing)
│   ├── LeaderboardWidget.js (NEW - compact display)
│   ├── LeaderboardModal.js (NEW - full leaderboard)
│   ├── InboxModal.js (NEW - mail system)
│   ├── EnergyDepletionModal.js (NEW - progressive offers)
│   ├── WheelSpinner.js (NEW - animated wheel)
│   ├── AvatarDisplay.js (NEW - 3D parrot renderer)
│   └── TaskCard.js (NEW - earn task item)
├── managers/
│   ├── LeaderboardManager.js (NEW - rank calculations)
│   ├── InboxManager.js (NEW - mail delivery)
│   ├── ReferralManager.js (NEW - referral tracking)
│   ├── TaskManager.js (NEW - task completion)
│   └── IAPManager.js (NEW - Telegram Stars integration)
├── utils/
│   ├── persistentState.js (existing)
│   ├── supabaseClient.js (existing)
│   ├── formatNumber.js (NEW - 1,234 vs 1.2K formatting)
│   └── timeUtils.js (NEW - countdown timers, UTC resets)
└── main.js (register new scenes)
```

### Implementation Priority (3 Phases)

#### **Phase 1: Foundation (Weeks 1-4)** - Core Retention

**Priority 1: Shop Scene + Avatar System**
- Purpose: Create coin sink + progression system
- Components: ShopScene.js, AvatarDisplay.js
- Database: user_outfits table
- Estimated Time: 1 week
- Impact: HIGH (gives purpose to coins, drives retention)

**Priority 2: Leaderboard + Leagues**
- Purpose: Daily competitive loop
- Components: LeaderboardWidget.js, LeaderboardModal.js, LeaderboardManager.js
- Database: daily_leaderboard view, league columns
- Estimated Time: 1 week
- Impact: HIGH (daily comeback mechanic)

**Priority 3: Inbox/Mail System**
- Purpose: Reward delivery + notifications
- Components: InboxModal.js, InboxManager.js
- Database: user_inbox table
- Estimated Time: 3 days
- Impact: MEDIUM (enables all future reward systems)

**Priority 4: Energy Depletion Modal**
- Purpose: Progressive monetization funnel
- Components: EnergyDepletionModal.js
- Logic: Referral → Ad → IAP progression
- Estimated Time: 2 days
- Impact: MEDIUM (gentle monetization introduction)

**Phase 1 Result:** Players have progression goal (avatar levels), daily competition (leaderboards), and gentle monetization (depletion modal).

---

#### **Phase 2: Engagement (Weeks 5-8)** - Social & Monetization

**Priority 5: Referral System**
- Purpose: Viral growth
- Components: ReferralManager.js, share buttons
- Database: user_referrals table
- Integration: Telegram share API
- Estimated Time: 1 week
- Impact: HIGH (player acquisition)

**Priority 6: Earn Scene + Tasks**
- Purpose: Free rewards for engaged players
- Components: EarnScene.js, TaskCard.js, TaskManager.js
- Database: user_tasks table
- Estimated Time: 1 week
- Impact: MEDIUM (F2P retention + ad revenue)

**Priority 7: Items Scene (IAP Store)**
- Purpose: Direct monetization
- Components: ItemsScene.js, IAPManager.js
- Integration: Telegram Stars API
- Estimated Time: 1 week
- Impact: HIGH (primary revenue stream)

**Priority 8: Wheel Scene**
- Purpose: Secondary engagement loop
- Components: WheelScene.js, WheelSpinner.js
- Mechanics: Ticket-based spins, weighted rewards
- Estimated Time: 4 days
- Impact: MEDIUM (additional energy source + fun factor)

**Phase 2 Result:** Complete game loop with all 5 scenes, monetization live, viral growth engine running.

---

#### **Phase 3: Polish & Optimization (Weeks 9-12)** - Retention Tuning

**Priority 9: Push Notifications**
- Purpose: Re-engagement
- Integration: Telegram Bot API (send messages)
- Logic: Energy full, leaderboard ending, mail expiring
- Estimated Time: 3 days
- Impact: MEDIUM (D1 retention boost)

**Priority 10: Friend Leaderboard**
- Purpose: Social competition
- Components: Tab in LeaderboardModal
- Query: Filter leaderboard by Telegram contacts
- Estimated Time: 2 days
- Impact: LOW (nice-to-have social feature)

**Priority 11: VIP Pass System**
- Purpose: Subscription revenue
- Components: VIP badge, daily bonus grants
- Database: vip_status, vip_expires_at columns
- Estimated Time: 1 week
- Impact: MEDIUM (recurring revenue)

**Priority 12: Analytics & Balancing**
- Purpose: Data-driven optimization
- Integration: Mixpanel/Amplitude or custom analytics
- Metrics: Retention, ARPU, session length, conversion funnel
- Estimated Time: Ongoing
- Impact: HIGH (informs all future decisions)

**Phase 3 Result:** Polished, data-driven game with optimized retention and monetization.

---

## Asset Requirements

### New Assets Needed

#### Wheel Scene
- `wheel_base.png` - Spinning wheel background (1024×1024)
- `wheel_segments.png` - 8 prize segments with icons
- `wheel_pointer.png` - Arrow indicator (128×256)
- `ticket_icon.png` - Ticket currency icon (256×256)

#### Shop Scene (Avatar System)
- `parrot_base.png` - Default parrot body (512×512)
- **Hats:** 15 PNG files (pirate hat, crown, baseball cap, wizard hat, etc.)
- **Shirts:** 20 PNG files (t-shirts, hoodies, pirate coat, tuxedo, etc.)
- **Pants:** 15 PNG files (shorts, jeans, pirate pants, formal pants, etc.)
- **Accessories:** 20 PNG files (sunglasses, necklace, eyepatch, scarf, etc.)
- **Backgrounds:** 10 PNG files (beach, jungle, treasure cave, sky, etc.)
- Total: ~80 outfit items (256×256 each)

#### Leaderboard
- `league_bronze.png` through `league_grandmaster.png` - 7 league badges (128×128)
- `rank_1_crown.png`, `rank_2_medal.png`, `rank_3_medal.png` - Podium icons
- `arrow_up.png`, `arrow_down.png` - Rank change indicators (64×64)

#### Inbox/Mail
- `mail_icon.png` - Envelope icon (128×128)
- `mail_badge_red.png` - Notification dot (32×32)
- `gift_box.png` - Reward icon (256×256)
- `checkmark_green.png` - Claimed indicator (64×64)

#### Energy Depletion Modal
- `energy_empty.png` - Empty battery illustration (512×512)
- `friend_invite_icon.png` - Referral icon (256×256)
- `ad_play_icon.png` - Video ad icon (256×256)
- `iap_star_icon.png` - Telegram Stars icon (256×256)

#### Special Gem Types
- `gem_ruby.png` - Red ruby (+5 gems, 256×256)
- `gem_sapphire.png` - Blue sapphire (+10 gems, 256×256)
- `gem_diamond.png` - White diamond (+25 gems, 256×256)

#### UI Elements
- `tab_wheel_icon.png`, `tab_shop_icon.png`, `tab_items_icon.png`, `tab_earn_icon.png`
- `notification_dot.png` - Red badge for tabs (32×32)
- `level_progress_bar_bg.png`, `level_progress_bar_fill.png` - XP bar (400×40)

### Existing Assets to Reuse
- StatusBar background (`statusbar_bg_small.png`)
- Buttons (`Button01_Demo_[Color].png`)
- Frames (`ItemFrame01-05`, `CardFrame01`)
- Sliders (`Slider_Basic01_Bg/Fill`)
- Icons (coins, gems, energy from `Icon_ItemIcons/`)

---

## Balancing Parameters

### Energy System
```javascript
const ENERGY_CONFIG = {
  startingEnergy: 100,
  maxEnergy: 100, // Can be exceeded by collectibles
  costPerTap: 1,
  hourlyGrant: 10, // per hour
  dailyGrant: 100, // at 00:00 UTC
  adReward: 5, // per ad watch
  adLimit: 3, // per day
  refillTime: 10 * 60 * 60 * 1000 // 10 hours in ms
};
```

### Reward Probabilities
```javascript
const REWARD_CONFIG = {
  coinPayout: {
    normal: { chance: 0.80, range: [3, 49] },
    big: { chance: 0.20, picks: [50, 75, 100, 125, 150] },
    megaJackpot: { chance: 0.005, picks: [3000, 4000, 5000] }
  },

  collectibles: {
    emerald: { chance: 0.10, value: 1, level: 1 },
    ruby: { chance: 0.02, value: 5, level: 10 },
    sapphire: { chance: 0.005, value: 10, level: 20 },
    diamond: { chance: 0.001, value: 25, level: 50 },
    energy: { chance: 0.25, range: [1, 3] },
    autoPop: { chance: 0.05, value: 5 }
  }
};
```

### Level Progression
```javascript
const LEVEL_CONFIG = {
  coinsPerLevel: 10000,
  // Level = floor((coins + skinValue) / 10000) + 1

  levelBenefits: {
    1: { coinRange: [3, 49], gemRate: 0.10, energyRate: 0.25, autoPopRate: 0.05 },
    6: { coinRange: [5, 60], gemRate: 0.12, energyRate: 0.27, autoPopRate: 0.06 },
    11: { coinRange: [8, 75], gemRate: 0.15, energyRate: 0.30, autoPopRate: 0.07 },
    21: { coinRange: [10, 100], gemRate: 0.18, energyRate: 0.32, autoPopRate: 0.08 },
    31: { coinRange: [15, 125], gemRate: 0.22, energyRate: 0.35, autoPopRate: 0.10 },
    51: { coinRange: [20, 150], gemRate: 0.25, energyRate: 0.40, autoPopRate: 0.12 }
  }
};
```

### League Thresholds
```javascript
const LEAGUE_CONFIG = {
  bronze: { min: 0, max: 99 },
  silver: { min: 100, max: 499 },
  gold: { min: 500, max: 1999 },
  platinum: { min: 2000, max: 4999 },
  diamond: { min: 5000, max: 9999 },
  master: { min: 10000, max: 24999 },
  grandmaster: { min: 25000, max: Infinity }
};
```

### IAP Pricing (Telegram Stars)
```javascript
const IAP_PRODUCTS = {
  energy: [
    { amount: 400, price: 100, bonus: 0 },
    { amount: 880, price: 200, bonus: 0.10 },
    { amount: 1500, price: 300, bonus: 0.25 },
    { amount: 2500, price: 450, bonus: 0.40 },
    { amount: 3600, price: 600, bonus: 0.50, popular: true },
    { amount: 5200, price: 750, bonus: 0.75 },
    { amount: 7600, price: 950, bonus: 1.00 },
    { amount: 11500, price: 1150, bonus: 1.50 },
    { amount: 16800, price: 1400, bonus: 2.00, bestValue: true }
  ],

  tickets: [
    { amount: 4, price: 200, bonus: 0 },
    { amount: 7, price: 300, bonus: 0.10, popular: true },
    { amount: 15, price: 600, bonus: 0.25 },
    { amount: 27, price: 950, bonus: 0.40 },
    { amount: 35, price: 1150, bonus: 0.50 },
    { amount: 56, price: 1400, bonus: 1.00, bestValue: true }
  ]
};

// Telegram Stars Conversion: 1 Star ≈ $0.02 USD
// 100 Stars = $2.00 USD (approx)
```

### Wheel Rewards
```javascript
const WHEEL_CONFIG = {
  rewards: [
    { type: 'energy', amount: 10, weight: 30 },
    { type: 'energy', amount: 25, weight: 25 },
    { type: 'energy', amount: 50, weight: 20 },
    { type: 'energy', amount: 100, weight: 15 },
    { type: 'gems', amount: 5, weight: 5 },
    { type: 'gems', amount: 10, weight: 3 },
    { type: 'coins', amount: 500, weight: 1.5 },
    { type: 'ton', amount: 1, weight: 0.5 } // Legendary
  ],
  spinCost: 1, // ticket
  spinDuration: 3000, // ms
  freeSpinsPerDay: 3 // via ads
};
```

### Combo System
```javascript
const COMBO_CONFIG = {
  timingWindow: 700, // ms to continue combo
  processingDelay: 350, // ms before finalizing
  bonuses: {
    3: 3,
    4: 4,
    5: 5 // capped at 5
  }
};
```

### Inbox Expiration
```javascript
const INBOX_CONFIG = {
  expirationTimes: {
    daily_reward: 24 * 60 * 60 * 1000, // 24 hours
    leaderboard_prize: 6 * 60 * 60 * 1000, // 6 hours
    referral: null, // never expires
    task_complete: null, // never expires
    announcement: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  maxMessages: 50, // auto-delete oldest after 50
  claimedRetention: 24 * 60 * 60 * 1000 // keep claimed messages for 24h
};
```

---

## Development Roadmap

### **Phase 1: Foundation (Weeks 1-4)**

**Week 1: Shop Scene + Avatar System**
- [ ] Create ShopScene.js with category tabs
- [ ] Implement AvatarDisplay.js component (parrot + outfits)
- [ ] Build outfit data structure (80+ items with prices/categories)
- [ ] Database: user_outfits table + sync logic
- [ ] Level calculation formula (coins + skinValue)
- [ ] Purchase flow (spend coins → unlock outfit → update level)
- [ ] Persistent state for equipped outfits

**Week 2: Leaderboard + Leagues**
- [ ] Create LeaderboardWidget.js (compact display below avatar)
- [ ] Create LeaderboardModal.js (full leaderboard with scrolling)
- [ ] Implement LeaderboardManager.js (rank calculations)
- [ ] Database: daily_leaderboard view + league columns
- [ ] Daily reset logic (00:00 UTC)
- [ ] League promotion system (check after gem collection)
- [ ] Prize distribution to inbox

**Week 3: Inbox/Mail System**
- [ ] Create InboxModal.js (profile + messages)
- [ ] Implement InboxManager.js (message delivery + expiration)
- [ ] Database: user_inbox table
- [ ] Red badge on avatar (unread count)
- [ ] Claim flow (tap → grant rewards → animate)
- [ ] Expiration timers (countdown display)
- [ ] Integration with leaderboard prizes

**Week 4: Energy Depletion Modal**
- [ ] Create EnergyDepletionModal.js (3-step progression)
- [ ] Logic: 1st = referral, 2nd+ = ad (if available), else IAP
- [ ] Ad reward integration (mock for now, real ads in Phase 2)
- [ ] IAP preview (links to Items scene)
- [ ] Track depletion count (persistent state)
- [ ] Countdown timer display ("Wait 9h for free refill")

**Phase 1 Milestone:** Players have progression (shop), competition (leaderboard), rewards (inbox), and gentle monetization intro (depletion modal).

---

### **Phase 2: Engagement (Weeks 5-8)**

**Week 5: Referral System**
- [ ] Create ReferralManager.js (code generation + tracking)
- [ ] Database: user_referrals table
- [ ] Telegram share API integration (share link with preview)
- [ ] Friend completion tracking (must open 25 chests)
- [ ] Reward distribution (50 energy to both players)
- [ ] Milestones system (5/10/25/50/100 referrals)
- [ ] UI: Progress bar in Profile Modal + Earn scene button

**Week 6: Earn Scene + Tasks**
- [ ] Create EarnScene.js with scrollable task list
- [ ] Create TaskCard.js component (icon + reward + button)
- [ ] Implement TaskManager.js (completion tracking + verification)
- [ ] Database: user_tasks table
- [ ] Task types: ad, social, referral, daily, cross_promo
- [ ] Ad reward integration (Telegram Ad API or partner network)
- [ ] Social task verification (honor system or API checks)
- [ ] Daily reset logic for renewable tasks

**Week 7: Items Scene (IAP Store)**
- [ ] Create ItemsScene.js with 3 tabs (Spins, Wheelspin, Gold)
- [ ] Design product cards (mimics competitor screenshot)
- [ ] Implement IAPManager.js (Telegram Stars integration)
- [ ] Telegram Invoice API (create invoice → show payment modal)
- [ ] Webhook handler (verify payment → grant items)
- [ ] "Popular" and "Best Value" banners
- [ ] First purchase 2x bonus logic
- [ ] Receipt tracking (prevent double-grants)

**Week 8: Wheel Scene**
- [ ] Create WheelScene.js with animated wheel
- [ ] Create WheelSpinner.js component (physics-based rotation)
- [ ] Weighted reward system (30% common, 0.5% legendary)
- [ ] Spin animation (3-second deceleration + confetti)
- [ ] Prize display modal (shows reward + claim button)
- [ ] Ticket deduction + balance check
- [ ] Ad reward integration (3 free spins per day)
- [ ] TON wallet check (for TON reward eligibility)

**Phase 2 Milestone:** All 5 scenes complete, monetization live, viral loop active.

---

### **Phase 3: Polish & Optimization (Weeks 9-12)**

**Week 9: Push Notifications**
- [ ] Telegram Bot API setup (bot token + webhooks)
- [ ] Notification types: energy full, leaderboard ending, mail expiring
- [ ] Opt-in flow (ask permission in Settings)
- [ ] Notification scheduling (cron jobs or queues)
- [ ] Deep linking (notification → open specific scene)
- [ ] Rate limiting (max 3 notifications per day)

**Week 10: Friend Leaderboard + VIP Pass**
- [ ] Friend leaderboard tab in LeaderboardModal
- [ ] Query: Filter by Telegram contacts API
- [ ] VIP Pass system (subscription purchase via Telegram Stars)
- [ ] VIP benefits: 100 energy daily, 5 Auto Pops daily, ad-free, 10% coin boost
- [ ] VIP badge display (StatusBar + leaderboards)
- [ ] Expiration handling (monthly renewal or lapse)

**Week 11: Analytics & Balancing**
- [ ] Integrate analytics SDK (Mixpanel/Amplitude)
- [ ] Track events: session start, chest tap, gem collect, IAP, referral, etc.
- [ ] Funnel analysis: FTUE → D1 → D7 → D30 retention
- [ ] Monetization metrics: ARPU, ARPPU, LTV, conversion rate
- [ ] A/B testing framework (energy refill rates, IAP prices, etc.)
- [ ] Balance adjustments based on data

**Week 12: Launch Prep**
- [ ] Backend security audit (Telegram auth verification, RLS policies)
- [ ] Load testing (Supabase queries, concurrent users)
- [ ] Asset optimization (image compression, lazy loading)
- [ ] Performance profiling (60 FPS on mid-range phones)
- [ ] Legal compliance (privacy policy, terms of service, COPPA)
- [ ] App Store Optimization (screenshots, description, keywords)
- [ ] Soft launch (100 beta testers)

**Phase 3 Milestone:** Polished, optimized, data-driven game ready for public launch.

---

## Success Metrics

### User Acquisition
- **Organic Installs:** 1,000 MAU by Month 3
- **Referral Rate:** 15%+ of users invite at least 1 friend
- **Viral Coefficient:** 0.3+ (each user brings 0.3 new users)

### Retention
- **D1 Retention:** 45%+ (industry: 40%)
- **D7 Retention:** 25%+ (industry: 20%)
- **D30 Retention:** 12%+ (industry: 10%)

### Engagement
- **DAU/MAU Ratio:** 35%+ (daily actives / monthly actives)
- **Session Length:** 3-5 minutes average
- **Sessions Per Day:** 2-4 (driven by energy refills)
- **Chests Opened Per Session:** 50-150

### Monetization
- **Conversion Rate:** 10%+ (users who make any purchase)
- **ARPU:** $0.40+ per user per month
- **ARPPU:** $5+ per paying user per month
- **LTV:** $5+ lifetime value (first 90 days)
- **IAP Revenue:** 60% of total
- **Subscription Revenue:** 25% of total
- **Ad Revenue:** 10% of total

### Social
- **Referrals Per User:** 0.5+ average
- **Friend Leaderboard Engagement:** 20%+ view weekly
- **Share Rate:** 5%+ share achievements

---

## Future Roadmap (Post-Launch)

### Month 4-6: Content Expansion
- [ ] 50 new avatar outfits (seasonal themes)
- [ ] Special events (2-week limited-time themes)
- [ ] Battle Pass system (monthly progression)
- [ ] Guild/clan system (10-50 members)
- [ ] New collectible types (power-ups, boosters)

### Month 7-12: Advanced Features
- [ ] Prestige system (reset for permanent bonuses)
- [ ] PvP tournaments (weekly competitions)
- [ ] Sticker collection + trading (use existing tab)
- [ ] Custom avatar creator (pay to design)
- [ ] TON blockchain integration (NFT rewards)

### Year 2+: Platform Expansion
- [ ] Web version (desktop browser)
- [ ] iOS/Android native apps (if Telegram limits growth)
- [ ] Multi-language support (Spanish, Portuguese, Russian, etc.)
- [ ] Cross-game partnerships (shared rewards)
- [ ] Esports tournaments (Grandmaster League championships)

---

## Conclusion

This game design document provides a complete blueprint for a Telegram mini-app chest tapping game with:

✅ **5-Scene Architecture** - Pop, Wheel, Shop, Items, Earn
✅ **Progressive Monetization** - Referral → Ad → IAP funnel
✅ **Avatar Progression** - Parrot customization with 80+ outfits
✅ **Level System** - Based on coins + skin value (never decreases)
✅ **Daily Leaderboards** - Gem-based, league-tiered, automated prizes
✅ **Inbox/Mail System** - Time-limited claimable rewards
✅ **Retention Loops** - Daily resets, energy timers, social competition
✅ **Telegram Integration** - Stars IAP, avatars, sharing, haptics
✅ **Balanced Economy** - F2P viable, whales rewarded, no pay-to-win

**Next Steps:**
1. Review and approve this design document
2. Begin Phase 1 implementation (Shop → Leaderboard → Inbox → Depletion Modal)
3. Iterate based on playtesting feedback
4. Launch Phase 2 (Referral → Earn → Items → Wheel)
5. Optimize Phase 3 (Notifications → Analytics → Polish)
6. Soft launch → Public launch → Post-launch content

**Estimated Timeline:** 12 weeks from start to public launch
**Estimated Cost:** $0 (self-developed) + ~$50-100/month hosting (Supabase + CDN)
**Revenue Potential:** $3,500-12,000/month by Month 6 (10,000 MAU × 10% conversion × $5 ARPPU)

This document serves as the master reference for all future development. All features, mechanics, and systems described herein are designed to work together as a cohesive, engaging, and profitable Telegram mini-app game.

---

**Document Version:** 1.0
**Created:** 2025-01-12
**Status:** Ready for Implementation
