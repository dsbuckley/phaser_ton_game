/**
 * Telegram Stars product catalog — server-authoritative.
 * The client renders whatever GET /api/shop/catalog returns; prices
 * are validated again at pre_checkout time so a stale client can
 * never buy at an old price.
 *
 * Pricing follows GAME_DESIGN.md (coin amounts use the corrected
 * values, not the inflated competitor numbers).
 */

export interface Product {
  id: string;
  category: 'energy' | 'tickets' | 'coins' | 'packs';
  title: string;
  amount: number; // of the primary resource
  bonusPct?: number;
  stars: number;
  ribbon?: 'popular' | 'best';
  reward: {
    energy?: number;
    tickets?: number;
    coins?: number;
    sticker_packs?: number;
  };
}

export const PRODUCTS: Product[] = [
  // ---- ENERGY ----
  { id: 'energy_small', category: 'energy', title: 'Small', amount: 400, stars: 100, reward: { energy: 400 } },
  { id: 'energy_medium', category: 'energy', title: 'Medium', amount: 880, bonusPct: 10, stars: 200, reward: { energy: 880 } },
  { id: 'energy_large', category: 'energy', title: 'Large', amount: 1500, bonusPct: 25, stars: 300, reward: { energy: 1500 } },
  { id: 'energy_xl', category: 'energy', title: 'XL', amount: 2500, bonusPct: 40, stars: 450, reward: { energy: 2500 } },
  { id: 'energy_xxl', category: 'energy', title: 'XXL', amount: 3600, bonusPct: 50, stars: 600, ribbon: 'popular', reward: { energy: 3600 } },
  { id: 'energy_mega', category: 'energy', title: 'Mega', amount: 5200, bonusPct: 75, stars: 750, reward: { energy: 5200 } },
  { id: 'energy_ultra', category: 'energy', title: 'Ultra', amount: 7600, bonusPct: 100, stars: 950, reward: { energy: 7600 } },
  { id: 'energy_basket', category: 'energy', title: 'Basket', amount: 11500, bonusPct: 150, stars: 1150, reward: { energy: 11500 } },
  { id: 'energy_treasure', category: 'energy', title: 'Treasure', amount: 16800, bonusPct: 200, stars: 1400, ribbon: 'best', reward: { energy: 16800 } },

  // ---- TICKETS ----
  { id: 'tickets_4', category: 'tickets', title: '4 Spins', amount: 4, stars: 200, reward: { tickets: 4 } },
  { id: 'tickets_7', category: 'tickets', title: '7 Spins', amount: 7, bonusPct: 10, stars: 300, ribbon: 'popular', reward: { tickets: 7 } },
  { id: 'tickets_15', category: 'tickets', title: '15 Spins', amount: 15, bonusPct: 25, stars: 600, reward: { tickets: 15 } },
  { id: 'tickets_27', category: 'tickets', title: '27 Spins', amount: 27, bonusPct: 40, stars: 950, reward: { tickets: 27 } },
  { id: 'tickets_35', category: 'tickets', title: '35 Spins', amount: 35, bonusPct: 50, stars: 1150, reward: { tickets: 35 } },
  { id: 'tickets_56', category: 'tickets', title: '56 Spins', amount: 56, bonusPct: 100, stars: 1400, ribbon: 'best', reward: { tickets: 56 } },

  // ---- COINS ----
  { id: 'coins_small', category: 'coins', title: 'Small', amount: 50000, stars: 100, reward: { coins: 50000 } },
  { id: 'coins_medium', category: 'coins', title: 'Medium', amount: 150000, bonusPct: 10, stars: 200, reward: { coins: 150000 } },
  { id: 'coins_large', category: 'coins', title: 'Large', amount: 300000, bonusPct: 25, stars: 300, ribbon: 'popular', reward: { coins: 300000 } },

  // ---- STICKER PACKS ----
  { id: 'packs_1', category: 'packs', title: '1 Pack', amount: 1, stars: 50, reward: { sticker_packs: 1 } },
  { id: 'packs_6', category: 'packs', title: '5+1 Packs', amount: 6, bonusPct: 20, stars: 225, ribbon: 'popular', reward: { sticker_packs: 6 } },
  { id: 'packs_13', category: 'packs', title: '10+3 Packs', amount: 13, bonusPct: 30, stars: 400, ribbon: 'best', reward: { sticker_packs: 13 } }
];

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
