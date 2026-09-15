# PR #5 follow-up: binary assets, WebGL population and GOTO

Baseline: main `cb2bb0142534b4895fa88bec8cd97c0ab081050d` (includes PR #6).

| Finding | Reproduction on baseline | Focused fix |
| --- | --- | --- |
| Metadata-only GLB verification | `verifyAssets()` passed `character.glb`, while Khronos validation found NaN position values. The unused `character-old.glb` also has malformed chunk headers. | Remove both unused legacy files; preserve attribution. Validate every shipped GLB recursively, including binary accessor ranges, finite values and skin-joint indices, before and after the build. Test the active procedural suited rig directly. |
| Unbounded WebGL rig cloning | Constructing `CPUAgentRenderer` with a lightweight source and count 2,000 invoked 2,000 clones and added 2,000 scene roots. This isolates allocation behavior without exhausting the tab with full rigs. | Cap WebGL at 30 before startup or resize allocations; enforce the same limit in the renderer, manager, store and slider. WebGPU retains 2,000. |
| GOTO inset clamp | Starting at z=28 and stepping 1,000 frames toward z=29.8, 30 or 31 stopped at z=29, leaving arrival distances of 0.8, 1 and 2. | Expand the GOTO route and movement bounds to include its target; keep BOIDS at worldSize minus one. |

PR #6 already changed the active character to `createSuitedAgent` and moved the offline exit from z=31 to z=28. This patch preserves both changes, office reconstruction, WebGPU shaders, renderer startup and Vercel configuration.

Validation:

- `npm test`: 20 passing tests. Includes a valid synthetic skinned GLB and mutations for NaN positions, out-of-bounds accessor data, joint index 244 with one bone, infinite inverse-bind data and truncation. A nested corrupt GLB causes deployment verification to fail.
- Tests cover initial and resized WebGL populations, a direct renderer bypass attempt, UI/store limits, active rig clips/joint data/colors/offline visibility, and finite animated vertices in independent walking and seated clones.
- GOTO reaches all four floor edges, z=31 and the current z=28 exit within the 0.3 arrival tolerance at 30 and 60 FPS. Existing boids confinement and partition-route regressions pass.
- `npm run lint`: TypeScript passes.
- `npm run build`: validates public assets, builds Vite output, then validates deployed GLBs.

The population cap is a bounded allocation safeguard, not a physical-device frame-rate certification. No physical-device performance claim is made.
