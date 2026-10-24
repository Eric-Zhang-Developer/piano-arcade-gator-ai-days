"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { beatSettings } from "../../game/beat";
import { calibrate, calibrationSettings, clickTimes, type Calibration } from "../../game/calibration";
import { midiDevice } from "../../game/core/input";
import { loadLatencyOffset, saveLatencyOffset, settings } from "../../game/core/settings";

const SIDE_STICK = 37; // beat-track's click: General MIDI side stick on channel 10

type Phase = { kind: "ready" } | { kind: "running"; clicks: number[] } | { kind: "done"; result: Calibration };

// Browser-only: Web Audio, Web MIDI and localStorage.
export default dynamic(() => Promise.resolve(Calibrate), { ssr: false });

function Calibrate() {
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });
  const [saved, setSaved] = useState(loadLatencyOffset);
  const [heard, setHeard] = useState(0); // clicks played so far
  const [midiStatus, setMidiStatus] = useState("");
  const stopRef = useRef<() => void>(() => {});
  useEffect(() => () => stopRef.current(), []); // leaving mid-run saves nothing

  const start = useCallback(async () => {
    stopRef.current();
    setHeard(0);
    // The piano when it's connected, as beat-track plays its beat; else a Web Audio click. Created inside the press.
    let audio: AudioContext | null = new AudioContext();
    const out = await pianoOutput();
    if (out) {
      void audio.close();
      audio = null;
    } else await audio.resume().catch(() => {});

    const clicks = clickTimes(performance.now());
    const taps: number[] = [];
    if (out) {
      for (const c of clicks) {
        out.send([0x99, SIDE_STICK, beatSettings.stickVelocity], c);
        out.send([0x89, SIDE_STICK, 0], c + beatSettings.noteLengthMs);
      }
    } else if (audio) {
      // Scheduled on the audio clock: perf time maps to it through one reading of each.
      const [ctxT, perfT] = [audio.currentTime, performance.now()];
      clicks.forEach((c, i) => {
        const t = ctxT + (c - perfT) / 1000;
        const osc = audio!.createOscillator();
        const gain = audio!.createGain();
        osc.frequency.value = i < calibrationSettings.settleClicks ? beatSettings.clickHz : beatSettings.clickAccentHz;
        gain.gain.setValueAtTime(beatSettings.clickVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + beatSettings.clickLengthS);
        osc.connect(gain).connect(audio!.destination);
        osc.start(t);
        osc.stop(t + beatSettings.clickLengthS);
      });
    }

    // Taps: any laptop key or piano key, stamped the way /play stamps input.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      e.preventDefault(); // Space would scroll or press a button
      taps.push(e.timeStamp);
    };
    window.addEventListener("keydown", onKey);
    const midi = midiDevice(setMidiStatus);
    void midi.start((e) => {
      if (e.type === "on") taps.push(e.timeMs);
    });

    let raf = 0;
    const tick = () => {
      setHeard(clicks.filter((c) => c <= performance.now()).length);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = () => {
      window.removeEventListener("keydown", onKey);
      midi.stop();
      cancelAnimationFrame(raf);
      clearTimeout(done);
      (out as (MIDIOutput & { clear?(): void }) | null)?.clear?.(); // Web MIDI's clear() drops queued clicks, where it exists
      void audio?.close();
      stopRef.current = () => {};
    };
    const done = setTimeout(() => {
      stop();
      const result = calibrate(clicks, taps);
      if (result.ok) {
        saveLatencyOffset(result.offsetMs);
        setSaved(result.offsetMs);
      }
      setPhase({ kind: "done", result });
    }, clicks.at(-1)! - performance.now() + calibrationSettings.pairMs + 50);
    stopRef.current = stop;
    setPhase({ kind: "running", clicks });
  }, []);

  const s = calibrationSettings;
  return (
    <main style={page} data-testid="calibrate" data-clicks={phase.kind === "running" ? phase.clicks.join(",") : undefined}>
      <h1 style={{ margin: 0, fontSize: 32 }}>Calibrate latency</h1>
      {phase.kind === "ready" && (
        <>
          <p style={text}>
            Tap any key, or any piano key, on each of {s.clicks} clicks. The first {s.settleClicks} are for settling in.
            Your taps set the latency offset {"/play"} uses.
          </p>
          <p style={dim}>Saved offset now: {saved} ms</p>
          <button style={button} onClick={start} autoFocus>
            Start
          </button>
        </>
      )}
      {phase.kind === "running" && (
        <>
          <p style={text}>Tap along</p>
          <div style={{ display: "flex", gap: 10 }} aria-label={`${heard} of ${s.clicks} clicks`}>
            {phase.clicks.map((c, i) => (
              <span
                key={c}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: i < heard ? (i < s.settleClicks ? "var(--pa-ink-dim)" : settings.noteColor) : "rgba(242,242,245,0.12)",
                }}
              />
            ))}
          </div>
        </>
      )}
      {phase.kind === "done" && <Result result={phase.result} onRetry={start} />}
      {midiStatus && <p style={{ ...dim, fontSize: 13 }}>{midiStatus}</p>}
      <Link href="/" style={{ color: settings.noteColor }}>
        Back to songs
      </Link>
    </main>
  );
}

function Result({ result, onRetry }: { result: Calibration; onRetry: () => void }) {
  const s = calibrationSettings;
  return (
    <>
      {result.ok ? (
        <p style={text} data-testid="calibrate-result">
          Latency offset <b>{result.offsetMs} ms</b>, spread ±{result.spreadMs} ms, from {result.taps} taps. Saved.
        </p>
      ) : (
        <p style={text} data-testid="calibrate-result">
          {result.reason === "too few"
            ? `Too few taps: ${result.taps} landed near a click after the first ${s.settleClicks}; it needs ${s.minTaps}.`
            : `Too spread: taps varied ±${result.spreadMs} ms; it needs ±${s.maxSpreadMs} ms or less.`}{" "}
          Nothing saved.
        </p>
      )}
      <button style={button} onClick={onRetry} autoFocus>
        Try again
      </button>
    </>
  );
}

async function pianoOutput(): Promise<MIDIOutput | null> {
  try {
    const access = await navigator.requestMIDIAccess();
    return [...access.outputs.values()].find((o) => o.name?.includes("Portable Grand")) ?? null;
  } catch {
    return null;
  }
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 20,
  padding: 16,
  background: "var(--pa-bg)",
  color: "var(--pa-ink)",
  fontFamily: "system-ui, sans-serif",
  textAlign: "center",
};
const text: React.CSSProperties = { maxWidth: 520, margin: 0, fontSize: 18, lineHeight: 1.5 };
const dim: React.CSSProperties = { margin: 0, color: "var(--pa-ink-dim)" };
const button: React.CSSProperties = {
  padding: "12px 32px",
  fontSize: 20,
  borderRadius: 8,
  border: "none",
  background: settings.noteColor,
  color: "#000",
  cursor: "pointer",
};
