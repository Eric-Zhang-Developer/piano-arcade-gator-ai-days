# 004: Spikes

- **Context:** on 2026-10-24 Eric asked for a guideline that is "pretty short and pretty broad... with some
  principles". That day's spikes (Flower Dance, song-rip, Tchaikovsky) showed two failure modes. Code was written into
  a gitignored folder, so it could never merge. Heavy runs competed with the workers for one laptop.
- **Choice:** the principles below. eric-asking-agent drafted them, and the planner edited principle 8 so that spike
  code can be reused through a spec, as Flower Dance's player was for backing-track.
- **How to undo:** revert this decision's PR and the AGENTS.md line that points here.

A spike is a cheap, bold experiment that answers one question. It's how we try ideas with agents without risking the
game. Be loose about polish and strict about truth.

## Principles
1. **One question, written first.** Before starting: the question, what counts as yes and as no, and a time box.
   "Can the DGX play a convincing string section in sync?" is a spike. "Make it cooler" is not.
2. **Know which kind it is.**
   - **Tech spike** ("does this technology work?", e.g. song-rip, mic-pitch): separate. It goes in `spikes/<slug>/`,
     reads from the game but never edits it, and is thrown away after.
   - **Prototype spike** ("can the game do this?", e.g. Flower Dance): it builds on the game's code, on a worktree
     branch, reusing what's there.
3. **Code is committed; content may not be.** Code we write is ours to commit even when the song it plays isn't.
   Copyrighted or large material (songs, rips, recordings, model weights, outputs) stays in a self-ignored folder
   (decision 003). Never mix the two in one ignored folder, or the code can't merge. Worktrees read local content by
   copying it in.
4. **Cheap by default.** Use a worktree, never a clone. Run heavy compute once, through the verify lock, under the load
   rule. Add no new dependency to `web/` without a spec.
5. **Off the critical path.** A spike never blocks a milestone, never edits another person's lane, and never ships to
   the demo by itself.
6. **Liberties, not lies.** Be as wild as you like with design, sound and arrangement. Tests and polish are optional.
   The never-invent-data rule is not: notes come from a cited source or from Eric, and numbers are measured.
7. **It ends in findings.** `FINDINGS.md` gives the question, the measured answer, what worked, what didn't, what to
   keep, and a recommendation: **promote** (it becomes a spec and lands as normal features), **iterate** (one more
   time box), or **kill**.
8. **Promotion goes through a spec.** What survives gets a spec and lands through normal PRs under that spec's title.
   Spike code may be reused as the seed when it's generic and contains no restricted content. Otherwise rewrite it.
   The spike's folder is then deleted or left as a record.

## Who
Eric or the planner opens a spike; an `idea` issue tracks it. The planner routes it to a worker.
