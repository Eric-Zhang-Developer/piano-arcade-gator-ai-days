// The worklet (spec: record-follows): the Stretcher (vocoder.ts) running in an AudioWorkletProcessor. Its source is the
// class's own text in a Blob URL, so there's no second copy of the DSP and no file in public/ to keep in step
// (decision record-follows-dsp: worklet loading). The port takes { buffer } (mono, the context's rate), { seek } (input
// sample), { rate } and { mode }: "silent" outputs zeros, "frozen" holds the spectral freeze, "playing" plays. It reports
// nothing back: the driver integrates the same ratios (driver.ts), and the seek puts the first frame's centre on the
// note (index.tsx), so the two agree to the vocoder's (N/2)(1 - rate) lag, ~4 ms at 0.8×, plus the output latency.
import { Stretcher } from "./vocoder";

export const workletSettings = { name: "record-follows" };

export type WorkletMessage = { buffer: Float32Array } | { seek: number } | { rate: number } | { mode: "silent" | "frozen" | "playing" };

// The processor's source. A class expression around Stretcher's text keeps it working whatever the bundler names it.
export const processorSource = (s = workletSettings) => `
const Stretcher = (${Stretcher.toString()});
class RecordFollows extends AudioWorkletProcessor {
  constructor() {
    super();
    this.s = null;
    this.mode = "silent";
    this.port.onmessage = ({ data }) => {
      if (data.buffer) this.s = new Stretcher(data.buffer);
      else if (!this.s) return;
      else if ("seek" in data) this.s.seek(data.seek);
      else if ("rate" in data) this.s.rate = data.rate;
      else if ("mode" in data) {
        this.mode = data.mode;
        this.s.frozen = data.mode === "frozen";
      }
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0];
    if (!this.s || this.mode === "silent") {
      for (const ch of out) ch.fill(0);
      return true;
    }
    this.s.process(out[0]);
    for (let c = 1; c < out.length; c++) out[c].set(out[0]);
    return true;
  }
}
registerProcessor(${JSON.stringify(s.name)}, RecordFollows);
`;

// A context registers a processor name once: a second addModule of this source would throw, so it's loaded once each.
const loaded = new WeakMap<BaseAudioContext, Promise<void>>();
const load = (ctx: BaseAudioContext) => {
  if (!loaded.has(ctx)) {
    const url = URL.createObjectURL(new Blob([processorSource()], { type: "text/javascript" }));
    loaded.set(ctx, ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url)));
  }
  return loaded.get(ctx)!;
};

// The node, playing into `out`. Mono in: a stereo file is averaged (mono()).
export async function stretchNode(ctx: AudioContext, samples: Float32Array, out: AudioNode): Promise<AudioWorkletNode> {
  await load(ctx);
  const node = new AudioWorkletNode(ctx, workletSettings.name, { numberOfInputs: 0, outputChannelCount: [2] });
  node.connect(out);
  node.port.postMessage({ buffer: samples } satisfies WorkletMessage);
  return node;
}

export function mono(b: AudioBuffer): Float32Array {
  const y = new Float32Array(b.length);
  for (let c = 0; c < b.numberOfChannels; c++) {
    const x = b.getChannelData(c);
    for (let i = 0; i < y.length; i++) y[i] += x[i] / b.numberOfChannels;
  }
  return y;
}
