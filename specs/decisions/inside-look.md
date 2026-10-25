# inside: the look

**Context.** The spec leaves the materials and the camera to the worker, and asks for them to be logged.

**Choices:**
- **Materials:** small textures drawn in code (felt speckle, maple grain, keybed) on MeshStandardMaterial, with
  steel at metalness 1 and roughness 0.25. Lighting is a RoomEnvironment, a warm key light and a cool rim, as in
  pinned.
- **Two views:** "One key" is a side section of the key whose stroke began last, with the parts named over them.
  "All 88" shows instanced keys, hammers, dampers and strings, from front and above.
- **The damper's lift is also its colour.** It is dark at rest and turns the kit's blue as it lifts. The true 8 mm
  lift barely reads at row scale, and colour shows the pedal's wave without exaggerating the travel.
- **The camera** sways ±10° about the target over 24 s, and drag orbits it. A view switch is a 0.8 s move.
- **Reduced motion** is followed live: no sway, no string shimmer, view switches jump, and parts snap to each
  state's position (`snap` in `action.ts`) instead of travelling.

**How to undo:** `lookSettings` in `scene.ts`.
