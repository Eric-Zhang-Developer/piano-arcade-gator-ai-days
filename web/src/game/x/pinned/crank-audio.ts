// The crank's audio (spec: musicbox-polish, #1199): one AudioContext, made on the first crank and reused by every one
// after it. Stop and the take's natural end stop its pins and drop their gain; leaving /musicbox closes it. Each crank
// used to open a new context and none was ever closed. Pure lifecycle, so a test can drive it with a fake context.

export interface CrankAudio {
  readonly ctx: AudioContext | null;
  start(gain: number, schedule: (ctx: AudioContext, out: AudioNode) => AudioScheduledSourceNode[]): AudioContext;
  stop(): void;
  close(): void;
}

export function crankAudio(make: () => AudioContext = () => new AudioContext()): CrankAudio {
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let sources: AudioScheduledSourceNode[] = [];
  const stop = () => {
    sources.forEach((s) => s.stop());
    sources = [];
    out?.disconnect();
    out = null;
  };
  return {
    get ctx() {
      return ctx;
    },
    start(gain, schedule) {
      stop();
      ctx ??= make();
      void ctx.resume(); // a reused context may have been suspended by the browser between cranks
      out = ctx.createGain();
      out.gain.value = gain;
      out.connect(ctx.destination);
      sources = schedule(ctx, out);
      return ctx;
    },
    stop,
    close() {
      stop();
      void ctx?.close();
      ctx = null;
    },
  };
}
