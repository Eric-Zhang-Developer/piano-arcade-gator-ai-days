---
name: "Docs refresh: the README's routes and page count, and devpost.md's experiments, caught up with main"
depends_on: ["learning-ui", "real-keys", "highlight-reel", "video-shots", "conductor", "wrong-note-spike", "simon-says-spike"]
owns: ["specs/features/docs-refresh/", "changes/docs-refresh.md", "specs/decisions/docs-refresh-", "README.md", "docs/devpost.md"]
assignee: "eric"
---

# Docs refresh

Issues #1140 and #1142, from the polish refill. The README and the Devpost draft have fallen behind the pages and
experiments on main. Docs only: no code, and no design pass (AGENTS.md exempts what changes no screen). It's a
`feat(docs-refresh)` PR so the done note can ride along; `README.md` is learning-ui's (done, no lane) and
`docs/devpost.md` has no owner, so this spec owns both while it's in flight.

## The changes
1. **README routes (#1140):**
   - every `page.tsx` under `web/src/app/` on the PR's base is in the route table (`README.md:26-37`) or the "other
     pages" paragraph (`:39-41`), one line each, worded from its done note's "What shipped". When this spec was
     written, the find also listed `/real-keys`, `/highlight`, `/shots`, `/composers-hands`, `/paint` and `/speak`,
     none of them in the README; take the list from the find, not from here;
   - the page count (`README.md:105`, "25 pages") is dropped, so it can't drift again (#1047 fixed the same drift
     once). Keep the link to the route list.
2. **devpost.md's experiments (#1142):** `docs/devpost.md` gets one line per experiment or spike with a done note on
   main that it doesn't name yet: at least Real Keys (`changes/real-keys.md`), Conduct (`changes/conductor.md`),
   Highlight reel (`changes/highlight-reel.md`), Wrong note (`changes/wrong-note-spike.md`) and Simon
   (`changes/simon-says-spike.md`). Each line:
   - is labeled a Lab experiment or a spike;
   - is worded from its done note's "What shipped" and nothing more;
   - links absolutely (`https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/…`), as #1087
     required.

   Any other experiment with a done note on main at the PR's base that devpost.md doesn't name gets the same line;
   list which in the PR.

## Files
| File | Owner |
|---|---|
| `README.md` | learning-ui (done; no lane), owned here while in flight |
| `docs/devpost.md` | none, owned here while in flight |

When this spec was written, no open PR held either. Check again before editing (`gh pr list --state open`, then each
PR's files); if one does, switch once it frees it.

## Validation
- **(a) Routes:** a one-line shell check, printed in the PR: every route from
  `find web/src/app -name page.tsx` (path minus `web/src/app` and `/page.tsx`; dynamic and `/auth/*` routes counted
  under their parent line) appears in `README.md`. Zero missing.
- **(b) No count:** `grep -n "pages" README.md` shows no page count.
- **(c) Experiments:** for each of the five, a grep of `docs/devpost.md` finds its route or name; each new line's
  link starts with `https://github.com/`.
- **(d) Nothing invented:** each new line's wording traces to a sentence in its done note; the PR lists the pairs.
- No design pass: docs only. The PR body says so.

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/docs-refresh-*.md`.
- No other README or devpost.md section rewritten.
