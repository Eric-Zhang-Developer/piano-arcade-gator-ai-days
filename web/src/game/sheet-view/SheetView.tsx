"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { Chart } from "../../contracts";
import { validateChart } from "../../contracts";
import { chartToMusicXml } from "../sheet-xml";
import styles from "./sheet-view.module.css";

// The ids /play takes: a folder under web/public/songs/ (the same pattern as play/page.tsx).
const SONG_ID = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/i;
const ZOOM_KEY = "pianoArcade.sheetZoom";
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;
const INK = "#f2f2f5"; // --pa-ink: OSMD takes a color string, not a CSS variable

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

type State = { phase: "loading" } | { phase: "error"; error: string } | { phase: "ready"; chart: Chart };

export function SheetView() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [zoom, setZoom] = useState(1);
  const [rendered, setRendered] = useState(false);
  const scoreRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);

  // Load the chart once, as /play does.
  useEffect(() => {
    const song = new URLSearchParams(window.location.search).get("song") || "twinkle";
    let live = true;
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
        setState({ phase: "ready", chart: raw as Chart });
      })
      .catch((e: Error) => live && setState({ phase: "error", error: e.message }));
    return () => {
      live = false;
    };
  }, []);

  // Render the score once the chart is in. OSMD touches the DOM, so it's imported in the browser only.
  const chart = state.phase === "ready" ? state.chart : null;
  useEffect(() => {
    const el = scoreRef.current;
    if (!chart || !el) return;
    let live = true;
    (async () => {
      const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
      if (!live) return;
      el.innerHTML = "";
      const osmd = new OpenSheetMusicDisplay(el, {
        autoBeam: true,
        drawTitle: false,
        drawComposer: false,
        drawCredits: false,
        drawPartNames: false,
        defaultColorMusic: INK,
        backend: "svg",
      });
      // The page's padding sets the edges, so the score lines up with the title; the left keeps room for the brace.
      osmd.EngravingRules.PageLeftMargin = 2;
      osmd.EngravingRules.PageRightMargin = 1; // at 0 the last barline of a system clips
      await osmd.load(chartToMusicXml(chart));
      if (!live) return;
      osmd.Zoom = loadZoom();
      osmd.render();
      osmdRef.current = osmd;
      setRendered(true);
    })().catch((e: Error) => live && setState({ phase: "error", error: `The score didn't render: ${e.message}` }));
    return () => {
      live = false;
    };
  }, [chart]);

  // Zoom: re-render at the new size and remember it.
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!rendered || !osmd || osmd.Zoom === zoom) return;
    osmd.Zoom = zoom;
    osmd.render();
    saveZoom(zoom);
  }, [zoom, rendered]);

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
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{chart?.title ?? "Loading the score…"}</h1>
          {chart?.composer && <p className={styles.composer}>{chart.composer}</p>}
          {chart && <p className={styles.note}>Generated from the chart</p>}
        </div>
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
