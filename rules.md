# rules.md

These are mandatory rules for Claude Code when generating or editing code in this repository.  

---

## General
- All code must be **mobile-first** (portrait 480x800).
- Always assume the game runs **inside Telegram WebApp**.
- Use **Vite ESModules** for imports, no CommonJS.
- Use **Phaser 3** for game logic, `@tonconnect/ui` for wallet integration, and `@supabase/supabase-js` for database.
- Never hardcode secrets (use `import.meta.env.VITE_*`).

---

## Game Code
- Use **class-based Phaser scenes** (`extends Phaser.Scene`).
- Scale config: `Phaser.Scale.FIT` + `Phaser.Scale.CENTER_BOTH`.
- Input: **touch/pointer only**, no keyboard listeners.
- Physics: Arcade engine, gravity disabled unless explicitly required.
- Place sprites and UI elements with mobile tap areas (min 40px).

---

## TON Wallet Integration
- Always use **`TonConnectUI`** from `@tonconnect/ui`.
- Connect wallet via a **custom button**, not the built-in widget.
- Show wallet address in-game after connect.
- Use a **listener pattern** to handle wallet connect/disconnect.
- Never trust client-only connection → comment where backend wallet verification is required.

---

## Telegram WebApp
- Always expand WebApp fullscreen on init:
  ```js
  window.Telegram.WebApp.expand();
