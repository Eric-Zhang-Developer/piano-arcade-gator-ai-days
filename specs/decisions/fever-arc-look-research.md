# Fever look: research (read-only pass, 2026-10-25)

Method: existing reference notes re-read, plus four fresh GH3 frames (ffmpeg, scratch `/private/tmp/claude-501/fr/gh.jpg`).
Web search not run: arcade-game specifics below marked **(memory)** are general knowledge, unverified here.
**PianiCast clip: no file found** (`find ~` and `find /` for `*pianicast*`: nothing). Only its spec mentions
(`specs/features/hit-particles/spec.md`, `specs/decisions/key-polish-*.md`) exist; no frames to study.
GH3 = `video-references/Guitar Hero 3 - Through The Fire and Flames ... [WMkjmiVo6jA].mp4`.

## (a) What each reference does

**GH3 Star Power** (GH3 1:30-1:42, frames 1m34s, 1m36s, 1m41s; fresh frames at 90/92/94/96 s)
- Entry: *telegraphed.* Meter tubes light up and "Star Power Ready" shows (1:00), so the player chooses the moment. The
  activation (~1:34.0, a phrase boundary, a section change in the song) flips the whole scene in about 1 s.
- Sustain (~7 s): cyan-white electric arcs run along both highway edges (light-blue on a dark lane, at 94 s the
  arcs are the strongest "on" cue); gems, sustains and lane beams all go cyan; multiplier dial jumps x4 to x8 and
  changes colour; the stage behind goes over-exposed and washed pale (96 s). HUD stays in place.
- Release (~1:41): instant snap back to lane colours and x4. No fade; the reference simply stops.
- Read-in-a-thumbnail: edge arcs + brightness shift. Costs readability: all gems share one colour.

**NOSTALGIA FLOWER** (nostalgia-flower.md; findings lines 89-129; no fever mode, but the nearest "payoff" grammar)
- Heightened cues are all brief and centred: ghost number at each 100 combo (grows to 1.65x, fades in ~0.5 s,
  1:18.83 and 2:32.60); background sepia to blue crossfade (~1:21, lasts a few seconds); rank badge plus gold corner
  ornaments arrive together (2:07).
- End: full-width purple-white glow wash over the hit area, about 1.0 s (2:38.95 to 2:39.95, peak at +0.25 s), then
  "Full Combo!" script writes in 0.25 s after the wash ends and holds 3.75 s. Sound: click, then music-box notes.
- Nothing sustained: the state is carried by the number and a ring that lingers on the bar.

**CHUNITHM** (chunithm-hands.md 0m30s, 0m59s, 3m03s; chunithm-chart.md)
- Sustain: a huge combo number sits at ~40% highway height with notes drawn over it; hits throw a ring plus star burst
  and a light column at the line. Layout never changes during the song.
- Release/end: FULL COMBO is a large gold 3D banner over a dimmed highway with white streak lines (3:03). Near-silent.
- No mid-song state change seen.

**Others (memory, unverified here):** Rock Band Overdrive and GH Star Power both pair a coloured highway/edge change
with a multiplier bump. Taiko go-go time lights the lane and turns the backdrop into a burst with a dancing crowd
(sustain is the lane, not the notes). osu! kiai time pulses flashes and fountain particles on the beat, the effect is
a beat-locked "breathing" of the field. DJMAX fever and Sound Voltex: unsure of details; skip.

## (b) Ranked moves (read-as-fire per effort)

1. **Beat-locked pulse of the whole field during fever** (osu! kiai, memory; GH3 stage pulse). A 6-10% brightness/glow
   swell on each beat, 150 ms decay. Hint: `arcAt` beat phase -> one `globalAlpha` curve on the edge glow and star layer.
2. **Edge arcs, not edge wash.** GH3's lightning on the highway edges is its strongest cue (94 s). Hint: draw 2-3 jittered
   polyline bolts per side in `lighter` composite, regenerate every 60-80 ms, 1-2 px core + gradient halo (no shadowBlur).
3. **Heat from below.** Amber glow rising from the hit line, taller on beat and with combo. Hint: vertical gradient quad
   over the bottom 20% at `lighter`; add 20-40 embers (WebGL layer) with upward velocity, ~1 s life.
4. **A 1.0 s ignition wipe** (Nostalgia end wash, GH3 ~1 s flip): bright band sweeps outward from the hit line,
   peak at +0.25 s, gone by +1.0 s, quantized to the beat. Hint: scaleY'd gradient, ease-out; fire once per `ignite`.
5. **Milestone ghost for the multiplier** (Nostalgia). On entry, a 1.65x translucent copy of the combo or "FEVER" swells
   and fades in 0.5 s. Hint: draw the text twice, second with scale+alpha tween.
6. **Dial/multiplier change with a visible tier colour** (GH3 x4 to x8, blue). Gives a number that reads without text.
   Hint: amber tier only for fever, never reuse for hands.
7. **Tint the hit line and key strip amber, not the notes.** Hands keep their colours (the GH3 mistake is recolouring
   every gem). Hint: amber rim (1-2 px stroke) on the line, keys glow, notes get an amber rim only.
8. **Asymmetric release: a cut-then-drain.** GH3 snaps; ours should snap the pulse and arcs (instant, quiet) and drain
   the heat glow over 400 ms. Hint: separate `arcAt` progress for "cut" and "drain".

## (c) Avoid

- Recolouring all falling notes to one hue (GH3 star power): the hand colour cue disappears when it matters most.
- Full-field over-exposure (GH3 96 s): washes out the dark Duo field and notes lose contrast. Cap added luminance in the
  note lanes at about +10%; put the brightness at the edges and above the line.
- Per-frame `shadowBlur`/filter blur at 1080p (findings: "the one trap"); use gradient sprites.
- Sustained full-screen strobing or shake: tiring on a big screen and fails reduced motion. Pulse only on the beat grid.
- A loud release. A miss/break should be quieter than a hit (miss-moment principle).
- Particles over the falling-note area at high density; keep embers behind the notes and below the line, or very sparse.
- Banner text crossing the lanes; GH3 and Nostalgia both keep milestone text above/outside the note area.
- Hard facts I could not verify: Nostalgia's and CHUNITHM's lack of a fever mode comes from our own notes, not an
  exhaustive watch; PianiCast and the arcade games listed as "memory" were not checked.
