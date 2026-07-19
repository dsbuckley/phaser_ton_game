import qrcode from 'qrcode-generator';

/**
 * Blocks the game outside the Telegram mobile app.
 *
 * Two gate variants:
 *  - 'desktop'  — inside Telegram (initData present) but on a desktop/web client
 *  - 'no-auth'  — not inside Telegram at all / not logged in (no initData)
 *
 * Dev bypass: `import.meta.env.DEV` skips the gate so the game stays playable
 * in a local browser. Preview a variant locally with ?gate=desktop or ?gate=no-auth.
 */

const TELEGRAM_LINK = 'https://t.me/treasurepop_bot/play';
const MOBILE_PLATFORMS = ['android', 'android_x', 'ios'];

export function getGateReason() {
  const forced = new URLSearchParams(window.location.search).get('gate');
  if (forced === 'desktop' || forced === 'no-auth') return forced;
  if (import.meta.env.DEV) return null;

  const tg = window.Telegram?.WebApp;
  if (!tg || !tg.initData) return 'no-auth';
  if (!MOBILE_PLATFORMS.includes(tg.platform)) return 'desktop';
  return null;
}

export function showPlatformGate(reason) {
  const title = reason === 'no-auth'
    ? 'Log in to Telegram to play!'
    : 'Use Telegram on your mobile!';
  const subtitle = reason === 'no-auth'
    ? 'Treasure Pop runs inside Telegram. Open the link on your phone and make sure you’re logged in.'
    : 'Treasure Pop is built for phones. Scan the QR code with your phone to start popping chests.';

  const qr = qrcode(0, 'M');
  qr.addData(TELEGRAM_LINK);
  qr.make();
  const qrSvg = qr.createSvgTag({ cellSize: 5, margin: 0, scalable: true });

  const style = document.createElement('style');
  style.textContent = `
    /* Undo the portrait-lock rotation hack from index.html — desktop stays upright */
    html.gated {
      transform: none !important;
      width: 100% !important;
      height: 100% !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
    }
    #platform-gate {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg, #0e1b3d 0%, #1a1a2e 100%);
      padding: 24px;
    }
    .gate-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 340px;
    }
    .gate-card img.gate-chest {
      width: 140px;
      height: auto;
      margin-bottom: 8px;
      filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.5));
    }
    .gate-card h1 {
      font-family: 'Tilt Warp', sans-serif;
      font-weight: 400;
      font-size: 28px;
      color: #ffd54a;
      margin-bottom: 10px;
      text-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
    }
    .gate-card p {
      font-family: 'LINESeed', sans-serif;
      font-size: 15px;
      line-height: 1.45;
      color: #c9d4f0;
      margin-bottom: 22px;
    }
    .gate-qr {
      background: #fff;
      border-radius: 16px;
      padding: 14px;
      width: 210px;
      height: 210px;
      margin-bottom: 18px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    }
    .gate-qr svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .gate-link {
      font-family: 'LINESeed', sans-serif;
      font-weight: 700;
      font-size: 16px;
      color: #6fb6ff;
      text-decoration: underline;
      -webkit-user-select: text;
      user-select: text;
    }
  `;
  document.head.appendChild(style);
  document.documentElement.classList.add('gated');

  const gate = document.createElement('div');
  gate.id = 'platform-gate';
  gate.innerHTML = `
    <div class="gate-card">
      <img class="gate-chest" src="/assets/sprites/open treasure/frame_0001.webp" alt="">
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <div class="gate-qr">${qrSvg}</div>
      <a class="gate-link" href="${TELEGRAM_LINK}" target="_blank" rel="noopener">t.me/treasurepop_bot/play</a>
    </div>
  `;
  document.body.appendChild(gate);

  const container = document.getElementById('game-container');
  if (container) container.style.display = 'none';
}
