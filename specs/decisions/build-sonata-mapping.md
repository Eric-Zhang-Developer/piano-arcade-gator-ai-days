# build-sonata: how the night becomes music

**Context.** The spec leaves these to the build and asks for each to be logged: the progression and key, the warp,
the lane registers, the velocity cap, which red counts, and anything else the spec doesn't decide. All of it lives in
`web/src/game/x/build-sonata/sonata.ts`; `make-sonata.mjs` re-runs it from git.

**Choices** (each the smaller, reversible option):
- **Notes:** one per first-parent commit whose subject ends in a PR number (`(#n)`): 691 of 704 on the first snapshot.
  The rest (the initial commit, plain merges) aren't merged PRs.
- **Tempo and length:** 120 bpm in 4/4; the commits fill beats 0–176 and the final I rings to about 180 (90 s).
- **The warp:** a commit's beat is 75% its rank (busy hours get room) and 25% its clock time, quantized to sixteenths.
  A hand plays one note per sixteenth; a note that would land on a taken slot moves to the next free one.
- **Harmony:** I–V–vi–IV in C, a chord a bar. Every note is a tone of its note's chord: a commit during an open
  `main-red` issue is in vi (A minor), the first commit after it resolves to I's C (id suffix `-resolve`), and the last
  two bars are V and I whatever else is true.
- **Fixes** are sixteenth-note passing tones: the nearest C-major scale step off the chord tone that isn't in the chord,
  inside the lane's register (id suffix `-pass`). A fix in the final cadence or a resolving fix stays a chord tone.
- **Shapes:** `feat` 2 beats, `fix` a sixteenth, everything else an eighth, the last note 4 beats; a tone stops before the
  next strike of its pitch. `revert` takes the chord tone just below its lane's last note (a fall within one note,
  because the spec's count rule is one note per commit).
- **Registers and hands:** game C5–E6 (72–88, R); plan/contract/docs, the bell, C7–C8 (96–108, R); learning G3–A4
  (55–69, L); backend C2–E3 (36–52, L). The registers don't overlap, so no two lanes share a pitch.
- **Lanes:** a scoped commit takes its spec's assignee's person (`eric` game, `sharan` backend). An empty assignee, no
  spec, or no scope goes by the majority of its changed paths against AGENTS.md's Lanes folders; a commit that touches
  none of them (CI, `.agents/`, spikes) counts as game, the lane that owns that tooling.
- **Velocity:** `40 + 7·log2(1 + lines changed)`, capped at 110.
- **Red:** only `main-red` issues turn the music minor. `ci-red` (a red scheduled run, which doesn't stop merges) counts
  for nothing.
- **Pedal:** only the final V–I: down 0.12 beats into each bar, up 0.04 before the next and at the end. The rest is dry,
  so passing tones don't blur.
- **Scrub:** the names and handles in AGENTS.md's Lanes table, matched as words in any case, and anything shaped like
  an email become the commit's lane name. No author field is read.

**How to undo.** Edit the constants in `sonata.ts`, re-run `make-sonata.mjs`, and commit the snapshot and chart.
