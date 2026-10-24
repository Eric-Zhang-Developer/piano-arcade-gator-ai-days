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

Pause clarification012: freeze hold time; preserve a still-held key through resume, process releases at frozen chart time and ignore new performance attacks during pause. Add an optional internal InputEvent.cancelled flag for disconnect: clear the held state without inventing a physical release in serialized Take. This prevents reconnect/retrigger from filling an unknown disconnected interval. V2 stored null releases receive zero final hold credit; overholds with real release evidence are clamped at target end. No GameEvent variant or migration is needed.
