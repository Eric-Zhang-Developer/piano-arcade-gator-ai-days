"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { beatSettings } from "../../game/beat";
import { calibrate, calibrationSettings, clickTimes, type Calibration } from "../../game/calibration";
import { midiDevice } from "../../game/core/input";
import { loadLatencyOffset, saveLatencyOffset } from "../../game/core/settings";
import { Brackets, Button, MonoLabel, Panel } from "../../game/duo-tokens";
import css from "./calibrate.module.css";

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
    <main className={css.page} data-testid="calibrate" data-clicks={phase.kind === "running" ? phase.clicks.join(",") : undefined}>
      <Brackets style={{ padding: 0 }}>
        <Panel>
          <div className={css.panel}>
            <h1 className={css.title}>Calibrate latency</h1>
            {phase.kind === "ready" && (
              <>
                <p className={css.text}>
                  Tap any key, or any piano key, on each of {s.clicks} clicks. The first {s.settleClicks} are for settling
                  in. Your taps set the latency offset {"/play"} uses.
                </p>
                <Clicks count={s.clicks} settle={s.settleClicks} heard={0} />
                <div className={css.row}>
                  <Button onClick={start} autoFocus style={kitSize}>
                    Start
                  </Button>
                  <div className={css.cell}>
                    <MonoLabel style={{ fontSize: "0.7em" }}>Saved offset now</MonoLabel>
                    <span className={css.numeral}>{saved} ms</span>
                  </div>
                </div>
              </>
            )}
            {phase.kind === "running" && (
              <>
                <p className={css.text}>Tap along</p>
                <Clicks count={phase.clicks.length} settle={s.settleClicks} heard={heard} />
              </>
            )}
            {phase.kind === "done" && <Result result={phase.result} onRetry={start} />}
            {midiStatus && <p className={css.status}>{midiStatus}</p>}
            <Link href="/" className={css.back}>
              Back to songs
            </Link>
          </div>
        </Panel>
      </Brackets>
    </main>
  );
}

// The clicks as square cells, the settling ones set apart: empty before Start, lit as each is heard.
function Clicks({ count, settle, heard }: { count: number; settle: number; heard: number }) {
  return (
    <div className={css.clicks} aria-label={`${heard} of ${count} clicks`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={css.click} data-settle-end={i === settle - 1 || undefined} data-heard={i < heard ? (i < settle ? "settle" : "count") : undefined} />
      ))}
    </div>
  );
}

function Result({ result, onRetry }: { result: Calibration; onRetry: () => void }) {
  const s = calibrationSettings;
  return (
    <>
      {result.ok ? (
        <p className={css.text} data-testid="calibrate-result">
          Latency offset <b>{result.offsetMs} ms</b>, spread ±{result.spreadMs} ms, from {result.taps} taps. Saved.
        </p>
      ) : (
        <p className={css.text} data-testid="calibrate-result">
          {result.reason === "too few"
            ? `Too few taps: ${result.taps} landed near a click after the first ${s.settleClicks}; it needs ${s.minTaps}.`
            : `Too spread: taps varied ±${result.spreadMs} ms; it needs ±${s.maxSpreadMs} ms or less.`}{" "}
          Nothing saved.
        </p>
      )}
      <Button onClick={onRetry} autoFocus style={kitSize}>
        Try again
      </Button>
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

// The kit's button text is a fixed 14 px; here it follows the page's height-scaled size.
const kitSize: React.CSSProperties = { fontSize: "calc(var(--size) * 0.8)", padding: "0.75em 1.8em" };
