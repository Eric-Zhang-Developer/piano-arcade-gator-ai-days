/** A small illustrative foundations slice, not an admitted universal piano curriculum. */
export type Domain = 'theory' | 'procedure';
export type Mastery = 'mastered' | 'developing' | 'unknown';
export type GraphAction = { domain: Domain; skillId: string; intent: 'learn' | 'review' };
export type Skill = { id: string; domain: Domain; title: string; short: string; description: string; parentId?: string; prerequisites: readonly string[]; activity?: string };
export type LearnerState = { mastery: Mastery; due?: boolean };
const skill = (domain: Domain, id: string, title: string, short: string, description: string, parentId?: string, prerequisites: readonly string[] = [], activity?: string): Skill => ({ id: `${domain}.${id}`, domain, title, short, description, parentId: parentId ? `${domain}.${parentId}` : undefined, prerequisites: prerequisites.map((p) => p.includes('.') ? p : `${domain}.${p}`), activity });

// Subject definitions contain no learner estimates, recommendations or coordinates.
export const skills: readonly Skill[] = [
  skill('theory', 'notation', 'Pitch & notation', 'Pitch & notation', 'Connect symbols on the page with musical pitch and duration.'),
  skill('theory', 'staff-notes', 'Notes on the staff', 'Staff notes', 'Identify a note from its position on a staff.', 'notation'),
  skill('theory', 'note-values', 'Note values', 'Note values', 'Relate written note shapes to beat lengths.', 'notation'),
  skill('theory', 'rests', 'Rests', 'Rests', 'Recognize intentional silence in written music.', 'notation', ['note-values']),
  skill('theory', 'hearing', 'Listening & patterns', 'Listening & patterns', 'Notice pitch relationships and recurring shapes by ear.'),
  skill('theory', 'pitch-match', 'Matching a heard pitch', 'Match a pitch', 'Compare a heard pitch with a reference.', 'hearing'),
  skill('theory', 'contour', 'Melodic contour', 'Melodic shape', 'Hear when a tune rises, falls or repeats.', 'hearing', ['pitch-match']),
  skill('theory', 'repetition', 'Repeated motifs', 'Repeated motifs', 'Find a short musical idea when it returns.', 'hearing'),
  skill('theory', 'tonality', 'Tonal relationships', 'Tonal relationships', 'Hear how notes relate to a tonal center.'),
  skill('theory', 'tonal-center', 'Tonal center', 'Home note', 'Compare how the end of a Twinkle phrase relates to its home note.', 'tonality', ['pitch-match'], 'Twinkle: compare phrase endings'),
  skill('theory', 'scale-steps', 'Scale relationships', 'Scale steps', 'Relate neighboring notes within a scale.', 'tonality', ['staff-notes']),
  skill('theory', 'key-signatures', 'Key signatures', 'Key signatures', 'Read the shared sharps or flats at the start of a staff.', 'tonality', ['scale-steps']),
  skill('theory', 'phrasing', 'Musical phrases', 'Musical phrases', 'Hear how short musical ideas form a larger shape.'),
  skill('theory', 'phrase-endings', 'Phrase endings', 'Phrase endings', 'Hear whether the ending of a Twinkle phrase feels open or settled.', 'phrasing', ['tonal-center'], 'Twinkle: compare phrase endings'),
  skill('theory', 'phrase-length', 'Phrase length', 'Phrase length', 'Locate the span of a musical phrase.', 'phrasing', ['note-values']),
  skill('theory', 'question-answer', 'Question and answer', 'Question / answer', 'Compare the roles of two connected phrases.', 'phrase-endings', ['phrase-endings']),
  skill('procedure', 'pulse', 'Pulse & duration', 'Pulse & duration', 'Keep musical time while controlling note lengths.'),
  skill('procedure', 'steady-pulse', 'Steady pulse', 'Steady pulse', 'Keep moving through the Twinkle melody without stopping.', 'pulse', [], 'Twinkle: continuous play-through'),
  skill('procedure', 'held-endings', 'Holding phrase endings', 'Hold the ending', 'Let the final G of the opening Twinkle phrase last two full beats.', 'pulse', ['steady-pulse'], 'Twinkle: opening two bars'),
  skill('procedure', 'rests-in-time', 'Silence in time', 'Rests in time', 'Keep a steady pulse through written rests.', 'pulse', ['steady-pulse']),
  skill('procedure', 'coordination', 'Movement & coordination', 'Movement & coordination', 'Connect planned movements into a continuous musical phrase.'),
  skill('procedure', 'key-targeting', 'Reliable key targeting', 'Find the keys', 'Move accurately between the keys of a short melody.', 'coordination'),
  skill('procedure', 'short-phrase-coordination', 'Short-phrase coordination', 'Connect a phrase', 'Play the opening Twinkle phrase and preserve its held ending.', 'coordination', ['key-targeting', 'steady-pulse'], 'Twinkle: opening two bars'),
  skill('procedure', 'hands-together', 'Hands together', 'Hands together', 'Coordinate the timing of two independent parts.', 'coordination', ['short-phrase-coordination']),
  skill('procedure', 'reading', 'Reading into movement', 'Reading into movement', 'Turn score information into planned sound and movement.'),
  skill('procedure', 'score-to-keys', 'Score to keyboard', 'Score to keys', 'Locate notes from the score on the keyboard.', 'reading', ['theory.staff-notes', 'key-targeting']),
  skill('procedure', 'reading-ahead', 'Reading ahead', 'Read ahead', 'Prepare the next group while playing the current one.', 'reading', ['score-to-keys']),
  skill('procedure', 'new-phrase', 'Reading a new phrase', 'A new phrase', 'Read unfamiliar short music without a falling-note guide.', 'reading-ahead', ['reading-ahead']),
  skill('procedure', 'expression', 'Listening & expression', 'Listening & expression', 'Shape the sound of a phrase intentionally.'),
  skill('procedure', 'articulation', 'Articulation', 'Connect / detach', 'Choose and control how notes join or separate.', 'expression', ['key-targeting']),
  skill('procedure', 'dynamics', 'Dynamic control', 'Soft / loud', 'Control differences in loudness deliberately.', 'expression'),
  skill('procedure', 'phrase-shape', 'Phrase shaping', 'Shape a phrase', 'Give a short phrase a clear musical direction.', 'expression', ['articulation', 'held-endings']),
];

