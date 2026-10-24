# Event: Gator Hack V rules, judging and prizes

Refs #35. Research only: no spec, no milestone, no code. Read on the open web on 2026-10-24 between 00:40 and
00:50 ET by Claude, for Sharan.

Labels follow `competitors.md`: **[verified]** read on a primary page; **[unverified]** secondhand or not confirmed;
"not found" means we looked and found nothing.

**About the quotes.** The tool that read these pages caps each verbatim quote at about 125 characters. So every
quoted line below is exact, but long sections are given as several exact excerpts with summaries between them,
never as one full block. Before relying on a section, open its URL and paste the full text under it, marked
**[pasted by Eric]**.

## Sources

| Short name | URL | Read |
|---|---|---|
| Site home | https://ufgatorhack.com/ | 2026-10-24 00:44 ET |
| Site prizes | https://ufgatorhack.com/prizes.html | 2026-10-24 00:47 ET |
| Site FAQ | https://ufgatorhack.com/faq.html | 2026-10-24 00:47 ET |
| Site schedule | https://ufgatorhack.com/schedule.html | 2026-10-24 00:47 ET |
| Site sponsors | https://ufgatorhack.com/sponsors.html | 2026-10-24 00:47 ET |
| Devpost overview | https://gatorhack2026.devpost.com/ (linked from the site as "View Devpost") | 2026-10-24 00:44 ET |
| Devpost rules | https://gatorhack2026.devpost.com/rules | 2026-10-24 00:44 ET |

## 1. The challenge statement

**Not read.** The site says the statement is released on Discord:

> "The challenge statement is announced at the opening ceremony. Join the Discord to see it the moment it drops."
> (Site home)

No page we could reach has the text. What the public pages say instead:

> "Anything you are excited about!" (Devpost overview)

> "build anything you’re excited about!" (Site FAQ)

