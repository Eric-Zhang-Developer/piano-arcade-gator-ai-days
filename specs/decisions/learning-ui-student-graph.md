# learning-ui: the student graph, a built curriculum painted by Bayes from the real piano, with a model-chosen Next

- Date: 2026-10-25   Decided by: Andres (choices 1-14), talking agent (defaults and simplifications)   Feature: learning-ui
- **Context:** Andres asked for a backend for learning: build a skill graph, give an adaptive diagnostic, use it as
  evidence of each student's mastery, and let the painted graph decide what they learn next, modelled on his Spark
  calc 1 app and `~/projects/ics-coach`. Today's map (`web/src/learn/frontend/graph/data.ts`) is 134 fictional
  skills with a fictional learner, and nothing in `web/src/learn/` stores state or calls an API. The model is
  summarised in `specs/features/learning-ui/spec.md`, section Student graph.
- **Options / Choice:**
  1. **Scope.** A) a thin slice; B) the full curriculum. **B** (Andres): zero to ABRSM Grade 5 theory, playing up to
     what the game's charts ask. Undo: drop region files from `mastery/curriculum/`; the audit still runs.
  2. **Sources.** Open Music Theory is the committed base; RCM and ABRSM set what mastery looks like; Musihacks is a
     private input only (citations, never its text), and out of the build since nobody here has access (Andres).
     Sources define mastery, never order. Undo: edit each node's `sources`.
  3. **Graph shape.** A) a prerequisite tree in syllabus order; B) ics-coach's layered graph. **B** (Andres): layers
     backbone, concept, detail; kind declarative or procedural; `whyImportant` required; edges in-context, analogous
     or contradicts, weight 1-5 with a rationale. "Prerequisites belong to a resource's route, not to the subject", so
     each student's path follows their prior knowledge. Graphify is out: it maps code and documents, with no
     prerequisite relation. Undo: add a `prerequisite` relation to the edge schema in `mastery/schema.ts`.
  4. **Built ahead of time** (Andres): the graph and its items are committed JSON; runtime is only the student's
     mastery over it. Undo: none needed; a generator could write the same JSON.
  5. **Items.** Authored with the graph, one credited node each, at least two per node; theory is a closed question
     whose wrong options explain their mistake, playing a short passage with pass bars (Andres). No validating how well
     each item measures its node: a good-enough estimate (Andres). Undo: add calibration fields to items.
  6. **Phase on the node** (Andres: "encoding starts at zero and builds up, retrieval starts at a hundred and comes
     down if they're not good enough"). ics-coach puts encoding and retrieval on the activity; here each node has one
     phase and the activity follows from kind x phase. Encoding goes to retrieval at belief 0.95 with three counting
     attempts on two items; retrieval goes back below 0.6, about two cold failures. Undo: change the thresholds in
     `mastery/engine/`.
  7. **Bayes** for both promotion and demotion, on a good amount of evidence (Andres): one update per counting
     attempt, rough guess and slip rates per item kind, nothing calibrated. Undo: swap the update in `mastery/engine/`.
  8. **What counts** (Andres): a theory answer counts if no hint was revealed; a playing attempt counts if at least 70%
     was cold ("the majority of it should be still cold"). More help is practice: shown, not counted. Undo: change the
     threshold in `mastery/engine/`.
  9. **Real piano evidence** (Andres): `/learn` reads Web MIDI itself and scores notes, timing, loudness, legato and
     pedal; cold game takes at the target tempo count for a song's tagged nodes. MIDI can't see fingers, so fingering
     is only indirect. Undo: remove `mastery/piano/` and keep theory-only evidence.
  10. **Diagnostic** (Andres): adaptive, both theory and playing. Default: the item on the node nearest 0.5,
      backbone first, alternating kinds; answers nudge linked priors by edge weight, never colour; stop when every
      backbone node is below 0.2 or above 0.8, or at 15 minutes; resumable. Undo: change the policy in
      `mastery/diagnostic/`.
  11. **Three colours** (Andres): unknown, in progress, mastered. "Mastered" means the retrieval phase, reached by
      evidence; a theory gate "passed" is not a mastery claim, so the two words don't clash. Undo: map more states in
      `web/src/learn/frontend/graph/`.
  12. **A model decides Next** (Andres): `POST /learn/api/next`. Code builds candidates (due cold checks, unknown or
      encoding nodes linked to mastered ones, scored by layer, link strength and goal-song value); Claude, on the
      chat's key with `claude-opus-5-5` by default, reads them with ics-coach's seven principles and picks 3-5
      activities. Code rejects anything off the list, more than 3 new nodes or keywords not in the graph; no key or a
      rejected reply falls back to the top candidates; every decision is logged with its inputs. The system picks;
      exploration stays the student's inside the encoding sandbox. Undo: always take the fallback.
  13. **Goal songs** (Andres): the student picks 1-3 songs to build up to; they weight the candidates. Songs are tagged
      whole. Undo: drop the weight from the candidate score.
  14. **Storage** (Andres): append-only attempts behind one store interface, state replayed, never stored; the device
      adapter now, Supabase when Sharan's `learning_attempts` table lands (#753), same player id as takes. Undo: none
      needed; adapters swap behind the interface.
  15. **The map** (Andres): the built graph replaces the 134 fictional skills and the fictional learner; the theory
      screens become evidence sources. The spec's "unchanged graph geometry/colors" Validation line is amended for this.
      Undo: restore `graph/data.ts` and the line.
  16. **PR lane (talking agent).** A) a new `student-graph` feature with a `plan:` PR; B) `fix(learning-ui)`. **B**:
      everything fits learning-ui's paths, like the theory screens, so nothing waits on a person's merge before the
      freeze. The cost is the engine living under `frontend/mastery/`. Undo: move `mastery/` to its own feature.
- **Simplifications (talking agent, at Andres's "fight for simplicity while still getting the full vision through"):**
  - Time decay and a 0.95/0.8 band are out: the belief moves only on evidence; time only schedules cold checks at 1,
    3, 7, 21 and 60 days, out a step on success and back to the start on failure. Undo: add decay to the engine.
  - "Aided counts for less" is out: an attempt counts or it doesn't (the 70% rule). Undo: weight the update by help.
  - Conditional knowledge, ics-coach's third kind, is out: two kinds. Undo: add `conditional` to `kind`.
  - Simple Spark's separate assessor model is out: closed questions explain their own mistakes and the piano scorer
    names what was off; one model call per decision. Undo: add an assessor call after a wrong attempt.
  - Confidence before feedback is out: never asked. Undo: add a confidence field to attempts.
  - Information gain is out: the item nearest 0.5. Undo: replace the pick in `mastery/diagnostic/`.
  - A `tools/curriculum/` audit script is out: the audit is a vitest test, so CI runs it. Undo: none needed.
  - Bar-level chart tags are out: songs are tagged whole. Undo: add bar ranges to `songs.json`.
- **How to undo all of it:** restore `web/src/learn/frontend/graph/data.ts`, remove `web/src/learn/frontend/mastery/`
  and `web/src/app/learn/{diagnostic,api/next,api/attempts}/`, and revert this record and the spec's Student graph
  section.
