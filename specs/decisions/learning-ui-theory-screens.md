# learning-ui: theory screens get a real model chat, gates that define done, and the Duo look

- Date: 2026-10-25   Decided by: Andres (choices 1-4), talking agent (defaults 5-7)   Feature: learning-ui
- **Context:** Andres asked for two theory screens: `/learn/understand`, an inquiry sandbox with problem-set gates
  and a chat beside the workspace, and `/learn/review/theory`, a clean one-question test that explains each wrong
  answer. The learning-ui spec said the opposite in three places: "No fake chat" with no chat at all, Saira italic
  headings, and no persistent progress. `specs/context/visual-direction.md` already puts `/learn` in the Duo look
  with Saira upright.
- **Options / Choice:**
  - **Chat.** A) questions and hints only, no chatbot (the earlier call); B) a real model. **B** (Andres). The chat
    coaches the student through the gate in focus; it never gives a gate's answer, never claims mastery, and with
    no key or a failed call says plainly that it isn't connected, never a fake reply. Per `specs/mission.md`, it
    states no facts about the student that results data doesn't back.
  - **Done.** A) done when the student leaves; B) done only when every gate passes. **B** (Andres): the gates are
    the evidence. The student can always stop and resume, per `PRODUCT_PHILOSOPHY.md` (principles 3 and 5), so
    gate progress is saved per device in `localStorage`.
  - **Look.** A) keep Eric's current italic Saira roles; B) Duo now, inside `/learn`. **B** (Andres): the values live
    in `web/src/learn/frontend/duo/` and the `--learn-*` aliases, and swap to Eric's shared kit when `duo-tokens`
    lands. Saira is upright, never italic, per `visual-direction.md`. Repointing the aliases restyles the existing
    `/learn` screens too; that is intended.
  - **Publishing.** Per `AGENTS.md`: PRs, squash-merged after green CI (Andres).
  - **Route (default, reversible).** A) under the coach's paths; B) `/learn/api/chat`, inside learning-ui's paths.
    **B**, so the work ships under one `fix(learning-ui)` PR title.
  - **Model (default, reversible).** Claude through `ANTHROPIC_API_KEY`, read server-side only (never a
    `NEXT_PUBLIC_` name), model `claude-opus-5-5`, overridable with `LEARN_CHAT_MODEL`. `specs/tech-stack.md`'s
    "expected to run on Gemini" is provisional and the learning lane's call.
  - **Gate rule (default, reversible).** A gate passes when every question is answered correctly without a reveal; a
    miss comes back later in the set. Copy says "passed", never "mastered": a passed gate is evidence on one
    device, not a mastery claim.
- **How to undo:** chat: remove `web/src/app/learn/api/chat/` and the chat panel, and restore "No fake chat" in
  `specs/features/learning-ui/spec.md`. Done: drop the gate check and the saved progress. Look: point the `--learn-*`
  aliases back at `--pa-*`. Route, model and gate rule: change the route path, set `LEARN_CHAT_MODEL`, or edit the
  gate rule in `web/src/learn/frontend/theory/`.
