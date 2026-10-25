## What shipped
- The README's route table now covers every `page.tsx` on main: the Lab's experiment and spike pages, `/shots`, the `/learn` activities and `/auth/callback`.
- The README's page count is gone, so it can't drift again (#1140).
- `docs/devpost.md` has a Lab bullet with one line per experiment or spike a judge can open: 14 of them, each labeled and linked to its done note (#1142).
## Where it lives
`README.md`, `docs/devpost.md`, `specs/decisions/docs-refresh-which-experiments.md`.
## How to check it
The route check in the PR printed `missing=0`. `grep -n "pages" README.md` shows no count. `grep` finds `/real-keys`, `/conduct`, `/highlight`, `/wrong-note` and `/simon` in `docs/devpost.md`. Docs only, so there is no browser check.
## Gaps
Research spikes with no page (hum-level, jam-mode and others) get no devpost line; the decision file says why. New experiments after this PR's base aren't listed.
