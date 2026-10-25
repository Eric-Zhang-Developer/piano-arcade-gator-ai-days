"use client";
// /paint (spike: wet-paint): free play. Every note blooms as paint from its key; the pedal keeps it wet, its lift dries
// it. After a minute, or on Frame it, the canvas hangs in a mat with a gallery caption. The solver is vendored
// (vendor/fluid.js); the rules are paint.ts; the colors colors.ts.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { InputEvent } from "../../../contracts";
import { keysDevice, midiDevice } from "../../core/input";
import { Button, canvasFonts, MonoLabel } from "../../duo-tokens";
import { canMove, laptopMap } from "../../laptop-octaves";
import { laptopKey, PIANO_NAME } from "../../laptop-sound";
import { rgb7 } from "../../leds/messages";
import { connect, linkState, send, subscribe, type LinkState } from "../../leds/serial";
import { hexOf, rgbOf } from "./colors";
import { caption, clock, focusAfter, frameAnnouncement, FramedPainting, Live, stripLights, type Framed } from "./framing";
import { createPainter, keyboard, pedalSettings, ranges, spaceIsPedal, xOfPitch, type Painter } from "./paint";
import styles from "./wet-paint.module.css";
import { createFluid, type Fluid } from "./vendor/fluid";

export const paintSettings = {
  frameAfterMs: 60_000, // a minute of play becomes a painting
  simShare: 0.25, // the solver's grid: a quarter of the canvas's backing height (?sim=<px> overrides)
  dyeShare: 0.5, // the paint itself: half, so edges stay soft but not blocky
  laptopLowest: 60, // laptop keys start at C4; Z / X move them an octave within ranges.laptop
};

export interface PaintEvent {
  t: number; // ms from play()'s call
  type: "on" | "off" | "cc";
  pitch?: number;
  velocity?: number;
  value?: number; // CC64
}



const onLights = (l: () => void) => {
  const off = subscribe(l);
  return () => void off();
};


