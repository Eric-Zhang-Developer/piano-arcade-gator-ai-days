"use client";
// The played title (spec: video-cards): each letter of Étude lands on its note of the cipher motif (motif.ts), the
// acute last with a burst of hit particles, then the tagline on the next downbeat. Notes go to the DGX when one is
// attached, else the laptop voice; the letters follow the same scheduled times, revealed on the frame their note
// sounds. The laptop voice can only start after a press (the browser's audio rule), so with no DGX the card stays
// black until the first key or click (decision video-cards-motif). Reduced motion: every part is there from the first
// frame and the motif still plays.
import { useEffect, useRef } from "react";
import { APP_NAME, clauses, TAGLINE } from ".";
import styles from "./cards.module.css";
import { hitParticles } from "../hit-particles/gl";
import { PIANO_NAME } from "../laptop-sound";
import { titleLetters, titleSettings, titleTimes } from "./motif";

declare global {
  interface Window {
    // the timing check (Validation c): when each note was scheduled and each letter first painted, on performance.now()
    __pianoArcadeCards?: { output: "dgx" | "laptop" | "none"; t0: number; notes: number[]; letters: number[] };
  }
}

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function TitleCard() {
  const card = useRef<HTMLElement>(null);
  const burst = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = card.current!;
    const times = titleTimes();
    const parts = [...root.querySelectorAll<HTMLElement>("[data-letter]")];
    const acute = root.querySelector<HTMLElement>("[data-acute]")!;
    const tagline = root.querySelector<HTMLElement>("[data-tagline]")!;
    let raf = 0;
    let gone = false;
    let started = false;
    const hook = (window.__pianoArcadeCards = { output: "none" as "dgx" | "laptop" | "none", t0: 0, notes: [] as number[], letters: [] as number[] });

    const start = (out: MIDIOutput | null) => {
      if (started || gone) return;
      started = true;
      const t0 = performance.now() + 60;
      hook.t0 = t0;
      for (const n of times.notes) {
        out?.send([0x90, n.pitch, titleSettings.velocity], t0 + n.atMs);
        out?.send([0x80, n.pitch, 0], t0 + n.atMs + titleSettings.noteMs);
        hook.notes.push(t0 + n.atMs);
      }
      if (reduced()) return root.setAttribute("data-still", ""); // every part shown at once; the motif plays on
      const particles = hitParticles();
      const ctx = burst.current?.getContext("2d") ?? null;
      let shown = 0;
      let burstAt = 0;
      let last = performance.now();
      const frame = (now: number) => {
        const t = now - t0;
        // a letter revealed on this frame is painted with it: its mark is this frame's time
        while (shown < parts.length && t >= times.notes[shown].atMs) {
          parts[shown].setAttribute("data-on", "");
          hook.letters[shown] = now;
          performance.mark(`video-cards:letter-${shown}`);
          shown++;
        }
        if (!burstAt && t >= times.accentMs) {
          acute.setAttribute("data-on", "");
          burstAt = now;
          const c = burst.current;
          const r = acute.getBoundingClientRect();
          if (c && particles) {
            [c.width, c.height] = [innerWidth, innerHeight];
            for (let i = 0; i < 3; i++) particles.hit(r.left, r.width, r.top + r.height / 2, "PERFECT", "#ffffff");
          }
        }
        if (t >= times.taglineMs) tagline.setAttribute("data-on", "");
        if (particles && ctx && burstAt) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          const f = { nowMs: t, lowPitch: 0, highPitch: 0, judgmentLineY: acute.getBoundingClientRect().bottom, keyX: () => ({ x: 0, width: 0 }), width: ctx.canvas.width, height: ctx.canvas.height };
          particles.draw(ctx, f, now - last);
        }
        last = now;
        if (now - (burstAt || now) < 3200) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    // The DGX if it's there; else the laptop voice after the first press; else silent, at once.
    (async () => {
      const access = navigator.requestMIDIAccess ? await navigator.requestMIDIAccess().catch(() => null) : null;
      const outs = access ? [...access.outputs.values()] : [];
      const dgx = outs.find((o) => o.id !== "laptop-sound" && o.name?.includes(PIANO_NAME)) ?? null;
      const laptop = outs.find((o) => o.id === "laptop-sound") ?? null;
      if (dgx) return ((hook.output = "dgx"), start(dgx));
      if (!laptop) return start(null);
      hook.output = "laptop";
      const go = () => setTimeout(() => start(laptop), 30); // after laptop-sound's own capture handler has made its audio
      window.addEventListener("pointerdown", go, { once: true });
      window.addEventListener("keydown", go, { once: true });
    })();
    return () => {
      gone = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  const letters = titleLetters();
  return (
    <main ref={card} className={styles.card} data-card="title">
      <h1 className={styles.title} aria-label={APP_NAME}>
        {letters.map((l, i) => (
          <span key={i} className={styles.letter} data-letter={i} aria-hidden>
            {i === 0 && (
              <span className={styles.acute} data-acute>
                ´
              </span>
            )}
            {l}
          </span>
        ))}
      </h1>
      <p className={styles.tagline} data-tagline>
        {clauses(TAGLINE).map((c) => (
          <span key={c} className={styles.clause}>
            {c}
          </span>
        ))}
      </p>
      <canvas ref={burst} className={styles.burst} aria-hidden />
    </main>
  );
}
