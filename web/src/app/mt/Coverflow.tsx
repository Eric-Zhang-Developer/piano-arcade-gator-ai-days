"use client";
// The coverflow (spec: menu-test): one SongJacket per song on a ring, the centred one flat, the rest tilted and
// receding. Drag, the arrows or the chevrons move it; Enter or a click on the centred card plays. Positions live in a
// ref and are painted straight to the DOM in requestAnimationFrame; React re-renders only when the centred song changes.
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useBestGrades } from "@/game/records/best";
import { goToStage } from "@/game/select-layout/go-to-stage";
import { SongJacket } from "@/game/song-jacket/SongJacket";
import type { Song } from "@/game/song-select/load";
import { cardPose, centreIndex, coverflowSettings as S, easeOut, flickTarget, foldOffset } from "./motion";
import styles from "./coverflow.module.css";

// In card widths (--card), so the server HTML is already in place before any measuring.
function poseStyle(offset: number, n: number): CSSProperties {
  const p = cardPose(offset, n, 1);
  return {
    transform: `translate(-50%, -50%) translateX(calc(${p.x} * var(--card))) translateZ(calc(${p.z} * var(--card))) rotateY(${p.tilt}deg)`,
    opacity: p.opacity,
    zIndex: p.layer,
    visibility: p.opacity > 0 ? "visible" : "hidden",
  };
}

type Drag = { id: number; x: number; pos: number; lastX: number; lastT: number; v: number; px: number; captured: boolean };

function Chevron({ left }: { left?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path d={left ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Coverflow({ songs }: { songs: Song[] }) {
  const n = songs.length;
  const router = useRouter();
  const best = useBestGrades();
  const [centre, setCentre] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const m = useRef({ pos: 0, from: 0, to: 0, start: 0, settling: false, raf: 0, centre: 0, moved: false, drag: null as Drag | null });

  const paint = () => {
    const s = m.current;
    cards.current.forEach((el, i) => el && Object.assign(el.style, poseStyle(foldOffset(i, s.pos, n), n)));
    const c = centreIndex(s.pos, n);
    if (c !== s.centre) setCentre((s.centre = c));
  };

  const tick = (now: number) => {
    const s = m.current;
    s.raf = 0;
    if (s.settling) {
      if (s.start < 0) s.start = now; // the settle's clock starts on its first frame
      const t = Math.min(1, (now - s.start) / S.settleMs);
      s.pos = s.from + (s.to - s.from) * easeOut(t);
      if (t >= 1) s.settling = false;
    }
    paint();
    if (s.settling) s.raf = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (!m.current.raf) m.current.raf = requestAnimationFrame(tick);
  };

  const moveTo = (target: number) => {
    const s = m.current;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      s.settling = false;
      s.pos = s.to = target;
    } else Object.assign(s, { from: s.pos, to: target, start: -1, settling: true });
    kick();
  };
  // Steps count from where the ring is heading, so quick presses don't lose cards.
  const step = (d: number) => moveTo((m.current.settling ? m.current.to : Math.round(m.current.pos)) + d);
  const play = (i: number) => goToStage(`/play?song=${songs[i].id}`, router);

  useLayoutEffect(() => {
    frame.current?.focus({ preventScroll: true });
    const s = m.current;
    return () => cancelAnimationFrame(s.raf);
  }, []);
  useEffect(() => router.prefetch(`/play?song=${songs[centre].id}`), [router, songs, centre]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      step(e.key === "ArrowRight" ? 1 : -1);
    } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      play(centreIndex(m.current.settling ? m.current.to : m.current.pos, n));
    }
  };

  // A press only captures the pointer once it moves, so a plain tap stays a click on its card.
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const s = m.current;
    s.settling = false;
    s.moved = false;
    const px = (cards.current[0]?.offsetWidth ?? 200) * (1 + S.gap);
    s.drag = { id: e.pointerId, x: e.clientX, pos: s.pos, lastX: e.clientX, lastT: e.timeStamp, v: 0, px, captured: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const s = m.current;
    const d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.captured) {
      if (Math.abs(dx) < 6) return;
      d.captured = s.moved = true;
      frame.current?.setPointerCapture(e.pointerId);
    }
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = 0.7 * (-(e.clientX - d.lastX) / d.px / (dt / 1000)) + 0.3 * d.v;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    s.pos = d.pos - dx / d.px;
    kick();
  };
  const onPointerUp = (e: PointerEvent) => {
    const s = m.current;
    const d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    s.drag = null;
    if (d.captured) moveTo(flickTarget(s.pos, e.timeStamp - d.lastT > 80 ? 0 : d.v));
    else if (!s.settling && s.pos !== Math.round(s.pos)) moveTo(Math.round(s.pos)); // a tap that stopped a settle
  };

  const onCardClick = (i: number) => {
    const s = m.current;
    if (s.moved) return;
    const o = foldOffset(i, s.settling ? s.to : s.pos, n);
    if (Math.abs(o) < 0.5) play(i);
    else moveTo(Math.round((s.settling ? s.to : s.pos) + o));
  };

  const song = songs[centre];
  const grade = best[song.id];
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Music select</h1>
      <section className={styles.carousel} aria-roledescription="carousel" aria-label="Songs" onKeyDown={onKeyDown}>
        <div
          ref={frame}
          className={styles.frame}
          tabIndex={0}
          aria-label="Songs: left and right arrows to browse, Enter to play"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className={styles.stage}>
            {songs.map((s, i) => (
              <div
                key={s.id}
                ref={(el) => {
                  cards.current[i] = el;
                }}
                className={styles.card}
                style={poseStyle(foldOffset(i, 0, n), n)}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${n}`}
                aria-current={i === centre || undefined}
                data-song={s.id}
                onClick={() => onCardClick(i)}
              >
                <div className={styles.jacket} style={i === centre ? { viewTransitionName: "stage-jacket" } : undefined}>
                  <SongJacket id={s.id} title={s.title} composer={s.composer} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <button type="button" className={`${styles.nav} ${styles.prev}`} aria-label="Previous song" onClick={() => step(-1)}>
          <Chevron left />
        </button>
        <button type="button" className={`${styles.nav} ${styles.next}`} aria-label="Next song" onClick={() => step(1)}>
          <Chevron />
        </button>
      </section>
      <div className={styles.caption} aria-live="polite" data-testid="mt-caption">
        <h2 className={styles.title}>{song.title}</h2>
        <p className={styles.composer}>
          {song.composer}
          {song.catalog ? <span className={styles.catalog}> · {song.catalog}</span> : null}
        </p>
        <dl className={styles.stats}>
          <div>
            <dt>Notes</dt>
            <dd>{song.noteCount}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{song.level}</dd>
          </div>
          <div data-testid="mt-best">
            <dt>Best</dt>
            <dd>{grade ? `${grade.rank} · ${(grade.accuracy * 100).toFixed(1)}%` : ""}</dd>
          </div>
        </dl>
        <p className={styles.hint}>
          {centre + 1} / {n} · Enter to play
        </p>
      </div>
    </main>
  );
}
