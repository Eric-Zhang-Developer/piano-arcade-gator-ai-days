---
name: "Source-grounded piano learning with diagnosis, practice and retrieval"
depends_on: []
owns: []
assignee: ""
---

# Piano learning

**Status: planned backlog feature, not implemented.** This specification records the learning direction and accepted source-first baseline. It allocates no code ownership or assignee and adds no milestone. Before implementation, reconcile the provisional coach/practice specs and cross-lane contracts, identify concrete dependencies and divide the work into reviewable features. Empty frontmatter lists do not certify that the integration prerequisites are already available.

## Plan

1. Obtain the selected source editions with suitable access, preserve provenance and asset notices, and record actual coverage gaps.
2. Admit source-backed theory/procedure capabilities and eliciting task families with explicit rubrics and evidence boundaries; avoid a speculative complete ontology.
3. Agree the game/learning interface, then build one online account-based loop: goals, adaptive diagnosis, scope selection, learning/practice/retrieval, qualified evidence and agent planning.
4. Expose the four learning jobs and supporting map/arcade surfaces. Validate supported claims against educator judgments and subsequent independent performances before expanding coverage.

## Requirements

### 1. Purpose and status

Help learners build meaningful musical capability, complete chosen music, and retain and transfer what they learn. Beginner-to-expert reach is the long-term ambition; present supported coverage is limited to authored, sourced competencies with suitable assessment tasks and evidence channels. One authenticated student account carries goals, observations, learner beliefs, song history and scheduled work between desktop and laptop devices. Internet is required during a session. Mobile is outside scope.

**Settled product direction** includes the source-first baseline below, shared mastery criteria, diagnosis-before-scope selection, account continuity and online desktop/laptop sessions. **Proposed learning policies** include level labels, completion anchors and numerical inference. **Implementation choices** remain inspectable design work. A planning requirement is not a tested result or an empirically calibrated model.

The repository's mission and learning stubs describe an earlier, narrower game/coach scope. This planned learning direction extends those stubs, including accounts and agent-led learning; it does not silently amend frozen repository contracts. Shared game interfaces, ownership and implementation approval still follow project rules. Backend/model providers and numerical model constants are not selected by this spec.


#### Source-first teaching baseline

Use the following minimal source set. Begin with the sources and derive the graph from their supported meaning; do not design an exhaustive ontology first and fill it with generated material.

