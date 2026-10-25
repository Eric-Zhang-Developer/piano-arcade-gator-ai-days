### A machine that hears every note, and a reason to play one more time.

---

## 01 · Inspiration: feeling lost at the piano

Picture someone who wants to learn piano, practicing alone. They don't know what to practice, whether they're getting better, or why they keep missing the same bar. A teacher would tell them. Most beginners don't have one, so they feel lost. **That feeling is the problem Étude is built to end.**

We saw it in our first playtest, on one-hand *Twinkle, Twinkle, Little Star*:

> **"We don't know when to press the key."**
>
> Eric's roommate scored about **15%**. Eric, who plays, scored about **10%** on his first runs. Right notes played "100 or 200 ms off" missed every time, and nothing on screen said early or late.

The four leading piano apps we checked (Simply Piano, Flowkey, Yousician, Playground Sessions) grade *which* notes you hit, not *how* you played them: early or late, even or uneven, loud or soft. That *how* is what a beginner can't hear for themselves.

---

## 02 · What it does: a tutor that hears every note

Étude runs in Chrome on a real 88-key piano (our Yamaha DGX-660, over USB), or on laptop keys with no piano at all.

**It hears every note to the millisecond.** Each key you press is measured against the moment the song says it was due:

$$\Delta t = \text{when you pressed} - \text{when it was due} - \text{your latency offset}$$

| PERFECT | GREAT | GOOD | MISS | WRONG |
|:---:|:---:|:---:|:---:|:---:|
| within 40 ms | within 80 ms | within 120 ms | no key in time | a key the song didn't ask for |

**It names one thing to fix, with real numbers.** After a take, the results screen shows accuracy bar by bar, brackets your weakest bars, and says how late you were on average. Then it offers one button: practice those bars, slower.

**It practices with you.** *Wait mode* stops the song on each note until you find it. *Flow mode* follows your tempo instead of leaving you behind. *Adaptive practice* narrows onto the bars you miss and grows back as you play them clean.

Every number on screen is a count from the take you just played.