export function WetPaint() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painterRef = useRef<Painter | null>(null);
  const fluidRef = useRef<Fluid | null>(null);
  const startRef = useRef<number | null>(null); // the first note, performance.now()
  const frozenRef = useRef(false);
  const shiftRef = useRef(0); // laptop octaves
  const [range, setRange] = useState(ranges.laptop);
  const rangeRef = useRef(range);
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set());
  const [cc, setCc] = useState(0);
  const [notes, setNotes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("Looking for a piano");
  const [noGl] = useState(() => !document.createElement("canvas").getContext("webgl2")); // client-only page
  const [framed, setFramed] = useState<Framed | null>(null);
  const [said, setSaid] = useState(""); // the polite status region's line
  const [strip] = useState(() => stripLights(send));
  const mainRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasFramed = useRef(false);
  const footRef = useRef(0); // the last CC64 in, framed or not
  const spaceRef = useRef(false); // Space is holding the pedal
  const lights = useSyncExternalStore<LinkState>(onLights, linkState, () => "off");

  const frameIt = useCallback(() => {
    const fluid = fluidRef.current;
    const painter = painterRef.current;
    if (!fluid || !painter || frozenRef.current) return;
    frozenRef.current = true;
    fluid.render(); // drawn and read in one task: the drawing buffer isn't preserved
    const url = canvasRef.current!.toDataURL("image/png");
    const f = { url, ms: startRef.current === null ? 0 : performance.now() - startRef.current, notes: painter.notes };
    strip.frame(); // play() ignores the key-offs from here on, so the lit keys go out now
    setHeld(new Set());
    setFramed(f);
    setSaid(frameAnnouncement(f));
  }, [strip]);

  const again = useCallback(() => {
    painterRef.current?.again(footRef.current);
    setCc(footRef.current);
    startRef.current = null;
    frozenRef.current = false;
    strip.clear();
    setFramed(null);
    setSaid("");
    setNotes(0);
    setElapsed(0);
    setHeld(new Set());
  }, [strip]);

  // One event in, from any source: the painter, the held keys, the lights.
  const play = useCallback((e: { type: "on" | "off"; pitch: number; velocity: number } | { type: "cc"; value: number }) => {
    const painter = painterRef.current;
    if (e.type === "cc") footRef.current = e.value; // kept while framed too: Again takes it up (#1327)
    if (!painter || frozenRef.current) return;
    if (e.type === "cc") {
      painter.pedal(e.value);
      setCc(e.value);
      return;
    }
    if (e.type === "on") {
      startRef.current ??= performance.now();
      painter.noteOn(e.pitch, e.velocity);
      strip.on(e.pitch, rgb7(hexOf(e.pitch)));
    } else {
      painter.noteOff(e.pitch);
      strip.off(e.pitch);
    }
    setHeld(painter.held);
    setNotes(painter.notes);
  }, [strip]);

  // Leaving the page, or closing it, puts the strip out: connect() registers no pagehide CLEAR of its own.
  useEffect(() => {
    const leave = () => strip.clear();
    addEventListener("pagehide", leave);
    return () => {
      removeEventListener("pagehide", leave);
      leave();
    };
  }, [strip]);

  // Framed: Save PNG takes focus. Again: the page gets it back.
  useEffect(() => {
    const to = focusAfter(wasFramed.current, !!framed);
    wasFramed.current = !!framed;
    if (to === "save") dialogRef.current?.querySelector<HTMLButtonElement>('[data-testid="save-png"]')?.focus();
    if (to === "page") mainRef.current?.focus({ preventScroll: true });
  }, [framed]);

  // The solver and its loop.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const q = new URLSearchParams(location.search);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let fluid: Fluid;
    try {
      fluid = createFluid(canvas, { SHADING: true, BACK_COLOR: { r: 8, g: 9, b: 13 } });
    } catch {
      return; // no WebGL2: noGl says so
    }
    const size = () => {
      const h = canvas.height;
      const sim = Number(q.get("sim"));
      fluid.config.SIM_RESOLUTION = Number.isFinite(sim) && sim >= 32 ? sim : Math.round(h * paintSettings.simShare);
      fluid.config.DYE_RESOLUTION = Math.round(h * paintSettings.dyeShare);
      fluid.reinit();
    };
    size();
    fluidRef.current = fluid;
    const painter = createPainter(
      {
        splat: (s) => fluid.splat(s.x, s.y, s.dx, s.dy, s.color, s.radius),
        step: (dt) => fluid.step(dt),
        params: (p) => {
          fluid.config.DENSITY_DISSIPATION = p.densityDissipation;
          fluid.config.VELOCITY_DISSIPATION = still ? 1000 : p.velocityDissipation; // reduced motion: no flow
          fluid.config.CURL = still ? 0 : p.curl;
        },
        fix: () => fluid.fix(),
        clear: () => fluid.clear(),
      },
      { xOf: (p) => xOfPitch(p, rangeRef.current.lo, rangeRef.current.hi), colorOf: rgbOf, still },
    );
    painterRef.current = painter;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 1 / 60);
      last = now;
      if (frozenRef.current) return;
      if (fluid.resize()) size();
      painter.frame(dt);
      fluid.render();
      if (startRef.current !== null) {
        const ms = now - startRef.current;
        if (ms >= paintSettings.frameAfterMs) frameIt();
      }
    };
    raf = requestAnimationFrame(loop);
    const tick = setInterval(() => startRef.current !== null && !frozenRef.current && setElapsed(performance.now() - startRef.current), 250);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(tick);
      fluidRef.current = null;
      painterRef.current = null;
    };
  }, [frameIt]);

  // The piano: core's MIDI device for notes, and the same input's CC64 read here (core passes notes only).
  useEffect(() => {
    const onNote = (e: InputEvent) => play({ type: e.type, pitch: e.pitch, velocity: e.velocity });
    const midi = midiDevice(setStatus);
    void midi.start(onNote);
    let input: MIDIInput | null = null;
    const onCc = (m: MIDIMessageEvent) => {
      const d = m.data;
      if (d && (d[0] & 0xf0) === 0xb0 && d[1] === 64) play({ type: "cc", value: d[2] });
    };
    navigator.requestMIDIAccess?.().then(
      (a) => {
        const inputs = [...a.inputs.values()];
        input = inputs.find((i) => i.name?.includes(PIANO_NAME)) ?? inputs[0] ?? null;
        input?.addEventListener("midimessage", onCc as EventListener);
        if (input) {
          rangeRef.current = ranges.piano;
          setRange(ranges.piano);
        }
      },
      () => {},
    );
    return () => {
      midi.stop();
      input?.removeEventListener("midimessage", onCc as EventListener);
    };
  }, [play]);

  // Laptop keys through laptop-octaves' map (Z / X an octave), the laptop piano's voice, and Space as the pedal.
  useEffect(() => {
    const map = laptopMap(paintSettings.laptopLowest);
    const keys = keysDevice(paintSettings.laptopLowest);
    void keys.start((e) => {
      const pitch = e.pitch + 12 * shiftRef.current;
      laptopKey(e.type, pitch, e.velocity);
      play({ type: e.type, pitch, velocity: e.velocity });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const down = e.type === "keydown";
      if (e.code === "Space") {
        const pedal = spaceIsPedal(e.target, frozenRef.current);
        if (pedal) e.preventDefault();
        // A press that began as the pedal still lets it up, wherever focus went (a release can't stick it down).
        if (down ? !pedal : !spaceRef.current) return;
        spaceRef.current = down;
        play({ type: "cc", value: down ? 127 : 0 });
      } else if (down && (e.code === "KeyZ" || e.code === "KeyX")) {
        const d = e.code === "KeyZ" ? -1 : 1;
        if (canMove(map, shiftRef.current, d, ranges.laptop)) shiftRef.current += d;
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      keys.stop();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [play]);

  // For the checks: scripted notes and CC64 with times, and what the page holds.
  useEffect(() => {
    const hook = {
      get notes() {
        return painterRef.current?.notes ?? 0;
      },
      get pedal() {
        return painterRef.current?.cc ?? 0;
      },
      get dried() {
        return painterRef.current?.fixes ?? 0;
      },
      get simSize() {
        return fluidRef.current?.simSize() ?? null;
      },
      play(events: PaintEvent[]): Promise<void> {
        const timers = events.map((e) =>
          setTimeout(() => (e.type === "cc" ? play({ type: "cc", value: e.value ?? 0 }) : play({ type: e.type, pitch: e.pitch ?? 60, velocity: e.velocity ?? 80 })), e.t),
        );
        const end = Math.max(0, ...events.map((e) => e.t));
        return new Promise((r) => setTimeout(() => r(void timers), end + 50));
      },
      frame: frameIt,
      again,
    };
    (window as unknown as { __wetPaint?: unknown }).__wetPaint = hook;
    return () => {
      delete (window as unknown as { __wetPaint?: unknown }).__wetPaint;
    };
  }, [play, frameIt, again]);

  const save = useCallback(() => {
    if (framed) void savePng(framed).catch(() => {});
  }, [framed]);

  const wet = cc >= pedalSettings.downAt;
  const keys = keyboard(range.lo, range.hi);

  return (
    <main ref={mainRef} tabIndex={-1} className={styles.page} data-testid="wet-paint">
      <canvas ref={canvasRef} className={styles.canvas} data-testid="paint-canvas" aria-label="The painting, made by what you play" />
      {noGl && <p className={styles.noGl}>This browser has no WebGL, so there&apos;s nothing to paint on. Chrome has it.</p>}

      {/* While framed, the dialog is modal (aria-modal): what's behind it takes no focus or clicks. */}
      <header className={styles.rail} inert={!!framed}>
        <h1 className={styles.mark}>Wet paint</h1>
        <dl className={styles.data}>
          <div>
            <dt>Pedal</dt>
            <dd data-testid="pedal" data-wet={wet || undefined}>
              <span className={styles.meter} aria-hidden>
                <span style={{ transform: `scaleX(${cc / 127})` }} />
              </span>
              {wet ? "Wet" : "Dry"}
            </dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd data-testid="notes">{notes}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>
              {clock(elapsed)} <span className={styles.of}>/ {clock(paintSettings.frameAfterMs)}</span>
            </dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Button onClick={frameIt} disabled={!notes || !!framed} data-testid="frame-it">
            Frame it
          </Button>
          {lights !== "unsupported" && (
            <Button kind="secondary" onClick={() => void connect()} disabled={lights === "ready" || lights === "opening"} data-testid="connect-lights">
              {lights === "ready" ? "Lights on" : "Connect lights"}
            </Button>
          )}
        </div>
      </header>

      <p className={styles.status} inert={!!framed}>
        <span role="status" aria-live="polite">
          <MonoLabel style={{ fontSize: "inherit" }}>{status}</MonoLabel>
        </span>
        <span className={styles.hint}>Pedal or Space keeps it wet. Let go and it dries.</span>
      </p>

      <div className={styles.keys} aria-hidden data-testid="paint-keys">
        {keys.map((k) => (
          <span
            key={k.pitch}
            className={k.black ? styles.black : styles.white}
            style={{ left: `${(k.x - k.w / 2) * 100}%`, width: `${k.w * 100}%`, ...(held.has(k.pitch) ? { background: hexOf(k.pitch) } : {}) }}
          />
        ))}
      </div>

      <Live text={said} />
      {framed && <FramedPainting framed={framed} onSave={save} onAgain={again} dialogRef={dialogRef} />}
    </main>
  );
}

// The framed painting as a PNG: the mat, the hairline, the picture and the caption, drawn at the picture's own size.
async function savePng(f: Framed) {
  const img = new Image();
  img.src = f.url;
  await img.decode();
  const mat = Math.round(img.height * 0.08);
  const foot = Math.round(img.height * 0.1);
  const c = document.createElement("canvas");
  c.width = img.width + mat * 2;
  c.height = img.height + mat * 2 + foot;
  const ctx = c.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  ctx.fillStyle = v("--pa-paper", "#f2ede3"); // the same paper mat the page hangs it in
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, mat, mat);
  ctx.strokeStyle = "rgba(22, 19, 15, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mat - 0.5, mat - 0.5, img.width + 1, img.height + 1);
  ctx.fillStyle = v("--pa-paper-ink", "#16130f");
  ctx.font = canvasFonts.data(Math.round(foot * 0.32));
  ctx.textBaseline = "middle";
  ctx.fillText(caption(f).toUpperCase(), mat, mat * 2 + img.height + foot * 0.25);
  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = `wet-paint-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
  a.click();
}
