# Local interaction upgrades

User requirements relayed through firstmate on2026-10-24: working Home links, faster/skippable initial countdown, faster resume; explicit early/late and hold feedback; original quiet browser lobby music and physical-piano menu navigation. Requested commercial songs require authorized user assets. This local-only branch preserves the preceding sourced-meter/epoch fixes; no remote publication or merge is authorized.

## Stage1: navigation and countdowns

- Home targets `/` directly on play setup/live/pause/results, simulator and other arcade workspaces. Sheet gets an in-flow Home link. Preserve existing learning, progress and calibration links to the same root. Hide redundant navigation inside the simulator iframe.
- Initial countdown is3 musical pulses; resume is1 pulse, using the existing sourced meter and selected-tempo timing. Chart note times/BPM and onset windows stay unchanged. Both countdowns expose an accessible Skip button.
- Initial Skip cancels the old take and starts a fresh transport without a count-in. Do not seek only the game clock: that would diverge from recording plugins' songStart epoch. Hide initial Skip when the first-note early window opens so it cannot discard a valid accepted early note. A cancelled take emits quit, not songEnd, and is not submitted as a completed score.
- Leaving/restarting stops that take's input/frames and emits quit to its output/audio plugins. Cancel pending MIDI permission/attach work, including the watchdog; it must not restore stale handlers after Home or Skip.

Validation: silent behavioral tests for normal/reduced tempo and4/4/12/8; cancel before MIDI permission resolves; isolated muted browser tests of initial skip, pause, resume skip and Home; repository lint/typecheck/unit/build checks. Prior longer-countdown assertions change because the user explicitly requested shorter counts; musical pulse/epoch assertions remain.

Later stages must document any versioned scoring/shared-format boundary before implementation. No commercial score transcription or fake song entries.

## Local additive sustain contract (firstmate authorization011)

New takes explicitly opt into scoringVersion2. Missing/1 remains original onset-only; no migration or re-judgment of stored rows. Version2 Results may add a sustain summary with per-note bounded hold credit, distinct from timing grade/rank. Existing note-on/off fields carry performance evidence. No new GameEvent shape is required. The API must preserve/check the version; row metadata and local record namespaces follow the actual policy, not a global reinterpretation. Unknown releases cannot earn invented duration. This local-only additive contract draft has no upstream/other-lane approval and does not authorize database/schema/auth changes.

Pause clarification012: freeze hold time; preserve a still-held key through resume, process releases at frozen chart time and ignore new performance attacks during pause. Add an optional internal InputEvent.cancelled flag for disconnect: clear the held state without inventing a physical release in serialized Take. This prevents reconnect/retrigger from filling an unknown disconnected interval. V2 stored null releases receive zero final hold credit; a confirmed hold still down at finish is closed at the finish cutoff (frozen pause time if paused) in live, saved and replay takes, while cancelled/disconnected holds stay null; overholds with real release evidence are clamped at target end. No GameEvent variant or migration is needed.

Exact recording-clock counterexample: save-plugin runs after audio initialization in layers order, so sampling its own performance.now at songStart can shift saved onset/release times while core judging is correct. Add optional GameEvent.performanceMs for matched phase-event readings, supplied by core for songStart/pause/resume/quit. V2 save/replay and beat use that pair rather than later dispatch time. Older event producers retain the fallback; no Take/DB wall-clock fields or new event variant is added.

## Stage3: lobby and piano menus

Browser-only original108BPM four-bar instrumental is opt-in, quiet at12%, with volume/on preference stored locally. Remembering enabled does not bypass the next browser gesture. Route departure and transport start cancel scheduled voices and pending resumes; background stalls skip missed beats. It sends no MIDI output. Song previews are quiet while music or piano menus are enabled.

Explicit Enable piano menu uses the existing MIDI permission/Portable Grand selection. B2 Home/close, C3 Previous, D3 Next, E3 Select traverse real focusable controls. Each note requires release before another action; presses during performance are tracked to avoid accidental confirmation when results open. A single native-message dispatcher supports separately cancellable menu/game subscriptions. Interpretation is disabled from count-in through playing, and on learning/sheet/calibration/simulator routes that consume musical input. Laptop controls retain their behavior. No autonomous permission prompt or automatic musical playback.

Requested Come As You Are and Billie Jean assets remain unavailable after bounded repository inspection. Accept authorized MIDI(.mid/.midi), MusicXML(.musicxml/.mxl) or chart JSON with source/license permission; add no placeholder songs or reproduced commercial score. This asset dependency is separate from the independent improvements.

## Pressed-key visibility follow-up015

Both white and black pressed keys use saturated orange fill with a dark/white outline and geometric end bar; matched-hand color remains a top accent/glow. Upcoming notes and hold targets retain their existing colors/shapes. This is paint-only: preserve noteoff, pause and judging semantics. Future LEDs require the actual strip/controller model; no hardware changes or new output path are authorized. Existing wrapInput/onEvent/phase cleanup hooks are summarized in the local LED evidence note.

## Forgiving timing, local excerpt and speaker fallback (firstmate017–022)

Billie Jean is cancelled. Come As You Are is a32-second credited gitignored local melody/bass excerpt from public BitMidi80612.mid (SHA256 in the adjacent local provenance), using the existing converter and recursive local catalog. It is not a full-length openly licensed piano arrangement. Constant120 quarter-BPM; source8/8 becomes four quarter-note beats/bar in existing Chart format, canonical4/4 display; bar lengths/absolute onset timing remain unchanged.170 selected onsets become165 after5 duplicate unisons merge. No agent transcription or program changes imported. Local songs already skip server takes.

Firstmate021 authorizes optional Take.scoringVersion3 using the existing local version machinery. V1/v2 remain25/50/100ms and150ms near-miss; new v3 is31.25/62.5/125ms and187.5ms near-miss. Uniform1.25 scale, inclusive boundaries, same pitch required, honest sustain algorithm unchanged. SustainSummary stays version2 because its algorithm/format is unchanged. Live/save/server/replay use the actual policy; v3 MIDI marker, row metadata and record namespace stay distinct. No new database/auth/schema operations. Explicit1/2 and unmarked historical files retain their policies.

Speaker diagnosis: observed lobbyOff plus Preview:laptop tones; old preview code already used a triangle oscillator, with no sampled piano assets in this app. The newly imported band programs cannot cause this because they are not imported into Chart.voice. Replace only browser fallback with a percussive fundamental/faster-decaying harmonic partials shared by preview/replay/wait hint, truthful synthesized-piano label and owned-node stop. This is piano-like synthesis, not a sampled instrument. Lobby remains opt-in and excluded from song playback. No instrument library, no physical-piano settings/output test; user hearing remains the final audible check.
