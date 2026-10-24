---
name: "Desktop learning frontend with four focused activities"
depends_on: []
owns: ["web/src/app/learn/", "web/src/learn/frontend/", "web/public/learning/"]
assignee: ""
---

# Learning frontend

Read the frozen [Product philosophy](../../../PRODUCT_PHILOSOPHY.md) before
product, UI or code decisions. This surface must carry its promise of a
reassuring personal tutor, useful challenge and growing independence; the
implementation choices below serve that promise.

This is the frontend slice commissioned from the published `piano-learning` plan on `seeko/work`. It does not deliver the complete learner engine, authentication, inference, scheduling, or cloud persistence. Explicit task authorization selects this bounded work independently of automatic milestone picking.

## Plan
1. Keep the accepted Spark question/workspace layout and four activity implementations.
2. Make the gator accompany the learner from a prepared map activity through arrival and page reveal.
3. Preserve Eric's visual identity, honest demo labels and real local session continuity.

## Requirements
- `/learn` is a calm, read-only guided map with one prepared activity, a short reason and one primary Start/Resume action. No Learn/Review mode choice, domain switch, node navigation/inspector, panning, zoom controls, guide hiding or recovery button is offered. The brand and Back to map remain essential navigation.
- Keep activity URLs `/learn/understand`, `/learn/practice`, `/learn/review/theory` and `/learn/play-through`. The former category hubs `/learn/explore` and `/learn/review` redirect to the map. Theory/Practice and Learn/Review still describe activity semantics; students need not choose them before following the prepared assignment.
- The graph domain follows the actual prepared skill; Theory and Procedure data remain separate. Preserve the Spark-derived six uneven broad hubs, meaningful outward fans, deeper previews and selective labels. World layout is independent x/y/z with z=0; no full 3D engine is required. Geometry, learner distributions, display projection and eligibility remain separate.
- Every node, including broad parents, uses the same three projected mastery colors/shapes. Preserve accessible noninteractive state names with Secure/Partial/Low projection and fictional/prior source. No color legend, color explanation, neutral-parent override or review-due marker is shown; internal scheduling still supports retrieval activities. Distributions are fictional examples or disclosed uniform demo priors, not measured failure, child averages or fitted posterior inference.
- The prominent gator and Up next activity stay top left. Explicit Start/Resume launches the character from its measured perch, glides along a real spatial path toward the actual prepared node while the camera follows, and settles clearly above that node and caption. Use a brief anticipation, purposeful roughly 1.2-1.8s total sequence and restrained tilt/bob/depth. The gator must visibly lead, rather than disappear during a generic zoom.
- A shared progress clock projects character and camera through the same world trajectory with a small camera lag. Arrival centers the actual skill while keeping its node/caption unobstructed. The same overlay character persists across routing until the activity visibly materializes; no blank interval or premature character removal. No generated video substitutes for navigation.
- Captions keep compact 18px/14px system-ui roles and the accepted clean paint, weights and tracking. Keep existing node-relative caption anchors continuous through travel and fade unrelated captions; do not introduce threshold detail churn or scale text as a bitmap. Check font fit through arrival and activity reveal at both desktop sizes.
- The generic journey supports every connected demo learning/retrieval mapping: phrase endings -> Learn theory; tonal center -> Review theory; short-phrase coordination/held endings -> Learn practice; steady pulse -> Review practice. Use the actual target and contextual route, never an unrelated generic lesson. The current authored prepared example stays fixed; no new scheduling or connected agent decision is implied.
- Start appears before entry, Resume only for an actual unfinished local session, and explicit Start again resets only completed state. Preserve question, draft, history, material, practice settings/results across learning navigation. Completed activities primarily return to the map; completion does not invent a new assignment or mastery update. Refresh/leaving learning clears the local preview.
- Native button activation and keyboard focus remain usable. Lock repeated starts immediately, route once, cancel RAF/timers on unmount or offline interruption, restore the prepared action on reconnect, and honor explicit map navigation. Reduced motion uses direct entry without travel/clip animation. No sound, recording or preview take starts automatically.
- Reuse Eric's current shared font roles and tokens: Saira italic 900 headings/wordmark, italic 800 menu/actions/song titles, system-ui reading/control labels. Keep top navigation restrained. Dark score panels use off-white notation including SVG text/glyph fill; music glyph fonts and geometry remain unchanged. A playing phrase is emphasized only while existing audio state reports it playing.
- Theory uses a flat full-height question/reference split, initially 40/60, based on the current Spark encoding workspace. A persistent musical-task header sits above independently scrolling question/answer history, with the current answer and one primary Check/Continue action anchored below. The material pane scrolls independently; its selected source stays open while Learn questions progress. A pointer and keyboard accessible divider respects minimum pane widths. No fake chat or duplicate navigation.
- Learn theory permits the reference; Review theory unlocks it only after submitting the current answer. Closed answers get computed feedback; open explanations compare with a reference, never fabricated semantic grading.
- Learn practice fades support; Review practice retains the score and gives feedback after a performance. Preview takes and observations are visibly illustrative, with no invented mastery or saved account claims.
- Existing cited repository score data is reused, with provenance retained. Original teaching summaries distinguish melodic closure from harmonic cadence evidence.
- Leaving a session for the map or a hub stops active audio, count-ins and preview takes; Resume restores safe stopped state and retains the underlying answers/settings/results. Offline recovery names the connection problem and sync limits, preserves in-memory answers, history, practice settings and completed results, and cancels active audio, count-ins and preview takes. The anonymous arcade, game loop, root styles, frozen contracts and dependencies stay unchanged.

## Validation
- `pnpm -C web test`, `pnpm -C web lint`, `pnpm -C web typecheck`, `pnpm -C web build` pass.
- In visible Chrome at 1440x900/1280x800, check the read-only map, one Start/real Resume, no manual exploration/mode/hide controls, accessible node state names, unchanged graph geometry/colors and unclipped text.
- Observe actual character departure, midpoint, arrival and page reveal, using frame coordinates and genuine captures or explicitly documented browser-only timeline inspection. Assert one shared character remains through the route, reaches the actual skill without covering its node/caption, and the page materializes without a blank interval. Record total time, both desktop sizes and caption/font fit through arrival. Static post-route screenshots alone do not prove motion.
- Follow prepared Start -> answer/feedback/edit draft/select Reference -> Back to map -> Resume. Confirm the same question, answer, history, reference and title. Check double-click guard, native button semantics/focus, offline interruption and navigation/unmount cancellation. Reduced motion must enter directly without travel/reveal clipping; distinguish a harness-tested branch from actual OS emulation when reporting.
- Unit checks cover every supported learning/retrieval target at both sizes: shared trajectory, measured perch, camera convergence, character/node/caption clearance and stable caption anchors. Obsolete manual-selection/zoom tests are removed because that behavior is explicitly removed.
- Existing activity validation remains: Learn reference available; Review reference locked until answering each question; computed closed feedback and ungraded explanation comparison; hints/audio; divider keyboard/pointer bounds; independent material/history scrolling; procedural support fading, whole-melody take/result and explicit completed repeat. Preserve honest demo/score provenance labels and off-white staff/glyph contrast.
- With an owned visible-Chrome tab, `chrome-devtools-axi run < web/src/learn/frontend/offline.browser.mjs` covers prepared-entry cancellation plus all four activity recovery paths, retained state, active audio/count-in/take cancellation and fresh playback.
- Run repository ownership, gate and marker checks. The repository's game verification is separate; report any unrun validation honestly.

## Defaults
Preview state is local and disposable. Unknown student progress stays unknown. No auth, backend or model connection is implied.
