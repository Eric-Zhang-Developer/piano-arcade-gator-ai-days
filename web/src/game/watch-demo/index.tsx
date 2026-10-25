// Watch demo (spec: watch-demo): /play?...&demo=1, opened by W on the select, plays the song with scenes' perfect bot,
// labeled DEMO, and goes back to / eight seconds after the results. Without demo=1 it does nothing.
import { useEffect, useRef } from "react";
import type { Frame, GamePlugin } from "../../contracts";
import { canvasFonts, kitSettings } from "../duo-tokens";
import { hudLayout, hudSettings } from "../hud";
import { bg, cyan } from "../ui-tokens";
import { pickOutput, toneVoice, type Voice } from "../../replay/piano";
import { returnAt, watchSettings } from "./demo";
import styles from "./watch-demo.module.css";

export { isWatchKey, watchSettings, watchUrl, returnAt } from "./demo";

declare global {
  interface Window {
    __pianoArcadeDemo?: { on: boolean; returnAt: number | null }; // read by verify-watch.mjs
  }
}

// A full load of /, so no ghost or MIDI state outlives the demo; router.push would keep this page's client state.
// eslint-disable-next-line @next/next/no-location-assign-relative-destination
const goHome = () => location.assign("/");

// cabinet's AutoStart, copied (3 lines, not exported there): Start clicks itself once the start screen mounts.
function AutoStart() {
  useEffect(() => {
    document.querySelector<HTMLButtonElement>("main button")?.click();
  }, []);
  return null;
}

// The results panel: a line and one button, focused after mount so Enter goes back at once.
function Back() {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className={styles.back} data-testid="demo-back">
      <p className={styles.line}>
        <span className={styles.tag}>DEMO</span> · back to songs in {watchSettings.returnMs / 1000} s
      </p>
      <button ref={ref} type="button" className={styles.button} onClick={goHome}>
        Back to songs
      </button>
    </div>
  );
}

// wait-hud's LEARN badge, saying DEMO, right-aligned in the HUD band's song-card slot so it covers no counter, score or
// multiplier. The card's text runs the slot's full width, so the badge sits on the composer row only, on the band's own
// fill: it hides that line's tail cleanly, and the title stays whole.
function drawBadge(ctx: CanvasRenderingContext2D, f: Frame) {
  const { panel, slots } = hudLayout(f.width, f.judgmentLineY);
  const h = panel.h;
  const size = Math.round(h * 0.24);
  ctx.font = canvasFonts.display(size); // Duo: upright, the kit's face
  const w = ctx.measureText("DEMO").width + size * 0.8;
  const bh = size * 1.25;
  const right = slots.card.x1 - Math.max(10, h * 0.25) * 0.5;
  const y = h * 0.7; // the composer row (hud: the title at 0.36 h, then 0.34 h down)
  ctx.beginPath();
  ctx.rect(right - w, y - bh / 2, w, bh); // Duo: square, framed in a hairline
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = hudSettings.panelBg;
  ctx.fill();
  ctx.strokeStyle = cyan;
  ctx.lineWidth = kitSettings.hairline;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = cyan;
  ctx.fillText("DEMO", right - w / 2, y + size * 0.04);
}

export function watchDemo(): GamePlugin {
  let on = false;
  let at: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let voice: Voice | null = null; // laptop tones when there's no piano; null while the piano plays scenes' notes
  let audio: AudioContext | null = null;
  let noteMs = new Map<string, number>();
  const publish = () => {
    if (on && typeof window !== "undefined") window.__pianoArcadeDemo = { on, returnAt: at };
  };
  const arm = (next: number | null) => {
    clearTimeout(timer);
    at = next;
    if (at !== null) timer = setTimeout(goHome, at - performance.now());
    publish();
  };
  if (typeof window !== "undefined") window.addEventListener("pagehide", () => arm(null));

  return {
    id: "watch-demo",
    transformChart(chart, params) {
      on = params.get("demo") === "1";
      const mpb = 60000 / chart.bpm;
      noteMs = new Map(chart.notes.map((n) => [n.id, n.duration * mpb]));
      publish();
      return chart;
    },
    // Nothing plays but the bot: a piano echo or a bumped key can't spoil the demo.
    wrapInput(device) {
      if (!on || device.kind !== "midi") return device;
      return { kind: device.kind, start() {}, stop() {} };
    },
    onEvent(e) {
      if (!on) return;
      if (e.type === "songStart") {
        voice?.stop();
        voice = null;
        // scenes' audible=1 plays the piano when there is one; without it, laptop tones, so the demo isn't silent.
        const ask = navigator.requestMIDIAccess?.();
        if (!ask) startTones();
        else
          void ask.then(
            (access) => void (pickOutput(access) ?? startTones()),
            () => startTones(),
          );
      }
      if (e.type === "noteHit") voice?.note(e.pitch, noteMs.get(e.noteId) ?? 300);
      if (e.type === "pause" || e.type === "quit" || e.type === "songEnd") voice?.stop();
      arm(returnAt(at, e, performance.now()));
    },
    draw(ctx, f) {
      if (on) drawBadge(ctx, f);
    },
    startPanel: () => (on ? <AutoStart /> : null),
    resultsPanel: () => (on ? <Back /> : null),
  };

  function startTones() {
    try {
      audio ??= new AudioContext(); // after Start's click (AutoStart's counts), so it may play
      void audio.resume().catch(() => {});
      voice = toneVoice(audio);
    } catch {
      voice = null;
    }
  }
}