| Role | Selected source | Access and coverage boundary |
| --- | --- | --- |
| Theory teaching spine | **Open Music Theory, version 2**, using selected fundamentals, tonal harmony, form/chromaticism, introductory counterpoint and appropriate aural material. [Author-hosted book](https://viva.pressbooks.pub/openmusictheory/) | HTML text is publicly readable; the complete corpus has not been ingested or audited. Workbook links exist, but task coverage is incomplete in at least the sampled chapter. Select supported outcomes instead of claiming the entire textbook is implemented. |
| Introductory procedure teaching spine | **Alfred's Basic Adult All-in-One Course, Books 1-3**, combining lessons, technique, theory and musical practice. [Publisher Book 3 page](https://www.alfred.com/products/alfred-s-basic-adult-all-in-one-course-book-3-00-14540), [sample contents](https://content.alfred.com/catpages/00-14540.pdf) | Publisher description and Book 3 sample/TOC were inspected, not the full three volumes. Obtain the exact copies and appropriate access before ingestion. This instructor-oriented introductory method is not a complete advanced procedure curriculum. |
| Coverage and assessment reference | **RCM Piano Syllabus, 2022 Edition**, and **Theory Syllabus, 2016 Edition**. [Official index](https://www.rcmusic.com/syllabi) | Full syllabus PDFs and relevant sections were accessible. They describe requirements and reference tasks; they are not the instructional spine, complete score books or validated automated rubrics. No RCM Level 8/10 coverage or certification is promised. |
| Music and exercises | Alfred material and selected **Celebration Series, Sixth Edition, Piano Repertoire and Piano Etudes** editions appropriate to the supported capabilities. [Piano syllabus, pp.89-90 name the level-10 volumes](https://rcmusic-production-strapi-media.s3.ca-central-1.amazonaws.com/piano_syllabus_2022_edition_9c6a49bb96.pdf) | Full score books were not obtained or ingested. Choose exact editions, arrangements and passages with suitable access; a syllabus listing does not supply the score, recording or an app rubric. |

The accepted baseline is this source selection, not completed ingestion or a fixed examination-level ceiling. Keep any intermediate/advanced procedural coverage unsupported until a suitable teaching corpus, demonstrations, tasks and assessment channels are added and reviewed. Repertoire lists and technical tests do not fill that teaching gap. Specialist traditions, diploma/concert certification and comprehensive expert coverage are outside the current supported promise.

For each admitted capability, retain source edition/version and printed page, or HTML chapter URL with section/example anchor; extract source-supported relationships; define a task family, conditions, rubric and bounded evidence claims. Chapter sequence is not automatically a prerequisite graph. Prerequisite edges require a task-specific rationale and source support. Maintain explicit coverage and assessment gaps. Theory and procedure may be learned together; no compulsory theory-before-playing gate is imposed.

Access is distinct from reuse permission. The [inspected OMT chapter](https://viva.pressbooks.pub/openmusictheory/chapter/chords-in-satb-style/) declares book-level CC BY-SA 4.0 with exceptions and separately attributed CC BY-NC-SA 4.0 media. Preserve per-asset notices. No unrestricted reuse of Alfred, score editions or RCM PDFs is established by a public sample or download. No ingestion pipeline has been implemented by this specification.

### 2. Shared standards, two connected skill graphs

**Confirmed:** shared capability standards apply across students, with separate theory/procedure mastery evidence and one student identity/history. **Current working direction:** organize theory and procedure as two connected universal, hierarchical skill graphs, with several meaningful broad hubs in each. This is the current planning architecture, not a separately frozen or approved ontology. Theory concerns musical understanding and relationships; procedure concerns performing musical actions. Typed links connect them without granting automatic credit. Knowing a chord relationship does not demonstrate playing it; fluent execution does not establish an explanation or reading claim.

Universal means shared capability standards across students. Beginner-to-expert reach remains the long-term ambition, while the currently supported teaching/assessment envelope follows the admitted source-backed capabilities. It does not mean a complete ontology has already been authored or validated. Goals change relevance, route and schedule, never the standard for the same claim. Hierarchical depth describes semantic scope and resolution, not difficulty, proficiency or mandatory learning order. Prerequisites are typed, task-sensitive relationships, distinct from containment.

Every broad and narrow node has a learner-specific probability distribution over shared mastery levels, conditioned on evidence, time and criterion version. An unobserved node retains an explicitly uncertain prior, not zero ability. There is no global piano score or single placement label. Inspectable criterion profiles retain coverage, support, integration, consistency, novelty, contradictions and observed delay. Graph colors are summaries with text and evidence, not the model itself.

**Proposed:** Developing, Independent, Integrated and Adaptable are the proposed shared level labels. Each node needs fixed scope, operational nested anchors, task families, exclusions and assessment channels. Broad nodes need explicit coverage-and-integration criteria. Numerical priors, likelihoods, pooling, update rules, calibration and temporal evolution are unresolved implementation/model work. Labels and numbers must not imply validated psychological stages or calibrated certainty.

### 3. Entry and adaptive diagnosis

1. Collect the musical goal, desired song/role, any meaningful completion date, relevant prior experience, instrument/input mode and accessibility needs. Explain the arrangement and intended performance condition. Goals are available upfront; a goal alone does not select the learning subgraph.
2. Check capture validity and task accessibility. Reuse suitable account evidence. Begin diagnosis at informative foundations across the shared graphs, adapting upward in demand and across independent branches as warranted. A comfortable musical sample is an entry point, not a global grade.
3. Use playing, listening, recognition, constructed responses and musical-understanding tasks when they discriminate the claim. Distinguish reading, hearing, execution and integration. Descend to simpler or narrower contrasts when an integrated result is ambiguous. Failure in notation must not erase valid ear-playing evidence.
4. Establish initial per-node beliefs and explicit unknowns within the supported task families. A beginner or advanced learner may enter, but discussion of an above-envelope topic is not reliable assessment of it. Show unsupported/out-of-coverage claims explicitly. Stop when enough evidence supports useful next work, or when fatigue/measurement limits require stopping. An incomplete diagnosis is an incomplete profile, not a low placement.
5. Only then select the learning subgraphs from BOTH prior-knowledge beliefs and the goal. Preserve useful known anchors and relevant foundations. The agent revises scope as goals and evidence change.

Diagnosis continues inside lessons, arcade, practice and retrieval. A later activity can reveal a better route. A taught answer followed by an immediate repeat cannot masquerade as independent diagnostic evidence.

### 4. Four directly accessible functions

The navigation directly exposes the four learning jobs below. Understand, Practice and Play-through are provisional labels; the theory-retrieval label is also unsettled. The four-job split is the requirement. Map exploration, arcade and the initial diagnostic/check-in are supporting surfaces, not substitutes for these four jobs. No chatbot is the primary workspace. Remove redundant dashboards, decorative scores and repeated status panels; keep the current action, its resource/music, structured questions and necessary controls visible.

| Learning job | Main flow | Evidence boundary |
| --- | --- | --- |
| Theory encoding (Understand) | Place an active structured challenge beside pages/listening resources; the learner constructs an answer, connects ideas and receives feedback. | Record resource exposure and assistance. Reading pages does not establish mastery; the response supports only its elicited claim. |
| Procedural encoding (Practice) | Model the intended sound/action; guide attempts, give grounded feedback, fade unnecessary scaffolds and integrate joins, phrases and whole music. | Record demo/highway/click/tempo conditions. Supported practice is useful evidence, distinct from independent execution. |
| Theory retrieval (label provisional) | Elicit recognition, explanation, application or construction before answer-supplying assistance; then assess, correct and schedule an appropriate recheck. | Record task conditions and actual reasoning/correctness. Immediate independence, delayed retention and unfamiliar transfer remain separate claims. |
| Procedural retrieval (Play-through) | Declare the arrangement/passage and performance condition; obtain the first continuous attempt before guidance, then review, repair and schedule. | The score may remain for execution. Separate immediate independence, memorization, delayed retention and unfamiliar transfer; preserve song completion as its own claim. |

Supporting map exploration provides theory/procedure partition navigation, search, pan/zoom and inspection of capabilities, relationships, sources and evidence; exploration creates no mastery. Arcade offers cue-supported musical practice and game feedback, with scoring kept separate from skill inference and song completion. The initial diagnostic/check-in establishes and revisits useful evidence for routing through the four learning jobs.

The agent chooses route and schedule, balancing foundations, uncertainty, coherent song progress, maintenance and meaningful deadlines. It records a concise reason linked to evidence and an intended recheck. It may change support, tempo, scope or method within the goal; it may not silently replace the chosen musical aim or certify another arrangement as the requested one. Due for a check does not mean forgotten.

### 5. Encoding and retrieval in both graphs

| | Encoding | Retrieval |
| --- | --- | --- |
| Theory | Spark-style active challenge, resources including listening, and a learner-constructed answer that connects ideas. | Attempt before opening answer-supplying help; explain, identify, apply or construct under declared conditions, then receive correction. |
| Procedure | Model the intended sound/action; guided attempt; feedback; adapt and fade unnecessary scaffolds; integrate into joins, phrases and whole music. | Execute the declared task before assistance supplying the target. The score may remain for execution or reading. Record all supports and familiarity. |

Retrieval is not a blanket instruction to remove the score. Familiar music with the sheet visible can show independent execution if the assessed action is not supplied by guidance. It cannot establish memorization and is not fresh sight-reading evidence. Unseen material can test reading/transfer only where the task elicits those capabilities. An immediate independent attempt is not delayed retention. Retention requires a documented gap and exposure history; collect the first check before warming up the tested material. Guidance relevance is claim-specific: record it rather than automatically disqualifying every cue for every claim.

Meaningful phrase work includes starts and transitions, supported repair, overlap, larger sections and whole performances. Passage growth and elapsed retrieval delay are different variables. No universal fragment size, fixed spacing cadence, success percentage, automatic tempo doubling or random interleaving rule is confirmed.

### 6. Musical milestones and honest achievement

**Confirmed:** meaningful song completion and deadlines can motivate and reinforce learning; the agent incorporates them into route/schedule. The specific completion rubric below is proposed policy.

A completed milestone identifies arrangement/version and performance condition. Proposed criteria require a valid continuous full performance preserving essential sections/voices, temporal continuity, musical identity and baseline musical shape. Small recovered slips may qualify; an omitted section or supplied essential part cannot. Publish arrangement-specific anchors before assessment rather than inventing a universal error percentage.

Keep completion demonstrated, later consistency, further polish, memorization, current availability/retention and unfamiliar transfer separate. A later struggle does not erase historical completion. Green phrases do not certify their join or a whole song. Score-supported completion is legitimate when declared. MIDI-only results cannot certify unobserved musical shape or acoustic quality; leave those dimensions pending unless suitable audio or qualified observation exists. Media capture, retention and consent are not silently authorized by this requirement.

### 7. Evidence and inference architecture

One evidence store serves both graph partitions and every activity. The proposed record boundaries are:

| Record | Required meaning |
| --- | --- |
| Shared content | Stable graph/node identities; graph/criterion/task-family versions; scope, sources, typed relationships and operational rubrics. |
| Observation | Unique identity; student, task/arrangement/segment; actual response/events and received times; instrument/modality/capture validity; support/exposure/familiarity; tempo/style/task conditions and provenance. Unknown fields stay unknown. |
| Assessment | Reproducible derived measurements or grounded rubric judgment; assessor/policy version; eligible bounded claims; exclusions and uncertainty. Preserve original work rather than overwriting it with interpretation. |
| Learner projection | Per-node level distributions and criterion profiles in each graph; direct versus inferred evidence and unique lineage; contradictions and time-conditioned availability. |
| Song record | Arrangement-specific passage, start/join and whole-performance history; support conditions; completion and separate retention/transfer claims. |
| Agent plan | Chosen scope, next activity, rationale/evidence references, intended recheck, scheduled work and explicit deferrals. |

Deterministic code owns valid capture, idempotent ingestion, reproducible measurements, evidence eligibility and versioned inference mechanics. The agent owns pedagogical choice, interpretation hypotheses, scope and schedule. There is no AI per-note game loop. A model's coaching statement cannot manufacture observations or authorize its own unsupported mastery update.

No automatic parent, sibling or cross-graph credit: one observation may inform multiple explicitly supported claims through an appropriate joint update, but never be counted repeatedly as independent evidence. Broad mastery requires representative coverage and integration, not a child-color average. Invalid capture gives no negative learning credit. Familiar repetitions are not independent new task families. Same history plus same policy version should reproduce derived state; duplicate ingestion must add no credit.

Authenticated sync carries acknowledged progress between desktop/laptop devices. Exact backend, identity provider and conflict/reconnect mechanics are implementation choices. The session requires internet: show connection failures honestly, do not fabricate uploads or learning credit, and preserve acknowledged account history. Offline sessions or offline teaching/sync queues are not requirements.

### 8. Procedural and theory observations

Collect available MIDI pitch, received onset timestamps, attack velocity, release events and pedal controller events. Derive only qualified task-relative observations: note choice, timing/rhythm, tempo, evenness, chord simultaneity, articulation, dynamic proxies and pedaling. Event streams and these measurements are observations, not graph nodes or mastery by themselves.

Velocity is not measured sound loudness. Received timestamps do not guarantee physical onset accuracy; device/browser latency and stalls matter. Releases do not equal sounding duration under sustain. Rubato, rolled chords, articulation and pedal intent require the musical task. Missing device channels remain unavailable. MIDI alone cannot establish fingering, posture, hand identity, acoustic tone or the complete musical result. Laptop keys are a distinct modality and cannot establish piano touch technique.

Theory can use simpler keyed responses or scoped rubrics for correctness, reasoning/application, support and task conditions. Recognition, explanation, hearing and execution supply different evidence. Reading pages is exposure, not mastery. Model-based rubric judgments must remain grounded in the submitted answer and inspectable; an explanation does not automatically prove procedure.

### 9. Map requirements

The map must use the selected spatial composition: deterministic broad hubs that stay fixed during navigation, weighted outward hierarchical fans, typed curved crosslinks, camera-driven detail reveal, a viewport label budget and an inspector. Compute broad hub placement deterministically and keep it stable during navigation; do not run a continuously moving force simulation. Preserve stable content ordering/versioning and review layout changes.

Each theory/procedure partition contains meaningful hubs, with visible, inspectable links between relevant capabilities. Partition navigation changes the view, not identity/history or mastery. The inspector separates capability criteria, evidence, uncertainty, sources and relationship meaning. Faint previews mean display resolution; they must never mean ignorance. Exploration cannot mutate the learner model. Layout constants are presentation policies, not validated piano performance or cognitive limits.

### 10. Acceptance and implementation boundaries

These are proposed observable acceptance cases, not results already achieved. Review/evaluation must cover the supported demand range and uneven profiles. Long-term ambition does not substitute for admitted content or observed evidence.

- Goal intake precedes diagnosis, while the learned scope is selected afterward using both goal and prior knowledge. Contrasting profiles receive justified different probes/routes; untested regions stay unknown, and above-envelope capabilities are marked unsupported.
- A reviewer can trace each supported capability and task to an exact source version/page or HTML section, inspect its rubric/eligible evidence, and identify content/access gaps. Chapter order creates no automatic prerequisite. A source listing or syllabus level cannot certify advanced coverage.
- Every broad/narrow node has its distribution and evidence condition. A notation failure preserves valid ear-playing evidence; theory success grants no automatic procedural credit; one child success cannot certify its parent.
- Theory encoding, procedural encoding, theory retrieval and procedural retrieval are directly reachable on desktop/laptop; labels remain provisional. Map, arcade and diagnostic/check-in remain supporting surfaces. Structured questions sit beside the active resources/music. Navigation, resource views and decorative metrics cannot become mastery evidence.
- Theory and procedure both support encoding and retrieval. A familiar score-visible, guidance-free take may show execution; it cannot become memorization, unseen reading or delayed retention automatically.
- Invalid capture produces an unavailable/retry outcome without negative learner credit. Missing channels remain absent; the same observation cannot receive duplicate credit through sync or propagation.
- A failed transition blocks an unsupported whole-arrangement completion claim. Completion and later retention/transfer remain separate; unobserved expressive criteria remain pending.
- Account progress follows between desktop/laptop devices, with visible connection failure and no fabricated sync. The agent's plan cites actual evidence and remains outside per-note timing.
- Map geometry stays stable under navigation. Reveal and label budget support inspection; previews are not learner-state encodings. Partition switching preserves one account/history.

Before implementation, agree cross-lane interfaces for chart/arrangement versions and bar/note identities, take events/timing/device/calibration validity, reproducible game results, activity/support context and requested range/tempo. These are desired capabilities, not assertions about frozen contracts. Keep the game owner's timing/judging/rendering responsibility intact.

First implement a coherent end-to-end evidence/agent/song loop after content and interface agreement, then evaluate it with real learners and educator judgments. Staging is not a restriction to beginners. Numerical calibration, task/rubric authoring, broad-node contracts, assistance classification, spacing/fading and completion anchors remain model/content design work. Do not claim validated diagnosis, educational efficacy, automatic interpretation grading or a complete universal curriculum from software checks.

### 11. Sources and open implementation work

The source-first baseline and its primary links are in section 1. The actual teaching sources, coverage/rubric references and practice scores have distinct roles. Sources support content definitions; they do not validate this proposed graph, diagnostic, learner model or coaching policy. Institutional requirements are normative, and available examples do not establish universal difficulty or mastery cutoffs.

Open implementation work includes obtaining/admitting the selected source material, completing task families and rubrics, node anchors and broad-node coverage contracts, inference/calibration, observation-to-claim mappings, backend/sync behavior, and any eligible audio/human-assessment workflow. Level labels, completion criteria and scheduling constants remain proposals. Unsupported advanced procedure is an explicit content/evidence gap rather than a promised capability. Non-learning consent/privacy requirements must be resolved through the owning product process before the relevant media capability is implemented.

## Validation

The feature is not implemented; the following are future verification recipes, not passing results. Route names and concrete UI labels must be pinned by implementation without removing any entry point or evidence safeguard. Keep the account history, source/task versions, plan rationale and relevant screenshots/results as proof for each case.

1. **Source admission:** select an admitted capability in the inspector -> see its source edition/page or HTML section, task family, rubric, eligible evidence and exclusions. Select an unadmitted advanced topic -> see unsupported coverage, without a mastery claim. Verify a chapter-order change alone cannot introduce a prerequisite or alter prior evidence.
2. **First session:** sign in, state a goal/song/deadline and begin check-in -> foundation probes adapt within supported branches, leave unknowns visible and establish initial beliefs. Then inspect the plan -> scope is selected using both goal and prior knowledge after diagnosis. Repeat with an uneven profile -> valid ear-playing evidence survives a notation failure and the next probe has a different evidence-linked rationale.
3. **Four direct jobs:** navigate directly to theory encoding, procedural encoding, theory retrieval and procedural retrieval -> each has the appropriate challenge/resource or musical workspace and structured response/attempt flow. Map and arcade remain available as supporting surfaces; visiting a page or map node does not increase mastery.
4. **Assistance and claims:** learn a passage with guidance, then perform it with the score visible and guidance absent -> record supported learning and immediate independent execution separately. The take cannot automatically become memorization, unseen reading, delayed retention or cross-graph mastery. Supply theory success alone -> no automatic procedure credit.
5. **Retention/transfer:** perform the first check after a documented gap before warm-up -> retain delay/exposure and score condition as a retention observation. Attempt genuinely unfamiliar related material -> retain a separate scoped transfer claim. Immediate repetition must not pass either condition by itself.
6. **Capture validity:** interrupt/stall capture or omit device channels during a task -> visible unavailable/retry outcome, absent measurements left unknown and no negative learner credit. Valid capture -> inspect only the task-qualified measured dimensions; fingering, posture and acoustic tone remain unmeasured unless an appropriate distinct channel exists.
7. **Evidence replay:** ingest one observation twice and replay the account history under the same policy -> identical derived state and no duplicate credit. Inspect a broad node -> show its criterion coverage, uncertainty and direct/inferred lineage; one successful child cannot certify its parent or sibling.
8. **Song integration:** succeed at isolated phrases but fail their join -> no unsupported whole-arrangement completion. Complete the declared full arrangement under its rubric -> record that historical milestone separately from consistency, polish, memory, current availability and transfer; unobserved expressive dimensions remain pending.
9. **Continuity:** acknowledge progress on one desktop/laptop, then sign in on another -> the same goals, history, beliefs, song progress and scheduled work appear. Interrupt internet -> visible session/sync failure without fabricated evidence or successful uploads; acknowledged history remains intact.
10. **Map and agent:** pan/zoom and switch theory/procedure partitions -> stable geometry, bounded labels/reveal, inspectable relationships and one unchanged account history. Faint previews indicate display resolution. Complete an activity -> the next agent plan cites actual evidence or an explicit unknown; timing/judging during the take contains no per-note model call.

Run the repository Checks and the eventual feature-specific live verification once implementation exists. Observe actual learners and qualified musical assessment for educational claims; synthetic results and software checks alone do not validate diagnosis, calibration or learning benefit.

## Defaults

- Keep unsupported claims unknown or explicitly outside coverage. Prefer a narrower honest claim over inferred advanced coverage from a syllabus or score title.
- Keep chosen source editions, arrangement conditions and provenance stable/versioned; preserve the original observation when a later rubric/model changes.
- Use smaller reversible implementation choices when unspecified. Do not change frozen shared contracts, another lane's responsibilities, or existing ownership through this planning spec.
- Retain provisional labels and numerical policies as proposals until designed and evaluated; do not invent thresholds, a global mastery score or automatic theory/procedure/ancestor credit.
