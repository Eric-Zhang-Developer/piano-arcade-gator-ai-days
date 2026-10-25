# Product and design handoff

Contributor guide for Eric. Read [PRODUCT_PHILOSOPHY.md](PRODUCT_PHILOSOPHY.md) before changing product behavior, UI or code. The purpose is frozen; the current interface is an editable implementation of it. [Learning UI specification](specs/features/learning-ui/spec.md), [design notes](specs/features/learning-ui/DESIGN.md) and [brand study](specs/features/learning-ui/BRAND_STUDY.md) provide the implementation context.

## Frozen purpose

Resolve the feeling of being lost while learning piano through a capable personal tutor. The learner should feel accompanied, safe and able to begin: “I got you” expressed through useful behavior throughout the experience, including mistakes and recovery.

The tutor carries needless planning while the learner does the musical work. Support should enable challenge and growing independence, without coddling, shame or abandonment. Preserve meaningful control to stop, ask for help, recover and act deliberately. Reassurance concerns dependable support and a path forward, never guaranteed learning outcomes or invented mastery.

One prepared next action makes that relationship concrete. Show the task and a short reason, then Start or a real Resume. Do not make the learner administer Theory/Procedure or Learn/Review categories before beginning. Keep essential hints, material, stopping and recovery controls; remove controls or copy that serve no current need.

## Current editable frontend

The user selected the **center upright, inviting alligator**. That selects the character, not every palette, layout or motion decision. The current frontend is the editable baseline shared with Eric under the frozen purpose. It uses a quiet graph behind a foreground assignment, then a question pane beside the actual score/reference workspace. The character stays beside the work.

`/learn/brand-preview` is the current desktop frontend entry for editing. Its in-app Proposed preview label distinguishes it from the previous interface. `/learn` and its activity routes retain the explicitly labelled **Prior UI**. Review disclosure, Replay and references sit outside the student task. This publication shares the complete current implementation; it does not connect the authored demo to a live tutor or deploy a production service.

### Current assets

| Repository asset | Current role |
| --- | --- |
| `web/public/learning/mentor-gator.png` | Selected full-body guide, 450×450 RGBA. Active home, journey and lesson image, displayed in a 112px square with `object-fit: contain`. |
| `web/public/learning/mentor-gator-avatar.png` | 240×240 RGBA bust crop of the same artwork. Retained asset; no longer used in the corrected transition. Do not reintroduce a crop crossfade. |
| `web/public/learning/companion-gator.svg` | Incumbent character on Prior UI, including its prepared theory handoff. |

Provenance: an authorized Nano Banana 2 still concept sheet generated the original identity on 2026-10-24. The chosen center was cropped, background-removed and padded; known white-matte edge RGB was cleaned without changing alpha or redrawing the figure. No additional animation frames, rig, vector source or listening/feedback poses were delivered.


### Current typography and colors

The proposed route loads actual `next/font/google` assets: **Bricolage Grotesque**, weights 600/700, for brand/headings; **Source Sans 3**, weights 400/500/600/700, for reading and controls. Both use Latin subsets and `display: swap`. Their CSS variables are `--mentor-heading` and `--mentor-reading`. Prior UI retains Saira italic display roles and system-ui reading; avoid changing the shared game font system to style the proposed route.

Current source: `web/src/learn/frontend/brand-preview/brand-preview.module.css`.

| Token | Value | Role |
| --- | --- | --- |
| `--brand-bg` | `#f7f7f2` | Warm working ground |
| `--brand-surface` | `#fff` | Task and score surfaces |
| `--brand-ink` | `#253141` | Main text |
| `--brand-muted` | `#56616c` | Supporting text |
| `--brand-line` | `#8e9ca1` | Graph edges |
| `--brand-rule` | `#d9dedc` | Dividers |
| `--brand-action` | `#3459cb` | Primary action and target |
| `--brand-focus` | `#2445a5` | Interactive focus |
| `--mastered` | `#356454` | Secure, solid fill |
| `--partial` | `#a16c19` | Partial, outlined ring |
| `--low` | `#6d7c83` | Low, dashed outline |

These are current implementation tokens, not frozen brand law. The green/cream character colors are embedded in the PNG, not separate palette tokens.

### Accompaniment in motion

Start follows the prepared target using one spatial path for guide and camera. The proposed journey and handoff timers live in [`directions.ts`](web/src/learn/frontend/brand-preview/directions.ts) and [`BrandPreview.tsx`](web/src/learn/frontend/brand-preview/BrandPreview.tsx); the visible docking and lesson-fade durations live in [`brand-preview.module.css`](web/src/learn/frontend/brand-preview/brand-preview.module.css). The CSS lesson fade is independent of the handoff timer. One 112px full-body image settles into reserved space **before** the lesson appears. Keep title, score and destination caption unobstructed; never morph into the portrait crop or leave the tutor behind. Stop and map return preserve control; reduced motion uses direct entry.

