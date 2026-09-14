# Corporate Claw

A living 3D office with autonomous agents, searchable team profiles, conversations, leadership training and simulation analytics.

## Run

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

The office uses Three.js WebGPURenderer (WebGPU with WebGL2 fallback). A working graphics context is required for the simulation. If unavailable, choose **Open team workspace** to browse profiles, training and dashboards. The cloud-browser environment used for this PR exposes no WebGPU/WebGL context; real device 3D performance remains unverified.

## Explore

- Search and filter the active team. Select an agent to inspect their mission and start a conversation.
- Click the floor to move the CEO. Drag to orbit; scroll/pinch to zoom. Reset view returns to the office overview.
- Pause/resume the simulation from the bottom toolbar.
- Complete a training checkpoint with the correct answer. Completion persists locally and cannot be counted twice.
- Explore the original lounge sofa in the on-demand Babylon.js viewer.
- Simulation dashboard values start with illustrative seeded metrics; they are not connected to a real company's analytics.

## Deploy on Vercel

`vercel.json` configures the Vite build, `dist` output, security headers and `/api/chat` server function. The server function requires `GEMINI_API_KEY` in Vercel environment variables; `GEMINI_MODEL` optionally changes the default model. Redeploy after changing server environment variables. Do not put credentials in client-side `VITE_` variables. Local `vite` alone does not run Vercel functions; use `vercel dev` to exercise chat locally.

The current release is deployed directly through Vercel. Automatic deployment on future GitHub merges requires connecting this repository to the Vercel project; this direct deployment does not establish a Git integration.

## Assets and verification

- `scripts/build_furnishings.py`: reproducible Blender 4.3+ model authoring/export.
- `public/models/lounge-sofa.glb`: original beveled sofa, walnut plinth, brass feet and loose cushions.
- `docs/visuals/`: concept, editable Blender source and actual GLB renders.
- `docs/VALIDATION.md`: verified behavior and unresolved gates.
- `.img2threejs/state.json`: preserved, incomplete image2threejs reconstruction checklist. No exact-reference pass is claimed.

## Attribution and licensing

Original character models (`character.glb`, `character-old.glb`) remain © 2026 Arturo Paracuellos (unboring.net), CC BY-NC 4.0. Preserve their attribution and non-commercial terms. The original source project is Autonomous Characters Lab by Arturo Paracuellos. See `LICENSE` and `public/models/README.txt`.

The newly authored `lounge-sofa.glb` and its generation script are contributed specifically for Corporate Claw; they do not derive from the third-party character models.
