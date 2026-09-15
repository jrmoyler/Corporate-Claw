export type ToolEvent = { agentIndex: number; callId: string; phase: 'start' | 'settled' };
export type CoffeePhase = 'queued' | 'outbound' | 'drinking' | 'returning';
const listeners = new Set<(event: ToolEvent) => void>();
const active = new Map<string, number>();
let phases: Record<number, CoffeePhase> = {};
const phaseListeners = new Set<() => void>();
export const mcpActivity = {
  start(agentIndex: number, callId: string) { active.set(callId, agentIndex); listeners.forEach(fn => fn({agentIndex,callId,phase:'start'})); },
  settle(agentIndex: number, callId: string) { active.delete(callId); listeners.forEach(fn => fn({agentIndex,callId,phase:'settled'})); },
  subscribe(fn: (event: ToolEvent) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  replay(fn: (event: ToolEvent) => void) { active.forEach((agentIndex,callId) => fn({agentIndex,callId,phase:'start'})); },
  setPhase(index: number, phase?: CoffeePhase) { phases={...phases}; if(phase)phases[index]=phase;else delete phases[index];phaseListeners.forEach(fn=>fn()); },
  snapshot: () => phases,
  subscribePhases(fn: () => void) { phaseListeners.add(fn);return () => {phaseListeners.delete(fn);}; },
};
