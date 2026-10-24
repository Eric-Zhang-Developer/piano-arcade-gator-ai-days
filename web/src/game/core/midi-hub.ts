// One physical message owner, independent subscribers for game and menu input.
// A menu disconnect must never clear a playing game's input handler.
const ports = new WeakMap<MIDIInput, { listeners: Set<(e: MIDIMessageEvent) => void>; dispatch: (e: MIDIMessageEvent) => void }>();

export function subscribeMidi(input: MIDIInput, listener: (e: MIDIMessageEvent) => void): () => void {
  let port = ports.get(input);
  if (!port) {
    const listeners = new Set<(e: MIDIMessageEvent) => void>();
    port = { listeners, dispatch: e => { for (const callback of [...listeners]) callback(e); } };
    ports.set(input, port);
  }
  const owned = port;
  owned.listeners.add(listener);
  input.onmidimessage = owned.dispatch;
  return () => {
    owned.listeners.delete(listener);
    if (!owned.listeners.size) {
      if (input.onmidimessage === owned.dispatch) input.onmidimessage = null;
      ports.delete(input);
    }
  };
}
