// Score follow (spike: score-follow-spike): with ?mode=flow&band=follow, a bass-and-drums band plays on the piano
// output on a clock that predicts your next note (follow.ts). ?band=hold plays the same band on flow mode's own clock,
// the baseline, for an A/B by ear. Any other URL: nothing is sent. Off the demo path until a spec promotes it.
import type { Chart, GamePlugin, InputDevice } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { isFlowMode, onsetsOf } from "../flow-mode/clock";
import { bandEvents, followSettings, kalmanFollower, scheduler, silence, type Follower } from "./follow";

type Band = "off" | "follow" | "hold";

export const bandFrom = (params: URLSearchParams): Band => {
  const band = params.get("band");
  return isFlowMode(params) && (band === "follow" || band === "hold") ? band : "off";
};

export function scoreFollow(): GamePlugin {
  let band: Band = "off";
  let chart: Chart | null = null;
  let beats: number[] = [];
  const onsetOf = new Map<string, number>(); // note id -> its onset's index
  const lastPress = new Map<number, number>(); // pitch -> performance.now() of its latest press
  let output: MIDIOutput | null = null;
  let f: Follower | null = null;
  let sched: ReturnType<typeof scheduler> | null = null;
  let running = false;
  let listening = false;

  const send = (data: number[], at?: number) => output?.send(data, at);
  const hush = () => {
    running = false;
    (output as (MIDIOutput & { clear?(): void }) | null)?.clear?.(); // drop what's queued, then all notes off
    silence().forEach((m) => send(m));
  };

  return {
    id: "score-follow",
    transformChart(c, params) {
      band = bandFrom(params);
      if (band === "off") return c;
      chart = c; // after hand-mode: the judged hand's notes, as flow mode's judge gets them
      const onsets = onsetsOf(c);
      beats = onsets.map((o) => o.ms / msPerBeat(c.bpm));
      onsetOf.clear();
      onsets.forEach((o, k) => o.ids.forEach((id) => onsetOf.set(id, k)));
      if (typeof navigator !== "undefined" && navigator.requestMIDIAccess) {
        navigator
          .requestMIDIAccess()
          .then((access) => {
            output = [...access.outputs.values()].find((o) => o.name?.includes("Portable Grand")) ?? null;
          })
          .catch(() => {
            output = null;
          });
      }
      if (!listening && typeof window !== "undefined") {
        listening = true;
        window.addEventListener("pagehide", hush);
      }
      return c;
    },
    wrapInput(input: InputDevice): InputDevice {
      if (band === "off") return input;
      return {
        kind: input.kind,
        start: (on) =>
          input.start((e) => {
            if (e.type === "on") lastPress.set(e.pitch, e.timeMs);
            on(e);
          }),
        stop: () => input.stop(),
      };
    },
    onEvent(e) {
      if (band === "off" || !chart) return;
      if (e.type === "songStart") {
        f = kalmanFollower(chart, beats);
        sched = scheduler(bandEvents(chart), beats[0]);
        send([0xc0 | followSettings.bassChannel, followSettings.bassProgram]);
        running = true;
      } else if (e.type === "noteHit" && f) {
        const k = onsetOf.get(e.noteId);
        if (k !== undefined) f.played(k, lastPress.get(e.pitch) ?? performance.now());
      } else if (e.type === "pause") {
        hush();
        f?.halt();
        if (f && f.next < beats.length) sched?.skip(beats[f.next]);
      } else if (e.type === "resume") {
        running = true;
      } else if (e.type === "quit" || e.type === "songEnd") {
        hush();
      }
    },
    draw(_ctx, frame) {
      if (!running || !f || !sched || !chart) return;
      const now = performance.now();
      if (band === "follow") return sched.fill(now, f.wallAt, send);
      // The baseline: each event goes out when flow mode's clock (the page's chart clock in Flow) passes its beat.
      const mpb = msPerBeat(chart.bpm);
      sched.fill(now, (beat) => (beat * mpb <= frame.nowMs ? now : Infinity), send);
    },
  };
}
