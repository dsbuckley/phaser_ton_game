/**
 * Small helpers for sound + haptic feedback that respect the user's
 * saved settings, usable from any scene/component (the SettingsModal
 * persists to these same localStorage keys).
 */

function flagEnabled(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'true');
  } catch {
    return true;
  }
}

export function soundEnabled() {
  return flagEnabled('soundEnabled');
}

export function hapticEnabled() {
  return flagEnabled('hapticEnabled');
}

export function playSound(scene, key, config) {
  if (!soundEnabled()) return;
  try {
    scene.sound.play(key, config);
  } catch { /* missing audio is non-fatal */ }
}

export function hapticImpact(style = 'light') {
  if (!hapticEnabled()) return;
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
}

export function hapticNotify(type = 'success') {
  if (!hapticEnabled()) return;
  window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
}
