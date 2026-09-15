/** WebGPU is opt-in until its shadow/material path has device-level evidence. */
export function requestedRenderer(search: string): 'webgl' | 'webgpu' {
  return new URLSearchParams(search).get('renderer') === 'webgpu' ? 'webgpu' : 'webgl';
}
