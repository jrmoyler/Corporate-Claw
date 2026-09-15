// Standard WebGL skinning allocates a skeleton and mixer per agent.
export const WEBGL_AGENT_LIMIT = 30;
export const WEBGPU_AGENT_LIMIT = 2000;
export function clampAgentCount(count: number, limit: number) {
  return Math.max(1, Math.min(limit, Number.isFinite(count) ? Math.round(count) : 1));
}
