"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { Chart } from "../../contracts";
import { validateChart } from "../../contracts";
import { hudSettings } from "../hud";
import { loadReview, reviewLine, type SheetReview } from "../sheet-review/review";
import { chartToMusicXml } from "../sheet-xml";
import { cyan, ink } from "../ui-tokens";
import { follow, type Follower } from "./follow";
import { SHEET_CHANNEL, type Judgment, type SheetMessage } from "./plugin";
import styles from "./sheet-view.module.css";

// The ids /play takes: a folder under web/public/songs/ (the same pattern as play/page.tsx).
const SONG_ID = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/i;
const ZOOM_KEY = "pianoArcade.sheetZoom";
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;
const JUDGMENTS: Judgment[] = ["PERFECT", "GREAT", "GOOD", "MISS"];
const COLORS = hudSettings.judgmentColors; // the HUD's, so a notehead means what the counter means

// For headless checks: where the cursor is, and how many noteheads are painted per judgment (not judgments heard).
interface SheetHook {
  review: boolean; // showing a stored take (sheet-review), not following /play
  cursorMs: number | null;
  colored: Record<Judgment, number>;
  beams: { should: number; beamed: number }; // sheet-beams: notes a score would beam, and how many OSMD did
  beamAudit: () => { judgments: (Judgment | null)[]; fill: string }[]; // each drawn beam, read when called
}
declare global {
  interface Window {
    __pianoArcadeSheet?: SheetHook;
  }
}

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));

// Unless the player chose one, the score grows with the window: 100% at 1280 wide, 150% on a 1920 monitor.
function loadZoom(): number {
  const fit = clampZoom(Math.max(1, window.innerWidth / 1280));
  try {
    const z = Number(localStorage.getItem(ZOOM_KEY));
    return z ? clampZoom(z) : fit;
  } catch {
    return fit;
  }
}

function saveZoom(z: number) {
  try {
    localStorage.setItem(ZOOM_KEY, String(z));
  } catch {
    // private window or blocked storage: the zoom just isn't remembered
  }
}

// `chart` is what the score shows (the take as played); `song` is the whole chart its key comes from (sheet-xml).
type State = { phase: "loading" } | { phase: "error"; error: string } | { phase: "ready"; chart: Chart; song: Chart };

// The whole song behind a transformed chart (one hand, a loop): transforms keep the id. A song that can't be loaded
// by its id (a local rip under another path) gives its key from the chart as played.
const songs = new Map<string, Chart>();
async function songFor(chart: Chart): Promise<Chart> {
  const known = songs.get(chart.id);
  if (known) return known;
  try {
    if (!SONG_ID.test(chart.id)) return chart;
    const r = await fetch(`/songs/${chart.id}/chart.json`);
    const raw: unknown = r.ok ? await r.json() : null;
    if (!raw || validateChart(raw).length) return chart;
    songs.set(chart.id, raw as Chart);
    return raw as Chart;
  } catch {
    return chart;
  }
}

