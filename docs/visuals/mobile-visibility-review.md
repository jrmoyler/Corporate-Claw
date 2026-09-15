# Mobile office visibility correction — 2026-09-15

## Evidence and diagnosis

Base: main `5ea3485e2139f67008ce5fd4c7e1bfd1f084bd6a` (PRs #6 and #7 merged).
The user supplied a phone screenshot showing a beige background, leaves and white
markers, plus the intended office reference. Both images are available in the
current workspace. The office reference remains excluded from Git as before.

The visible leaves do not receive shadows. The missing parquet, merged furniture,
walls and CPU suited meshes do receive shadows. White talk markers belong to the
GPU agent path. This is strong evidence for a rendering-path failure; it does not
identify a particular device-driver/shader error without the phone's console.
The active factories contain finite furniture and valid suited skeletal meshes.
Missing content must not be diagnosed as a missing GLB: these objects are procedural.

The cloud browser opened production, where WebGPU was unavailable and WebGL2 context
creation failed (`getSupportedExtensions` on null). Local app navigation returned
`ERR_BLOCKED_BY_CLIENT`. Neither is a reproduction of the user's partially drawn
GPU scene. No alternate browser or security override was used.

## Changed method

The normal URL now uses the native Three.js WebGLRenderer, standard PBR materials,
PCF shadows and the bounded CPU suited rig. It no longer invokes WebGPURenderer's
TSL/WebGL fallback. `?renderer=webgpu` preserves the explicit GPU path for diagnosis;
it cannot silently fall back to the previously failing path. The existing WebGL
limit of 30 active agents remains enforced, including the UI count; explicit
WebGPU retains its 2000 cap. This means desktop defaults also use 30 rather than
100 agents, a deliberate compatibility tradeoff until native GPU evidence exists.

First-frame compilation/drawing happens before the loading screen clears. Native
shader compilation failures surface through the existing recovery UI rather than
announcing a running simulation. ACES tone mapping and sRGB output are explicit.

The camera is now orthographic, preserving adult/furniture scale across the room.
Portrait uses a closer pannable crop rather than fitting the entire room into a
narrow strip. One-finger dragging pans; pinch zoom remains available; Reset view
also resets zoom. Floor/agent picking uses the same camera.

## Validation and acceptance

- Typecheck, all 23 tests and production build are required for this change.
- New tests construct the actual complete office (including batching), check all
  positions/normals/UVs and bounds, and reject node-only materials in the default
  scene. Texture painting is stubbed for this structural test, not visual evidence.
- Camera tests cover portrait, landscape, zero-sized initialization, floor picking
  and equal projected adult heights at different room depths.
- Existing tests cover rig deformation, separate clone animation, population
  bounds, binary GLB verification, navigation and API boundaries.

The change is a rendering mitigation, not a verified diagnosis of a specific GPU
shader bug. Browser shader execution, on-phone FPS, exact-reference composition,
lighting and photoreal character/furniture likeness are **not passed**. The prior
procedural models remain approximations of the reference. There is no substitute
photo plane, and no generated image is presented as the running application.

Before visual acceptance, open the PR preview in an accelerated browser and on
the user's Samsung phone. Verify the default scene contains the parquet, ivory
walls, framed meeting room, both furnished lounges, reception and visibly suited
humans together. Check walking/seating, tap selection, drag/pinch, reset and
portrait/landscape rotation. Compare with the supplied reference. Keep the PR in
draft until this evidence exists; passing structural tests is insufficient.

## Image-to-Three.js continuation

Existing `.img2threejs/state.json` and previous rejection/validation records remain
unchanged. `forge/next.py` still reports reference-suitability pending. Continue the
existing direct scene route documented in `reference-continuation.md`; do not
claim the generic single-object pipeline passes. This pass changes the renderer
and projection, not the inferred hidden geometry. The visual acceptance gate is
still open. Authorization is the user's current request for a PR fixing the
invisible office and matching the attached reference.