![The results screen: accuracy by bar with the weakest bars bracketed, the timing histogram, the gator's line and one PRACTICE BARS button](https://raw.githubusercontent.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/f7f61f4d6c6bff08f24d78bf37b30c304d05be7b/specs/features/duo-results/shots/sweep4-after-1920.jpg)

*The results screen, from a test run on Twinkle: it names the weakest bars (5–8, 55%) and the average timing (+7 ms late), then offers one button.*

---

## 03 · Why you keep practicing: the arcade is the method

Practice only works if you come back, so Étude borrows from Japanese arcade rhythm games. Every effect has a job:

| Effect | Its job |
|---|---|
| The millisecond readout | Tells you how late you were, so you can correct it |
| Adaptive practice | Narrows onto your weak bars, so you practice what you can't play yet |
| Combo, rank and fever | Make you want to play it once more |
| An LED strip over the keys | Lights up as you play, so the room becomes part of the game |

The look is **Duo**: black, with the right hand in electric blue and the left in purple, on the notes, the keys and the strip. Gold and red appear only when something happens: a PERFECT or a WRONG. A first-timer can drive it all with a mouse: every action that started as a key press has a button, and `?` lists every control.

---

## 04 · Two halves, built as equals

**The game and practice engine** (Eric's lane) is everything above: the highway, the judge, the results screen, the practice modes, and timing, evenness and dynamics on every take, across 48 songs, each charted from a cited score.

**The learning side** (Andres's lane), at `/learn`, is the tutor itself. A new student names the songs they want to play, then takes a diagnostic of up to 15 minutes. From then on the tutor drives: `/learn` opens on a map of 207 music skills, each citing its source, with the next step ready to start. The steps: understand an idea, with a theory chat that asks guiding questions instead of giving the answer; recall it; practice a passage with help that fades; and prove it in a cold check, at tempo, both hands, no help. The tutor hears those passages over Web MIDI with its own scorer, and every attempt updates its belief that you know each skill.

**Claude chooses what's next.** The server replays your attempts and builds candidates from the map: checks that are due, skills near ones you've mastered, the songs you want to play. Claude picks 3 to 5 and says why. A pick that fails the map's check, an error or a missing key falls back to the top candidates. What the tutor doesn't do yet is read your takes from the game.

![/learn: the mastery map, with the gator and the prepared next session](https://raw.githubusercontent.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/f7f61f4d6c6bff08f24d78bf37b30c304d05be7b/specs/features/learning-ui/shots/entry-map-1920.jpg)

*The learning side: one map, one prepared next step.*

---

## 05 · How we built it

The three of us built Étude in one weekend with a team of AI coding agents that ran through the night. The agents worked from written specs. Each feature shipped as a pull request, and counted as done only when CI passed and a short note saying how to check it was merged.

| ~43 h | 861 | 832 | 206 | 288 |
|:---:|:---:|:---:|:---:|:---:|
| first commit (Fri 8:39 PM) to Sun 3:30 PM | commits | merged pull requests | finished features | test files and browser checks in CI |

**One judge, everywhere.** The judge is one pure function. The same code scores you in the game, scores synthetic players in tests, and re-scores saved takes on the server. Under it: Next.js and TypeScript in Chrome, Web MIDI for the piano, Web Audio, a canvas highway, Supabase for saved takes (the browser never writes to the database), and an ESP32 driving the LED strip.

---

## 06 · Challenges we ran into

- **Strict timing was "completely undemoable."** On a hard piece, Eric scored 10 to 20% and couldn't rejoin after a slip. That became flow mode, merged about an hour after he approved it.
- **Two lanes built two looks.** The game and the learning side grew apart overnight. We sat down together and settled it: one palette, Duo, for both halves.
- **CI jammed under its own load.** Each fix for slow checks took more of a shared runner pool. Now a pull request runs a quick check, and the full browser suite runs on `main`.

---

## 07 · Accomplishments that we're proud of

- **The judge on trial.** `/veritas` runs test players that plant known mistakes in real songs, and the judge has to find exactly those. On *Für Elise*: **2 planted, 2 found, 0 false alarms.** On all 48 songs it catches exactly what was planted, except rushing (see below).
- **Measured, then fixed.** `/play` lagged on a Retina screen. A probe found it drawing **53 canvases and 436 megapixels** a frame. It now draws **3 canvases and 9.4 megapixels**.
- **The Lab.** Overnight, the agents also built experiments, kept off the main path. **Real Keys** drops the falling notes onto a live camera picture of the real keys. **Conductor** lets a hand at the laptop camera lead the piano: a still hand holds, a fist cuts off. **The Round** has you play a round once, and the piano plays your take back as voices 2, 3 and 4. They're built and pass their tests; none has been tried with players yet.

![The Round: you play voice 1, and the piano answers as voices 2, 3 and 4](https://raw.githubusercontent.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/f7f61f4d6c6bff08f24d78bf37b30c304d05be7b/specs/features/experiments/shots/round/round3-1920-voice4.jpg)

*The Round, from the Lab.*

---

## 08 · What we learned

- **Precision earns trust, not formality.** We argued over whether a learning app should look serious. We decided trust comes from exact timing, real numbers and a clear way to recover, so the tutor looks like an instrument, not a textbook.
- **Check what's being tested before testing it.** One playtest ran on a build 9 hours behind `main`. Now the song select shows the commit it serves and its age.
- **Measure before optimizing.** The lag fix started with a probe that counted canvases and megapixels, not with a guess.

---

## 09 · What's next for Étude

We'd rather name our limits than hide them. Each one is the next step.

| Not yet | Next |
|---|---|
| **The tutor doesn't read your game takes.** It hears its own passages, but takes from `/play` don't reach the map yet. | Feed it the takes the game already saves. |
| **The tutor's numbers aren't calibrated.** The 0.95 mastery line, the 1, 3, 7, 21 and 60-day checks and the 30% help line are standard knowledge-tracing values. | Calibrate them on real students. |
| **Theory at the moment you stumble.** The results screen names your weak bars with a fixed template line. | A `nextStep(results)` that reads the real take and the map, and offers a short theory card at the bar you missed, checked against the take before it's shown. |
| **Rushing.** The judge can't flag it yet; `/veritas` shows the gap instead of hiding it. | A rule for rushed takes. |
| **Flow mode and adaptive practice haven't met the piano.** They pass their tests and browser checks. | The beginner's second take. |
| **The game hasn't driven the LED strip.** The piano lights it; the game's "next key" hints pass on a simulated board (42 of 42). | Run them together on the real strip. |
| **Some takes save wrong.** A flow-mode take saves as all misses. | Save the take that was judged. |
