---
name: "UI foundation: clear play states and a consistent responsive shell"
depends_on: ["core-loop", "timing-feedback", "piano-sim", "judging-tiers"]
owns: ["web/src/ui/", "web/src/app/globals.css", "web/src/app/layout.tsx", "web/src/app/loading.tsx", "web/src/app/error.tsx", "web/src/app/not-found.tsx", "web/src/app/play/", "web/src/app/sim/", "web/ui-e2e/"]
assignee: ""
---

# UI foundation

Issue: [UI foundation](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/84).
Users can identify the current screen, enter the existing game, understand real loading/device states, recover from
failures, and reach controls on a narrow screen. The latest request defers the name, logo and final brand while the
identity is decided: keep Piano Arcade and its existing dark, mint-accented design provisionally. This is a bounded
foundation on the current app, not a final brand or a replacement application; brand work needs its own spec.

## Plan
1. Add a few shared presentation primitives and CSS tokens, reusing current styles and components.
2. Compose them into the play menus/results and simulator shell, with accessible navigation outside active play.
3. Connect loading, error, retry and empty-state presentation to real chart requests and existing device callbacks.
4. Run the app checks, behavioral regression tests, live screen inspection and retained visual evidence below.

**Coordination:** judging-tiers is done on main (its done note is in `changes/`); its play-page and existing e2e
behavior must be preserved, and no path is removed from its spec. UI tests live separately in `web/ui-e2e/`; existing
verify scripts remain unchanged. Core-loop, timing-feedback, piano-sim and judging-tiers are done, so their
presentation paths can be claimed without changing their specs. The assignee is empty: this spec claims no person or lane.

The owned play/sim paths permit additive presentation and chart-request recovery only. Keep the existing
`?song`, `?input=test`, MIDI simulation parameters, test IDs, Start/Retry controls and simulator's first-button
Start/Retry integration working as they exist when implementation begins. Read active changes again before edits.
Song-select keeps `/` and its chart discovery/selection behavior; this feature does not edit that page or
`web/src/game/song-select/`. Do not change other feature owners, AGENTS, CODEOWNERS, contracts or game folders.

## Requirements

**Shared interface:** centralize existing background/text/accent, typography, spacing and control/focus tokens in
`globals.css`. Add only the small reusable shell, actions and status/feedback components needed by these screens.
Use readable content widths, clear headings and consistent buttons, links, disabled states and visible keyboard
focus. Global styles must not change canvas dimensions, game layers or unrelated routes' deliberate designs.

**Navigation and layout:** provide compact links to the existing front door and play/simulator routes where useful,
with an accessible current-screen label. Do not advertise routes that have not shipped. Preserve the front door's
behavior when it is still a redirect. Hide general navigation during play and in the simulator's embedded game;
keep the highway window-sized. Ready, error and results overlays scroll when content exceeds the viewport. At a
narrow width, the simulator shell stacks its game and controls; wide logs scroll within their own region. Preserve
virtual-key interactions, fault controls, profile sources and fixture-recording behavior on `/sim?record`.

**Chart requests:** `/play` and `/sim` show a named pending state only while their chart request is unresolved.
Check HTTP status and validate the chart before using it. Distinguish failure from a valid chart and show an
actionable retry plus an existing-route escape. Retry performs a real new request, disables duplicate retry while
pending, and clears stale error state only as appropriate to the request. Ignore or abort stale requests on retry
and unmount. A failed or invalid response must not enable Start, the simulator bot or virtual chart keys. Show an
honest empty MIDI-log message until messages arrive; do not invent song or device data. Route boundaries give a
meaningful pending state and retry/home recovery for uncaught route failures using the installed Next.js APIs.
No artificial delays, percentages, fabricated stages, fake skeleton data or progress unrelated to actual work.

