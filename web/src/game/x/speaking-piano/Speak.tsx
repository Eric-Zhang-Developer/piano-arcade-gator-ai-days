"use client";
// /speak (spike: speaking-piano, #1153). The keyboard lies on its side down the canvas's left edge, so each of the 88
// rows of the voice's spectrogram sits beside the key it strikes. A playhead turns the voiceprint into the roll it
// became; the keys light as they sound; the words appear only once the piano has finished. Reduced motion: two still
// panels, voiceprint above and roll below, no morph. The mic's audio is analyzed in memory and dropped after playback.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, canvasFonts, MonoLabel } from "../../duo-tokens";
import { PIANO_NAME } from "../../laptop-sound";
import { bg, ink, inkDim, line, panel, primary, secondary } from "../../ui-tokens";
import { analysisDefaults, analyze, HIGH_KEY, LOW_KEY } from "./analysis";
import { micHold, type Take } from "./mic";
import { phraseMessages, play, playbackSettings, silenceOnPagehide, type Output, type Player, type PlayFrame } from "./playback";
import hello from "./presets/hello-judges.json";
import thanks from "./presets/thank-you.json";
import welcome from "./presets/welcome.json";
import s from "./speak.module.css";

export interface Phrase {
  label: string;
  text: string | null; // null for the mic: there's no subtitle to show
  fps: number;
  n: number;
  frameMs: number;
  frames: (PlayFrame & { fricative: boolean })[];
  bandsDb: number[][];
}

const preset = (label: string, t: typeof welcome): Phrase => ({
  label,
  text: t.text,
  fps: t.fps,
  n: t.n,
  frameMs: t.frameMs,
  frames: t.frames.map((f) => ({ tMs: f.tMs, fricative: f.fricative, strikes: f.strikes as [number, number][] })),
  bandsDb: t.bandsDb,
});
// Neutral labels: the listener hears the phrase before reading it.
const PRESETS = [preset("Phrase A", hello), preset("Phrase B", welcome), preset("Phrase C", thanks)];
const PICK = { fps: welcome.fps, n: welcome.n }; // the sweep's pick, which the presets were rendered at
const CAPS = { velCap: analysisDefaults.velCap, n: PICK.n };
const MIC_MS = 3000;
const KEYS = HIGH_KEY - LOW_KEY + 1;
// The kit sizes its buttons and labels in px; this page scales its type with the width (as /conduct), so they follow.
const SCALED = { fontSize: "0.85em", padding: "0.85em 1.2em" };
const LABEL = { fontSize: "max(12px, 0.7em)" }; // the kit's 12 px floor (speak-polish, #1202)
const MORPH_MS = 260; // a cell turns into its strike over this, just behind the playhead

type Phase = "idle" | "listening" | "playing" | "done";

async function pianoOutput(): Promise<(Output & { name?: string }) | null> {
  try {
    const access = await navigator.requestMIDIAccess();
    return ([...access.outputs.values()].find((o) => o.name?.includes(PIANO_NAME)) as unknown as Output & { name?: string }) ?? null;
  } catch {
    return null;
  }
}

