/**
 * Earn-task catalog — server-authoritative. The client renders what
 * GET /api/tasks returns; rewards are only ever credited here.
 */

export interface TaskReward {
  coins?: number;
  gems?: number;
  energy?: number;
  tickets?: number;
  sticker_packs?: number;
  xp?: number;
}

export interface TaskDef {
  id: string;
  type: 'daily' | 'once' | 'referral_milestone';
  title: string;
  icon: string; // client texture key
  reward: TaskReward;
  /** daily tasks: max claims per UTC day */
  dailyLimit?: number;
  /** referral_milestone: qualified referrals required */
  requiredReferrals?: number;
  /** once (social) tasks: link to open before claiming */
  url?: string;
  /** for watch_ad: client shows the Adsgram flow first */
  requiresAd?: boolean;
}

export const TASKS: TaskDef[] = [
  {
    id: 'watch_ad',
    type: 'daily',
    title: 'Watch an Ad',
    icon: 'statusbar_energy',
    reward: { energy: 5, xp: 10 },
    dailyLimit: 3,
    requiresAd: true
  },
  {
    id: 'ref_milestone_3',
    type: 'referral_milestone',
    title: 'Invite 3 Friends',
    icon: 'statusbar_gem',
    reward: { gems: 50, tickets: 5, xp: 40 },
    requiredReferrals: 3
  },
  {
    id: 'ref_milestone_5',
    type: 'referral_milestone',
    title: 'Invite 5 Friends',
    icon: 'statusbar_gem',
    reward: { gems: 250, xp: 40 },
    requiredReferrals: 5
  },
  {
    id: 'ref_milestone_10',
    type: 'referral_milestone',
    title: 'Invite 10 Friends',
    icon: 'statusbar_gem',
    reward: { gems: 500, sticker_packs: 2, xp: 40 },
    requiredReferrals: 10
  },
  {
    id: 'follow_tiktok',
    type: 'once',
    title: 'Follow on TikTok',
    icon: 'statusbar_ticket',
    reward: { tickets: 3, xp: 40 },
    // TODO: replace with the real profile URL
    url: 'https://www.tiktok.com/@yourgame'
  },
  {
    id: 'like_youtube',
    type: 'once',
    title: 'Like our YouTube video',
    icon: 'statusbar_energy',
    reward: { energy: 25, xp: 40 },
    // TODO: replace with the real video URL
    url: 'https://www.youtube.com/@yourgame'
  },
  {
    id: 'join_channel',
    type: 'once',
    title: 'Join our Telegram channel',
    icon: 'statusbar_energy',
    reward: { energy: 25, tickets: 2, xp: 40 },
    // TODO: replace with the real channel URL
    url: 'https://t.me/yourgamechannel'
  }
];

/** 7-day check-in cycle (repeats after day 7). Matches GAME_DESIGN.md. */
export const CHECKIN_REWARDS: TaskReward[] = [
  { energy: 25, coins: 500, xp: 20 },   // day 1
  { energy: 50, xp: 20 },               // day 2
  { energy: 75, tickets: 2, xp: 20 },   // day 3
  { energy: 100, coins: 1000, xp: 20 }, // day 4
  { energy: 100, gems: 5, xp: 20 },     // day 5
  { energy: 125, tickets: 3, xp: 20 },  // day 6
  { energy: 150, tickets: 5, gems: 10, xp: 20 } // day 7
];

export function taskById(id: string): TaskDef | undefined {
  return TASKS.find((t) => t.id === id);
}