**Devices:** surface existing MIDI acquisition outcomes, including pending, connected, unsupported, no input and
denied/error with laptop-key fallback. Pending begins only when acquisition actually starts and ends when the
existing device start/status path settles; do not move MIDI permission requests or delay the game clock. Allow
another attempt through the existing Start/Retry lifecycle. Do not claim a live connection before the device
reports one, or infer disconnection from silence. MIDI watchdog owns stalls/reconnection; compose with its shipped
status mechanism if available, without reimplementing it or changing input/audio behavior. A device state that
cannot be observed through existing interfaces stays unknown and is reported as a gap, not simulated.

**Accessibility:** retain one main landmark per document, meaningful heading order, accessible labels for controls
and frames, logical Tab order, visible focus and status/error announcements. Keep recovery controls keyboard
operable and focus the useful next control/heading after transitions without stealing focus during play. No new
letter-key UI shortcuts or global handlers that swallow gameplay input. Any animated UI loader respects
`prefers-reduced-motion` with a static equivalent. Color alone must not communicate status.

**Preservation:** keep highway sizing/rendering, judging/timing/scoring, MIDI/audio scheduling, input mapping,
simulator protocol/faults and timing-feedback calculations/latency suggestions unchanged. Keep all results rows and
their real values, including judging-tiers' GOOD/WRONG. No dependencies, framework migration, final name,
logo, paid services, teaching logic, authentication, invented catalog, metrics or dashboard.

## Validation

- Run all Checks in `specs/tech-stack.md` using the feature title and retain their command output.
- Add behavior tests in `web/ui-e2e/` using installed Playwright and an actual running app; provide a documented
  runnable command. Intercept chart responses to assert unresolved request -> pending and disabled actions;
  HTTP failure, malformed JSON and invalid chart -> actionable error; retry with valid chart -> ready and enabled
  actions. Exercise both `/play` and `/sim`, including a retry/unmount race that cannot restore stale state.
  Execute UI behavior rather than grep or snapshot implementation strings. Do not weaken existing tests or verify.
- Exercise the existing MIDI acquisition interface with controlled Web MIDI responses in browser tests: unresolved
  permission -> pending; connected fake port -> actual device name; unsupported, empty inputs and rejected access
  -> truthful laptop fallback. Assert permission starts on Start and gameplay is not held up by permission. Preserve
  test-input and simulation paths. No physical hardware claim follows from these tests.
- Run `python3 .agents/scripts/verify.py --slug ui-foundation --worktree .` successfully, retaining its evidence and
  exact printed verdict. Its existing Perfect-player game and simulator checks must continue to pass.
- Run the app and inspect it with `chrome-devtools-axi` after reading its help. At 1280x800 and 375x812, visit `/`
  then `/play`, `/sim` and `/sim?record`: headings/actions are readable, overlays scroll, controls are reachable,
  simulator columns stack, and the document has no unintended horizontal scroll. Confirm navigation is absent
  during play and from the embedded game. Preserve before/after screenshots of actual ready, results and simulator
  screens, including narrow views, in the task evidence directory; record exact URLs/viewports and observations.
- In that browser, Tab/Shift-Tab through navigation, Start, latency, retry and simulator controls; Enter/Space
  activate the focused action and focus remains visible. Delay/fail a real chart request using browser tooling or
  the behavior-test harness, inspect pending/error, retry -> ready and retain the observations. Inspect the empty
  log before messages arrive, then use the simulator bot -> real results and MIDI log. Verify the same gameplay
  keys still reach the game and reduced-motion emulation leaves any loader static. Record console errors honestly.
- Report commands, screenshots and any excluded state/tool blocker. Real piano testing remains Eric's; mark it
  untested unless he supplies evidence. Write `changes/ui-foundation.md` last with the verify line and all gaps.

## Defaults

Prefer small reversible presentation components and composition over gameplay rewrites. If an existing interface
cannot truthfully expose a state without another feature's internals changing, ship the independent coherent
foundation and record that excluded enhancement and its dependency; do not invent a substitute state or expand
ownership. The planning PR is only a prerequisite: human merge approval precedes implementation, which remains
outstanding until its own checks, live evidence and release note are complete.
