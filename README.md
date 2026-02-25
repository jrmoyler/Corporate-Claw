# Autonomous Characters Lab

Three.js WebGPU simulation of a small city with autonomous characters and a player-controlled agent.

## Features

- 100 instanced characters (1 player + 99 NPCs).
- GPU compute for movement, CPU logic for behaviors.
- Click-to-move player, NPC selection, and encounter detection.
- Debug panel with world and behavior visualization.

## Tech Stack

- Vite + React + TypeScript
- Three.js (WebGPU)
- Zustand

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the dev server:

```bash
npm run dev
```

3. Open the app at the local URL shown in your terminal.

## Scripts

- `npm run dev` - Start the development server.
- `npm run build` - Build for production.
- `npm run preview` - Preview the production build.

## Project Structure

- `three/` - Rendering, compute, input, and behavior logic.
- `components/` - UI and debug panels.
- `store/` - Zustand store for UI and runtime state.
- `data/` - Static agent data.

## License & IP

License & Intellectual Property
This project follows a dual-licensing model to distinguish between the functional source code and the creative artistic assets:

Source Code (MIT)
All source code files (.js, .jsx, .css) are licensed under the MIT License.
You are free to use, copy, modify, and distribute the code for both personal and commercial projects. See the LICENSE file for full details.

3D Models & Assets (CC BY-NC 4.0)
All 3D models (.glb, .gltf), textures, and custom environment maps located in the /public/models directory are Copyright © 2026 Arturo Paracuellos (unboring.net) and are licensed under Creative Commons Attribution-NonCommercial 4.0 International.

Attribution: You must give appropriate credit to Arturo Paracuellos (unboring.net).

Adaptation: You are free to remix, transform, and build upon these assets.

Non-Commercial: You may not use these assets or their derivatives for commercial purposes.

To view a copy of this license, visit: CC BY-NC 4.0

Developed with ❤️ by Arturo Paracuellos