// Up to MIC_MS of the mic, in memory. The stream and its context close as soon as the take ends.
async function openMic(): Promise<{ stop: () => Take }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  src.connect(proc);
  proc.connect(ctx.destination); // silent: the output buffer stays zero, but the node only runs while connected
  return {
    stop() {
      proc.disconnect();
      src.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      const rate = ctx.sampleRate;
      void ctx.close();
      const samples = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
      chunks.reduce((at, c) => (samples.set(c, at), at + c.length), 0);
      chunks.length = 0;
      return { samples: samples.subarray(0, Math.min(samples.length, Math.round((rate * MIC_MS) / 1000))), rate };
    },
  };
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// The canvas. elapsed: ms into the phrase (null before it plays; Infinity once it's done).
export function drawSpeak(ctx: CanvasRenderingContext2D, w: number, h: number, p: Phrase | null, elapsed: number | null, still: boolean) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const keyW = Math.round(w * 0.06);
  const pad = Math.round(h * 0.02);
  const lit = new Map<number, number>();
  const frameAt = p && elapsed !== null && Number.isFinite(elapsed) ? Math.floor(elapsed / p.frameMs) : -1;
  if (p && frameAt >= 0 && frameAt < p.frames.length) for (const [k, v] of p.frames[frameAt].strikes) lit.set(k, v);

  const panels = still ? [{ y: pad, h: (h - 3 * pad) / 2, mode: "print" as const }, { y: 2 * pad + (h - 3 * pad) / 2, h: (h - 3 * pad) / 2, mode: "roll" as const }] : [{ y: pad, h: h - 2 * pad, mode: "morph" as const }];
  for (const pn of panels) {
    const rowH = pn.h / KEYS;
    const rowY = (key: number) => pn.y + (HIGH_KEY - key) * rowH; // high keys at the top
    // The keyboard on its side: white keys ivory-dim, black keys dark, each lit in the primary blue while it sounds.
    for (let key = LOW_KEY; key <= HIGH_KEY; key++) {
      const black = [1, 3, 6, 8, 10].includes(key % 12);
      const v = lit.get(key);
      ctx.fillStyle = v ? primary : black ? "#151a24" : "#c9ccd3";
      ctx.globalAlpha = v ? 0.35 + (0.65 * v) / 127 : black ? 1 : 0.85;
      ctx.fillRect(0, rowY(key), black ? keyW * 0.62 : keyW, Math.max(1, rowH - 0.5));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = line;
    ctx.fillRect(keyW + 1, pn.y, 1, pn.h);
    // The pitch axis: each C named beside its key, so an empty band reads as where the voice never goes.
    ctx.font = canvasFonts.data(Math.max(12, Math.round(h * 0.022)));
    ctx.textBaseline = "middle";
    ctx.fillStyle = inkDim;
    for (let key = 24; key <= HIGH_KEY; key += 12) ctx.fillText(`C${key / 12 - 1}`, keyW + 5, rowY(key) + rowH / 2);
    if (!p) continue;

    const x0 = keyW + Math.round(w * 0.04);
    const span = w - x0 - pad;
    const total = p.frames.length * p.frameMs;
    const xAt = (t: number) => x0 + (t / total) * span;
    const peak = Math.max(...p.bandsDb.flat());
    const floor = peak - analysisDefaults.floorDb;
    const head = elapsed === null ? -Infinity : Math.min(elapsed, total);
    p.frames.forEach((f, i) => {
      const xa = xAt(f.tMs);
      const fw = Math.max(1, xAt(f.tMs + p.frameMs) - xa - 1);
      // 0: still the voiceprint; 1: turned into strikes. In the morph it follows the playhead; still panels are fixed.
      const k = pn.mode === "print" ? 0 : pn.mode === "roll" ? 1 : Math.max(0, Math.min(1, (head - f.tMs - p.frameMs) / MORPH_MS + 1));
      if (k < 1) {
        const row = p.bandsDb[i];
        for (let j = 0; j < KEYS; j++) {
          const a = (row[j] - floor) / analysisDefaults.floorDb;
          if (a <= 0) continue;
          ctx.globalAlpha = Math.min(1, a) ** 1.6 * 0.9 * (1 - k);
          ctx.fillStyle = ink;
          ctx.fillRect(xa, rowY(LOW_KEY + j), fw + 1, Math.max(1, rowH));
        }
      }
      if (k > 0) {
        for (const [key, vel] of f.strikes) {
          const hiss = f.fricative && key >= 96;
          ctx.globalAlpha = (0.3 + (0.7 * vel) / 127) * k;
          ctx.fillStyle = hiss ? secondary : primary;
          const bh = Math.max(2, rowH * (0.7 + 0.3 * k));
          ctx.fillRect(xa, rowY(key) + (rowH - bh) / 2, fw * (0.4 + 0.6 * k), bh);
        }
      }
    });
    ctx.globalAlpha = 1;
    if (!still && Number.isFinite(head) && head < total) {
      ctx.fillStyle = ink;
      ctx.fillRect(Math.round(xAt(head)), pn.y, 2, pn.h);
    }
  }
}

// The stand's note (#1203): the two errors as alerts, a hint as a polite status. The status line is always mounted, so
// a screen reader hears it change.
export interface Note {
  text: string;
  alert: boolean;
}
export function NoteLines({ note }: { note: Note | null }) {
  return (
    <>
      {note?.alert && (
        <p className={s.note} role="alert">
          {note.text}
        </p>
      )}
      <p className={s.note} role="status">
        {note && !note.alert ? note.text : ""}
      </p>
    </>
  );
}

