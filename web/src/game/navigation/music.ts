// Original four-bar instrumental sketch: generated bass/chord arpeggios and
// soft percussion. Browser audio only; no MIDI output or external recording.
export const lobbySettings = { bpm: 108, defaultVolume: .12, lookaheadS: .12, tickMs: 25 };
export const LOBBY_KEY = "pianoArcade.lobbyMusic";
export function loopNotes(step: number) {
  const bar = Math.floor(step / 8) % 4;
  const root = [48, 45, 53, 50][bar];
  const chord = bar % 2 ? [0, 3, 7, 10] : [0, 4, 7, 11];
  const voice = [0, 2, 1, 3, 2, 0, 3, 1][step % 8];
  return [
    { pitch: root + 12 + chord[voice], length: .23, level: .045 },
    ...(step % 4 === 0 ? [{ pitch: root - 12, length: .38, level: .1 }] : []),
  ];
}

export class LobbyPlayer {
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private voices = new Set<AudioScheduledSourceNode>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;
  constructor(private createContext = () => new AudioContext()) {}
  async start(volume: number) {
    this.stop();
    const run = this.generation;
    const audio = this.context ??= this.createContext();
    await audio.resume();
    if (run !== this.generation || audio.state !== "running") return false;
    const bus = this.bus = audio.createGain(); bus.gain.value = volume; bus.connect(audio.destination);
    const origin = audio.currentTime + .04;
    const eighth = 30 / lobbySettings.bpm;
    let step = 0;
    const schedule = () => {
      if (run !== this.generation) return;
      step = Math.max(step, Math.ceil((audio.currentTime - origin) / eighth)); // never burst old notes after a background stall
      while (origin + step * eighth < audio.currentTime + lobbySettings.lookaheadS) {
        const at = origin + step * eighth;
        for (const note of loopNotes(step)) {
          const voice = audio.createOscillator(); const gain = audio.createGain();
          voice.type = "triangle"; voice.frequency.value = 440 * 2 ** ((note.pitch - 69) / 12);
          gain.gain.setValueAtTime(.001, at); gain.gain.linearRampToValueAtTime(note.level, at + .01);
          gain.gain.exponentialRampToValueAtTime(.001, at + note.length);
          voice.connect(gain).connect(bus); voice.start(at); voice.stop(at + note.length);
          this.voices.add(voice); voice.onended = () => { this.voices.delete(voice); voice.disconnect(); gain.disconnect(); };
        }
        // A short high sine pulse supplies an original, quiet percussive tick.
        if (step % 2 === 0) {
          const tick = audio.createOscillator(); const gain = audio.createGain();
          tick.frequency.value = step % 8 === 0 ? 130 : 1800;
          gain.gain.setValueAtTime(.015, at); gain.gain.exponentialRampToValueAtTime(.001, at + .025);
          tick.connect(gain).connect(bus); tick.start(at); tick.stop(at + .03);
          this.voices.add(tick); tick.onended = () => { this.voices.delete(tick); tick.disconnect(); gain.disconnect(); };
        }
        step++;
      }
    };
    schedule(); this.timer = setInterval(schedule, lobbySettings.tickMs);
    return true;
  }
  volume(value: number) { if (this.bus) this.bus.gain.value = value; }
  stop() {
    this.generation++;
    if (this.timer) clearInterval(this.timer); this.timer = null;
    this.bus?.disconnect(); this.bus = null;
    for (const voice of this.voices) { try { voice.stop(); } catch { /* Already ended. */ } }
    this.voices.clear();
  }
}

const player = new LobbyPlayer();
const initial = { enabled: false, volume: lobbySettings.defaultVolume, playing: false, status: "Off · switch on to start browser audio" };
let snapshot = initial;
let attempt = 0;
const listeners = new Set<() => void>();
const update = (value: typeof initial) => { snapshot = value; listeners.forEach(cb => cb()); };
export const lobbySnapshot = () => snapshot;
export const lobbyServerSnapshot = () => initial;
export const subscribeLobby = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };
function persist() { try { localStorage.setItem(LOBBY_KEY, JSON.stringify({ enabled: snapshot.enabled, volume: snapshot.volume })); } catch { /* Local preference only. */ } }
export function hydrateLobby() {
  try {
    const value = JSON.parse(localStorage.getItem(LOBBY_KEY) ?? "null");
    if (value) update({ ...snapshot, enabled: value.enabled === true, volume: typeof value.volume === "number" && Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : lobbySettings.defaultVolume, playing: false, status: value.enabled ? "Preference saved · switch on to start browser audio" : initial.status });
  } catch { /* Keep truthful defaults. */ }
}
export async function playLobbyMusic() {
  const run = ++attempt;
  update({ ...snapshot, enabled: true, status: "Starting browser audio…" }); persist();
  try {
    const playing = await player.start(snapshot.volume);
    if (run !== attempt) return;
    update({ ...snapshot, playing, status: playing ? "Playing · original browser instrumental" : "Audio needs a browser click · switch on to retry" });
  } catch {
    if (run === attempt) update({ ...snapshot, playing: false, status: "Audio could not start · switch on to retry" });
  }
}
export function stopLobbyMusic(disable = false) {
  attempt++; player.stop();
  update({ ...snapshot, enabled: disable ? false : snapshot.enabled, playing: false, status: disable ? "Off" : snapshot.enabled ? "Paused outside lobby · switch on here to restart" : initial.status });
  if (disable) persist();
}
export function setLobbyVolume(volume: number) {
  const value = Math.max(0, Math.min(1, volume)); player.volume(value);
  update({ ...snapshot, volume: value }); persist();
}
