# Event: Gator Hack V rules, judging and prizes

Refs #35. Research only: no spec, no milestone, no code. Read on the open web on 2026-10-24: first pass 00:40–00:50
ET, full re-read 02:00–03:00 ET, by Claude for Sharan.

Labels follow `competitors.md`: **[verified]** read on a primary page; **[unverified]** secondhand or not confirmed;
"not found" means we looked and found nothing.

**About the quotes.** Quoted lines below are exact, but long sections are given as short exact excerpts with
summaries between them, never as one full block. Before relying on a section, open its URL and paste the full text
under it, marked **[pasted by Eric]**. The Re-check checklist at the end covers this.

## Sources

| Short name | URL | Read (ET) |
|---|---|---|
| Site home | https://ufgatorhack.com/ | 2026-10-24 02:10 |
| Site prizes | https://ufgatorhack.com/prizes.html | 2026-10-24 02:30 |
| Site FAQ | https://ufgatorhack.com/faq.html | 2026-10-24 02:35 |
| Site schedule | https://ufgatorhack.com/schedule.html | 2026-10-24 02:30 |
| Site sponsors | https://ufgatorhack.com/sponsors.html | 2026-10-24 02:30 |
| Site about | https://ufgatorhack.com/about.html | 2026-10-24 02:40 |
| Devpost overview | https://gatorhack2026.devpost.com/ (linked from the site as "View Devpost") | 2026-10-24 02:05 |
| Devpost rules | https://gatorhack2026.devpost.com/rules | 2026-10-24 02:10 |
| Twinly developer API | https://www.twinly.tech/docs/developer-api (linked from Devpost's Twinly prize) | 2026-10-24 02:50 |
| Vobile | https://us.vobile.com/ | 2026-10-24 02:50 |

## 1. The challenge statement

**[verified, Site home]**, under "Friday, 5:00 PM opening ceremony":

> **"Fresh off the frontier"**

Exact excerpts, with the rest summarized:
- > "a technology, dataset, or discovery first made publicly available within the past 12 months"

  used to solve a problem, explore an idea or create an experience in a field you care about.
- Teams are encouraged to bring their own field; the page names biology, music and history as examples.
- > "The new technology or resource should be central to what you build."
- Be ready to show what it does and the difficulties faced, and to explain what makes it recent.

The public pages also say, unchanged since the first pass:

> "Anything you are excited about!" (Devpost overview)

> "build anything you’re excited about!" (Site FAQ)

