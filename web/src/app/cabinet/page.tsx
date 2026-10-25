"use client";
// The cabinet (spec: cabinet): PRESS ANY KEY, then attract and a bot's demo in full-screen iframes, then the title
// again, unattended. This page keeps the keyboard and listens to the piano itself; the iframes never take input.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Chart } from "../../contracts";
import { echoGuard } from "../../game/hand-mode/hands";
import { cabinetSettings, demoResults, demoUrl, keyUrl, start, tick, timers, type Loop } from "../../game/cabinet/loop";
import type { CabinetMessage } from "../../game/cabinet/plugin";
import { pickOutput } from "../../replay/piano";
import { APP_NAME } from "@/game/app-name";

const ALL_NOTES_OFF_CH1 = [0xb0, 123, 0];

// Every note-on the iframe sends to the piano, in this page's clock, so the echo guard knows it. Wraps the frame's
// MIDIOutput.prototype.send, which covers outputs it already holds. A timestamped send counts at its own time.
function watchSends(win: Window, sent: (pitch: number, atPerf: number) => void) {
  const proto = (win as Window & { MIDIOutput?: { prototype: MIDIOutput } }).MIDIOutput?.prototype;
  if (!proto) return;
  const send = proto.send;
  proto.send = function (data: number[] | Uint8Array, timestamp?: number) {
    const d = [...data];
    if ((d[0] & 0xf0) === 0x90 && d[2] > 0) sent(d[1], performance.now() + (timestamp ? timestamp - win.performance.now() : 0));
    return send.call(this, data, timestamp);
  };
}

// /attract waits for its Play button; press it once it's enabled (its data loads first).
function startAttract(win: Window) {
  const until = performance.now() + 15_000;
  const poll = setInterval(() => {
    const play = [...win.document.querySelectorAll("button")].find((b) => b.textContent?.includes("Play") && !b.disabled);
    if (play) play.click();
    if (play || performance.now() > until) clearInterval(poll);
  }, 250);
}

export default function Cabinet() {
  const [loop, setLoop] = useState<Loop | null>(null);
  const loopRef = useRef<Loop | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const guardRef = useRef(echoGuard(cabinetSettings.echoMs));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let chart: Chart | null = null;
    void fetch(`/songs/${cabinetSettings.demoSong}/chart.json`)
      .then((r) => r.json())
      .then((c: Chart) => (chart = c))
      .catch(() => {});
    const set = (s: Loop) => {
      loopRef.current = s;
      setLoop(s);
    };
    set(start(performance.now()));

    let output: MIDIOutput | null = null;
    const guard = guardRef.current;
    const go = (kind: "laptop" | "piano") => {
      output?.send(ALL_NOTES_OFF_CH1); // a demo cut off mid-note leaves nothing sounding
      window.location.assign(keyUrl(kind));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      e.preventDefault();
      go("laptop");
    };
    const onMidi = (m: Event) => {
      const d = (m as MIDIMessageEvent).data;
      if (!d || (d[0] & 0xf0) !== 0x90 || d[2] === 0) return;
      if (guard.isEcho(d[1], m.timeStamp)) return; // attract and the demo both play the piano
      go("piano");
    };
    const onMessage = (e: MessageEvent<CabinetMessage>) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "cabinet-results" && loopRef.current) set(demoResults(loopRef.current, performance.now()));
    };
    let inputs: MIDIInput[] = [];
    let live = true; // MIDI access can resolve after this effect is cleaned up (StrictMode runs it twice)
    void navigator.requestMIDIAccess?.().then(
      (a) => {
        if (!live) return;
        output = pickOutput(a);
        inputs = [...a.inputs.values()];
        inputs.forEach((i) => i.addEventListener("midimessage", onMidi));
      },
      () => {},
    );
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    const interval = setInterval(() => {
      const s = loopRef.current;
      if (!s) return;
      const next = tick(s, performance.now(), timers(params, chart));
      if (next === s) return;
      if (s.phase !== "title") {
        output?.send(ALL_NOTES_OFF_CH1);
        guard.clear();
      }
      set(next);
    }, 250);
    return () => {
      live = false;
      clearInterval(interval);
      inputs.forEach((i) => i.removeEventListener("midimessage", onMidi));
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  // An iframe's page can take focus (autoFocus): its keys come here too.
  const onFrameLoad = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.addEventListener("keydown", (e) => window.dispatchEvent(new KeyboardEvent("keydown", { key: e.key, repeat: e.repeat })));
    watchSends(win, (pitch, at) => guardRef.current.sent(pitch, at));
    if (loopRef.current?.phase === "attract") startAttract(win);
  };

  const phase = loop?.phase ?? "title";
  return (
    <main data-testid="cabinet" data-phase={phase} style={screen}>
      {phase === "title" ? (
        <>
          <h1 style={wordmark}>{APP_NAME}</h1>
          <p data-testid="press-any-key" style={press}>
            PRESS ANY KEY
          </p>
          <button tabIndex={-1} style={kiosk} onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}>
            Start kiosk
          </button>
        </>
      ) : (
        <iframe
          key={`${phase}-${loop?.since}`}
          ref={frameRef}
          data-testid={`cabinet-${phase}`}
          title={phase}
          src={phase === "attract" ? "/attract" : demoUrl()}
          tabIndex={-1}
          allow="midi"
          onLoad={onFrameLoad}
          style={frame}
        />
      )}
    </main>
  );
}

const screen: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(to bottom, var(--pa-bg) 0%, var(--pa-sky) 100%)",
  color: "var(--pa-ink)",
};
const wordmark: CSSProperties = {
  margin: 0,
  fontFamily: "var(--pa-font-display), system-ui, sans-serif",
  fontStyle: "italic",
  fontWeight: 900,
  fontSize: "clamp(48px, 9vw, 160px)",
  textTransform: "uppercase",
  letterSpacing: "-0.02em",
};
const press: CSSProperties = { marginTop: "4vh", fontSize: "clamp(20px, 2.4vw, 40px)", fontWeight: 700, letterSpacing: "0.2em" };
const kiosk: CSSProperties = {
  position: "absolute",
  right: 24,
  bottom: 24,
  padding: "6px 12px",
  borderRadius: 6,
  border: "none",
  background: "var(--pa-panel)",
  color: "var(--pa-ink)",
  cursor: "pointer",
};
const frame: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, pointerEvents: "none" };
