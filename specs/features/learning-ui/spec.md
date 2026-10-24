---
name: "Desktop learning frontend with four focused activities"
depends_on: []
owns: ["web/src/app/learn/", "web/src/learn/frontend/", "web/public/learning/"]
assignee: ""
---

# Learning frontend

This is the frontend slice commissioned from the published `piano-learning` plan on `seeko/work`. It does not deliver the complete learner engine, authentication, inference, scheduling, or cloud persistence. Explicit task authorization selects this bounded work independently of automatic milestone picking.

## Plan
1. Port the accepted split-pane learning layout to Next.js routes.
2. Integrate focused Practice and Play-through components.
3. Compare the first working baseline with mlhacky.com and apply evidenced visual principles in a piano-specific identity.

## Requirements
- Desktop/laptop routes `/learn` and `/learn/understand`, `/learn/practice`, `/learn/review`, `/learn/play-through` are directly reachable from persistent navigation.
- One current question and one primary Check/Continue action beside a spacious music/reference workspace. No fake chat or duplicate navigation.
- Understand permits the reference; theory review unlocks it only after submitting the current answer. Closed answers get computed feedback; open explanations compare with a reference, never fabricated semantic grading.
- Practice fades support; Play-through retains the score and gives feedback after a performance. Preview takes and observations are visibly illustrative, with no invented mastery or saved account claims.
- Existing cited repository score data is reused, with provenance retained. Original teaching summaries distinguish melodic closure from harmonic cadence evidence.
- Offline recovery names the connection problem and sync limits. The anonymous arcade, game loop, root styles, frozen contracts and dependencies stay unchanged.

## Validation
- `pnpm -C web test`: question feedback, phrase selection and procedural state checks.
- `pnpm -C web lint`, `pnpm -C web typecheck`, `pnpm -C web build` pass.
- In visible Chrome, open each route at 1440x900 and 1280x800. Navigate all four activities; check a correct/incorrect answer, compare an explanation, use hints and audio, complete review, and confirm reference is locked before each review answer.
- Start a procedural preview take, fade support, play through, and verify feedback occurs after completion. Keep four desktop stills and laptop evidence outside the repository.
- Run repository ownership, gate and marker checks. The repository's game verification is separate from learning-route verification.

## Defaults
Preview state is local and disposable. Unknown student progress stays unknown. No auth, backend or model connection is implied.
