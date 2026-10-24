# Event: Gator Hack V, what judges score and how we win it

Refs #35. Research only: no spec, no milestone, no code. Facts read on the open web on 2026-10-24, 02:00–03:00 ET,
by Claude for Sharan, with a browser that returns each page's full text. Every fact has a source in the table at the
bottom; quotes are kept short, so open the source for the full wording.

Labels: **[verified]** read on the primary page; **[unverified]** secondhand; **[guess]** our reading of the facts,
never a fact. "Not found" means we looked and found nothing.

## For agents: read this first

1. **The challenge statement is public now** (section 1). It asks for something first made public in the past 12
   months, *central* to the build, and the video must say what it does, what was hard, and why it's recent. #10
   (which technology) is still a one-way door: no spec, done note or pitch line may claim we meet it until #10 is
   answered.
2. **Round 1 is judged offline from the Devpost page alone**: title, description, public repo, a video of 3 minutes
   or less. Only the top 10 present live. So for round 1, a feature exists only if it shows in the video or
   the write-up (section 2).
3. **Score against five criteria**: impact, technicality, design, novelty, presentation (section 3). Novelty includes
   how new the *tools* are. Section 4 maps each criterion to our features and names the gaps.
4. **Evidence beats claims.** Past winners solved a named problem for named users and showed it working (section 6).
   For us that means real counts from real takes (`mission.md`), the timing data, and the before/after from
   `specs/context/findings.md`.
5. **No winner we found in four years was a game** [verified for the winners listed in section 6]. Lead with *it
   teaches*, and show the arcade as the reason people keep practicing [guess].
6. When you write a done note, the story (`docs/story.md`) or pitch material, say which criterion it serves and what
   evidence a judge would see. Don't invent numbers to fill a criterion; leave it empty and visible.

## 1. The challenge statement

**[verified, Site home]**, under "Friday, 5:00 PM opening ceremony": the title is **"Fresh off the frontier"**.

What it asks, closely summarized:
- Build a project that uses a **technology, dataset or discovery first made publicly available within the past 12
  months** to solve a problem, explore an idea or create an experience in a field you care about.
- Bringing your own field is encouraged; the page names **music** as an example, next to biology and history.
- The new thing must be **central** to what you build.
- Be ready to show **what it does, what difficulties you faced, and what makes it recent**.

Window [guess, from the event dates]: first public on or after about 2025-10-23.

Devpost overview and the Site FAQ still say "build anything you're excited about"; the statement adds to that, and
the Vobile Prize is judged on it (section 5). The opening-ceremony schedule line says challenge statements, plural; we found
only this one.

### Candidates for #10, with checked dates

This list is input for #10, not a pick. #10 is a one-way door and the learning lane's call; each entry still needs
a person to decide whether it is honestly *central*.

