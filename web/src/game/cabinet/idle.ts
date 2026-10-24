// Calls onIdle once nobody has touched a key, the mouse or the piano for ms. Any of them starts the wait again. Returns
// a disarm. extra: more window events that count as input (demo-reset adds "wheel").
export function whenIdle(ms: number, onIdle: () => void, extra: string[] = []): () => void {
  let timer = setTimeout(onIdle, ms);
  const restart = () => {
    clearTimeout(timer);
    timer = setTimeout(onIdle, ms);
  };
  const onMidi = (m: Event) => {
    const d = (m as MIDIMessageEvent).data;
    if (d && (d[0] & 0xf0) === 0x90 && d[2] > 0) restart();
  };
  let inputs: MIDIInput[] = [];
  let live = true; // access can resolve after a disarm
  void navigator.requestMIDIAccess?.().then(
    (a) => {
      if (!live) return;
      inputs = [...a.inputs.values()];
      inputs.forEach((i) => i.addEventListener("midimessage", onMidi));
    },
    () => {},
  );
  const events = ["keydown", "pointerdown", ...extra];
  events.forEach((t) => window.addEventListener(t, restart));
  return () => {
    live = false;
    clearTimeout(timer);
    inputs.forEach((i) => i.removeEventListener("midimessage", onMidi));
    events.forEach((t) => window.removeEventListener(t, restart));
  };
}
