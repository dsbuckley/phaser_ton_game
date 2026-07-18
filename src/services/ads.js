/**
 * Adsgram rewarded-ads wrapper.
 *
 * Setup:
 * 1. Sign up at adsgram.ai, create a RewardedVideo block for your bot.
 * 2. Put the block id in .env: VITE_ADSGRAM_BLOCK_ID=int-XXXX
 * 3. (Production) configure the block's server-side Reward URL:
 *    https://<worker>/api/adsgram/reward?userid={userid}&key=<TELEGRAM_WEBHOOK_SECRET>
 *    — the server credits the reward; the client just refreshes.
 *
 * In dev (no SDK / no block id) showRewarded() resolves after a short
 * fake delay so the flow is fully testable.
 */

let controller = null;

function getController() {
  const blockId = import.meta.env.VITE_ADSGRAM_BLOCK_ID;
  if (!blockId || !window.Adsgram) return null;
  if (!controller) {
    controller = window.Adsgram.init({ blockId });
  }
  return controller;
}

export const ads = {
  /** True when the real Adsgram SDK + block id are available. */
  isAvailable() {
    return Boolean(import.meta.env.VITE_ADSGRAM_BLOCK_ID && window.Adsgram);
  },

  /**
   * Show a rewarded ad. Resolves { mock } when the user finished
   * watching (reward earned); rejects on skip/error.
   */
  showRewarded() {
    const ctrl = getController();
    if (!ctrl) {
      if (import.meta.env.DEV) {
        console.warn('Adsgram unavailable — using 1.5s mock ad');
        return new Promise((resolve) => setTimeout(() => resolve({ mock: true }), 1500));
      }
      return Promise.reject(new Error('ads_unavailable'));
    }
    return ctrl.show().then(() => ({ mock: false }));
  }
};
