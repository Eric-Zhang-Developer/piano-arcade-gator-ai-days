"use client";
// /harmony (spec: harmony-map): a song's constellation, drawn from its chart and pedal, and the live panel lit by your
// own playing: the page's own MIDI access (notes and CC64, which core input drops) or laptop keys from middle C.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Chart } from "../../../contracts";
import { keysDevice } from "../../core/input";
import { loadPedal, type Pedal } from "../../pedal";
import { constellationSvg, stats } from "./constellation";
import css from "./harmony.module.css";
import { Legend } from "./Legend";
import { drawPanel, liveHarmony } from "./live";
import { fileLook, look } from "./look";
import { fromId, triadName } from "./tonnetz";

declare global {
  interface Window {
    // the perf check's hook (Validation b): play into the panel, and the per-frame work times in ms
    __pianoArcadeHarmony?: { press(p: number): void; release(p: number): void; pedal(down: boolean): void; frames: number[] };
  }
}

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function save(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function Harmony({ songs }: { songs: { id: string; title: string }[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const song = params.get("song") ?? "moonlight-1";
  const [data, setData] = useState<{ song: string; chart: Chart; pedal: Pedal | null } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [input, setInput] = useState("Laptop keys A to ; play from middle C");
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(liveHarmony());

  useEffect(() => {
    let gone = false;
    fetch(`/songs/${song}/chart.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${song}: ${r.status}`))))
      .then(async (chart: Chart) => {
        const pedal = await loadPedal(song);
        if (gone) return;
        setData({ song, chart, pedal });
        setFailed(null);
      })
      .catch((e: Error) => !gone && setFailed(e.message));
    return () => {
      gone = true;
    };
  }, [song]);

  const view = useMemo(() => {
    if (!data) return null;
    const st = stats(data.chart, data.pedal);
    const title = `${data.chart.title}: its harmony on the Tonnetz`;
    return { st, svg: constellationSvg(st, look, title), file: () => constellationSvg(st, fileLook, title) };
  }, [data]);

  // Input: laptop keys always, and the first MIDI input when there is one.
  useEffect(() => {
    const h = live.current;
    const keys = keysDevice(60);
    void keys.start((e) => (e.type === "on" ? h.press(e.pitch, performance.now()) : h.release(e.pitch, performance.now())));
    let midi: MIDIInput | null = null;
    let gone = false;
    (async () => {
      const access = navigator.requestMIDIAccess ? await navigator.requestMIDIAccess().catch(() => null) : null;
      if (gone || !access) return;
      midi = [...access.inputs.values()][0] ?? null;
      if (!midi) return;
      setInput(`Piano: ${midi.name ?? "MIDI in"}, with its pedal`);
      midi.onmidimessage = (m) => {
        const d = m.data;
        if (!d || d.length < 3) return;
        const cmd = d[0] & 0xf0;
        const t = performance.now();
        if (cmd === 0xb0 && d[1] === 64) h.pedal(d[2] >= 64, t);
        else if (cmd === 0x90 && d[2] > 0) h.press(d[1], t);
        else if (cmd === 0x80 || cmd === 0x90) h.release(d[1], t);
      };
    })();
    const frames: number[] = [];
    window.__pianoArcadeHarmony = {
      press: (p) => h.press(p, performance.now()),
      release: (p) => h.release(p, performance.now()),
      pedal: (down) => h.pedal(down, performance.now()),
      frames,
    };
    return () => {
      gone = true;
      keys.stop();
      if (midi) midi.onmidimessage = null;
    };
  }, []);

  // The panel's frame loop. The work time (update and draw) is what the perf check reads.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let raf = 0;
    const frame = () => {
      const t0 = performance.now();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(c.clientWidth * dpr);
      const hh = Math.round(c.clientHeight * dpr);
      if (c.width !== w || c.height !== hh) [c.width, c.height] = [w, hh];
      drawPanel(ctx, { x: 0, y: 0, w, h: hh }, live.current, t0, reduced());
      const frames = window.__pianoArcadeHarmony?.frames;
      if (frames) {
        frames.push(performance.now() - t0);
        if (frames.length > 3000) frames.shift();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const title = songs.find((s) => s.id === song)?.title ?? data?.chart.title ?? song;
  const st = view?.st;
  return (
    <main className={css.page} data-testid="harmony">
      <header className={css.head}>
        <h1 className={css.title}>The Harmony Map</h1>
        <span className={css.sub}>{title}</span>
        <nav className={css.nav}>
          <Link href="/harmony/all">The atlas</Link>
          <Link href="/lab">Lab</Link>
        </nav>
      </header>
      <Legend />
      <div className={css.stage}>
        <figure className={css.chart} aria-busy={!view && !failed}>
          {failed ? <p>No chart for {song}: {failed}</p> : view ? <div style={{ width: "100%" }} dangerouslySetInnerHTML={{ __html: view.svg }} /> : <p className={css.sub}>Drawing…</p>}
        </figure>
        <aside className={css.side}>
          <canvas ref={canvas} className={css.panel} role="img" aria-label="Live: the notes you're playing on the Tonnetz, and the triad they make" />
          <p className={css.sub}>Live · {input}</p>
          <div className={css.row}>
            <label>
              <span className={css.sub}>Song </span>
              <select className={css.select} value={song} onChange={(e) => router.replace(`/harmony?song=${encodeURIComponent(e.target.value)}`)}>
                {songs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {st && (
            <dl className={css.facts}>
              <dt>Home</dt>
              <dd>{st.home === null ? "none: no full triad" : triadName(fromId(st.home))}</dd>
              <dt>Changes</dt>
              <dd>{st.order.length}</dd>
              <dt>Triads</dt>
              <dd>{st.beats.size}</dd>
              <dt>Pedal</dt>
              <dd>{data?.pedal ? "from its pedal.json" : "none: note lengths only"}</dd>
            </dl>
          )}
          {view && (
            <div className={css.row}>
              <button type="button" className={css.select} onClick={() => save(`${song.replace(/\//g, "-")}-harmony.svg`, new Blob([view.file()], { type: "image/svg+xml" }))}>
                Download SVG
              </button>
              <button
                type="button"
                className={css.select}
                onClick={() => {
                  const img = new Image();
                  const url = URL.createObjectURL(new Blob([view.file()], { type: "image/svg+xml" }));
                  img.onload = () => {
                    const k = 2;
                    const c = document.createElement("canvas");
                    [c.width, c.height] = [img.naturalWidth * k, img.naturalHeight * k];
                    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
                    URL.revokeObjectURL(url);
                    c.toBlob((b) => b && save(`${song.replace(/\//g, "-")}-harmony.png`, b), "image/png");
                  };
                  img.src = url;
                }}
              >
                Download PNG
              </button>
            </div>
          )}
        </aside>
      </div>
      <p className={css.cite}>
        The lattice is Euler&rsquo;s, from <i>Tentamen novae theoriae musicae</i> (1739, E33): fifths one way, major thirds
        the other. Hugo Riemann related triads by transformations in the 1880s and drew the network in{" "}
        <i>Grosse Kompositionslehre</i> I (1902). P, L and R are neo-Riemannian theory&rsquo;s three moves, as surveyed by
        Richard Cohn (<i>Journal of Music Theory</i> 42/2, 1998, doi:10.2307/843871). Chords are named by the jam-mode
        spike&rsquo;s namer.
      </p>
    </main>
  );
}
