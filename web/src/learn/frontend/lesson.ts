import chart from '../../../public/songs/twinkle/chart.json';

export const source = {
  title: 'Open Music Theory, v2: Harmony, Cadences, and Phrase Endings',
  url: 'https://viva.pressbooks.pub/openmusictheory/chapter/intro-to-harmony/#chapter-2809-section-3',
};
export const score = chart;
export type Question = {
  id: string;
  prompt: string;
  options?: readonly string[];
  answer?: string;
  explanation: string;
  hint: string;
};
// Original questions, using the repository's cited Twinkle score. This is a
// bounded ear/notation exercise, not a claim about harmonic cadence mastery.
export const questions: readonly Question[] = [
  { id: 'listen', prompt: 'Listen to both phrases. Which ending feels more at rest?', options: ['Phrase 1', 'Phrase 2'], answer: 'Phrase 2', explanation: 'Phrase 2 ends on C, the home note in this C-major melody. Phrase 1 ends on G.', hint: 'Hum the final note, then try singing C. Which ending already feels at home?' },
  { id: 'explain', prompt: 'What makes that ending feel at rest? Explain it in your own words.', explanation: 'Compare your answer: the melody returns to C, the tonic or home note. An ending on the tonic can feel settled. Melody alone does not identify a harmonic cadence.', hint: 'Compare the last note with the home note, C.' },
  { id: 'read', prompt: 'Read the last note in bar 2. Which note does phrase 1 end on?', options: ['C', 'F', 'G'], answer: 'G', explanation: 'It ends on G. The second phrase returns to C in bar 4.', hint: 'Find the second line up from the bottom of the treble staff. That line is G.' },
];
export const reviewQuestions: readonly Question[] = [
  { id: 'home', prompt: 'The melody is in C major. Which note is its tonic?', options: ['C', 'F', 'G'], answer: 'C', explanation: 'C is the tonic, or home note, of C major.', hint: '' },
  { id: 'ending', prompt: 'Listen to the two phrases. Which one returns to the tonic at the end?', options: ['Phrase 1', 'Phrase 2'], answer: 'Phrase 2', explanation: 'Phrase 2 ends on C. Phrase 1 ends on G.', hint: '' },
  { id: 'boundary', prompt: 'Does a melody ending on C prove that the harmony makes an authentic cadence?', options: ['Yes', 'No'], answer: 'No', explanation: 'No. An authentic cadence is a harmonic ending from V to I. The melody alone does not establish those chords.', hint: '' },
];
export function evaluateAnswer(question: Question, answer: string): 'correct' | 'incorrect' | 'compare' {
  if (!question.answer) return 'compare';
  return question.answer === answer ? 'correct' : 'incorrect';
}
export function phraseNotes(phrase: 1 | 2) {
  const from = phrase === 1 ? 0 : 8;
  return score.notes.filter(n => n.beat >= from && n.beat < from + 8).map(n => ({ ...n, beat: n.beat - from }));
}