The Site schedule lists "challenge statements" (plural) for the opening ceremony; only this one is published.
The first pass found the statement on Discord only; it has since been posted on the Site home (#44).

## 2. Judging criteria

Three pages list criteria, and they differ (conflict 3, #43). No page gives weights [verified: none found].

**Devpost overview** [verified], four criteria. Short exact excerpts plus a summary:
- **Impact:** how meaningful the problem is and how useful the solution is to its users.
- **Technical Execution:** how well it works, including technical ambition, implementation quality, creativity, and
  what the team accomplished during the hacking period.
- **Design & Usability:** whether the experience is intuitive, accessible, and well designed.
- **Presentation & Demo:** how clearly the team explains "the problem, solution, technical approach, and
  limitations", and whether the demo shows the project working.

**Devpost rules** [verified]:
> "based on impact, technicality, design, novelty, and presentation"

**Site prizes** [verified], five criteria:
- **Impact:** "How much positive change your project creates."
- **Technicality:** "The complexity and quality of your solution."
- **Design:** "The user experience and visual appeal."
- **Novelty:** "How new your idea is, and how new the tools behind it are."
- **Presentation:** "How well you communicate your idea and demo."

**Process:**
> "Round one is judged offline by a panel of UF graduate students after submissions close" (Devpost rules)

> "A panel of assigned judges reviews every project and selects the top 10 finalists." (Site prizes)

> "Judges' decisions are final." (Devpost rules)

The Devpost overview lists two judges by name: Matheus Kunzler Maldaner ("Student Organizer") and Sanethia Thomas
("Associate Professor") [verified]. The Site team page's Judges section says "Coming soon" [verified].

## 3. Submission requirements

**Devpost overview** [verified], summarized from the "what to submit" list (exact phrases in quotes):
- A project title and a short description of what it does and how it was built.
- A link to a public code repository.
- A demo video, "3 minutes maximum", or slides. An honest work-in-progress demo is acceptable.
- A full team roster of 2 to 5 members, all registered.
- The sponsor prizes the team wants considered.
- > "Late submissions cannot be accepted, so leave buffer time before the deadline."

**Devpost rules** [verified]:
> "Projects must be submitted through Devpost by the deadline. One project per team."

**Site FAQ** [verified]: a working demo (or honest progress), the code repository, and a brief write-up of what it
does and how it was built.

The rules page states no video length, repo or license rule [verified: not found there]. A **license** is required
only for the Best Open Source prize (section 5). As of `8d087a6` this repo has no `LICENSE` file [verified].

## 4. Eligibility

| Rule | Exact text | Source |
|---|---|---|
| Who | "open to currently enrolled students from any school, and participation is in person only" | Devpost rules |
| Who | "Any currently enrolled student from any school is welcome" | Site FAQ |
| Age | "Participants must be at least 18 years old (the age of majority)." Under-18s email the organizers first (summary) | Devpost rules |
| Team size | "Teams must have 2 to 5 members." Solo registration is allowed; solo submissions aren't eligible (summary) | Devpost rules |
| Team size | "Teams must have 2 to 5 people, so solo projects are not eligible." | Site FAQ |
| **Departments** | "Each team must include members from at least two different UF departments" | Devpost rules |
| Departments | "Every major is welcome, and there’s no coding requirement to attend." | Site FAQ |
| Fresh code | "All project code must be written during the hacking period" | Devpost rules |
| Fresh code | "All code must be written during the hacking period" and "Projects must be started at the event." | Site FAQ |
| Allowed | Open-source libraries, frameworks and public APIs are allowed; pre-written project code is not (summary) | Devpost rules |

The department rule is conflict 2 (#42). Sharan reports the team meets it (2026-10-24); organizers weren't asked.

## Hard deadlines

Agents plan by `specs/milestones.toml` only; these dates are facts for the pitch and submission.

| What | When | Source |
|---|---|---|
| Fresh-code window | Fri Oct 23, 5:00 PM to Sun Oct 25, 5:00 PM ET | Devpost rules |
| Submission deadline | Sun Oct 25, 5:00 PM ET (submissions due on Devpost) | Devpost overview; Site schedule |
| Finalists announced | Live at Monday's ceremony | Devpost overview; Site schedule |
| Finals | Mon Oct 26, 10:15 to 11:15 AM, Reitz Union, top 10 present live | Devpost rules; Site prizes |
| Attendance | "At least one member of each team must be physically present at the Monday, October 26 finals" | Devpost rules |
| Attendance | "If no team member is present, the team cannot win." | Site FAQ |
| Awards | Mon Oct 26, 12:15 PM, AI Student Competition Awards | Devpost rules; Site schedule |

> "All times and events are subject to change." (Site schedule)

## 5. Prizes

Since the first pass, the Site prizes page has changed to **the same prize list as Devpost** [verified 02:30 ET]:
its four $200 category prizes (Beginner, Design, AI, Social Impact) and DSI's Best Use of ML are gone. Only the total
still differs (#41).

| Prize | Site prizes [verified] | Devpost overview [verified] |
|---|---|---|
| 1st / 2nd / 3rd | $2,000 "Best overall project." / $1,000 "Runner-up team award." / $500 "Third overall winner." | $2,000 / $1,000 / $500 cash, 1 winner each |
| Best Use of Gemini (MLH) | "Assorted swag from MLH." | MLH swag per member; build with the Google Gemini API or Google AI Studio |
| Best Use of the Twinly API | $1,250. 1st: a fast-tracked internship interview, $750 credit, 3 months Twinly Max per member; 2nd: $500 credit, 3 months Twinly Pro per member | Same breakdown, listed as "$1,250 in cash", 2 winners. Uses Twinly's "computer use, voice-clone calling and iMessage" APIs; "macOS only" |
| Best Open Source Project (MLH) | "$25 gift cards", one per member | $25 gift card per member; needs "a public GitHub repository with a clear open-source license" |
| Vobile Prize | "Prize TBA". "judged on the same challenge statement" | "amount to be announced". Judged on the same challenge statement as the main awards |
| Total | "$5,000+" | "$6,000+" in the prize header; "$5,000+" in the overview text |

From the Site FAQ: "a project can take a main award and also win sponsor prizes it qualifies for." and "Prizes are
split evenly among team members and paid out after the event."

**Note on Twinly's "$1,250 cash":** the Devpost breakdown is usage credit, subscriptions and an interview, not cash
[verified from the same page]. Read the real value as credits.

### What each sponsor says it wants

| Sponsor | Role (Site sponsors) | What it says it wants |
|---|---|---|
| Vobile | "Gator Hack Sponsor" | Not stated beyond judging on the challenge statement. Its own site: copyright protection and content monetization "powered by AI technologies", for platforms, film studios, TV networks, sports leagues, music labels and other rights holders (VideoTracker, RightsID, ChannelID, Vobile Insights) [verified]. It acquired Pex, a music-identification company, in 2025 ([Digital Music News](https://www.digitalmusicnews.com/2025/04/14/vobile-pex-acquisition/)) [verified, first pass] |
| Twinly | "Gator Hack Sponsor" | Use of its new computer-use, voice-clone calling and iMessage APIs (Devpost). Its docs: one API key acts as the key owner; Mac endpoints (send and read iMessages, place a call in the owner's cloned voice, run a task) run in the Twinly app on the owner's Mac; cloud endpoints (chat, images, computer-use next action) answer from Twinly's servers [verified] |
| MLH | "Best Use of Gemini" | Gemini API or Google AI Studio (Devpost). Open Source: a public repo with a clear license (Devpost) |
| UF DSI | "Organizing club" | Not stated |
| NVIDIA | "AI Days Platinum Sponsor" (AI Days, not a Gator Hack prize) | Not stated |

## Past winners, to show the bar

| Year | Challenge | Winner | One line | Source |
|---|---|---|---|---|
| 2025 | not found | Plato's Cave (FINS team), 1st | Splits a research paper into claims, agents verify them on the web, the user explores a flowchart; judges cited the human-in-the-loop design | [UF ECE](https://ece.ufl.edu/2025/11/10/uf-student-hackers-enter-platos-cave-for-first-place-win/) |
| 2024 | UF/IBM, natural disasters | AidLink, 1st | Phone a number and an IBM Watson voice agent records your location and needs; responders see requests on a map | [Devpost](https://devpost.com/software/aidlink-isoz04) |
| 2024 | | BeHeal; Atlas; EcoLogic; ClaimGuard | Disaster mental-health volunteer training; hospital-load forecasts after hurricanes; logic-gate networks on FPGAs for climate; insurance-claim error checks. All marked "Winner" | [Gallery](https://uf-aidays-hackathon.devpost.com/project-gallery) |
| 2023 | Verizon, "Reimagine Digital Experience with GenAI" | Where's My Water!, 1st | Generative AI web app that visualizes and predicts U.S. groundwater levels from USGS data | [UF IFAS](https://blogs.ifas.ufl.edu/swsdept/2023/10/20/wheres-my-water-wins-uf-ai-days-hackathon/) |
| 2023 | | A.I.R.A; ChatGIT | A voice-controlled shopping assistant; a chat interface for the git CLI. Both marked "Winner" | [Gallery](https://ufgatorhackathon.devpost.com/project-gallery) |
| 2022 | "AI for Social Good" (the UN sustainable development goals) | K-Boston Analysis; GuppyAI; WeatherOrNot; I2T-ASL; Automotive Mileage Monitor; GatorTells | Climate clustering for Boston neighborhoods; a conversational companion; climate what-if viewer; sign language to text and art; traffic video to fuel cost; data for sustainability. All marked "Winner" | [Gallery](https://ufai-days-hackathon.devpost.com/project-gallery) |

Past Devpost pages (2022–2024) also required the video to show how teammates from different disciplines
collaborated and each teammate's responsibilities [verified]. The 2026 pages don't ask for this.

## Conflicts

Each has its own `needs-human` issue. Until it's answered, agents treat both sides as unconfirmed and plan on neither.

1. **Prize list** (#41). Now the same prizes on both pages (section 5); only the total differs: Site "$5,000+",
   Devpost "$6,000+" and "$5,000+".
2. **Department rule** (#42). Devpost rules: "Each team must include members from at least two different UF
   departments". Site FAQ and Devpost rules' own eligibility line: students "from any school".
3. **Judging criteria** (#43). Devpost overview has four (no novelty); Devpost rules and the Site have five, with
   novelty (section 2).
4. **Challenge statement** (#44). Devpost and the FAQ say build anything; the Site home has "Fresh off the frontier"
   (section 1). The first pass couldn't find the statement; now it's published.
5. **Round 1 judges** (#45). Devpost rules: "a panel of UF graduate students". Site prizes and FAQ: "a panel of
   assigned judges". Devpost names two judges (section 2).

## Not read

- The event Discord (login), and anything said only at the opening ceremony.
- Registration emails to participants (login).
- MLH's own pages for Best Use of Gemini and Best Open Source (not found by search; the Devpost text is used).
- The 2024 recap and 2025 winners videos on YouTube (video, not text); 2025's 2nd and 3rd place.
- Devpost's "Updates" tab had no posts on Oct 24, 00:44 ET.

## Re-check before submitting

Once, before Eric submits, re-read each source and diff it against this doc:
- [ ] Section 1: the challenge statement on the Site home, pasted in full and marked **[pasted by Eric]**, plus
      anything added at the opening ceremony or on Discord.
- [ ] Section 2: judging criteria on Devpost overview, Devpost rules and Site prizes.
- [ ] Section 3: the Devpost "what to submit" list, especially the video cap.
- [ ] Section 4: eligibility, especially the two-department rule.
- [ ] Section 5: every prize on Devpost, and that the ones we tick in the submission exist there.
- [ ] Every conflict issue has an answer, or the doc says it's still open.
