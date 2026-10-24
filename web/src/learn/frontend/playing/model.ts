import chart from '../../../../public/songs/twinkle/chart.json';

/** The approved repository chart is the source of every score and audio note. */
export const music = chart;
export const targetTempo = chart.bpm;
export const passageBeats = 8;
export const totalBeats = Math.max(...chart.notes.map((n) => n.beat + n.duration));
export type Settings = { tempo: number; hints: boolean };
export type PracticeStage = 'ready' | 'feedback' | 'drill' | 'fade' | 'complete';
export type PracticeState = Settings & { stage: PracticeStage; repetitions: number; takes: number; busy: boolean; error: string | null };
export const initialPractice: PracticeState = { stage: 'ready', repetitions: 0, takes: 0, tempo: 72, hints: true, busy: false, error: null };
export type PracticeEvent =
  | { type: 'start' }
  | { type: 'finish' }
  | { type: 'stop' }
  | { type: 'drill' }
  | { type: 'repeat' }
  | { type: 'settings'; settings: Partial<Settings> }
  | { type: 'error'; message: string };

export function fadeSupport(settings: Settings): Settings {
  if (settings.hints) return { ...settings, hints: false };
  return { ...settings, tempo: targetTempo };
}

export function practiceReducer(s: PracticeState, e: PracticeEvent): PracticeState {
  switch (e.type) {
    case 'start':
      if (s.busy || s.stage === 'complete') return s;
      return { ...s, ...(s.stage === 'fade' ? fadeSupport(s) : {}), busy: true, error: null };
    case 'finish':
      if (!s.busy) return s;
      return { ...s, busy: false, takes: s.takes + 1,
        stage: s.repetitions < 4 ? 'feedback' : !s.hints && s.tempo === targetTempo ? 'complete' : 'fade' };
    case 'stop': return { ...s, busy: false };
    case 'drill': return s.busy ? s : { ...s, stage: 'drill', repetitions: 0 };
    case 'repeat': return s.stage !== 'drill' || s.busy ? s : { ...s, repetitions: Math.min(4, s.repetitions + 1), stage: s.repetitions >= 3 ? 'fade' : 'drill' };
    case 'settings': return s.busy ? s : { ...s, ...e.settings, tempo: Math.max(48, Math.min(targetTempo, e.settings.tempo ?? s.tempo)) };
    case 'error': return { ...s, busy: false, error: e.message };
  }
}

export type TakePhase = 'ready' | 'countin' | 'playing' | 'result';
export function takeTransition(phase: TakePhase, event: 'start' | 'counted' | 'finish' | 'stop' | 'again'): TakePhase {
  if (event === 'again') return 'ready';
  if (event === 'stop') return phase === 'countin' || phase === 'playing' ? 'ready' : phase;
  if (phase === 'ready' && event === 'start') return 'countin';
  if (phase === 'countin' && event === 'counted') return 'playing';
  if (phase === 'playing' && event === 'finish') return 'result';
  return phase;
}
