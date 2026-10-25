---
name: "Account details on /auth/login: Google name, email and avatar, a handle, the split-screen look"
depends_on: ["take-store"]
owns: ["web/src/app/auth/", "web/src/data/"]
assignee: "sharan"
---

# Account details

Builds on #467 (`fix(take-store)`), which adds the optional sign-in screen `/auth/login` ("Sign in with Google" or
"Play as guest", then the menu or `?next=`), `AccountChip`, and `googleSession`/`safeNext` in
`web/src/data/auth.ts`. Merge #467 first. This feature keeps `/auth/login` as the one page and adds what a signed-in
player sees about themselves, a handle they can set, and the split-screen look. `players.handle` already exists
(`^[A-Za-z0-9_ ]{1,16}$`, nullable) and nothing sets it yet.

Needs the `contract:` PR that amends `specs/mission.md` Not doing to allow an optional sign-in screen with "Play as
guest", never required to play. Merge that first too.

## Plan
1. `web/src/data/auth.ts`: read the signed-in user's Google name, email and avatar from Supabase Auth's user endpoint.
2. `/auth/login`, signed in: show them, plus the handle, a link to `/progress`, Continue and Sign out.
3. A server route under `web/src/app/auth/` that sets the player's handle with `SUPABASE_SECRET_KEY`.
4. Restyle `/auth/login` as a split screen in a CSS module, reusing the uncommitted draft in `landing`'s worktree
   (`web/src/app/player/`: `PlayerCard.tsx`, `player.module.css`). `/player` isn't kept as its own route.

## Requirements
- **Signed out:** unchanged from #467 ("Sign in with Google", "Play as guest", then `?next=` or the menu). An
  anonymous player who already has takes also sees "Keep my progress" (`linkGoogle`, the same user).
- **Signed in with Google:** name, email and avatar, read from the Supabase user's Google identity on each visit,
  never stored in our tables. Whatever Google doesn't give stays empty and visible, never a placeholder name.
  `AccountChip` shows the handle when there is one, else the Google name, else what it shows today.
- After a Google sign-in (`/auth/callback`): a player with no handle, who hasn't skipped on this device, sees one field,
  **Name**, filled with their Google first name cut to the handle rule; Save stores it, Skip doesn't ask again here.
  Every Google sign-in then shows **Welcome, Name** over a two-octave keyboard whose keys light up left to right
  (still under `prefers-reduced-motion`), and goes on after about two seconds (Continue skips the wait).
- **Handle:** the player can set or change it. The rule is the existing CHECK. The browser never writes: it calls a
  route under `web/src/app/auth/`, which checks the player's token, then writes only that player's `players.handle`
  with the secret key. A refused handle shows why and leaves the old one. An anonymous player can set one too (they're
  a user already); it stays theirs when they link Google.
- **Design:** `specs/context/visual-direction.md` (`--pa-*` tokens, Saira italic, the synthwave stage). Form on the
  left, a visual on the right with a typewriter quote. Every quote is a real line from a file on `main`, cited next to
  it (the draft takes them from `specs/context/findings.md` and `docs/story.md`). Plain CSS module: no Tailwind, no
  shadcn, no new dependency (`web/package.json` is frozen). Phone width with no horizontal scroll; with
  `prefers-reduced-motion`, the quote appears whole.
- Without Supabase configured, the page behaves as in #467. Nothing here runs in the playing loop.

## Validation
- `pnpm -C web build` -> `/auth/login` builds.
- Local stack (`supabase/tests/local-stack/`), no session: open `/auth/login` -> split screen with "Sign in with
  Google" and "Play as guest"; "Play as guest" opens `/`. Screenshot.
- Anonymous player with a take: set handle `Sharan_1` -> the route answers 200 and `players.handle` is `Sharan_1`
  for that id only. Set `<script>` -> refused with the reason shown, the row unchanged. Keep the responses and the row.
- Route without a token, or with another player's id in the body -> refused, no row changed (add to
  `supabase/tests/local-stack/attacks.mjs`).
- Signed in with Google (a Gmail added as a test user on the consent screen): name, email and avatar show; the chip
  shows the handle; "Sign out" -> the signed-out view, and the takes are still on `/progress` after signing back in.
  This needs a person: say so in the done note if it wasn't tried.
- 375 px wide -> no horizontal scroll. Screenshot both widths.
- Vitest: the handle rule (valid, too long, bad characters, empty) and the user-details mapping with missing fields.

## Defaults
- Mounting `AccountChip` on the music select is Eric's lane: #467 leaves it as a one-line change for him. Don't edit
  `web/src/game/` or `/`.
- Google's OAuth consent screen is in Testing, so only listed test users can sign in. Publishing it or adding judges
  is a person's job in Google Cloud (`needs-human` for `sharan`). "Play as guest" keeps working either way.
- No migration: `players.handle` and its CHECK exist. If one turns out to be needed, stop and ask for a `plan:` change
  (`supabase/` isn't in this spec's `owns`).