// Entirely fictional state. Changing this overlay never changes the subject geography.
export const demoLearner: Readonly<Record<string, LearnerState>> = {
  'theory.staff-notes': { mastery: 'mastered' }, 'theory.note-values': { mastery: 'mastered' },
  'theory.pitch-match': { mastery: 'mastered' }, 'theory.contour': { mastery: 'developing' },
  'theory.repetition': { mastery: 'mastered' }, 'theory.tonal-center': { mastery: 'mastered', due: true },
  'theory.phrase-endings': { mastery: 'developing' }, 'theory.phrase-length': { mastery: 'developing' },
  'procedure.steady-pulse': { mastery: 'mastered', due: true }, 'procedure.key-targeting': { mastery: 'mastered' },
  'procedure.short-phrase-coordination': { mastery: 'developing' }, 'procedure.held-endings': { mastery: 'developing' },
  'procedure.score-to-keys': { mastery: 'developing' }, 'procedure.dynamics': { mastery: 'mastered' },
};
export const demoGoal = { title: 'Play short melodies with clear, steady endings', targets: ['theory.phrase-endings', 'procedure.short-phrase-coordination', 'theory.tonal-center', 'procedure.steady-pulse'] } as const;
export const byId = new Map(skills.map((node) => [node.id, node]));
export const stateOf = (id: string, learner = demoLearner): LearnerState => learner[id] ?? { mastery: 'unknown' };

export function actionFor(node: Skill, learner = demoLearner): { action?: GraphAction; reason: string; missing: Skill[] } {
  const children = skills.some((s) => s.parentId === node.id);
  const missing = node.prerequisites.filter((id) => stateOf(id, learner).mastery !== 'mastered').map((id) => byId.get(id)!).filter(Boolean);
  if (!node.parentId) return { reason: 'An organizing group. Select a smaller skill to inspect its state.', missing: [] };
  if (!node.activity) return { reason: missing.length ? 'In this sample, explore the foundations below first. No activity is connected for this skill yet.' : 'No activity is connected for this skill in this preview.', missing };
  if (missing.length) return { reason: 'In this sample, begin with the foundations below before this activity.', missing };
  const state = stateOf(node.id, learner);
  if (state.mastery === 'mastered') return state.due
    ? { action: { domain: node.domain, skillId: node.id, intent: 'review' }, reason: 'Established in the sample; a fresh check is due. Due does not mean low mastery.', missing }
    : { reason: 'Established in the sample. No review is due right now.', missing };
  return { action: { domain: node.domain, skillId: node.id, intent: 'learn' }, reason: children ? 'Build this relationship before exploring its finer details.' : 'This supports the goal, and its sample foundations are in place.', missing };
}
export function recommendation(domain: Domain, learner = demoLearner): Skill | undefined {
  return demoGoal.targets.map((id) => byId.get(id)!).find((node) => node.domain === domain && actionFor(node, learner).action);
}
