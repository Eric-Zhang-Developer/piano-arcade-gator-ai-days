"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chart } from "../../contracts";
import { keyMap } from "../../game/core/input";
import { KEYS_VELOCITY } from "../../game/core/settings";
import { keyOff, keyOn, PROFILE_SOURCES, type SimLog, type TimelineEntry } from "../../game/sim/fake";
import fixture from "../../game/sim/fixtures/python-piano.json";
import { SIM_CHANNEL, type SimCommand, type SimMessage } from "../../game/sim/plugin";

const CHART_URL = "/songs/twinkle/chart.json";
const MAX_GAP_MS = 2000; // replay only: longer silences in the capture are shortened, and say so in the log
const MAX_LOG = 500;
const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(p % 12);

// "Replay a real take": every run of the capture back to back, long gaps capped.
function replayTimeline(): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  let t = 0;
  for (const seg of fixture.segments) {
    seg.messages.forEach((m, i) => {
      const gap = i ? m.timeMs - seg.messages[i - 1].timeMs : MAX_GAP_MS;
      t += Math.min(gap, MAX_GAP_MS);
      const note = !i
        ? `run "${seg.label}" (log line ${seg.startLine})`
        : gap > MAX_GAP_MS
          ? `gap capped (was ${(gap / 1000).toFixed(1)} s)`
          : undefined;
      out.push({ timeMs: t, bytes: m.bytes, note });
    });
  }
  return out;
}

function describe(b: number[]): [string, string] {
  const ch = b[0] < 0xf0 ? `ch${(b[0] & 0x0f) + 1}` : "";
  const cmd = b[0] & 0xf0;
  if (b[0] === 0xfe) return [ch, "active_sensing"];
  if (b[0] === 0xf8) return [ch, "clock"];
  if (cmd === 0x90) return [ch, b[2] ? "note_on" : "release(v0)"];
  if (cmd === 0x80) return [ch, "note_off"];
  if (cmd === 0xb0) return [ch, "control_change"];
  return [ch, "other"];
}

const hex = (b: number[]) => b.map((x) => x.toString(16).toUpperCase().padStart(2, "0")).join(" ");

interface Row {
  t: number;
  gap: number | null;
  ch: string;
  type: string;
  bytes: string;
  note?: string;
}

// The spike log's columns: time, gap since the previous message, channel, type, raw bytes.
function useLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const last = useRef<number | null>(null);
  const add = useCallback((l: SimLog) => {
    let row: Row;
    if (l.kind === "message") {
      const [ch, type] = describe(l.bytes);
      row = { t: l.timeStamp, gap: last.current === null ? null : l.timeStamp - last.current, ch, type, bytes: hex(l.bytes), note: l.note };
      last.current = l.timeStamp;
    } else {
      row = { t: l.timeStamp, gap: null, ch: "", type: l.kind === "state" ? "statechange" : "fault", bytes: "", note: l.kind === "state" ? `port ${l.state}` : l.text };
    }
    setRows((r) => [...r.slice(-MAX_LOG + 1), row]);
  }, []);
  return { rows, add };
}

// Client only: the page's id and mode come from the browser, so there's nothing to prerender.
export default dynamic(() => Promise.resolve(SimRoot), { ssr: false });

function SimRoot() {
  return new URLSearchParams(window.location.search).has("record") ? <Record /> : <SimPage />;
}

