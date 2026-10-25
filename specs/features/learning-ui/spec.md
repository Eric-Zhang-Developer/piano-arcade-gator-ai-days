---
name: "Desktop learning frontend with four focused activities"
depends_on: []
owns: ["web/src/app/learn/", "web/src/learn/frontend/", "web/public/learning/", "README.md", "PRODUCT_PHILOSOPHY.md", "PRODUCT_AND_DESIGN.md"]
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
- The prominent gator and Up next activity stay top left. Explicit Start/Resume launches the character from its measured perch, glides along a real spatial path toward the actual prepared node while the camera follows, and settles clearly above that node and caption. Use a brief anticipation, purposeful roughly 1.2s map journey, followed by a legible roughly 550ms settle and 200ms reveal, with restrained tilt/bob/depth. The gator must visibly lead, rather than disappear during a generic zoom.
- A shared progress clock projects character and camera through the same world trajectory with a small camera lag. Arrival centers the actual skill while keeping its node/caption unobstructed. The same overlay character persists across routing until the activity visibly materializes. The prepared theory path reserves a constant-size tutor slot before revealing teaching content, retains the guide in the lesson and avoids title/score overlap or a crossfade between different crops. No generated video substitutes for navigation.
- Captions keep compact 18px/14px system-ui roles and the accepted clean paint, weights and tracking. Keep existing node-relative caption anchors continuous through travel and fade unrelated captions; do not introduce threshold detail churn or scale text as a bitmap. Check font fit through arrival and activity reveal at both desktop sizes.
- The generic journey supports every connected demo learning/retrieval mapping: phrase endings -> Learn theory; tonal center -> Review theory; short-phrase coordination/held endings -> Learn practice; steady pulse -> Review practice. Use the actual target and contextual route, never an unrelated generic lesson. The current authored prepared example stays fixed; no new scheduling or connected agent decision is implied.
- Start appears before entry, Resume only for an actual unfinished local session, and explicit Start again resets only completed state. Preserve question, draft, history, material, practice settings/results across learning navigation. Completed activities primarily return to the map; completion does not invent a new assignment or mastery update. Refresh/leaving learning clears the local preview, except theory gate progress (below).
- `/learn/understand` counts as complete only when every gate passes. A gate passes when every question is answered correctly without a reveal; a miss comes back later in the set. Stop is always available and keeps progress: gate progress is saved per device in `localStorage`, so a reload resumes it. Copy says "passed", never "mastered". See `specs/decisions/learning-ui-theory-screens.md`.
- Native button activation and keyboard focus remain usable. Lock repeated starts immediately, route once, cancel RAF/timers on unmount or offline interruption, restore the prepared action on reconnect, and honor explicit map navigation. Reduced motion uses direct entry without travel/clip animation. No sound, recording or preview take starts automatically.
- `/learn` follows the Duo look in `specs/context/visual-direction.md`: black `#030607`, panels `#0A0D15`, ink `#E2E6F0`, dim `#7D8496`, dim-ink hairlines; blue `#2B9BFF` primary, purple `#A07CFF` secondary, red `#ff4d5e` only beside a ✕; no fourth colour, no hype pink, no gradients or glows; zero radius. Saira upright condensed 600-800 for headings (no italic), a calm reading face for body, monospace for data; nothing under 16px at 1280×720; motion 150-250ms ease-out with a static reduced-motion end state. The values live in `web/src/learn/frontend/duo/` and the `--learn-*` aliases until `duo-tokens` lands, then swap to Eric's shared kit. Keep top navigation restrained. Notation sits on the paper panel, black ink on warm off-white, never inverted; music glyph fonts and geometry remain unchanged. A playing phrase is emphasized only while existing audio state reports it playing.
- The brand-preview theory lesson uses a flat full-height question/reference split, initially 40/60, based on the current Spark encoding workspace. A persistent musical-task header sits above independently scrolling question/answer history, with the current answer and one primary Check/Continue action anchored below. The material pane scrolls independently; its selected source stays open while Learn questions progress. A pointer and keyboard accessible divider respects minimum pane widths. No duplicate navigation.
- `/learn/understand` is an inquiry sandbox laid out like a code workspace: a hairline header (title, gate progress in mono, Stop), file tabs (Score on paper with Listen, Reference, Gates) and a chat panel on the right. The chat is a real model behind `POST /learn/api/chat`, keyed server-side by `ANTHROPIC_API_KEY` (never `NEXT_PUBLIC_`), model `LEARN_CHAT_MODEL` defaulting to `claude-opus-5-5`. With no key or a failed call it says plainly that it isn't connected, never a fake reply. The tutor asks guiding questions; it never gives a gate's answer, claims mastery or states unchecked facts about the student.
- Learn theory permits the reference; Review theory never shows it before the current answer is submitted. `/learn/review/theory` is a clean test: one question at a time in one bracketed panel, no workspace or reference while answering. Correct shows in blue with the word; wrong shows ✕ in red with the word and, beside the answer, the explanation of the option chosen. The end summary comes from real attempts only. Closed answers get computed feedback; open explanations compare with a reference, never fabricated semantic grading.
- Learn practice fades support; Review practice retains the score and gives feedback after a performance. Preview takes and observations are visibly illustrative, with no invented mastery or saved account claims.
- Existing cited repository score data is reused, with provenance retained. Original teaching summaries distinguish melodic closure from harmonic cadence evidence.
- Leaving a session for the map or a hub stops active audio, count-ins and preview takes; Resume restores safe stopped state and retains the underlying answers/settings/results. Offline recovery names the connection problem and sync limits, preserves in-memory answers, history, practice settings and completed results, and cancels active audio, count-ins and preview takes. The anonymous arcade, game loop, root styles, frozen contracts and dependencies stay unchanged.

