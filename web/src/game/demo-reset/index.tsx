"use client";
// Demo reset (spec: demo-reset): Shift+Esc anywhere, or 60 s with no input on a plain take's results, sends All Notes
// Off and pedal up to the piano and loads / fresh. localStorage and sessionStorage are kept (latency, records, capture mode).
import { useEffect } from "react";
import type { GamePlugin } from "../../contracts";
import { whenIdle } from "../cabinet/idle";
import { getReplayState } from "../piano-out";
import { silence } from "../x/composers-hands/rolls";

export const resetSettings = {
  idleSeconds: 60, // on a plain take's results; ?idle=<s> shortens it for a check
  repeatMs: 250, // All Notes Off and pedal up again this far ahead, after sends already queued (beat-track's)
  midiWaitMs: 500, // a MIDI permission prompt can't hold the reset
  skip: ["/cabinet", "/attract", "/operator", "/sheet"], // pages where the combo does nothing
};

// Shift+Esc, nothing else held, not a repeat. Chrome on Windows and Linux keeps Shift+Esc for its Task Manager.
export const isResetKey = (e: Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey" | "repeat">) =>
  e.key === "Escape" && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat;

export async function reset(): Promise<void> {
  try {
    const access = await Promise.race([
      navigator.requestMIDIAccess?.(),
      new Promise<undefined>((r) => setTimeout(r, resetSettings.midiWaitMs)),
    ]);
    // The pedal too (#1313): a bot demo leaves it down, and a reload can't reach the page that pressed it.
    for (const o of access?.outputs.values() ?? []) silence(o, performance.now(), resetSettings.repeatMs);
  } catch {
    // no MIDI, or access refused: nothing to silence
  }
  // A full load, not router.push: no game state, timer or MIDI listener survives, and pagehide handlers run.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/");
}

// A replay on the piano (piano-out) or on screen (replay-view) holds the idle wait; it starts again when that ends.
const replaying = () => getReplayState().playing || (typeof document !== "undefined" && !!document.querySelector('[data-testid="replay-overlay"]'));

export function demoReset(onIdle: () => void = () => void reset()): GamePlugin {
  let idleMs = resetSettings.idleSeconds * 1000;
  let plain = true; // not a cabinet take
  let disarm: (() => void) | null = null;
  const stop = () => {
    disarm?.();
    disarm = null;
  };
  const arm = () => {
    stop();
    let idle: (() => void) | null = null;
    const watch = () => {
      if (replaying()) {
        idle?.();
        idle = null;
      } else idle ??= whenIdle(idleMs, onIdle, ["wheel"]);
    };
    watch();
    const poll = setInterval(watch, 500);
    disarm = () => {
      clearInterval(poll);
      idle?.();
    };
  };
  return {
    id: "demo-reset",
    transformChart(c, params) {
      plain = !params.has("cabinet");
      const s = Number(params.get("idle"));
      idleMs = (s > 0 ? s : resetSettings.idleSeconds) * 1000;
      return c;
    },
    onEvent(e) {
      if (e.type === "songEnd" && plain) arm();
      if (e.type === "songStart" || e.type === "quit") stop();
    },
  };
}

// Mounted once in the root layout: Shift+Esc on every page but resetSettings.skip. Capture phase, so no page's own
// handler (replay-view, records) can swallow it.
export function DemoReset() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isResetKey(e) || resetSettings.skip.some((p) => window.location.pathname.startsWith(p))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      void reset();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  return null;
}
