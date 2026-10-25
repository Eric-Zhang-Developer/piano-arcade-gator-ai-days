# lab-gallery: the labels, the posters, the verdict store

## Where the labels live
**Context.** The spec puts `kind`, `needs`, `poster` and `preview` on `Experiment` in `web/src/game/x/index.ts`, set
in each experiment's folder. On 2026-10-25 an open PR (#1255, `feat(inside)`) holds `x/index.ts`, and AGENTS.md
widens ownership only over files no open PR is working on.
**Options.** (A) Wait for #1255. (B) Keep the labels in this feature's own `web/src/game/x/gallery/labels.ts`, keyed
by experiment name, merged onto the registry by the gallery.
**Choice.** B. The spec's own fallback ("a folder held by an open PR keeps its entry without the fields") points the
same way, and it touches no experiment's folder. An entry with no label (a new experiment, such as `inside`) renders
as a text card. A test fails if a registry entry has no label, so the next experiment adds its line here.
**How to undo.** Move each entry's fields onto its `Experiment` once `x/index.ts` is free, and drop `labels.ts`.

## kind: the issue's labels
`wow` where the issue carries `wow` (#985, #1017, #913, #1069, #1106, #1123, #1162, #1153, #1171, #1190); `polish`
where it carries `polish` (#1127, #1167). #878 (sample) and #990 (screen-shake) carry neither, so they have no kind
and the chip shows their group (The frame, Juice). No issue carries `spike`, so none is `spike`, though the
registry comments call highlight-reel and speaking-piano spikes.

## needs: what it can't be judged without
laptop-sound (`web/src/app/layout.tsx:44`, `laptop-sound/index.ts:79-84, 142-170`) answers `requestMIDIAccess`
with a virtual output when no DGX is plugged in, so no experiment *fails* without the piano. `needs` lists what the
experiment's point depends on:
- **real-keys: dgx, camera.** It films the real keys (`RealKeys.tsx:201-203` asks for video); its overlay maps the
  DGX's keys (spec lines 21, 64). `?clip=1` replays a recorded clip instead.
- **conductor: camera.** `Conduct.tsx:228` asks for video; `?clip=1` takes an uploaded clip (`:304-307`).
- **round: dgx.** Its point is the DGX playing the round back as voices 2–4 (`round/index.tsx:51-56`); its spec checks
  the voices only on the DGX (line 119).
- **speaking-piano: dgx.** The spike's question is whether the DGX itself can speak (`Speak.tsx:53`). The mic is
  optional: three preset phrases need none (`Speak.tsx:39`, spec 59-61), so no `mic`.
- **Everything else: none.** It runs on laptop keys, a bot, a demo take or laptop sound (composers-hands, wet-paint,
  build-sonata and name-theme use the DGX when it's there, through the virtual output when not).

No experiment needs `mic`.

## The posters
Each is the in-app browser's 1280×720 frame (scaled to 800×450) of the entry's own `href` plus `&capture=1`, taken
on eric-agent-8's dev server, Next's dev badge hidden, encoded with `cwebp -q 86` (2–42 KB each). The moment:
- start screen, as the href opens: sample (its `x=sample` tag), ui-sounds-ab (its A/B panel);
- about 10 s into the bot's take after Start: screen-shake (`bot=fever`), hand-palette (`bot=perfect`), round (its
  href plus `bot=perfect`, which stands in for the player: voice 2 has come in);
- the page as it opens: conductor ("Raise a hand"), highlight-reel (the scripted take), speaking-piano (phrase A's
  spectrogram), pinned (the cylinder), name-theme (HAYDN), build-sonata (after its count-up settles, ~10 s);
- after one action: composers-hands ("Use the test roll"), wet-paint (the page's own `__wetPaint.play` hook: pedal
  down and 18 notes);
- real-keys: no camera here and no committed clip, so the honest still is its "camera off" frame, cropped to the key
  grid (112,110 576×324). It reads as dark; a shot through a camera at the venue would replace it.

## Clips
None ship (the spec's stretch). The posters carry the gallery; there is no clip trigger, so nothing plays or loads
below the fold.

## The verdict store
One localStorage key, `pianoArcade.labVerdicts` (the `pianoArcade.` prefix the capture flag uses), holding
`{ [name]: { v: "keep" | "cut" } | { v: "note", note } }`. Read through `useSyncExternalStore` like
`records/best.ts`, with an in-memory copy when storage is blocked. "Copy verdicts" dates its header with the
browser's local date, `YYYY-MM-DD`; a note left empty copies as a plain `keep`.

## The wall
The groups stay in first-seen order, but the wall runs on unbroken: with four plates a row, the one-entry groups
(The frame, Juice) left three-quarters of a row empty each. The group headings stay in the markup for screen
readers, and a card's category chip names its kind, or its group when it has no kind. "Needs nothing" gets no chip:
only real needs are marked, so they stand out.