## Student graph
The map's 134 fictional skills and fictional learner give way to the student graph: a full-curriculum skill graph built
ahead of time, an adaptive diagnostic at the real piano, Bayes mastery in three colours, and a model-chosen Next. Where
it disagrees with the map requirements above (fictional distributions, Secure/Partial/Low, no scheduling or agent
decision), this section wins. The code lives in `web/src/learn/frontend/mastery/`; the decisions and simplifications are
in `specs/decisions/learning-ui-student-graph.md`.
- **Graph:** JSON in `mastery/curriculum/`, one file per region (pitch, rhythm, keys, chords, expression, pieces), plus
  the backbone, cross-region links and song tags. It runs from zero to ABRSM Grade 5 theory and playing to the game's
  level. Nodes have a layer (backbone, concept, detail), a kind (declarative, procedural), `whyImportant` and sources;
  edges are in-context, analogous or contradicts, weighted 1-5 with a rationale. No prerequisite order. Every node has
  at least two items, each crediting one node. A vitest audit fails a node without a source or `whyImportant`, an edge
  without a rationale, a node with fewer than two items, or a graph that isn't one connected piece.
- **Mastery:** each node has a phase (encoding or retrieval) and a Bayes belief, updated once per counting attempt. At
  0.95 with three counting attempts on two items it moves to retrieval; below 0.6 on cold checks it goes back. Time
  never lowers the belief; it only schedules cold checks (1, 3, 7, 21, 60 days). A theory answer counts if no hint was
  revealed; a playing attempt counts if at least 70% was cold. State is replayed from append-only attempts, on the
  device until a `learning_attempts` table exists.
- **Piano evidence:** `/learn` reads Web MIDI and scores right notes in order, steadiness, evenness, legato and pedal.
  Game takes played cold at the target tempo count for their song's tagged nodes.
- **Diagnostic:** adaptive, theory and playing alternating, backbone first, the item whose node's belief is nearest 0.5.
  An answer nudges linked nodes' priors, never their colour. It stops when every backbone node is below 0.2 or above
  0.8, or at 15 minutes, and resumes.