export function Speak() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phrase, setPhrase] = useState<Phrase | null>(PRESETS[0]); // its voiceprint at rest, not played
  const [phase, setPhase] = useState<Phase>("idle");
  const [outName, setOutName] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const startAt = useRef<number | null>(null);
  const player = useRef<Player | null>(null);
  const hold = useRef<ReturnType<typeof micHold> | null>(null);
  const alive = useRef(true);
  const phaseRef = useRef<Phase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stop = useCallback(() => {
    player.current?.stop();
    player.current = null;
  }, []);

  useEffect(() => silenceOnPagehide(window, stop), [stop]);

  // The draw loop: the playhead and the lit keys move with the clock; idle frames redraw too, so a resize lands.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = canvas.current;
      if (c) {
        const r = c.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) {
          c.width = Math.round(r.width * dpr);
          c.height = Math.round(r.height * dpr);
        }
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const ph = phaseRef.current;
          const elapsed = ph === "done" ? Infinity : ph === "playing" && startAt.current !== null ? performance.now() - startAt.current : null;
          drawSpeak(ctx, r.width, r.height, phrase, elapsed, reducedMotion());
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phrase]);

  const speak = useCallback(
    async (p: Phrase) => {
      stop();
      setPhrase(p);
      const out = await pianoOutput();
      if (!alive.current) return;
      setOutName(out ? (out.name ?? PIANO_NAME) : null);
      if (!out) {
        setNote({ text: "No piano output: plug in the DGX, or open this page with laptop sound on.", alert: true });
        setPhase("done");
        return;
      }
      setNote(null);
      const at = performance.now() + playbackSettings.leadMs;
      startAt.current = at;
      setPhase("playing");
      const pl = play(out, phraseMessages(p.frames, p.frameMs, at, CAPS));
      player.current = pl;
      await pl.done;
      if (player.current === pl) player.current = null;
      setPhase("done");
    },
    [stop],
  );

  // Hold to speak: the mic opens on the first press (the browser asks then), and the take ends on release or at 3 s.
  const onTake = useCallback(
    (raw: Take) => {
      let take: Take | null = raw;
      if (take.samples.length < take.rate * 0.2) {
        setPhase("idle");
        setNote({ text: "Hold Speak a little longer, then let go.", alert: false });
        return;
      }
      const a = analyze(take.samples, take.rate, { ...analysisDefaults, fps: PICK.fps, n: PICK.n });
      take = null; // the audio goes now: only the strikes and the spectrogram's numbers are kept
      void speak({
        label: "Your voice",
        text: null,
        fps: PICK.fps,
        n: PICK.n,
        frameMs: a.frameMs,
        frames: a.frames.map((f) => ({ tMs: f.tMs, fricative: f.fricative, strikes: f.strikes.map((x) => [x.key, x.vel] as [number, number]) })),
        bandsDb: a.bandsDb,
      });
    },
    [speak],
  );

  // Leaving: stop the player, let go of the mic (timer, tracks, context), and play nothing that was pending (#1201).
  useEffect(() => {
    const h = micHold(openMic, MIC_MS, onTake);
    hold.current = h;
    alive.current = true;
    return () => {
      alive.current = false;
      stop();
      h.dispose();
    };
  }, [stop, onTake]);

  const micDown = async () => {
    if (!hold.current || hold.current.open || phaseRef.current === "listening") return;
    stop();
    try {
      setPhase("listening");
      setPhrase(null);
      await hold.current.down();
    } catch {
      if (!alive.current) return;
      setPhase("idle");
      setNote({ text: "The mic isn't available here. The presets still play.", alert: true });
    }
  };
  const micUp = () => hold.current?.up();

  const busy = phase === "playing" || phase === "listening";
  return (
    <main className={s.page} data-testid="speak">
      <header className={s.head}>
        <h1 className={s.title}>The Speaking Piano</h1>
        <p className={s.sub}>A voice, struck on 88 keys. After Peter Ablinger&apos;s speaking piano.</p>
        <Link className={s.back} href="/lab">
          Back to the Lab
        </Link>
      </header>
      <div className={s.stage}>
        <div className={s.roll}>
          <canvas ref={canvas} className={s.canvas} aria-label="The phrase's spectrogram beside the keyboard, turning into the keys it strikes" />
          <p className={s.subtitle} data-testid="speak-subtitle" aria-live="polite">
            {phase === "done" && phrase ? (phrase.text ? <>&ldquo;{phrase.text}&rdquo;</> : <span className={s.dim}>Your voice, as the piano heard it.</span>) : <span className={s.dim}>{phase === "playing" ? "Listen." : phase === "listening" ? "Speaking…" : "The words appear after the piano speaks."}</span>}
          </p>
        </div>
        <aside className={s.stand}>
          <MonoLabel style={LABEL}>Presets</MonoLabel>
          <div className={s.presets}>
            {PRESETS.map((p) => (
              <Button key={p.label} kind={phrase?.label === p.label ? "primary" : "secondary"} style={SCALED} disabled={busy} onClick={() => void speak(p)} data-testid="speak-preset">
                {p.label}
              </Button>
            ))}
          </div>
          <MonoLabel style={LABEL}>Your voice, up to 3 s</MonoLabel>
          <button
            type="button"
            className={s.mic}
            data-live={phase === "listening" || undefined}
            disabled={phase === "playing"}
            onPointerDown={() => void micDown()}
            onPointerUp={micUp}
            onPointerLeave={micUp}
            onKeyDown={(e) => (e.key === " " || e.key === "Enter") && !e.repeat && void micDown()}
            onKeyUp={(e) => (e.key === " " || e.key === "Enter") && micUp()}
          >
            {phase === "listening" ? "Listening" : "Hold to speak"}
          </button>
          <Button kind="secondary" style={SCALED} onClick={() => (stop(), setPhase(phrase ? "done" : "idle"))} disabled={phase !== "playing"}>
            Stop
          </Button>
          <dl className={s.caps}>
            {[
              ["Velocity cap", CAPS.velCap],
              ["Keys a frame", CAPS.n],
              ["Frames a second", PICK.fps],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <MonoLabel style={{ ...LABEL, color: outName ? undefined : inkDim }}>{outName ? `Out: ${outName}` : "Out: the piano, when you press"}</MonoLabel>
          <NoteLines note={note} />
          <p className={s.small} style={{ background: panel }}>
            The mic&apos;s sound stays in this tab: analyzed in memory, dropped after it plays, never stored or sent.
          </p>
        </aside>
      </div>
    </main>
  );
}
