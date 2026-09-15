import { AGENTS } from './agents';

export const DEPARTMENT_LOOKS = {
  Executive: { suit: '#172c46', accent: '#c6a56c', shirt: '#f2ece0', accessory: 'Waistcoat', description: 'Midnight tailoring · gold waistcoat and pocket square' },
  Production: { suit: '#234f48', accent: '#62bab0', shirt: '#dae8e4', accessory: 'Lanyard', description: 'Forest tailoring · teal lanyard and ID badge' },
  Sales: { suit: '#623342', accent: '#e3ac85', shirt: '#f2e4da', accessory: 'PocketSquare', description: 'Burgundy tailoring · copper pocket square' },
  Marketing: { suit: '#56466f', accent: '#d8b8d9', shirt: '#f0e5ed', accessory: 'Scarf', description: 'Plum tailoring · lilac silk scarf' },
  Finance: { suit: '#35485c', accent: '#aabccf', shirt: '#e6edf3', accessory: 'Waistcoat', description: 'Slate tailoring · silver waistcoat and glasses' },
  People: { suit: '#796051', accent: '#d9b98a', shirt: '#f0e7d7', accessory: 'Scarf', description: 'Warm taupe tailoring · champagne scarf' },
} as const;

// Individual variation is independent of department and stable across reloads.
export function agentAppearance(index: number) {
  const agent = AGENTS[index] ?? AGENTS[0];
  const look = DEPARTMENT_LOOKS[agent.department as keyof typeof DEPARTMENT_LOOKS] ?? DEPARTMENT_LOOKS.Executive;
  const seed = Math.imul(index + 1, 2654435761) >>> 0;
  return { ...look, department: agent.department,
    skin: ['#d5ac8d','#a87555','#6e4938','#bf906e','#e3c0a3'][seed % 5],
    hair: ['#29231e','#514033','#302b29','#746354'][(seed >>> 4) % 4],
    bun: (seed >>> 8) % 3 === 0,
    height: .96 + ((seed >>> 12) % 9) * .01,
    glasses: agent.department === 'Finance' || (seed >>> 16) % 4 === 0,
  };
}

export function agentSurface(index: number, name: string, suitOverride?: string) {
  const a = agentAppearance(index);
  const colors: Record<string, string> = { Suit: suitOverride ?? a.suit, Lapel: a.suit, Shirt: a.shirt, Tie: a.accent,
    Skin: a.skin, Hair: a.hair, HairBun: a.hair, Waistcoat: a.accent, PocketSquare: a.accent,
    Lanyard: a.accent, Scarf: a.accent, Hardware: a.accent, Glasses: '#25282c', CoffeeCup: '#eee6d6' };
  const visible = name === 'CoffeeCup' ? false : name === 'HairBun' ? a.bun : name === 'Glasses' ? a.glasses
    : name === 'PocketSquare' ? ['Executive','Sales'].includes(a.department)
    : ['Waistcoat','Lanyard','Scarf'].includes(name) ? a.accessory === name : true;
  return { color: colors[name], visible, height: a.height };
}
