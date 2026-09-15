# Department colleagues and MCP coffee trips

This PR builds on merged PR #8. The native WebGL default, existing 30-agent safety
limit, explicit WebGPU mode, office reconstruction and Vercel Git connection stay
in place. This work does not certify exact photographic likeness or phone FPS.

## Wardrobe and rig

| Department | Suit | Signature |
| --- | --- | --- |
| Executive | Midnight navy | Gold waistcoat and pocket square |
| Production | Forest green | Teal lanyard and ID badge |
| Sales | Burgundy | Copper pocket square |
| Marketing | Plum | Lilac scarf |
| Finance | Slate | Silver waistcoat and glasses |
| People | Warm taupe | Champagne scarf |

`agentAppearance.ts` is the shared contract for CPU materials, GPU per-instance
colors/accessory masks, directory avatars and department icons. Skin, hair, bun,
glasses and height vary deterministically within departments. The People team is
now included in the department directory instead of being accessible only by search.

The actual rig includes a contoured jacket, shaped jaw, lapels, flat tie and knot,
pocket flaps, buttons, brows, glasses, elbow/knee joint coverage and department
accessories. The Coffee clip moves a skinned cup and handle with the forearm; its
peak is checked against the mouth position. The cup is hidden outside coffee states
on both backends. Existing Idle, Walk, Talk and Sit clips and saved progression are
preserved. Temporary indexed source geometries are disposed after conversion.

## Connect tools

Set server-only Vercel environment variables using `.env.example`:

- `MCP_ACCESS_TOKEN`: long random office access key, entered by authorized users in
  the tool panel. It is not bundled or saved in browser storage.
- `MCP_SERVERS`: explicit server IDs, labels, HTTPS Streamable HTTP URLs, optional
  upstream bearer tokens, exact tool-name allowlists and allowed departments.

Open **Use a tool** on an agent profile, or the toolbar tool button for the selected
colleague (CEO when no NPC is selected). Connect, choose a server, choose a task,
enter its inputs and run it. Text/number/boolean/enum fields and nested JSON inputs
are supported. Results and errors are displayed alongside the office. Tools run
only on explicit submission. Ordinary Gemini chat does not invoke tools or start
coffee trips; no keyword pretending to be an MCP invocation was added.

The new `/api/mcp` endpoint uses the official TypeScript SDK's Client and Streamable
HTTP transport for initialization, discovery and invocation. It requires the office
access key, checks same-origin browser requests, enforces server/tool/department
allowlists and never accepts an arbitrary destination URL from the browser.
Upstream tokens never reach the client. Redirects are refused; per-request clients
and sessions are closed in `finally`. A request has a 23-second transport deadline
inside the 30-second Vercel function budget. There is no automatic retry of a tool
call, because tools can have external side effects. Stop waiting cancels the local
request; the UI explicitly says the remote tool may still be running.

SDK source/documentation: https://github.com/modelcontextprotocol/typescript-sdk
and https://ts.sdk.modelcontextprotocol.io/ . No real MCP endpoint or upstream
credential was supplied or enabled in this session. The app reports unconfigured
connections instead of presenting fixture tools as live integrations.

## Coffee lifecycle

All application tool dispatches go through `mcpService.callTool`. Its start/finally
notifications drive a queued `CoffeeBreaks` controller, including request failure
and cancellation. Discovery is not a tool invocation and does not start a trip.
Concurrent calls for one colleague share the break until all settle. Colleagues
queue for one machine; waiting colleagues continue their current work. Normal
coffee tasks yield the machine to tool work.

The controller snapshots the interrupted state and waypoint, walks the colleague
around real office obstacles, plays at least one 2.4-second sip even if the request
was fast, then walks back and restores the prior state/waypoint. Normal task expiry
is postponed by the interruption duration. Simulation pause also pauses the trip.
Chat and player waypoint actions cannot overwrite an active coffee trip. A
90-second route watchdog restores the saved position/state if navigation stalls.
Population rebuilds dispose old trips and replay still-active requests only for
indices in the new population. Returning calls, overlapping requests and disposal
cannot leave a permanent COFFEE state.

## Verification

Tests exercise actual generated meshes and clone colors, independent identity
variation, cup skinning and mouth reach, shared GPU appearance attributes and
baked Coffee matrices, actual obstacle navigation to the machine, queuing,
overlapping/fast/failed requests, state restoration and BehaviorManager integration.
MCP tests perform a real SDK initialize/list/tools-call exchange against an
in-memory protocol server; API tests verify unauthorized requests never reach the
executor and credentials do not appear in discovery. Browser-service tests verify
start/settled pairing for success, tool errors, network errors and cancellation.

The previous cloud browser limitations still prevent a rendered GPU/phone sign-off.
No software or generated render is substituted for the live application. Inspect
the Vercel preview on an accelerated browser for garment appearance, Coffee pose,
mobile tool-panel behavior and runtime performance before visual acceptance.
