import { phraseNotes } from './lesson';

export function playPhrase(phrase: 1 | 2): () => void {
  const context = new AudioContext();
  void context.resume();
  const start = context.currentTime + 0.08;
  const secondsPerBeat = 0.48;
  for (const note of phraseNotes(phrase)) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 440 * 2 ** ((note.pitch - 69) / 12);
    const time = start + note.beat * secondsPerBeat;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.16, time + .015);
    gain.gain.exponentialRampToValueAtTime(.001, time + note.duration * secondsPerBeat - .04);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(time); oscillator.stop(time + note.duration * secondsPerBeat);
  }
  const timer = window.setTimeout(() => { void context.close(); }, 4400);
  return () => { window.clearTimeout(timer); if (context.state !== 'closed') void context.close(); };
}
