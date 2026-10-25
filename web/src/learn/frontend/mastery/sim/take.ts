import type { PianoEvent } from '../piano/capture';
import type { Take } from '../piano/score';
import type { PlayingItem } from '../schema';
import { chance, normal, type Random } from './random';

/** How a learner's hands play one take of a node: its hidden mastery and their own accuracy and noise. */
export type Hands = { mastery: number; accuracy: number; timingNoiseMs: number; velocityNoise: number };

const START_MS = 1000;
const VELOCITY = 72;

/**
 * The key and pedal events of one simulated take, for the real scorer to judge. A node the learner knows comes out
 * near the bars; one they don't misses notes, wanders off the click and jumps in loudness.
 */
export function simulateTake(random: Random, item: PlayingItem, hands: Hands): Take {
  const { mastery, accuracy } = hands;
  const beatMs = 60000 / item.bpm;
  const slip = (1 - mastery) * 0.45 + (1 - accuracy) * 0.06;
  const timingSd = hands.timingNoiseMs * (1 + 3 * (1 - mastery));
  const velocitySd = hands.velocityNoise * (1 + 1.5 * (1 - mastery));
  const joins = 0.5 + 0.5 * mastery * accuracy;
  const events: PianoEvent[] = [];

  for (const note of item.notes) {
    if (chance(random, slip) && chance(random, 0.5)) continue; // missed
    const pitch = chance(random, slip) ? note.pitch + (chance(random, 0.5) ? 1 : -1) : note.pitch;
    const onMs = START_MS + note.startBeat * beatMs + normal(random) * timingSd;
    const endMs = START_MS + (note.startBeat + note.beats) * beatMs;
    const offMs = Math.max(onMs + 30, chance(random, joins) ? endMs + 60 : endMs - 0.35 * beatMs);
    const velocity = Math.round(Math.min(127, Math.max(1, VELOCITY + normal(random) * velocitySd)));
    events.push({ type: 'on', pitch, velocity, timeMs: onMs }, { type: 'off', pitch, velocity: 0, timeMs: offMs });
  }

  if (item.pass.pedal !== undefined) {
    events.push({ type: 'pedal', down: true, timeMs: START_MS - 200 });
    const clean = 0.4 + 0.6 * mastery * accuracy;
    for (const beat of [...new Set(item.notes.map(n => n.startBeat))].slice(1)) {
      const at = START_MS + beat * beatMs;
      const up = chance(random, clean) ? at + 30 : at - 80; // lifting before the chord blurs it
      events.push({ type: 'pedal', down: false, timeMs: up }, { type: 'pedal', down: true, timeMs: up + 0.3 * beatMs });
    }
  }

  return { startMs: START_MS, bpm: item.bpm, events: events.sort((a, b) => a.timeMs - b.timeMs) };
}
