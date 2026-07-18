/**
 * Wheel prize table — server-authoritative. Segment order MUST match
 * src/config/wheel.js on the client (the client renders the wheel and
 * lands the animation on the index the server returns).
 */

export interface WheelSegment {
  index: number;
  weight: number; // percent
  prize: {
    type: 'energy' | 'gems' | 'coins' | 'jackpot';
    energy?: number;
    gems?: number;
    coins?: number;
    sticker_packs?: number;
  };
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { index: 0, weight: 30, prize: { type: 'energy', energy: 10 } },
  { index: 1, weight: 25, prize: { type: 'energy', energy: 25 } },
  { index: 2, weight: 20, prize: { type: 'energy', energy: 50 } },
  { index: 3, weight: 13, prize: { type: 'energy', energy: 100 } },
  { index: 4, weight: 5, prize: { type: 'gems', gems: 5 } },
  { index: 5, weight: 3, prize: { type: 'gems', gems: 10 } },
  { index: 6, weight: 2.5, prize: { type: 'coins', coins: 500 } },
  { index: 7, weight: 1.5, prize: { type: 'jackpot', coins: 3000, sticker_packs: 1 } }
];

export const FREE_SPINS_PER_DAY = 3;
export const SPIN_XP = 15;

export function rollSegment(): WheelSegment {
  const total = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * total;
  for (const segment of WHEEL_SEGMENTS) {
    roll -= segment.weight;
    if (roll <= 0) return segment;
  }
  return WHEEL_SEGMENTS[0];
}