This is code-driven movement of one standing illustration, not an animated walk or flight pose. Transformed raster softness remains a visual limitation. Inspect real normal-speed departure, arrival, docking and reveal at 1440×900 and 1280×800; a settled screenshot or completed progress trace cannot establish motion quality.

## Graph and evidence boundaries

The intended mastery model is a universal hierarchical skill graph: broad concepts and subskills carry learner-state distributions, with teaching/retrieval activities chosen from that state. The present frontend is a **134-node illustrative foundations slice**, not a complete admitted piano curriculum or connected adaptive tutor. Theory and Procedure datasets remain separate; the prepared skill chooses the shown domain. Students do not need to explore or manage the graph to proceed.

Every node, including broad parents, retains a normalized distribution over low/partial/secure mastery. Current values are fictional examples or disclosed uniform priors. Three colors and shapes are a presentation projection; cutoffs are demo choices, not validated assessment thresholds. Parent values are independently authored, not inferred child averages. Preserve distributions, provenance, presentation and eligibility as distinct concerns. No extra review-due color or student-facing legend is required.

The prepared recommendation is authored, not a live model decision. Session answers, history, reference selection and practice settings/results are in-memory. [Learning preview](README.md#learning-preview) owns the reset boundaries for the separate proposed and Prior UI sessions. No account continuity, persistent progress, AI explanation grading, piano capture or mastery-update service is connected to this UI. Closed answers have computed feedback; explanations compare against reference copy. Procedural takes/results remain illustrative; the score is permitted during procedural retrieval. Preserve the distinction between melodic closure and evidence of harmonic cadence. Offline recovery must describe connection/sync limits honestly, preserve available local work and stop active playback/takes safely.

## Cross-industry lessons

Official public surfaces informed mechanisms, not a collage of borrowed aesthetics:

- [Monzo](https://monzo.com/current-account/personal): concrete status and usable recovery before reassurance.
- [Lemonade](https://www.lemonade.com/claims): legible input, assistance and understandable fallback.
- [Waze](https://www.waze.com/live-map/): foreground next task over quiet map context.
- [Zocdoc](https://www.zocdoc.com/): suitability and concrete evidence near a decision.
- [Airbnb](https://www.airbnb.com/): recognizable context and an identifiable host across an unfamiliar task.
- [TurboTax Expert Assist](https://turbotax.intuit.com/personal-taxes/online/live/how-it-works.htm): the customer does the work with competent help beside it.

Research inspected public interfaces and explanations, not completed banking, insurance, navigation, booking or tax-filing flows. Emotional effects are design inferences, not measured results. No company logos, guarantees or authority claims are transferred to this product.

## Run and edit

From the repository root, with Node.js and the pnpm version pinned in `web/package.json`:

```sh
pnpm -C web install
pnpm -C web dev --port 3000
```

Open `http://localhost:3000/learn/brand-preview` for the current editable interface. Open `http://localhost:3000/learn` for Prior UI; its prepared theory action enters `/learn/understand`. The root URL redirects to the game, so use the learning route explicitly.

| Concern | Authoritative implementation |
| --- | --- |
| Proposed route and fonts | `web/src/app/learn/brand-preview/page.tsx` |
| Proposed composition and motion | `web/src/learn/frontend/brand-preview/BrandPreview.tsx`, `directions.ts`, `brand-preview.module.css` |
| Shared theory lesson and score/reference | `web/src/learn/frontend/TheoryWorkspace.tsx`, `lesson.ts` |
| Local session continuity | `web/src/learn/frontend/LearningSessions.tsx` |
| Graph definitions, state, layout, preparation | `web/src/learn/frontend/graph/data.ts`, `layout.ts`, `projection.ts`, `prepared.ts` |
| Prior route journey | `web/src/learn/frontend/graph/GuidedEntry.tsx`, `guided-motion.ts`, `MasteryGraphHome.tsx` |
| Procedural workspaces | `web/src/learn/frontend/playing/` |
| Image assets | `web/public/learning/` |

These are code responsibility boundaries, not new person assignments. Follow `AGENTS.md` and `.github/CODEOWNERS`: Eric owns `web/src/game/` and frozen contracts; the learning lane has no named CODEOWNER yet. Keep proposed styles scoped rather than silently rewriting the shared game shell. Use the feature specification's validation when changing behavior, including real Start/Resume and normal-speed desktop motion. Native keyboard, actual OS reduced motion, audio and connected services require their own evidence; do not inherit claims from a screenshot.