- **Colours:** unknown (no counting attempt), in progress (encoding with evidence), mastered (retrieval).
- **Next:** `POST /learn/api/next`. Code builds candidates; Claude (the chat's key and model) picks 3-5 activities with
  a reason each; code rejects anything off the list. No key or a rejected reply falls back to the top candidates by
  score. Every decision is logged with its inputs. The student picks 1-3 goal songs, which weight the candidates.

## Validation
- `pnpm -C web test`, `pnpm -C web lint`, `pnpm -C web typecheck`, `pnpm -C web build` pass.
- In visible Chrome at 1440x900/1280x800, check the read-only map, one Start/real Resume, no manual exploration/mode/hide controls, accessible node state names and unclipped text. The map is the student graph: its nodes and the three colours come from `mastery/curriculum/` and the student's replayed attempts.
- Observe actual character departure, midpoint, arrival and page reveal, using frame coordinates and genuine captures or explicitly documented browser-only timeline inspection. Assert one shared character remains through the route, reaches the actual skill without covering its node/caption, and the page materializes without a blank interval. Record total time, both desktop sizes and caption/font fit through arrival. Static post-route screenshots alone do not prove motion.
- Follow prepared Start -> answer/feedback/edit draft/select Reference -> Back to map -> Resume. Confirm the same question, answer, history, reference and title. Check double-click guard, native button semantics/focus, offline interruption and navigation/unmount cancellation. Reduced motion must enter directly without travel/reveal clipping; distinguish a harness-tested branch from actual OS emulation when reporting.
- Unit checks cover every supported learning/retrieval target at both sizes: shared trajectory, measured perch, camera convergence, character/node/caption clearance and stable caption anchors. Obsolete manual-selection/zoom tests are removed because that behavior is explicitly removed.
- Existing activity validation remains: Learn reference available; Review reference locked until answering each question; computed closed feedback and ungraded explanation comparison; hints/audio; divider keyboard/pointer bounds; independent material/history scrolling; procedural support fading, whole-melody take/result and explicit completed repeat. Preserve honest demo/score provenance labels and black-ink staff/glyph contrast on the paper panel.
- With an owned visible-Chrome tab, `chrome-devtools-axi run < web/src/learn/frontend/offline.browser.mjs` covers prepared-entry cancellation plus all four activity recovery paths, retained state, active audio/count-in/take cancellation and fresh playback.
- At 1280×720, `/learn/understand` and `/learn/review/theory` show the Duo look (black, blue, purple; red only beside a ✕; zero radius; Saira upright; nothing under 16px). `/learn/understand` is complete only after every gate passes, a reload resumes gate progress, and the chat replies or, with no `ANTHROPIC_API_KEY`, says it isn't connected. On `/learn/review/theory` a wrong answer shows ✕ and the explanation for the option chosen, beside the answer.
- `pnpm -C web exec vitest run src/learn src/app/learn` passes, including the curriculum audit test.
- At 1280x720, `verify-mastery.mjs` (through `verify.py --slug learning-ui`) has a fresh student take the diagnostic with
  simulated MIDI and answers; it asks both theory and playing, and adapts. The map then shows unknown, in progress and
  mastered. Next returns 3-5 activities on the candidate list (the no-key fallback is fine). Two cold failures on a
  mastered node turn it back to in progress. Screenshots of the map and the diagnostic, in the Duo look.
- Run repository ownership, gate and marker checks. The repository's game verification is separate; report any unrun validation honestly.

## Defaults
Preview state is local and disposable, except theory gate progress, which stays on the device. Unknown student progress stays unknown. The model connections are the theory chat at `/learn/api/chat` and Next at `/learn/api/next`; no auth is implied, and attempts stay on the device until Supabase has a `learning_attempts` table.

## Current editable frontend

`/learn/brand-preview` is the current task-first desktop frontend baseline grounded in
[Product philosophy](../../../PRODUCT_PHILOSOPHY.md), official cross-industry
research and the user-selected upright inviting alligator. It replaces the three
rejected studies. [BRAND_STUDY.md](BRAND_STUDY.md) records source mechanisms,
actual assets, composition, motion and verification limits. The study uses the
real graph/lesson and isolated sessions, external provenance/reference controls,
replay/back/stop and continuous guide identity. The repository [product/design handoff](../../../PRODUCT_AND_DESIGN.md) and README
provide contributor entry/edit paths; their exact publication paths are included
in this feature’s declared ownership. It does not rename the product or redirect
the prior `/learn` comparison route. Check both desktop sizes, real Start/Resume, target/caption
clearance, lesson theming and accessible review controls.