export function SheetView() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [zoom, setZoom] = useState(1);
  const [rendered, setRendered] = useState(false);
  const scoreRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const shownRef = useRef<Chart | null>(null); // the chart the score shows
  const followerRef = useRef<Follower | null>(null);
  const judgedRef = useRef(new Map<string, Judgment>()); // this take's judgments, kept to repaint after a re-render
  const paintedRef = useRef(new Map<string, Judgment>()); // the ones with a notehead painted
  const clockRef = useRef<number | null>(null);
  // ?review=1 (sheet-review): the stored take, all its judgments at once and no cursor, until /play starts a take.
  // undefined: not a review; null: a review was asked for and none is stored (or it's corrupt). Read at first render:
  // what shows it waits for the chart, after hydration, so the server's undefined never mismatches.
  const [review, setReview] = useState<SheetReview | null | undefined>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("review") === "1" ? loadReview() : undefined,
  );
  const reviewRef = useRef(false);

  const publish = () => {
    const colored = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    for (const j of paintedRef.current.values()) colored[j]++;
    window.__pianoArcadeSheet = {
      review: reviewRef.current,
      cursorMs: clockRef.current,
      colored,
      beams: followerRef.current?.beams ?? { should: 0, beamed: 0 },
      beamAudit: () => followerRef.current?.beamAudit(judgedRef.current) ?? [],
    };
  };
  const paint = (id: string, j: Judgment) => {
    if (followerRef.current?.paint(id, COLORS[j])) paintedRef.current.set(id, j);
    followerRef.current?.paintBeam(id, judgedRef.current, COLORS, ink);
  };
  // The cursor to the chart clock; the page, not OSMD, scrolls, so reduced motion can make it a jump.
  const moveCursor = (nowMs: number) => {
    const el = followerRef.current?.clock(nowMs);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = headRef.current?.offsetHeight ?? 0;
    if (r.top >= top && r.bottom <= window.innerHeight) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: window.scrollY + r.top - top - 24, behavior: reduce ? "auto" : "smooth" });
  };
  // After every render: a new follower on the new SVG, this take's colors back on, the cursor where the take is.
  const attach = (osmd: OpenSheetMusicDisplay, chart: Chart) => {
    followerRef.current = follow(osmd, chart);
    paintedRef.current.clear();
    for (const [id, j] of judgedRef.current) paint(id, j);
    if (reviewRef.current) osmd.cursor.hide(); // a finished take: nothing to follow
    if (clockRef.current !== null) moveCursor(clockRef.current);
    publish();
  };

  // Load the chart once, as /play does; a stored review brings its own (the chart as played).
  useEffect(() => {
    const song = new URLSearchParams(window.location.search).get("song") || "twinkle";
    let live = true;
    if (review) {
      reviewRef.current = true;
      for (const [id, j] of Object.entries(review.judgments)) judgedRef.current.set(id, j);
      void songFor(review.chart).then((whole) => {
        if (!live) return;
        setZoom(loadZoom());
        setState((s) => (s.phase === "loading" ? { phase: "ready", chart: review.chart, song: whole } : s));
      });
      return () => {
        live = false;
      };
    }
    (SONG_ID.test(song) ? fetch(`/songs/${song}/chart.json`) : Promise.reject(new Error(`No song called "${song}".`)))
      .then((r) => {
        if (!r.ok) throw new Error(`No song called "${song}".`);
        return r.json();
      })
      .then((raw: unknown) => {
        const problems = validateChart(raw);
        if (problems.length) throw new Error(`Bad chart: ${problems.join("; ")}`);
        if (!live) return;
        setZoom(loadZoom()); // here, not at first render: the server has no localStorage
        songs.set((raw as Chart).id, raw as Chart);
        setState((s) => (s.phase === "loading" ? { phase: "ready", chart: raw as Chart, song: raw as Chart } : s)); // a take may have come first
      })
      .catch((e: Error) => live && setState({ phase: "error", error: e.message }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once: review only changes when a live take brings its chart
  }, []);

  // Render the score once the chart is in. OSMD touches the DOM, so it's imported in the browser only.
  const chart = state.phase === "ready" ? state.chart : null;
  const song = state.phase === "ready" ? state.song : null;
  useEffect(() => {
    const el = scoreRef.current;
    if (!chart || !el) return;
    let live = true;
    (async () => {
      const { OpenSheetMusicDisplay, CursorType } = await import("opensheetmusicdisplay");
      if (!live) return;
      el.innerHTML = "";
      const osmd = new OpenSheetMusicDisplay(el, {
        autoBeam: false, // sheet-xml writes the beams (sheet-beams): OSMD's autoBeam splits runs at every eighth in n/8
        drawTitle: false,
        drawComposer: false,
        drawCredits: false,
        drawPartNames: false,
        defaultColorMusic: ink,
        backend: "svg",
        cursorsOptions: [{ type: CursorType.Standard, color: cyan, alpha: 0.35, follow: false }],
      });
      // The page's padding sets the edges, so the score lines up with the title; the left keeps room for the brace.
      osmd.EngravingRules.PageLeftMargin = 2;
      osmd.EngravingRules.PageRightMargin = 1; // at 0 the last barline of a system clips
      await osmd.load(chartToMusicXml(chart, song ?? chart));
      if (!live) return;
      osmd.Zoom = loadZoom();
      osmd.render();
      osmdRef.current = osmd;
      shownRef.current = chart;
      attach(osmd, chart);
      setRendered(true);
    })().catch((e: Error) => live && setState({ phase: "error", error: `The score didn't render: ${e.message}` }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attach only reads refs
  }, [chart, song]);

  // Zoom: re-render at the new size and remember it.
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!rendered || !osmd || osmd.Zoom === zoom) return;
    osmd.Zoom = zoom;
    osmd.render();
    if (shownRef.current) attach(osmd, shownRef.current);
    saveZoom(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attach only reads refs
  }, [zoom, rendered]);

  // Follow /play: the latest take wins.
  useEffect(() => {
    const ch = new BroadcastChannel(SHEET_CHANNEL);
    ch.onmessage = ({ data: m }: MessageEvent<SheetMessage>) => {
      if (m.type === "take") {
        reviewRef.current = false; // the latest take wins over a review too
        setReview(undefined);
        judgedRef.current.clear();
        clockRef.current = null;
        const osmd = osmdRef.current;
        if (osmd && shownRef.current && JSON.stringify(shownRef.current) === JSON.stringify(m.chart)) {
          for (const id of paintedRef.current.keys()) {
            followerRef.current?.paint(id, ink);
            followerRef.current?.paintBeam(id, judgedRef.current, COLORS, ink); // judgedRef is empty: back to ink
          }
          attach(osmd, shownRef.current); // the same score: clear the colors and reset the cursor, no re-render
        } else {
          // hands, loops or another song: render the chart as played, in its whole song's key
          void songFor(m.chart).then((song) => setState({ phase: "ready", chart: m.chart, song }));
        }
      }
      if (m.type === "clock") {
        clockRef.current = m.nowMs;
        moveCursor(m.nowMs);
      }
      if (m.type === "judgment") {
        judgedRef.current.set(m.noteId, m.judgment);
        paint(m.noteId, m.judgment);
      }
      publish();
    };
    return () => ch.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the helpers only read refs
  }, []);

  // − and + on the keyboard too (= is + without Shift).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "-" || e.key === "_") setZoom((z) => clampZoom(z - ZOOM_STEP));
      if (e.key === "+" || e.key === "=") setZoom((z) => clampZoom(z + ZOOM_STEP));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tally = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
  for (const j of Object.values(review?.judgments ?? {})) tally[j]++;

  if (state.phase === "error") {
    return (
      <main className={`${styles.sheet} ${styles.message}`} data-sheet="error">
        <p role="alert">{state.error}</p>
        <Link href="/">Back to the song list</Link>
      </main>
    );
  }

  return (
    <main className={styles.sheet} data-sheet={rendered ? "ready" : "loading"}>
      <header className={styles.head} ref={headRef}>
        <div>
          <h1 className={styles.title}>{chart?.title ?? "Loading the score…"}</h1>
          {chart?.composer && <p className={styles.composer}>{chart.composer}</p>}
          {chart && (
            <p className={styles.note}>
              {review ? reviewLine(review) : review === null ? "No take to review" : "Generated from the chart"}
            </p>
          )}
        </div>
        <ul className={styles.legend} aria-label="Note colors">
          {JUDGMENTS.map((j) => (
            <li key={j}>
              <span className={styles.swatch} style={{ background: COLORS[j] }} aria-hidden />
              {j}
              {chart && review && <span className={styles.count}>{tally[j]}</span>}
            </li>
          ))}
        </ul>
        <div className={styles.zoom} role="group" aria-label="Zoom">
          <button onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
            −
          </button>
          <output aria-live="polite">{Math.round(zoom * 100)}%</output>
          <button onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
            +
          </button>
        </div>
      </header>
      <div ref={scoreRef} className={styles.score} />
    </main>
  );
}
