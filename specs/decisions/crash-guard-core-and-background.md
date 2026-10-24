# crash-guard: core's guard, the background's hook name, where the layer is cleared

**Context.** The spec fixes `createGuard(onFail)` → `{ run, off }` for plugins and says core's own throws are logged
once per distinct message. It doesn't name the helper for core, the hook name for a background's frame, or where an
off plugin's layer is cleared.

**Options.** (A) Core uses `createGuard` under a fake id. (B) A second, smaller `coreGuard()` that never turns
anything off. For the layer: (1) clear it in the draw loop when `run` fails; (2) clear it in `onFail`.

**Choice.** B: `coreGuard()` returns `(what, fn)`, logs `crash-guard: <what> threw: <message>` once per distinct line,
one per take. A fake id would turn core "off" after its first throw, which is the freeze again. The background's hook
is logged as `background`, under the id of the plugin that owns it. The layer is cleared in `onFail` (2), from the
canvas ref, so a plugin turned off by its `onEvent` (before or between draws) doesn't leave its last frame on screen.

**How to undo.** Swap `coreGuard` calls in `web/src/app/play/page.tsx` for `guard.run("core", …)` and drop
`coreGuard` from `web/src/game/crash-guard/guard.ts`.