| Candidate | First public | Where it would be central | Fit [guess] | Source |
|---|---|---|---|---|
| Claude Opus 5 / Opus 5.5 driving the spec-driven agent workflow (Eric's direction in #10) | Opus 5: 2026-07-24; Opus 5.5: 2026-09-22 [verified] | "The arcade that builds its own levels" (#10, catalog G17); `operator-board`, `operator-replay` show the build | Recent: yes. Central only if a level-building or build-replay flow is in the product, not just how we coded it | anthropic.com announcements and system cards |
| Lyria 3.5 (Google music generation) | September 2026; available in Google AI Studio [verified] | A generated backing track or practice accompaniment | Recent: yes. Also counts for Best Use of Gemini (AI Studio). Conflicts with `mission.md` if it writes chart notes; audio only | Google's September 2026 AI roundup |
| Gemini 3.8 Live (speech-to-speech) | September 2026; in Google AI Studio and the Gemini API [verified] | A coach you talk to after a take | Recent: yes; Gemini prize too. The coach is still provisional (`coach` spec) | Same roundup |
| MuScriptor (open multi-instrument transcription) | arXiv v1 2026-07-09; open weights [verified on arXiv; weight host not stated there] | `song-rip-spike`: a recording becomes a chart | Recent: yes. Riskiest piece in the plan; no solo-piano results stated | arXiv 2607.08168 |
| PDMX (public-domain MusicXML dataset) | 2024 [verified] | `chart-compiler` | **Too old**: doesn't qualify | arXiv 2409.10831 |
| Web MIDI, Demucs, Basic Pitch | before 2025 | | **Too old** (#10) | #10 |

## 2. How judging works

| Step | What happens | Source |
|---|---|---|
| Submit | Devpost, by Sun Oct 25, 5:00 PM ET. Title and short description, public repo link, demo video (3 min max) or slides, full roster (2–5, all registered), sponsor prizes picked. Late submissions are refused | Devpost overview [verified] |
| Round 1 | Offline, after 5 PM Sunday, "by a panel of UF graduate students" (Devpost rules); "a panel of assigned judges" (Site prizes, FAQ). They pick 10 finalists | [verified] |
| Finalists | Announced live at Monday's ceremony, not before | Devpost overview, Site schedule [verified] |
| Round 2 | Mon Oct 26, 10:15–11:15 AM, Reitz Union: the 10 finalists present live on stage | Devpost rules [verified] |
| Awards | Mon Oct 26, 12:15 PM, AI Student Competition Awards | Devpost rules [verified] |
| Attendance | At least one team member at the 10:15 AM finals, or the team can't win | Devpost rules, Site FAQ [verified] |

**Judges named on Devpost** [verified]:
- **Matheus Kunzler Maldaner**: student organizer; graduate student in AI Systems and former DSI president (Site
  team page). He was on the **2025 first-place team**, Plato's Cave (UF ECE article).
- **Sanethia Thomas**: faculty organizer. Devpost calls her "Associate Professor"; the Site team page calls her
  "Senior Lecturer, UF CISE" (minor conflict). She is also listed as a judge on the 2023 Devpost page.

Ten-minute window for ten finalists [guess, from 10:15–11:15]: roughly 5–6 minutes each, including changeover. The
v4 plan's stage version (about 6 minutes, stop at 3½) fits.

## 3. The judging criteria

Two versions are published (conflict 3, #43). Devpost **rules** (what round 1 judges by) and the **Site prizes** page
list five; the Devpost **overview** lists four and has no novelty. No page gives weights [verified: none found].
Plan for all five.

| Criterion | Site prizes, in short | Devpost overview, in short |
|---|---|---|
| Impact | How much positive change it creates | How meaningful the problem is, how useful the solution is to its users |
| Technicality | Complexity and quality of the solution | "Technical Execution": does it work; ambition, implementation quality, creativity, what was done in the hacking period |
| Design | User experience and visual appeal | "Design & Usability": intuitive, accessible, the interface helps people use it |
| Novelty | How new the idea is, **and how new the tools behind it are** | not listed |
| Presentation | How well the idea and demo are communicated | "Presentation & Demo": explains problem, solution, technical approach **and limitations**; the demo shows it working |

Two phrases to design for: **"limitations"** (judges are told to reward a team that names them) and **"during the
hacking period"** (the fresh-code rule; our git history shows it).

**Past years' criteria** (2022–2024 Devpost pages, identical each year) [verified]: Potential Value, Quality of the
Idea, Functionality, Quality of Presentation. Presentation asked for an "interesting and captivating" video with a
**statement of how teammates from different disciplines collaborated**, and the submission video had to list each
teammate's responsibilities. 2026's pages don't ask for this, but the rules call interdisciplinary collaboration
Gator Hack's "core mission" [verified]. Saying who did what costs about ten seconds of video [guess].

## 4. Playbook: each criterion against Piano Arcade

Status words follow `AGENTS.md`: merged, checked by CI, verified live, tried by a user are different things. Feature
status is from `main` at `8d087a6` (2026-10-24); re-check before citing.

| Criterion | What a judge needs to see | What we have | Gap |
|---|---|---|---|
| **Impact** | A real problem, a real user, and that it helps | Problem: apps grade *which* notes, not *how* (`competitors.md`, four apps checked). Playtests: Eric about 10% at first, 40% later; 71.4% with the beat track (`findings.md`). The **beat track** turned "unplayable" into "much much better", a real before/after from real takes | No "it teaches" evidence yet: the coach is provisional. One player's improvement across sessions, shown with real counts, would be the strongest proof [guess]. `take-store` (#60, #61) would keep that history |
| **Technicality** | It works, it's ambitious, it was built this weekend | Millisecond judging on a real DGX-660 (`core-loop`); MIDI spike measured a 3.1 ms key pair and 1 ms clock agreement (`RESULTS.md`); `piano-sim` tests the MIDI path in CI; `judging-tiers`, `timing-feedback` done; take-store re-judges server-side with abuse checks | Show it, don't list it: the 3.1 ms log line and a CI run are 5-second shots [guess]. `[verify].command` results belong in the write-up |
| **Design** | Intuitive, accessible, good-looking | Synthesia look plus arcade layer (decision 001); `hud` done, `juice-visual` and `juice-sound` not yet; laptop-keys fallback so judges can play | Accessibility isn't covered by any spec: color isn't the only signal for a miss (decision 001 row 6 uses color). Not checked: contrast, a reduced-motion setting |
| **Novelty** | A new idea, *and new tools* | An arcade on a real 88-key piano that judges timing direction and plays your take back; no app we checked grades early/late or dynamics (`competitors.md`) | "New tools" waits on #10. Every candidate in section 1 has a date; none is picked |
| **Presentation** | Problem, solution, approach, **limitations**, a working demo, in ≤ 3 min | The v4 video plan (two wows, Twinkle hook, Var. XII "I can't play this yet"); `docs/story.md` has filmable beats; `operator-replay` shows the build | Add a limitations beat (the Chrome MIDI stall, latency calibration, what's provisional). Add who did what. The 3-minute cap is hard: the deep dive goes in the write-up (decision 001 row 14) |

### Submission checklist (owner: whoever submits; the agents prepare it)

- [ ] Devpost title and short description: what it does, how it was built.
- [ ] Public repo link. The repo has **no `LICENSE` file** on `main` [verified]; Best Open Source needs "a clear
      open-source license". Choosing one is a team decision.
- [ ] Video ≤ 3:00, public link. It covers the challenge statement's three asks (what it does, what was hard, why it's
      recent), limitations, and who did what.
- [ ] Roster: 2–5, every member registered.
- [ ] Sponsor prizes ticked: only ones we actually qualify for (section 5).
- [ ] Submitted with buffer before Sun 5:00 PM ET; late is refused.
- [ ] Monday: at least one member at the Reitz Union by 10:15 AM.

## 5. Prizes and what each sponsor wants

The Site prizes page now matches Devpost's prize list [verified 2026-10-24 02:30 ET]: the four $200 category prizes
and DSI's Best Use of ML that the Site listed earlier are gone. That answers most of #41. Only the total differs:
the Site says "$5,000+", Devpost says "$6,000+" in its prize header and "$5,000+" in its text.

| Prize | Value | To qualify | Our fit [guess] |
|---|---|---|---|
| 1st / 2nd / 3rd | $2,000 / $1,000 / $500 cash | The main judging (sections 2–3) | The target |
| Vobile Prize | "A major prize", amount TBA | Vobile's top pick, **judged on the challenge statement** | Vobile does copyright protection and content monetization for studios, labels and rights holders, "powered by AI" (us.vobile.com). Cited public-domain and openly licensed sources (decision 003 loosens this to CC BY / CC BY-SA with credit) fit that. A ripped copyrighted song ("Golden") works against it |
| Best Use of Gemini (MLH) | MLH swag per member | Use the Gemini API or Google AI Studio | The coach "expected on Gemini" (`coach` spec, provisional). Lyria 3.5 and Gemini 3.8 Live are both in AI Studio |
| Best Open Source (MLH) | $25 gift card per member | Public GitHub repo with a clear open-source license | One `LICENSE` file away, once the team picks a license. Check every dependency's license first |
| Best Use of the Twinly API | 1st: internship interview fast-track, $750 usage credit, 3 months Twinly Max each; 2nd: $500 credit, 3 months Pro | Use Twinly's computer-use, voice-clone calling or iMessage APIs; macOS only | Weak and not in any spec. Twinly's endpoints run on the key owner's Mac and act as them (texts from their number, calls in their voice). One honest fit: text a player their practice summary. Not planned |

"Twinly $1,250 in cash" on Devpost is credits, subscriptions and an interview in its own breakdown [verified].
One project can win a main award and sponsor prizes (Site FAQ) [verified]. Prizes split evenly among members.

## 6. Past winners and what they had in common

| Year | Theme (challenge) | Winners [verified, Devpost galleries and UF pages] |
|---|---|---|
| 2022 | "AI for Social Good": the UN's 17 sustainable development goals | K-Boston Analysis (k-means on climate data for underserved Boston neighborhoods), GuppyAI (a conversational companion by language and education level), WeatherOrNot (climate what-if viewer), I2T-ASL (sign language to text and art), Automotive Mileage Monitor (traffic video to fuel cost), GatorTells |
| 2023 | Verizon: "Reimagine Digital Experience with GenAI" | Where's My Water! (1st: groundwater prediction from USGS data; soil and water science, CS and data science), A.I.R.A (voice shopping assistant), ChatGIT (chat for the git CLI) |
| 2024 | UF/IBM, disasters (all 24 projects are disaster tools) | **AidLink (1st)**: phone a number, an IBM Watson voice agent takes your location and needs, responders see requests on a map. Also BeHeal, Atlas, EcoLogic, ClaimGuard |
| 2025 | Not found | **Plato's Cave (1st)**: agents split a research paper into claims, verify them on the web, and the user explores them as a flowchart; judges cited the human-in-the-loop design. Team included this year's judge Matheus Kunzler Maldaner. 2nd and 3rd: not found in text (the AI² Center page links a video) |

Patterns [guess, from the table]:
- **A named problem, a named user, a working thing.** AidLink had a real phone number judges could call. Plato's Cave
  made AI checkable by a person.
- **The year's sponsor tech, used centrally.** AidLink ran on IBM Watson in the IBM year. This year the statement
  itself asks for a recent technology, which is the same pattern.
- **Trust in AI is a theme the judge pool rewarded**: Plato's Cave won on verifying AI output. Our `mission.md`
  rule "anything an LLM says about a take must be checked against the results data" is the same idea; show it.
- **Every winner was a tool, not a game.** Our risk; our answer is "it teaches" (section 4, Impact).
- Each AidLink teammate wrote their own contribution on Devpost. Past rules required it.

## 7. Workshops still ahead (Site schedule, tentative)

| When | Workshop | Why it might matter [guess] |
|---|---|---|
| Sat 1:30 PM | "Can AI Hear? Audio to ML Features" (IEEE Signal Processing Society) | Audio features for the coach or song ripping |
| Sat 4:00 PM | SQLite & Relational Databases (Society of Software Developers) | Not needed: take-store is on Supabase |
| Sat 7:30 PM | Agents 101 (UF AI Club) | Our build story is agents |
| Sun 11:00 AM | **How to Nail the Pitch** (SwampHacks) | Before the video is cut |
| Sun 1:00 PM | How to Use Claude (Data Science & Informatics, the organizing club) | The organizers' own view of Claude, relevant if #10 picks Opus 5.x |
| Sun 9:30 AM | Mentor office hours (Devpost overview) | Ask about #43 and the license |

## 8. Hard dates

| What | When (ET) | Source |
|---|---|---|
| Fresh-code window | Fri Oct 23, 5:00 PM to Sun Oct 25, 5:00 PM | Devpost rules |
| Submission deadline | Sun Oct 25, 5:00 PM EDT | Devpost overview |
| Finals | Mon Oct 26, 10:15–11:15 AM, Reitz Union | Devpost rules |
| Awards | Mon Oct 26, 12:15 PM | Devpost rules |

Agents plan by `specs/milestones.toml` only (its `start` is empty); these dates are for the submission.

## 9. Open questions

| # | Question | Status, 2026-10-24 03:00 ET |
|---|---|---|
| #10 | Which recent technology is central | Open (one-way door). Candidates with dates: section 1 |
| #41 | Which prize list is real | **Mostly answered**: the Site now matches Devpost. Only the total differs |
| #42 | Two-UF-department rule | Devpost rules require members from two UF departments; the FAQ says any school. Sharan reports the team covers it (2026-10-24); organizers not asked |
| #43 | Is novelty judged | Still two versions. The rules (round 1) and the Site include it: plan for it |
| #44 | Exact challenge statement | **Answered**: on the Site home (section 1). The opening ceremony may have added detail; the Discord wasn't read |
| #45 | Who judges round 1 | **Mostly answered**: UF graduate students per the rules; Devpost names Matheus Kunzler Maldaner and Sanethia Thomas |

## Not read

- The event Discord (login). Anything said only at the opening ceremony.
- The 2024 and 2025 recap and winners videos (video, not text); 2025's 2nd and 3rd place.
- MLH's own pages for its two prizes (Devpost's text is used).

## Sources

All read 2026-10-24 between 02:00 and 03:00 ET unless marked.

| Short name | URL |
|---|---|
| Site home | https://ufgatorhack.com/ |
| Site about | https://ufgatorhack.com/about.html |
| Site prizes | https://ufgatorhack.com/prizes.html |
| Site FAQ | https://ufgatorhack.com/faq.html |
| Site schedule | https://ufgatorhack.com/schedule.html |
| Site sponsors | https://ufgatorhack.com/sponsors.html |
| Site team | https://ufgatorhack.com/team.html |
| Devpost overview | https://gatorhack2026.devpost.com/ |
| Devpost rules | https://gatorhack2026.devpost.com/rules |
| 2024 Devpost (UF/IBM) | https://uf-aidays-hackathon.devpost.com/ and /project-gallery |
| 2023 Devpost (Verizon) | https://ufgatorhackathon.devpost.com/ and /project-gallery |
| 2022 Devpost | https://ufai-days-hackathon.devpost.com/ and /project-gallery |
| AidLink write-up | https://devpost.com/software/aidlink-isoz04 |
| 2025 winner (UF ECE) | https://ece.ufl.edu/2025/11/10/uf-student-hackers-enter-platos-cave-for-first-place-win/ |
| 2023 winner (UF IFAS) | https://blogs.ifas.ufl.edu/swsdept/2023/10/20/wheres-my-water-wins-uf-ai-days-hackathon/ (read 2026-10-24 00:47 ET) |
| AI² Center, AI Days | https://www.ai.ufl.edu/ai-days/ |
| Twinly developer API | https://www.twinly.tech/docs/developer-api |
| Vobile | https://us.vobile.com/ |
| Claude Opus 5 | https://www.anthropic.com/news/claude-opus-5 (system card dated 2026-07-24) |
| Claude Opus 5.5 | https://www.anthropic.com/claude-opus-5-5 (system card dated 2026-09-22) |
| Google, September 2026 AI updates | https://blog.google/innovation-and-ai/technology/ai/google-ai-updates-september-2026/ (dated 2026-10-02) |
| MuScriptor | https://arxiv.org/abs/2607.08168 |
| PDMX | https://arxiv.org/abs/2409.10831 |
