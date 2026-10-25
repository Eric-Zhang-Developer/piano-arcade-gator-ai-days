---
name: "Landing page: what Piano Arcade is, at /about"
depends_on: ["core-loop"]
owns: ["web/src/app/about/"]
assignee: "sharan"
---

# Landing page

The page a judge, a teammate or a Devpost reader opens first. It says what Piano Arcade is in one screen, shows it
moving, and sends people to `/play` and `/sim`. `/` stays song-select's (Eric); this lives at `/about`.

## Requirements
- Hero: the name, one line on what it is, a "Play now" link to `/play` and a "Try it without a piano" link to `/sim`.
  Behind it, the real Twinkle chart (`/songs/twinkle/chart.json`) falls onto a key-aligned keyboard in the game's
  colors, looping. It's a picture, not a take: it shows no score. With `prefers-reduced-motion`, it draws one still frame.
- Every claim and number on the page comes from a file on `main` (mission, findings, story, done notes, competitors),
  each section citing its file. No made-up counts, quotes or dates.
- Build progress is read from `specs/milestones.toml` and `changes/*.md` at build time: a feature is shown done
  only when its `changes/<slug>.md` exists. If those files can't be read, the section says so instead of guessing.
- Works at phone width (no horizontal scroll) and with JavaScript off (everything but the animation).

## Validation
- `pnpm -C web build` -> `/about` builds as a static page.
- Open `/about` -> the hero animation plays Twinkle; "Play now" opens `/play`; "Try it without a piano" opens `/sim`.
- Progress section -> the done features match `ls changes/`.
- 375 px wide -> no horizontal scroll. Screenshot both widths.

## Defaults
- Plain CSS module, no new dependencies, system fonts.
