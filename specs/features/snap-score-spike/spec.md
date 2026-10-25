---
name: "Snap-score spike: Claude's vision reads a phone photo of a printed score into a chart, scored against the library"
depends_on: ["level-forge", "song-pack-1", "minuet-g"]
owns: ["specs/features/snap-score-spike/", "changes/snap-score-spike.md", "spikes/snap-score/", "specs/decisions/snap-score-spike-"]
assignee: "eric"
---

# Snap a score (spike)

Issue #518. Eric, 2026-10-25, on spikes: "We have a lot of agent hours ... Treat it as near-infinite. But the problem
is the humans." So the answer is measured by code against charts we already trust, and Eric's part is three phone
photos. A tech spike (decision 004): it reads from the game and never edits it. The mission puts AI around the
playing loop, never in it; reading a photo into a level runs before play.

Level forge (done) turns a public-domain MIDI file into a level. This asks whether a photo can stand in for the file.

## The question
Can Claude's vision read a phone photo of a printed public-domain score page into a chart whose notes match our
committed chart of the same piece?
- **Yes:** for at least 2 of the 3 pieces below, the photo's chart matches ≥ 90% of the committed notes (`forge
  diff`: pitch, hand and beat within 1/12) and passes the library's rules.
- **No:** fewer than 2 of 3 reach 90%, or the recall control (below) matches as well as the photo, which would mean
  the model knew the piece rather than read it.
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state; with no phone photos yet, it
  reports the clean renders and says "photos pending". Start by 09:00 ET: no new spike work after Sun 2026-10-25
  12:00 ET.

The 90% bar is the planner's; level-forge's bar for a MIDI source was 95%.

## The pieces
Each has a committed chart from a Mutopia file, so the photo and the chart cite the same edition:

| Chart | Source, as the chart cites it |
|---|---|
| `minuet-g` | Mutopia 75, Public Domain (right hand only: the diff counts committed notes, so the left hand only adds unmatched ones) |
| `ode-to-joy` | Mutopia 528, Public Domain |
| `fur-elise` | Mutopia 931, Public Domain |

## The images (all in `spikes/snap-score/local/`, self-ignored: `*` then `!.gitignore`)
- **Clean:** page 1 of each piece's Mutopia PDF, downloaded from its piece page and rendered with macOS's own
  `sips -s format png` (no new tool).
- **Photo (Eric, about 5 minutes):** a phone photo of each page, printed or on a screen, in ordinary light. Dropped
  into the folder as `<chart id>.photo.jpg`.
- Photos, PDFs, renders, model output and usage stay local. Only code and the prompt are committed.

## The reader (`spikes/snap-score/snap.mjs`, committed)
- Plain Node with built-in `fetch`, no dependency, no change to `web/`. Run as
  `node --env-file=<main checkout>/web/.env.local spikes/snap-score/snap.mjs <image> --id <id> --bpm <n> --title <t>
  --composer <c> --source "<the committed chart's source line>" --out spikes/snap-score/local/`.
- The Messages API call follows the repo's only server-side pattern, `web/src/app/learn/api/chat/route.ts`: POST
  `https://api.anthropic.com/v1/messages`, headers `x-api-key` from `ANTHROPIC_API_KEY` and `anthropic-version:
  2026-10-21`, model `claude-opus-5-5` unless `SNAP_MODEL` is set. The image goes as a base64 image block, the
  prompt from `spikes/snap-score/prompt.md` (committed).
- The prompt asks for JSON only: `beatsPerBar` and `notes` (`pitch` as MIDI, `beat` from beat 0 of bar 1, `duration`
  in quarter notes, `hand` R for the treble staff and L for the bass), every note printed on the page, repeats not
  expanded, ornaments as their main note. It forbids filling in anything not visible.
- The script adds `id`, `title`, `composer`, `bpm` (from `--bpm`: a page rarely prints one, and the diff is in beats)
  and note ids, and sets `source` to `Read from a photo of <source> by <model> (snap-score-spike)`. It writes
  `<id>.<image name>.chart.json` and `<id>.<image name>.usage.json` (the response's `usage`, `stop_reason`, the model
  and the wall time).
- **The key:** no key, it exits "not configured", as the chat route answers 503. It never prints, logs or writes
  the key. If Eric's `web/.env.local` has none, file a `needs-human` issue and stop: no other key, no other provider.
- A refused, cut-off or unparseable reply is a recorded failure for that image, not a retry loop: at most 2 attempts
  per image, both logged.

## The measurement
For each piece × image (clean, photo) plus the control:
- `python3 game-tools/forge/forge.py diff <chart> web/public/songs/<id>/chart.json`: share, matched, unmatched.
- **One alignment allowed:** if the chart is off by a constant beat shift (a pickup counted differently), also diff a
  copy shifted by the best whole-sixteenth offset, and report both numbers and the shift.
- The library's rules, as level-forge runs them: `FORGE_CHART=<chart> FORGE_ID=<id> pnpm -C web exec vitest run
  src/app/api/forge/check.test.ts` (imported rules, nothing copied).
- **The recall control:** the same prompt with no image, naming the piece, once per piece. Its chart is scored the
  same way and never leaves `local/`. Its share is the "knew it already" floor for that piece.
- Tokens and wall time per call from `usage.json`. Dollars only from Anthropic's published prices, cited with the
  date read; otherwise left empty.
- `spikes/snap-score/score.mjs` (committed) runs the diffs and prints one table for FINDINGS.md.

## Validation
1. `node spikes/snap-score/snap.mjs --self-test`: with no network, a canned API reply becomes a chart with the right
   ids, `source` and `bpm`; a reply that isn't JSON, a cut-off reply and a missing key each fail with a reason; the
   key never appears in the output.
2. The runs: 3 clean renders, 3 photos (when Eric has taken them), 3 recall controls. About 9 calls, run one at a
   time, never in parallel.
3. `node spikes/snap-score/score.mjs` prints the table: per image, share (raw and shifted), unmatched, rules pass,
   tokens and seconds.

## FINDINGS.md (`spikes/snap-score/FINDINGS.md`)
Per decision 004: the question, the table, what worked, what didn't (where reading failed: clefs, ledger lines,
rhythm, accidentals), what to keep, and **promote**, **iterate** or **kill**. A promote names what phase 2 would be (a
server route and a page, through a spec) but builds none of it. Then `changes/snap-score-spike.md` last.

## Gaps (accepted)
- Three famous pieces; the recall control is the only guard against memory. A piece the model can't know is phase 2.
- Page 1 only, so the diff covers each committed chart's opening bars.
- No route, no page, no upload in `web/`: a snapped chart never reaches song select during the spike.
- A snapped level's notes come from a cited score through the model's reading, checked by the diff. Whether that
  meets the mission's "notes from a cited score" for unchecked photos is Eric's call on promotion.

## Defaults
- The smaller option; log choices the spec doesn't make in `specs/decisions/snap-score-spike-*.md`.
