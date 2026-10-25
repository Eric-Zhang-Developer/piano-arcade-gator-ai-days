// The lab's entries (spec: lab): one per done feature that /'s menu doesn't reach. Each description is copied from
// its feature's changes/<slug>.md "What shipped", never written fresh; lab.test.ts holds every entry to that, to a
// done note, to a page under web/src/app/ and to a song in the library.

export interface LabEntry {
  slug: string; // the feature: changes/<slug>.md
  name: string;
  description: string; // a run of the done note's words, Markdown emphasis and backticks dropped
  href: string;
  open: string; // the button's words
}

export interface LabGroup {
  title: string;
  entries: LabEntry[];
}

export const labGroups: LabGroup[] = [
  {
    title: "Play differently",
    entries: [
      {
        slug: "wait-mode",
        name: "Learn mode",
        description: "the highway stops on each note (a chord waits for all its keys), never calls a MISS, plays no beat",
        href: "/play?song=twinkle&mode=wait",
        open: "Twinkle, Learn",
      },
      {
        slug: "flow-mode",
        name: "Flow mode",
        description:
          "the song waits at each note and follows your tempo (0.5–1.3×), scored on wrong notes, skipped notes and stops past 2 beats, not timing",
        href: "/play?song=twinkle&mode=flow",
        open: "Twinkle, Flow",
      },
      {
        slug: "adaptive-chunks",
        name: "Adaptive chunks",
        description:
          '"Practice in chunks" now starts on the whole song at 70% (practice=adapt) instead of walking it 4 bars at a time.',
        href: "/play?song=fur-elise",
        open: "Für Elise's start screen",
      },
      {
        slug: "bar-loop",
        name: "Bar loop",
        description: 'Each pass is scored on its own, and a "Passes" panel next to the results lists each pass\'s accuracy in order.',
        href: "/play?song=fur-elise&from=1&to=4&tempo=70",
        open: "Für Elise, bars 1–4 at 70%",
      },
      {
        slug: "hand-mode",
        name: "One hand",
        description: "results score only the hand you play, and the piano plays it in time",
        href: "/play?song=fur-elise&hands=R",
        open: "Für Elise, right hand",
      },
      {
        slug: "rewind",
        name: "Rewind",
        description: "In wait mode, ◀ (or ←) moves back a bar and ▶ (or →) skips ahead one, from the HUD's buttons.",
        href: "/play?song=twinkle&mode=wait",
        open: "Twinkle, Learn",
      },
    ],
  },
  {
    title: "Watch",
    entries: [
      {
        slug: "watch-demo",
        name: "Watch demo",
        description: "WATCH on the music select plays the focused song with the perfect bot, audible and hands-off.",
        href: "/play?song=twinkle&bot=perfect&audible=1&demo=1",
        open: "Twinkle, the perfect bot",
      },
      {
        slug: "cabinet",
        name: "Cabinet",
        description: "Idle 30 s, it shows attract (/attract, started automatically) for 60 s, then a perfect-bot demo of Twinkle on the piano",
        href: "/cabinet",
        open: "/cabinet",
      },
      {
        slug: "operator-replay",
        name: "Attract",
        description: "one merged PR per note of Twinkle on the chart's own rhythm, while each step's note plays",
        href: "/attract",
        open: "/attract",
      },
      {
        slug: "stage-view",
        name: "Stage view",
        description: "notes rise dim on a back slope, tip over a lit crest and speed down to the bar, over 1033 ms.",
        href: "/stage",
        open: "/stage",
      },
    ],
  },
  {
    title: "Score",
    entries: [
      {
        slug: "sheet-view",
        name: "Sheet music",
        description: "While /play runs a take, the sheet's cursor follows the chart clock, and each judged note's notehead takes its HUD color.",
        href: "/sheet?song=twinkle",
        open: "/sheet, Twinkle",
      },
    ],
  },
  {
    title: "Experiments",
    entries: [
      {
        slug: "simon-says-spike",
        name: "Simon Says",
        description: "plays the opening notes of a library song, you repeat them, and each round adds a note.",
        href: "/simon",
        open: "/simon",
      },
      {
        slug: "wrong-note-spike",
        name: "Spot the Wrong Note",
        description: "the DGX plays 8 notes of Twinkle (or Ode to Joy, Minuet in G, Für Elise) with one moved 2 semitones",
        href: "/wrong-note",
        open: "/wrong-note",
      },
      {
        slug: "veritas",
        name: "Veritas",
        description: "five test players (Golden, Rusher, Jitter, Fumbler, Chord Roller) plant mistakes in real library songs",
        href: "/veritas",
        open: "/veritas",
      },
      {
        slug: "piano-sim",
        name: "Piano sim",
        description: 'the game, a virtual keyboard, a raw MIDI log, fault buttons, "Watch the bot"',
        href: "/sim",
        open: "/sim",
      },
    ],
  },
  {
    title: "Behind the scenes",
    entries: [
      {
        slug: "operator-board",
        name: "Operator board",
        description: "a coin-counter strip, then Needs a person (non-draft plan/contract PRs, needs-human and blocked issues, drafts stale at 45 min, red main CI, STOP)",
        href: "/operator",
        open: "/operator",
      },
      {
        slug: "calibration",
        name: "Calibration",
        description: "The mean tap offset over clicks 5–12 is saved as the latency offset, which /play's slider then shows.",
        href: "/calibrate",
        open: "/calibrate",
      },
    ],
  },
  {
    title: "Learn",
    entries: [
      {
        slug: "learning-ui",
        name: "Learning",
        description: "guided mastery map, three-state parent/leaf examples, one prepared Start/real Resume, four existing activities",
        href: "/learn",
        open: "/learn",
      },
    ],
  },
];

export const labEntries: LabEntry[] = labGroups.flatMap((g) => g.entries);
