# learning-ui: the agent drives, so every button and line of text must be essential

- Date: 2026-10-25   Decided by: Andres (the principle), talking agent (the method's wording)   Feature: learning-ui
- **Context:** Next (the model-chosen next step, decision `learning-ui-student-graph`) picks what a student learns;
  students choose only their goal songs (Q17). Screens built before Next still offered choices of what to learn and
  text explaining them. Andres: "We don't need as many buttons when we fully lean into the fact that the agent is
  going to be driving the experience for the user."
- **Options / Choice:** A) keep the current controls and add Next beside them; B) strip each learning screen to what
  the student needs while the agent drives. **B** (Andres).
- **The method, a basis-vector test.** What is on screen should already span the student's needs, with nothing
  redundant. Remove one element at a time (a button, a link, a heading, a line of text), run the flow, and put back
  only what that breaks. Keep going until nothing more can go.
- **Removing an element breaks the flow** when the student can no longer do the agent's current activity, stop, ask
  for help or recover (`PRODUCT_PHILOSOPHY.md`), or choose their goal songs; or when they lose information they need
  to act. Choices of what to learn (pick a skill, a mode, a lesson) go: Next picks.
- **Each PR that applies it** lists, in its Design section, every kept button and text with why it is essential, and
  every removal. A check that asserts a removed element is fixed in the same PR, with the reason in the PR.
- **First application, `/learn`:** a student with no answers yet picks up to three goal songs once, then goes to the
  diagnostic (once per tab, so its Stop lands on the map). A returning student sees the painted map, the agent's next
  activity started by one action, and one Goals link. `/learn/explore` is deleted: nothing links to it, and its
  redirect served no one.
- **Goals are milestones, on their own page.** Goals change only on `/learn/goals`, where each shows mastered tagged
  skills out of all tagged skills, replayed from attempts and never invented. The map keeps no goal panel or rail.
- **Seven items or fewer** per screen at 1280×720. The graph counts as one; an expandable group counts as one and holds
  seven or fewer when open; items hidden until focus don't count; the site's nav band is counted apart.
- **How to undo:** put back the removed element (each PR's Design section lists them) and restore the redirect page
  from git history (`web/src/app/learn/explore/page.tsx`).
