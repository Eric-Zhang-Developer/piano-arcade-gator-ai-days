# video-shots: the brief for the title and end cards

**Context.** The video needs a title card after the opening wow and an end card at 1:50
(`specs/features/video-shots/shot-list.md`, rows 3 and 14). Before designing them, eric-agent-3's research subagent
studied how three official game trailers open and close (2026-10-25). It jumped each paused YouTube video to set times
and read the frames in the browser, without sound and without saving any images (decision 003). Every timing below
comes from those frames; "on the beat" can't be checked without audio. CHUNITHM and NOSTALGIA have no official short
trailer the subagent could find (only fan uploads and streams), so they're not covered.

| Trailer | Title | End card |
|---|---|---|
| Thumper, release trailer ([link](https://www.youtube.com/watch?v=WrgC-SqEF90), 1:16) | After a white flash at 60–62 s, the wordmark spaced over moving gameplay for ~2 s; no card of its own | Cut to black at ~69 s: "OUT NOW" and platform logos, no name, no URL; still for ~7.5 s |
| Sayonara Wild Hearts, launch trailer ([link](https://www.youtube.com/watch?v=F-RyxYcxSQ4), 1:05) | Tagline built word by word in ~1.5 s (17.6–19 s) after a flash; the logo alone at 58 s for ~2 s | Black card from ~62.5 s, ~3 s: date, hashtag, platform logos; still |
| Hi-Fi RUSH, launch trailer ([link](https://www.youtube.com/watch?v=O2i1Vq3Odbg), 2:27) | Hard cut at ~127 s to the logo alone, dead still for ~4 s | ~137–140 s: logo, "AVAILABLE NOW", the website URL and platform badges; still for ~2.7 s |

**The pattern:** gameplay first; a title cut in hard (or after one flash) that then holds dead still for 2–4 s; flat
end cards, still, 3–7 s, saying only where to get it. None used a QR code.

## What the cards take
- **A hard cut in, one short move, then dead still.** The spec's "motion ends within 2 s, then holds" matches all
  three; the hold is what makes any cut of the card usable.
- **The title card leads, against the pattern.** All three put the title late because they sell to people already
  curious; a judge skimming many submissions needs the name early, so ours comes right after the opening wow (the
  writeup's plan already does this).
- **The tagline is one line, quoted as written** in the dialogue's Book I
  (`specs/context/dialogues/2026-10-25-what-are-we-building.md`): "a machine that hears every note, and a reason to
  play one more time." If it moves, it builds within the same 2 s (Sayonara Wild Hearts builds four words in ~1.5 s).
- **The end card carries the name next to the URL** (Hi-Fi RUSH); Thumper's card has no name, which loses a judge who
  skims. Black, plain, still.

## What the cards drop
- **The title in passing over gameplay** (Thumper): it reads as style, not a name.
- **Clutter after the URL:** platform rows, edition art, a studio ident. We have one URL, so the card shows one URL
  (the repo; the live URL only once #792 sets it).
- **Quote and award cards:** we have none, and the spec allows no made-up text.
- **A QR code:** no QR library is installed; if Eric wants one, it's made in the edit. Not built.
- **The Duo before/after:** neither plan gives it a row in the ~90 s, so it isn't built (spec, plan step 4).

## How to undo
The cards are pages under `/shots`; dropping them is deleting `web/src/app/shots/` and `web/src/game/video-shots/`.
This brief changes nothing else.
