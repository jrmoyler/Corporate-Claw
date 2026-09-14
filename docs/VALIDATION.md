# Corporate Claw upgrade verification

## Passed

- `npm run lint`: TypeScript compilation without errors.
- `npm test`: five server-boundary tests cover request method, malformed/cross-origin requests, content/history bounds, and missing-key handling.
- Production Vite build succeeds. Main bundle ~511 KB gzip; Babylon furnishing viewer is lazy-loaded (~458 KB gzip) and no longer ships the entire Babylon barrel (~1.6 MB gzip).
- Vercel builds the app and `/api/chat` server function successfully.
- Connected browser, production URL: recovery to team workspace, agent search, selected profile, dashboard open/close, training answer gate, successful completion, persistence after reload, and disabled repeat completion.
- Blender 4.3.2 exports the original sofa; actual exported GLB was re-imported and rendered from front/rear. Both inspected: connected cushions, base, arms, feet and pillows; no floating pieces.
- Credentials no longer appear in the browser service or Vite define block. Server-only key missing yields HTTP 503, not an import-time app crash.
- Behavior allocation uses only the active roster. Changing the count reconstructs the behavior buffer. Population range 10–2000 remains available; physical office dimensions are fixed to the existing furniture layout.

## Visual comparison

Concept: `visuals/office-concept.png`. Browser capture inspected at 1363 × 936 (connected browser did not expose viewport resizing). The concept itself is 1536 × 1024.

1. Navy header and footer and warm ivory sidebar match the chosen visual direction.
2. Serif brand and sidebar heading, compact sans-serif controls and clear text hierarchy are implemented.
3. Persistent header navigation and sidebar replace the disappearing branding and floating controls.
4. Search and directory rows use real active-agent records; the concept's five department rows were intentionally expanded to a searchable roster.
5. Solid panels and thin borders replace translucent glass surfaces. Added recovery copy is intentional for graphics-unavailable environments.
6. The generated room plan was not copied: existing furniture slots, collisions and character assets are preserved. Sofa, plants, cutaway elevations, lighting and floor colors are upgraded with actual geometry.

The main 3D scene and Babylon viewer cannot be visually signed off in this environment. Browser reported WebGPU unavailable and WebGL context creation returned null (`getSupportedExtensions`). Local Chromium startup was denied at OS socket creation. Automatic approval review rejected uploading a deployed-app screenshot to an external Higgsfield/S3 sandbox; that upload was not performed. No passing screenshot or FPS result is fabricated. The inspected browser screenshot is the honest graphics-unavailable workspace, not a substitute for a 3D render.

## Remaining gates

- A hardware-accelerated browser/device must verify rendered office composition, character movement/picking, pause/resume, resize, pinch gestures, the Babylon furnishing viewer and performance. No physical-device claim is made.
- Set server-side `GEMINI_API_KEY` in Vercel and redeploy to enable live agent chat; no credential was available in this project. Live provider responses remain unverified.
- The image2threejs exact-reference pipeline remains incomplete, as recorded in its state and reconstruction ledger. Blender asset checks are separate from exact-reference acceptance.
- This release is directly deployed to Vercel; GitHub-to-Vercel automatic deployment is not connected by this action.

## Reference reconstruction PR — current verification

The previous Git-link statement is superseded by the deployment evidence in
DEPLOYMENT.md: production is a successful Git build of main `9d1f453`.

This revision replaces the room layout, adds reference-derived furnishings and
adult suited skeletal figures, and restores the five initial department rows.
The software geometry inspection identified and corrected camera framing,
reception placement, lounge chair scale, living-wall planters and parquet
orientation. It is **not** a browser screenshot, lighting acceptance, or evidence
of identical reference fidelity. The figures' unseen anatomy and faces are inferred.

Typecheck and 14 tests pass, including actual suited-mesh deformation, independent
walking/seated clones, material opacity, clear task destinations and navigation
around partitions. Both backends share those navigation rules. Existing chat
boundary, crowd state and GLB preservation checks also pass.

Current browser limitations: production reports WebGPU unavailable and a null
WebGL2 context; localhost access returns ERR_BLOCKED_BY_CLIENT. Blender's Python
package was unavailable and system installation failed under environment
permissions. No security restrictions were changed. A software rasterization of
actual geometry was used only for structural inspection. GPU lighting, shader
execution, touch performance and full visual fidelity remain unverified.