function SimPage() {
  const [simId] = useState(() => Math.random().toString(36).slice(2, 10));
  const [ready, setReady] = useState(false);
  const [jitter, setJitter] = useState(false);
  const [chart, setChart] = useState<Chart | null>(null);
  const [down, setDown] = useState<Set<number>>(new Set());
  const { rows, add } = useLog();
  const chRef = useRef<BroadcastChannel | null>(null);
  const downRef = useRef(new Set<number>());
  const [gameKey, setGameKey] = useState(0);
  const botPending = useRef(false);

  useEffect(() => {
    const ch = new BroadcastChannel(SIM_CHANNEL);
    chRef.current = ch;
    ch.onmessage = ({ data: m }: MessageEvent<SimMessage>) => {
      if (m.simId !== simId) return;
      if (m.type === "log") return add(m.log);
      if (m.type !== "ready") return;
      setReady(true);
      if (botPending.current) ch.postMessage({ simId, type: "bot" } satisfies SimMessage);
      botPending.current = false;
    };
    fetch(CHART_URL)
      .then((r) => r.json())
      .then(setChart);
    return () => ch.close();
  }, [simId, add]);

  const post = useCallback((c: SimCommand) => chRef.current?.postMessage({ simId, ...c } satisfies SimMessage), [simId]);
  const press = useCallback(
    (pitch: number, on: boolean) => {
      const d = downRef.current;
      if (d.has(pitch) === on) return;
      if (on) d.add(pitch);
      else d.delete(pitch);
      setDown(new Set(d));
      post({ type: "send", bytes: on ? keyOn(pitch, KEYS_VELOCITY) : keyOff(pitch) });
    },
    [post],
  );

  const pitches = chart ? chart.notes.map((n) => n.pitch) : [];
  const low = pitches.length ? Math.min(...pitches) : 0;
  const high = pitches.length ? Math.max(...pitches) : -1;

  // Laptop keys, while this page (not the game) has focus, go through the fake piano.
  useEffect(() => {
    if (!chart) return;
    const map = keyMap(Math.min(...chart.notes.map((n) => n.pitch)));
    const handle = (on: boolean) => (e: KeyboardEvent) => {
      const p = map.get(e.code);
      if (p === undefined || e.repeat || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      press(p, on);
    };
    const kd = handle(true);
    const ku = handle(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [chart, press]);

  const stuckPitch = chart?.notes[0].pitch ?? 60;
  const keys = Array.from({ length: Math.max(0, high - low + 1) }, (_, i) => low + i);

  return (
    <main style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(320px, 1fr)", gap: 16, padding: 16, height: "100vh", boxSizing: "border-box" }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <iframe key={gameKey} title="game" src={`/play?midi=sim&simId=${simId}`} style={{ flex: 1, border: "1px solid #333", borderRadius: 8, minHeight: 0 }} />
        <div aria-label="virtual keyboard" style={{ display: "flex", gap: 2, height: 96 }}>
          {keys.map((p) => (
            <button
              key={p}
              aria-label={`key ${p}`}
              aria-pressed={down.has(p)}
              onPointerDown={() => press(p, true)}
              onPointerUp={() => press(p, false)}
              onPointerLeave={() => press(p, false)}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                alignSelf: isBlack(p) ? "flex-start" : "stretch",
                height: isBlack(p) ? "60%" : undefined,
                background: down.has(p) ? "#5ef0c4" : isBlack(p) ? "#222" : "#ddd",
                color: isBlack(p) ? "#eee" : "#111",
                fontSize: 12,
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, opacity: 0.6, fontSize: 13 }}>
          Click keys, or type A S D F G H J K L ; (white) and W E T Y U O P (black) with this page focused: they go through
          the fake piano. With the game focused, its own laptop keys bypass MIDI.
        </p>
      </section>

      <aside style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            style={btn}
            disabled={!ready}
            onClick={() => {
              // A fresh game from any state (ready, mid-song, results): the bot starts once it says ready.
              botPending.current = true;
              setReady(false);
              setGameKey((k) => k + 1);
            }}
          >
            Watch the bot
          </button>
          <button style={btn} disabled={!ready} onClick={() => post({ type: "play", timeline: replayTimeline() })}>
            Replay a real take
          </button>
          <button style={btn} disabled={!ready} onClick={() => post({ type: "stall", ms: 5000 })}>
            Stall 5 s
          </button>
          <button style={btn} disabled={!ready} onClick={() => post({ type: "unplug" })}>
            Unplug
          </button>
          <button style={btn} disabled={!ready} onClick={() => post({ type: "replug" })}>
            Replug
          </button>
          <button
            style={btn}
            disabled={!ready}
            aria-pressed={jitter}
            onClick={() => {
              post({ type: "jitter", ms: jitter ? 0 : 10 });
              setJitter(!jitter);
            }}
          >
            Jitter ±10 ms: {jitter ? "on" : "off"}
          </button>
          <button style={btn} disabled={!ready} onClick={() => post({ type: "dropRelease", pitch: stuckPitch })}>
            Stuck note ({stuckPitch})
          </button>
        </div>
        {!ready && <p style={{ margin: 0, opacity: 0.6 }}>Waiting for the game…</p>}

        <h2 style={h2}>MIDI log</h2>
        <div data-testid="midi-log" style={{ flex: 1, overflowY: "auto", minHeight: 120, fontFamily: "ui-monospace, monospace", fontSize: 12, background: "#111", borderRadius: 8, padding: 8 }}>
          <LogTable rows={rows} />
        </div>

        <h2 style={h2}>Profile</h2>
        <table data-testid="profile" style={{ fontSize: 12, borderSpacing: "8px 2px" }}>
          <tbody>
            {PROFILE_SOURCES.map((s) => (
              <tr key={s.label}>
                <td style={{ opacity: 0.7 }}>{s.label}</td>
                <td>{s.value}</td>
                <td style={{ opacity: 0.5 }}>{s.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>
    </main>
  );
}

function LogTable({ rows }: { rows: Row[] }) {
  const end = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" }); // newer Chrome returns a Promise here: never return it
  }, [rows]);
  return (
    <table style={{ width: "100%", borderSpacing: "8px 0", whiteSpace: "nowrap" }}>
      <thead>
        <tr style={{ opacity: 0.5, textAlign: "right" }}>
          <th>t_ms</th>
          <th>gap_ms</th>
          <th style={{ textAlign: "left" }}>ch</th>
          <th style={{ textAlign: "left" }}>type</th>
          <th style={{ textAlign: "left" }}>bytes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} ref={i === rows.length - 1 ? end : undefined} style={{ color: r.bytes ? undefined : "#f0c45e" }}>
            <td style={{ textAlign: "right" }}>{r.t.toFixed(1)}</td>
            <td style={{ textAlign: "right" }}>{r.gap === null ? "" : r.gap.toFixed(1)}</td>
            <td>{r.ch}</td>
            <td>{r.type}</td>
            <td>
              {r.bytes} {r.note && <span style={{ opacity: 0.6 }}>{r.note}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// /sim?record, with the real piano: every raw message unfiltered (0xFE included), downloadable as a fixture.
function Record() {
  const [status, setStatus] = useState("Not connected");
  const [msgs, setMsgs] = useState<{ timeMs: number; bytes: number[] }[]>([]);
  const { rows, add } = useLog();
  const portName = useRef("");

  const connect = async () => {
    if (!navigator.requestMIDIAccess) return setStatus("Web MIDI not supported: use Chrome");
    try {
      const access = await navigator.requestMIDIAccess();
      const inputs = [...access.inputs.values()];
      const input = inputs.find((i) => i.name?.includes("Portable Grand")) ?? inputs[0];
      if (!input) return setStatus("No MIDI input found");
      portName.current = `${input.name} (${input.manufacturer})`;
      setStatus(`Recording from ${portName.current}`);
      input.onmidimessage = (m) => {
        if (!m.data) return;
        const bytes = [...m.data];
        setMsgs((a) => [...a, { timeMs: m.timeStamp, bytes }]);
        add({ kind: "message", timeStamp: m.timeStamp, bytes });
      };
    } catch (e) {
      setStatus(`MIDI: ${(e as Error).name}`);
    }
  };

  const fe = msgs.filter((m) => m.bytes[0] === 0xfe).map((m) => m.timeMs);
  const feGaps = fe.slice(1).map((t, i) => t - fe[i]).sort((a, b) => a - b);
  const download = () => {
    const at = new Date().toISOString();
    const json = {
      source: `/sim?record, ${portName.current}, ${at}`,
      segments: [{ label: "record", startLine: null, messages: msgs.map((m) => ({ ...m, line: null })) }],
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json) + "\n"], { type: "application/json" }));
    a.download = `piano-record-${at.replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "100vh", boxSizing: "border-box" }}>
      <h1 style={{ margin: 0 }}>Record a fixture</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>
        With the real piano in Chrome: connect, leave the piano idle for 60 s, play Twinkle once, then download. Nothing is
        filtered.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn} onClick={connect}>
          Connect piano
        </button>
        <button style={btn} disabled={!msgs.length} onClick={download}>
          Download fixture ({msgs.length} messages)
        </button>
      </div>
      <p style={{ margin: 0 }}>{status}</p>
      <p data-testid="active-sensing" style={{ margin: 0 }}>
        Active Sensing (0xFE): {fe.length} received
        {feGaps.length > 0 && `, median interval ${feGaps[Math.floor(feGaps.length / 2)].toFixed(1)} ms`}
      </p>
      <div style={{ flex: 1, overflowY: "auto", fontFamily: "ui-monospace, monospace", fontSize: 12, background: "#111", borderRadius: 8, padding: 8 }}>
        <LogTable rows={rows} />
      </div>
    </main>
  );
}

const btn: React.CSSProperties = { padding: "8px 14px", borderRadius: 6, border: "none", background: "#5ef0c4", color: "#000", cursor: "pointer" };
const h2: React.CSSProperties = { margin: 0, fontSize: 16 };
