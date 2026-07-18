/**
 * Wheel display config — segment ORDER must match
 * server/config/wheel.ts (the server returns a segment index).
 * Colors follow the LayerLab rarity palette.
 */

export const WHEEL_SEGMENTS = [
  { index: 0, color: 0x5bc8f5, label: '+10', icon: 'statusbar_energy', prizeText: '+10 Energy' },
  { index: 1, color: 0x4ade80, label: '+25', icon: 'statusbar_energy', prizeText: '+25 Energy' },
  { index: 2, color: 0x38a3e0, label: '+50', icon: 'statusbar_energy', prizeText: '+50 Energy' },
  { index: 3, color: 0x2dd4bf, label: '+100', icon: 'statusbar_energy', prizeText: '+100 Energy' },
  { index: 4, color: 0xa78bfa, label: '+5', icon: 'statusbar_gem', prizeText: '+5 Gems' },
  { index: 5, color: 0x8b5cf6, label: '+10', icon: 'statusbar_gem', prizeText: '+10 Gems' },
  { index: 6, color: 0xfbbf24, label: '+500', icon: 'statusbar_coin', prizeText: '+500 Coins' },
  { index: 7, color: 0xef4444, label: 'JACKPOT', icon: 'statusbar_coin', prizeText: 'JACKPOT!' }
];

export const SEGMENT_ANGLE = 360 / WHEEL_SEGMENTS.length;
