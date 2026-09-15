import { AGENTS } from './agents';

// Suiting stays inside a believable worsted-wool range; the accent carries the department.
export const DEPARTMENT_LOOKS = {
  Executive: { suit: '#1b2436', accent: '#c6a56c', shirt: '#f4f1ea', accessory: 'Waistcoat', description: 'Midnight worsted · gold waistcoat and pocket square' },
  Production: { suit: '#2c3a36', accent: '#62bab0', shirt: '#e6ecea', accessory: 'Lanyard', description: 'Deep pine flannel · teal lanyard and ID badge' },
  Sales: { suit: '#453035', accent: '#e3ac85', shirt: '#f3e9e2', accessory: 'PocketSquare', description: 'Oxblood twill · copper pocket square' },
  Marketing: { suit: '#3b3648', accent: '#d8b8d9', shirt: '#f0eaf0', accessory: 'Scarf', description: 'Aubergine flannel · lilac silk scarf' },
  Finance: { suit: '#333c47', accent: '#aabccf', shirt: '#e9eef3', accessory: 'Waistcoat', description: 'Slate herringbone · silver waistcoat and glasses' },
  People: { suit: '#4a4137', accent: '#d9b98a', shirt: '#f2ebdd', accessory: 'Scarf', description: 'Warm taupe tweed · champagne scarf' },
} as const;

/** Darkens a hex colour toward the shadow end, for lips against their own skin tone. */
function shade(hex: string, factor: number) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((n >> shift) & 255) * factor).toString(16).padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

// Individual variation is independent of department and stable across reloads.
export function agentAppearance(index: number) {
  const agent = AGENTS[index] ?? AGENTS[0];
  const look = DEPARTMENT_LOOKS[agent.department as keyof typeof DEPARTMENT_LOOKS] ?? DEPARTMENT_LOOKS.Executive;
  const seed = Math.imul(index + 1, 2654435761) >>> 0;
  return { ...look, department: agent.department,
    skin: ['#d5ac8d','#a87555','#6e4938','#bf906e','#e3c0a3'][seed % 5],
    hair: ['#221c17','#4a3628','#6b5744','#2f2b2c','#8a7358'][(seed >>> 4) % 5],
    bun: (seed >>> 8) % 3 === 0,
    height: .955 + ((seed >>> 12) % 10) * .011,
    glasses: agent.department === 'Finance' || (seed >>> 16) % 4 === 0,
    shoes: ['#1b1e20','#2a1f19','#191a1d'][(seed >>> 20) % 3],
    // Ties are personal rather than departmental, so a team never matches.
    tie: ['#36455e','#5c2b33','#2c4a3d','#47395c','#77492c','#2b3340','#4a5b70'][(seed >>> 24) % 7],
  };
}

export function agentSurface(index: number, name: string, suitOverride?: string) {
  const a = agentAppearance(index);
  const suit = suitOverride ?? a.suit;
  const colors: Record<string, string> = { Suit: suit, Lapel: shade(suit, .84), Shirt: a.shirt, Tie: a.tie,
    Skin: a.skin, Lips: shade(a.skin, .72), Hair: a.hair, HairBun: a.hair, Shoes: a.shoes, Eyes: '#2a2725',
    Waistcoat: shade(a.accent, .72), PocketSquare: a.accent, Lanyard: a.accent, Scarf: a.accent, Hardware: shade(suit, .6),
    Glasses: '#2b2f34', CoffeeCup: '#eee6d6' };
  const visible = name === 'CoffeeCup' ? false : name === 'HairBun' ? a.bun : name === 'Glasses' ? a.glasses
    : name === 'PocketSquare' ? ['Executive','Sales'].includes(a.department)
    : ['Waistcoat','Lanyard','Scarf'].includes(name) ? a.accessory === name : true;
  return { color: colors[name], visible, height: a.height };
}