`specs/mission.md` and #10 call it "Fresh off the frontier": a technology, dataset or discovery first made public
in the past 12 months, central to the project. #10 also says "The video has to say what makes it recent
(ufgatorhack.com)". **We didn't find that sentence on any ufgatorhack.com page** (home, about, prizes, FAQ,
schedule, sponsors). It may be on Discord. Conflict 4 below (#44).

## 2. Judging criteria

Three pages list criteria, and they differ (conflict 3, #43). No page gives weights [verified: none found].

**Devpost overview** [verified], four criteria. Short exact excerpts plus a summary:
- **Impact:** how meaningful the problem is and how useful the solution is to its users.
- **Technical Execution:** how well it works, including technical ambition, implementation quality, creativity, and
  what the team accomplished.
- **Design & Usability:** whether the experience is intuitive, accessible, and well designed.
- **Presentation & Demo:** how clearly the team explains "the problem, solution, approach, and limitations", and
  whether the demo shows the project working.

**Devpost rules** [verified]:
> "based on impact, technicality, design, novelty, and presentation"

**Site prizes** [verified], five criteria (summaries of each one-line description):
- **Impact:** how much positive change the project creates.
- **Technicality:** the complexity and quality of the solution.
- **Design:** the user experience and visual appeal.
- **Novelty:** how new the idea is **and how new the tools behind it are**.
- **Presentation:** how well the idea and demo are communicated.

The novelty line matters for #10: on the site, novelty covers the tools as well as the idea.

**Process:**
> "Round one is judged offline by a panel of UF graduate students after submissions close" (Devpost rules)

> "a panel of assigned judges reviews every project and narrows the field to 10 finalists." (Site FAQ)

> "Judges' decisions are final." (Devpost rules)

## 3. Submission requirements

**Devpost overview** [verified], summarized from the "what to submit" list (exact phrases in quotes):
- A project title and a short description of what it does and how it was built.
- A link to a public code repository.
- A demo video, "3 minutes maximum", or slides. A work-in-progress demo is acceptable.
- A full team roster of 2 to 5 members, all registered.
- The sponsor prizes the team wants considered.
- > "Late submissions cannot be accepted, so leave buffer time before the deadline."

**Devpost rules** [verified]:
> "Projects must be submitted through Devpost by the deadline. One project per team."

The rules page states no video length, repo or license rule [verified: not found there]. A **license** is required
only for the Best Open Source prize (section 5). As of `c1b88e3` this repo has no `LICENSE` file.

## 4. Eligibility

| Rule | Exact text | Source |
|---|---|---|
| Who | "Gator Hack V is open to currently enrolled students from any school, and participation is in person only." | Devpost rules |
| Who | "Any currently enrolled student from any school is welcome, undergraduate or graduate, from every major and skill level." | Site FAQ |
| Age | "Participants must be at least 18 years old (the age of majority)." Under-18s email the organizers first (summary) | Devpost rules |
| Team size | "Teams must have 2 to 5 members." Solo registration is allowed; solo submissions aren't eligible (summary) | Devpost rules |
| Team size | "Teams must have 2 to 5 people, so solo projects are not eligible." | Site FAQ |
| **Departments** | "Each team must include members from at least two different UF departments" | Devpost rules |
| Departments | "Every major is welcome, and there’s no coding requirement to attend." | Site FAQ |
| Fresh code | "All project code must be written during the hacking period" | Devpost rules |
| Fresh code | "All code must be written during the hacking period." and "Projects must be started at the event." | Site FAQ |
| Allowed | Open-source libraries, frameworks and public APIs are allowed; pre-written project code is not (summary) | Devpost rules |

**The department rule is the one to settle now** (conflict 2, #42). If it holds, the roster needs two people from two
different UF departments, and an all-CS team, or a team with a non-UF member counted toward it, may be ineligible.

## Hard deadlines

Agents plan by `specs/milestones.toml` only; these dates are facts for the pitch and submission.

| What | When | Source |
|---|---|---|
| Fresh-code window | Fri Oct 23, 5:00 PM to Sun Oct 25, 5:00 PM ET | Devpost rules |
| Submission deadline | "Deadline: Oct 25, 2026 @ 5:00pm EDT" | Devpost overview |
| Finalists announced | Before Monday morning | Devpost rules; Site schedule |
| Finals | Mon Oct 26, 10:15 to 11:15 AM, Reitz Union, top 10 present live | Devpost rules; Site prizes |
| Attendance | "At least one member of each team must be physically present at the Monday, October 26 finals" | Devpost rules |
| Attendance | "If no team member is present, the team cannot win." | Site FAQ |
| Awards | Mon Oct 26, 12:15 PM, AI Student Competition Awards | Devpost rules; Site schedule |

> "All times and events are subject to change." (Site schedule)

## 5. Prizes

The site and Devpost list **different prizes** (conflict 1, #41). Both lists, side by side, picking neither.

| Prize | Site prizes [verified] | Devpost overview [verified] |
|---|---|---|
| 1st / 2nd / 3rd | $2,000 "Best overall project." / $1,000 "Runner-up team award." / $500 "Third overall winner." | $2,000 / $1,000 / $500 cash, 1 winner each |
| Best Beginner Hack | $200, "For first-time hackers." | not listed |
| Best Design | $200, "Outstanding UI/UX." | not listed |
| Best AI Hack | $200, "Creative use of AI." | not listed |
| Best Social Impact | $200, "Tech for good." | not listed |
| Best Use of ML | TBA, presented by UF Data Science & Informatics (DSI) | not listed |
| Best Use of Gemini | MLH swag | MLH swag per member; must use the Google Gemini API or Google AI Studio |
| Twinly | Twinly Max, 3 months, for the winners; Twinly Pro for 2nd | "Best Use of the Twinly API", $1,250 cash, 2 winners. 1st: a fast-tracked internship interview, $750 Twinly usage credit, 3 months Twinly Max per member. 2nd: $500 usage credit, 3 months Twinly Pro per member. Uses Twinly's computer use, voice-clone calling and iMessage APIs; macOS only |
| Best Open Source Project (MLH) | not listed | $25 gift card per member; needs a public GitHub repo with a clear open-source license |
| Vobile Prize | not listed | 1 winner, amount TBA, judged on the main challenge statement |
| Total | "$5,000+" | "$6,000+" in one place and "$5,000+" in another [unverified which] |

From the Site FAQ: "a project can take a main award and also win sponsor prizes it qualifies for." and "Prizes are
split evenly among team members and paid out after the event."

**Note on Twinly's "$1,250 cash":** the Devpost breakdown is usage credit, subscriptions and an interview, not cash
[verified from the same page]. Read the real value as credits.

### What each sponsor says it wants

| Sponsor | Role (Site sponsors) | What it says it wants |
|---|---|---|
| Vobile | "Gator Hack Sponsor" | Not stated for the hackathon. Its own site: a "provider of digital content asset protection and transaction software as a service", products for copyright protection and monetization (VideoTracker, RightsID, ChannelID), serving studios, music labels and other rights holders ([us.vobile.com](https://us.vobile.com/)) [verified]. It acquired Pex, a music-identification company, in 2025 ([Digital Music News](https://www.digitalmusicnews.com/2025/04/14/vobile-pex-acquisition/)) [verified]. **Implication [guess]:** a copyrighted song ripped into a level ("Golden") works against this sponsor's business. A public-domain library with cited sources works with it |
| Twinly | "Gator Hack Sponsor" | Use of its computer use, voice-clone calling and iMessage APIs, macOS only (Devpost). Twinly's own page: not found |
| MLH | Sponsors Best Use of Gemini | Gemini API or Google AI Studio (Devpost). Open Source: a public repo with a clear license (Devpost) |
| UF DSI | Sponsors Best Use of ML | Not stated; prize TBA |
| NVIDIA | "AI Days Platinum Sponsor" (AI Days, not a Gator Hack prize) | Not stated |
| OpenAI | "Additional Supporters" | Not stated |

## Past winners, to show the bar

| Year | Winner | One line | Source |
|---|---|---|---|
| 2025 | Plato's Cave (FINS team), 1st | Splits a research paper into claims, agents verify them on the web, the user explores a flowchart; judges cited the human-in-the-loop design | [FINS](https://fins.institute.ufl.edu/index.php/2025/10/28/fins-students-win-top-prize-at-uf-ai-days-gator-hack-for-human-centered-ai-research-tool/) (linked from Site home), [UF ECE](https://ece.ufl.edu/2025/11/10/uf-student-hackers-enter-platos-cave-for-first-place-win/) |
| 2023 | Where's My Water!, 1st | Generative AI web app that visualizes and predicts U.S. groundwater levels from USGS data; team from soil and water science, CS and data science | [UF IFAS](https://blogs.ifas.ufl.edu/swsdept/2023/10/20/wheres-my-water-wins-uf-ai-days-hackathon/) (linked from Site home) |
| Year not shown | A.I.R.A; ChatGIT | A voice-controlled shopping assistant; a chat interface for the git CLI. Both marked "Winner" | [Devpost gallery](https://ufgatorhackathon.devpost.com/project-gallery) [unverified year] |
| 2024 | not found | The site links a "2024 Recap Video" only | Site home |

**Pattern [guess]:** every winner we found is a useful AI tool aimed at a real problem. None is a game.

## Conflicts

Each has its own `needs-human` issue. Until it's answered, agents treat both sides as unconfirmed and plan on neither.

1. **Prize list** (#41). The site lists four $200 category prizes and DSI's Best Use of ML; Devpost lists Twinly at $1,250,
   Best Open Source and the Vobile Prize instead (section 5). Devpost is where we submit and pick prizes.
2. **Department rule** (#42). Devpost rules: "Each team must include members from at least two different UF
   departments". Site FAQ and Devpost rules' own eligibility line: students "from any school". It affects whether
   our roster qualifies.
3. **Judging criteria** (#43). Devpost overview has four (no novelty); Devpost rules and the site have five, with novelty
   (section 2).
4. **Challenge statement** (#44). Devpost and the FAQ say build anything; `mission.md` and #10 cite "Fresh off the
   frontier" and a video rule we couldn't find on ufgatorhack.com (section 1).
5. **Round 1 judges** (#45). Devpost rules: "a panel of UF graduate students". Site FAQ: "a panel of assigned judges".
   Minor; worth one question to organizers.

## Not read

- The event Discord, including the challenge statement (login).
- Registration emails to participants (login).
- Twinly's own prize or API page (not found by search).
- MLH's own pages for Best Use of Gemini and Best Open Source (not found by search; the Devpost text is used).
- The 2024 and 2025 winners videos on YouTube (video, not text).
- Devpost's "Updates" tab had no posts on Oct 24, 00:44 ET.

## Re-check before submitting

Once, before Eric submits, re-read each source and diff it against this doc:
- [ ] Section 1: the challenge statement, from Discord, pasted in full and marked **[pasted by Eric]**.
- [ ] Section 2: judging criteria on Devpost overview, Devpost rules and Site prizes.
- [ ] Section 3: the Devpost "what to submit" list, especially the video cap.
- [ ] Section 4: eligibility, especially the two-department rule.
- [ ] Section 5: every prize on Devpost, and that the ones we tick in the submission exist there.
- [ ] Every conflict issue has an answer, or the doc says it's still open.
