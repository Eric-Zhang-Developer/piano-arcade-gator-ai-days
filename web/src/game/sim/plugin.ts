import type { Chart, GamePlugin } from "../../contracts";
import { loadLatencyOffset } from "../core/settings";
import { botTimeline } from "./bot";
import { createSimMidiAccess, installSim, type SimLog, type SimMidi, type TimelineEntry } from "./fake";

export const SIM_CHANNEL = "pianoArcade.sim";

// /sim -> /play
export type SimCommand =
  | { type: "send"; bytes: number[] }
  | { type: "play"; timeline: TimelineEntry[] }
  | { type: "bot" }
  | { type: "stall"; ms: number }
  | { type: "unplug" }
  | { type: "replug" }
  | { type: "jitter"; ms: number }
  | { type: "dropRelease"; pitch: number };
// Every message carries the /sim page's id, so two /sim tabs don't play into each other's games.
export type SimMessage = { simId: string } & (SimCommand | { type: "ready" } | { type: "log"; log: SimLog });

let sim: SimMidi | null = null;
let chart: Chart | null = null;
let botArmed = false;

function connect(simId: string) {
  const s = createSimMidiAccess();
  installSim(s);
  const ch = new BroadcastChannel(SIM_CHANNEL);
  const post = (m: SimMessage) => ch.postMessage(m);
  s.onLog((log) => post({ simId, type: "log", log }));
  ch.onmessage = ({ data: m }: MessageEvent<SimMessage>) => {
    if (m.simId !== simId) return;
    if (m.type === "send") s.send(m.bytes);
    if (m.type === "play") s.play(m.timeline);
    if (m.type === "stall") s.stall(m.ms);
    if (m.type === "unplug") s.unplug();
    if (m.type === "replug") s.replug();
    if (m.type === "jitter") s.setJitter(m.ms);
    if (m.type === "dropRelease") s.dropRelease(m.pitch);
    if (m.type === "bot") {
      // Start (or Retry) the game; the bot plays from its songStart. Mid-song, it waits for the next start.
      botArmed = true;
      // Start by its id, or Retry by its name: since duo-start (#763) neither is the first button on its screen.
      const start = document.querySelector<HTMLButtonElement>("[data-testid=start]");
      (start ?? [...document.querySelectorAll<HTMLButtonElement>("main button")].find((b) => b.textContent?.trim() === "Retry"))?.click();
    }
  };
  post({ simId, type: "ready" });
  return s;
}

// Only /play?midi=sim: the fake replaces requestMIDIAccess before the game asks for MIDI (at chart load, before
// Start), so core's real MIDI input runs against it unchanged.
export const simPlugin: GamePlugin = {
  id: "piano-sim",
  transformChart(c, params) {
    chart = c;
    if (params.get("midi") === "sim" && !sim) sim = connect(params.get("simId") ?? "");
    return c;
  },
  onEvent(e) {
    if (e.type !== "songStart" || !sim || !chart || !botArmed) return;
    botArmed = false;
    const zeroPerf = performance.now() - e.atMs; // chart clock 0, in performance.now() time
    sim.cancel();
    sim.play(botTimeline(chart), zeroPerf + loadLatencyOffset());
  },
};
