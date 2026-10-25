# For Andres: your half of the Devpost post

Andres, these are the parts of our Devpost submission that speak for the learning side, or that carry the impact
story you argued for. One question:

> **Is each passage below true and fair to your half? Strike or fix anything that isn't.**

Passages 1 to 4 are for review. **Section 5, the challenge answer, is yours to write.** Edit this file directly, or reply to Eric. Whatever you change goes into [about.md](about.md) (the text that gets
pasted). The rule we're holding to is your principle 5: claim only what `/learn` does today, and name the rest as next.

Each passage is quoted exactly as it will appear, followed by what it rests on in the repo.

---

## 1. Inspiration (the impact story)

> Picture someone who wants to learn piano, practicing alone. They don't know what to practice, whether they're
> getting better, or why they keep missing the same bar. A teacher would tell them. Most beginners don't have one, so
> they feel lost. **That feeling is the problem Étude is built to end.**

**Rests on:** `PRODUCT_PHILOSOPHY.md` principle 1 ("Resolve feeling lost"), and the dialogue's "What was agreed". The
playtest numbers right after it (roommate ~15%, Eric ~10%) come from `specs/context/findings.md`.

---

## 2. The learning side, in "Two halves, built as equals"

Rewritten from your #1415 draft (merged 15:31), so it should already match your half:

> **The learning side** (Andres's lane), at `/learn`, is the tutor itself. A new student names the songs they want to
> play, then takes a diagnostic of up to 15 minutes. From then on the tutor drives: `/learn` opens on a map of 207
> music skills, each citing its source, with the next step ready to start. The steps: understand an idea, with a theory
> chat that asks guiding questions instead of giving the answer; recall it; practice a passage with help that fades;
> and prove it in a cold check, at tempo, both hands, no help. The tutor hears those passages over Web MIDI with its own
> scorer, and every attempt updates its belief that you know each skill.
>
> **Claude chooses what's next.** The server replays your attempts and builds candidates from the map: checks that are
> due, skills near ones you've mastered, the songs you want to play. Claude picks 3 to 5 and says why. A pick that
> fails the map's check, an error or a missing key falls back to the top candidates. What the tutor doesn't do yet is
> read your takes from the game.

**Rests on:** your `docs/devpost.md` (#1415): `diagnostic/model.ts`, `curriculum/` and `audit.test.ts`, `piano/score.ts`
(#802), `engine/constants.ts`, `decide/index.ts` and `candidates.ts`, `api/chat/tutor.ts`; #874 for the takes.
Left out on purpose: `/learn/play-through`, which still plays a sample learner's take (`PlayThroughWorkspace.tsx:45`).

---

## 3. What we learned (the trust argument)

> **Precision earns trust, not formality.** We argued over whether a learning app should look serious. We decided
> trust comes from exact timing, real numbers and a clear way to recover, so the tutor looks like an instrument, not
> a textbook.

**Rests on:** Book III of the dialogue. The dialogue marks this "Proposed" and gives you the concession; strike it if
it isn't yours.

---

## 4. What's next (the learning rows of the limits table)

> | Not yet | Next |
> |---|---|
> | **The tutor doesn't read your game takes.** It hears its own passages, but takes from `/play` don't reach the map yet. | Feed it the takes the game already saves. |
> | **The tutor's numbers aren't calibrated.** The 0.95 mastery line, the 1, 3, 7, 21 and 60-day checks and the 30% help line are standard knowledge-tracing values. | Calibrate them on real students. |
> | **Theory at the moment you stumble.** The results screen names your weak bars with a fixed template line. | A `nextStep(results)` that reads the real take and the map, and offers a short theory card at the bar you missed, checked against the take before it's shown. |

**Rests on:** #874, `engine/constants.ts`, #642 (`nextStep` is proposed, not built), `changes/duo-results.md` Gaps.

---

## 5. The challenge answer: yours to write

Eric wants this one to be yours. Your #1415 draft names Claude Opus 5.5; Eric thinks that's a weak answer and wants
it changed. If you still think Opus 5.5 is right, make the case to him directly. Otherwise write a new one here. The
field stays blank until you two agree.

**What the challenge asks** (`specs/context/event.md`, section 1, quoted from the event site): "a technology, dataset,
or discovery first made publicly available within the past 12 months", and "The new technology or resource should be
central to what you build." Be ready to explain what makes it recent.

**What it has to stay true to:** the same rule as the rest, principle 5. Name only what's on `main` today, and say
"next" for the rest. Whatever you pick needs a public release date inside Oct 2025 to Oct 2026.

**Already ruled out in #10:** Web MIDI, Demucs and Basic Pitch (too old), and Claude Code (released May 2025). The
agent workflow was called tooling, not product.

**What's on your side today that a model touches:** the next-session pick (`decide/index.ts`, #1079) and the theory chat
(`api/chat/route.ts`). If your answer is a dataset, a learning-science method or something else in the map, that works
too, as long as it's recent and central.

Write it here, about 80 to 120 words, and Eric pastes it into the form.
