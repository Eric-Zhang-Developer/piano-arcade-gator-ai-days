// The worklet (spec: crowd): the ClapDetector (dsp.ts) on the mic, in an AudioWorkletProcessor. Its source is the class's
// own text in a Blob URL, as record-follows' is, so vitest and the page run one copy. The audio stays in the worklet:
// only onset times (context seconds) go out, and only note-on times come in. Nothing is stored or sent.
import { ClapDetector, crowdSettings, type CrowdSettings } from "./dsp";

export const workletName = "crowd-claps";

export type ToWorklet = { noteOn: number }; // context seconds
export type FromWorklet = { clap: number }; // context seconds, the clap's first sample

export const processorSource = (s: CrowdSettings = crowdSettings) => `
const ClapDetector = (${ClapDetector.toString()});
class CrowdClaps extends AudioWorkletProcessor {
  constructor() {
    super();
    this.d = new ClapDetector(sampleRate, ${JSON.stringify(s)});
    this.port.onmessage = ({ data }) => {
      if (typeof data.noteOn === "number") this.d.noteOn(Math.round(data.noteOn * sampleRate));
    };
  }
  process(inputs) {
    const x = inputs[0] && inputs[0][0];
    if (!x) return true;
    // the detector counts samples from its first; currentFrame is the context's, so start it there
    if (this.d.pos === 0) this.d.pos = currentFrame;
    for (const at of this.d.push(x)) this.port.postMessage({ clap: at / sampleRate });
    return true;
  }
}
registerProcessor(${JSON.stringify(workletName)}, CrowdClaps);
`;

// A context registers a processor name once, so it's loaded once each.
const loaded = new WeakMap<BaseAudioContext, Promise<void>>();
export function loadWorklet(ctx: BaseAudioContext): Promise<void> {
  if (!loaded.has(ctx)) {
    const url = URL.createObjectURL(new Blob([processorSource()], { type: "text/javascript" }));
    loaded.set(ctx, ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url)));
  }
  return loaded.get(ctx)!;
}
