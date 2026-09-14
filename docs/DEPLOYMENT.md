# Deploying Corporate Claw from main

The repository root is the Vercel project root. Use the Vite preset, `npm ci`,
`npm run lint && npm test && npm run build`, and output directory `dist`. `vercel.json` enables automatic
Git deployments, including main and pull-request previews. Production Branch
must be `main` in the Vercel project's production environment settings; that
project-level setting cannot be declared in `vercel.json`.

After connecting the repository, existing commits are not a new Git push.
Merge the deployment fix PR into main to trigger a new production build.
The Vercel deployment's Git source must show `jrmoyler/Corporate-Claw`, `main`,
and the resulting merge commit. PR branches should produce previews.

The build verifies both `public/models` and `dist/models`: the agent GLB must
contain its skeleton and Idle/Talk/Walk clips, and the lounge sofa must contain
geometry. Missing or malformed assets fail the build instead of shipping an
empty office. Model URLs revalidate on reload, so a previous file is not kept
under an unchanged model filename.

## Rendering correction

The office uses Three.js WebGPURenderer with WebGL2 fallback. The original
agent shader makes arbitrary storage-buffer accesses for movement and baked
bone matrices; it must not be used unchanged on the WebGL backend. Backend
selection now happens after renderer initialization. WebGPU retains the GPU
crowd path; WebGL2 uses the original rig with standard skinned meshes,
AnimationMixer, per-agent expressions, and CPU movement with spatial separation.
The same positions and behavior buffer feed picking, following and tasks.
The initial loading screen waits for an actual first render.

The source character GLB also contained 76,888 trailing bytes after the declared
GLB end. Those bytes are removed; its JSON, binary chunk, meshes, materials,
skeleton and clips are unchanged. The lounge asset remains unchanged.

## Verification scope

Local TypeScript validation and 11 tests pass, including parsing the real agent
rig, cloning/animating its three skinned meshes, expressions/material visibility,
population disposal, waypoint arrival, frame-rate independence, boundaries and
obstacle handling. Image decoding is stubbed in the Node rig test; this is not a
GPU render test. The build checks exported model assets as well.

The connected browser reproduces the production renderer startup failure:
WebGPU is unavailable and WebGL context creation returns null. Consequently
this browser cannot provide visual 3D acceptance or device performance numbers.
A browser with WebGL2 or WebGPU is still necessary; no application fallback can
create a graphics context when both are disabled. On a compatible device,
verify office furniture, moving agents, selecting/following a colleague, click
to move, pause/resume, reset view and the furnishing viewer.

Existing production model downloads were checked against main's Git blob hashes
before changes. Both matched, so stale deployment alone did not explain the
reported missing 3D view. The previous production deployment has no Git source
metadata; a fresh Git deployment must be verified separately.

Vercel successfully created a Git-source preview of PR #5 after its branch was
pushed. GitHub Actions could not start because the account is billing-locked;
the same typecheck and tests therefore run inside the Vercel build itself.
The new standalone Actions workflow was removed before merging.

## September 14 verification — supersedes the unresolved Git-link warning above

Production `corporate-claw.vercel.app` was verified through Vercel deployment
`dpl_BXyP49GSrVxsPs9kKrzR5KnvM9XT`: `READY`, `target=production`, `source=git`,
`githubCommitRef=main`, SHA `9d1f4535369cf21928561daa79421a5db154b48f`.
The domain is an alias of that deployment. Main's Git commit matches exactly.
No additional Vercel configuration change is needed to repair that deployment.

The reference reconstruction replaces the office's downloaded cartoon character
with a bundled procedural adult skeleton and Idle/Talk/Walk/Sit clips. The old
GLB remains a historical asset; the sofa GLB still serves the furnishing viewer.
The new rig is validated by `tests/reference.test.ts`. Both rendering backends
now share CPU navigation around furniture and partitions; WebGPU still instances
and skins the visible crowd on the GPU. WebGL2 retains ordinary cloned skeletons.
Untextured skin, hair and clothes now remain opaque on the GPU path.
