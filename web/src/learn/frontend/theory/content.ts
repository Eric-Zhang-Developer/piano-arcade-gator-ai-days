import type { Gate } from './model';

export const theoryTitle = 'Where Twinkle’s phrases end';
export const sources = [
  { title: 'Open Music Theory, v2: Harmony, Cadences, and Phrase Endings', url: 'https://viva.pressbooks.pub/openmusictheory/chapter/intro-to-harmony/#chapter-2809-section-3' },
  { title: 'Open Music Theory, v2: Major Scales, Scale Degrees, and Key Signatures', url: 'https://viva.pressbooks.pub/openmusictheory/chapter/major-scales/' },
  { title: 'Open Music Theory, v2: Notation of Notes, Clefs, and Ledger Lines', url: 'https://viva.pressbooks.pub/openmusictheory/chapter/notation-of-notes-clefs-and-ledger-lines/' },
] as const;

// Original questions about the repository's Twinkle chart (C major; phrase 1 is C C G G A A G, phrase 2 is
// F F E E D D C), checked against the Open Music Theory chapters above. Melody alone never proves a cadence.
export const theoryGates: readonly Gate[] = [
  {
    id: 'home',
    title: 'The home note',
    questions: [
      {
        id: 'tonic',
        prompt: 'Twinkle is in C major. Which note is its tonic, the home note?',
        answer: { id: 'c', text: 'C', explanation: 'A major scale is named for its first note, which is also its last. C is the tonic of C major.' },
        wrong: [
          { id: 'g', text: 'G', explanation: 'G is scale degree 5, the dominant. Phrase 1 pauses on it, but it is not home.' },
          { id: 'f', text: 'F', explanation: 'F is scale degree 4, the subdominant. Phrase 2 starts on it and steps down to C.' },
        ],
      },
      {
        id: 'tonic-degree',
        prompt: 'Which scale degree is the tonic?',
        answer: { id: '1', text: '1', explanation: 'The tonic is scale degree 1, the note the scale starts and ends on.' },
        wrong: [
          { id: '5', text: '5', explanation: 'Scale degree 5 is the dominant: G in C major.' },
          { id: '3', text: '3', explanation: 'Scale degree 3 is the mediant: E in C major.' },
        ],
      },
      {
        id: 'dominant',
        prompt: 'In C major, which note is scale degree 5, the dominant?',
        answer: { id: 'g', text: 'G', explanation: 'Count up from C: C D E F G. G is scale degree 5, the dominant.' },
        wrong: [
          { id: 'f', text: 'F', explanation: 'F is scale degree 4, the subdominant. Count one step further up.' },
          { id: 'a', text: 'A', explanation: 'A is scale degree 6, the submediant. Count one step back down.' },
        ],
      },
    ],
  },
  {
    id: 'endings',
    title: 'Where the phrases end',
    questions: [
      {
        id: 'phrase-1-end',
        prompt: 'Phrase 1 is bars 1–2. Which note does it end on?',
        phrase: 1,
        answer: { id: 'g', text: 'G', explanation: 'Phrase 1 ends on G, held for two beats at the end of bar 2.' },
        wrong: [
          { id: 'c', text: 'C', explanation: 'Phrase 1 starts on C but does not return to it. C is where phrase 2 ends.' },
          { id: 'a', text: 'A', explanation: 'A is the note just before the end. The melody steps down from A to G.' },
        ],
      },
      {
        id: 'phrase-2-end',
        prompt: 'Phrase 2 is bars 3–4. Which note does it end on?',
        phrase: 2,
        answer: { id: 'c', text: 'C', explanation: 'Phrase 2 ends on C, held for two beats at the end of bar 4.' },
        wrong: [
          { id: 'd', text: 'D', explanation: 'D is the note just before the end. The melody takes one more step down, to C.' },
          { id: 'g', text: 'G', explanation: 'G is where phrase 1 ends. Phrase 2 has no G: it steps down from F to C.' },
        ],
      },
      {
        id: 'tonic-ending',
        prompt: 'Which phrase ends on the tonic?',
        answer: { id: 'phrase-2', text: 'Phrase 2', explanation: 'Phrase 2 ends on C, the tonic of C major.' },
        wrong: [
          { id: 'phrase-1', text: 'Phrase 1', explanation: 'Phrase 1 ends on G, scale degree 5, away from home.' },
          { id: 'both', text: 'Both', explanation: 'Only phrase 2 ends on C. Phrase 1 ends on G, scale degree 5.' },
        ],
      },
      {
        id: 'descent',
        prompt: 'How does phrase 2 reach its last note?',
        phrase: 2,
        answer: { id: 'steps', text: 'Down by step: F, E, D, C', explanation: 'Each new note is one step lower: scale degrees 4, 3, 2, 1.' },
        wrong: [
          { id: 'leap', text: 'A leap down from G to C', explanation: 'Phrase 2 has no G. It starts on F and moves down one step at a time.' },
          { id: 'repeat', text: 'By repeating C', explanation: 'C sounds only once, as the last note. Before it the melody steps down F, E, D.' },
        ],
      },
    ],
  },
  {
    id: 'reading',
    title: 'Reading and naming endings',
    questions: [
      {
        id: 'g-line',
        prompt: 'Where on the treble staff is phrase 1’s last note, G?',
        phrase: 1,
        answer: { id: 'second-line', text: 'The second line from the bottom', explanation: 'The treble clef curls around the second line from the bottom, marking it as G.' },
        wrong: [
          { id: 'bottom-line', text: 'The bottom line', explanation: 'The bottom line of the treble staff is E, two steps below G.' },
          { id: 'middle-line', text: 'The middle line', explanation: 'The middle line is B, two steps above G.' },
        ],
      },
      {
        id: 'c-ledger',
        prompt: 'Where on the treble staff is phrase 2’s last note, C?',
        phrase: 2,
        answer: { id: 'ledger', text: 'On a ledger line below the staff', explanation: 'This C is too low for the staff, so it sits on a short ledger line below it.' },
        wrong: [
          { id: 'bottom-space', text: 'The bottom space', explanation: 'The bottom space is F, where phrase 2 starts.' },
          { id: 'bottom-line', text: 'The bottom line', explanation: 'The bottom line is E, which phrase 2 passes on its way down.' },
        ],
      },
      {
        id: 'cadence-proof',
        prompt: 'Twinkle’s melody ends on C. Does that alone prove an authentic cadence?',
        answer: { id: 'no', text: 'No', explanation: 'An authentic cadence is a harmonic progression, V to I, at the end of a phrase. The melody alone does not show the chords.' },
        wrong: [
          { id: 'yes', text: 'Yes', explanation: 'Ending on C is a fact about the melody. An authentic cadence is about the chords, V to I, and the melody alone does not show them.' },
        ],
      },
      {
        id: 'half-cadence',
        prompt: 'A phrase that ends on V, the dominant chord, makes which kind of cadence?',
        answer: { id: 'half', text: 'A half cadence', explanation: 'A phrase that ends on V makes a half cadence: it stops on the dominant without reaching I.' },
        wrong: [
          { id: 'authentic', text: 'An authentic cadence', explanation: 'An authentic cadence goes from V to I. A phrase that stops on V never reaches I.' },
          { id: 'none', text: 'No cadence', explanation: 'Ending a phrase on V is a cadence: a half cadence.' },
        ],
      },
    ],
  },
];
