"use client";

// Attract mode: the build replayed, one merged PR per note of Twinkle, with the crew timeline below. Reads
// operator-board's board: live from /api/operator (development), or the snapshot (?snapshot, or any production build).
import { useEffect, useMemo, useRef, useState } from "react";
import type { Chart } from "../../contracts";
import type { Board } from "../../operator/board";
import { chapters, counters, doneAt, layout, steps, timeline, type Kind, type Timeline } from "../../replay/model";
import { pianoVoice, pickOutput, toneVoice, type Voice } from "../../replay/piano";
import { createStage, GLYPH, type Stage } from "../../replay/stage";
import op from "../operator/operator.module.css";
import styles from "./attract.module.css";

const SNAPSHOT_URL = "/operator/snapshot.json";
const CHART_URL = "/songs/twinkle/chart.json";
const LEAD_MS = 600; // from Play to the first step
const MAX_LATE_MS = 150;

const isBoard = (b: unknown): b is Board => {
  const x = b as Board | null;
  return !!x && typeof x.at === "string" && Array.isArray(x.features) && !!x.books && Array.isArray(x.books.milestones);
};

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const clock = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

export default function AttractPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [mode, setMode] = useState<"LIVE" | "SNAPSHOT" | null>(null);
  const [note, setNote] = useState("");
  const [env, setEnv] = useState({ webgl: true, reduced: false });
  const [k, setK] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [wall, setWall] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const voice = useRef<Voice | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const shownK = useRef(-1);
  const origin = useRef(0); // performance.now() of step time 0, so steps don't drift by each timer's lateness

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let stopped = false;
    (async () => {
      const get = (url: string) => fetch(url, { cache: "no-store" }).catch(() => null);
      let r = params.has("snapshot") ? null : await get("/api/operator");
      const live = !!r && r.status !== 404;
      if (!live) r = await get(SNAPSHOT_URL); // a production build has no live data
      const [b, c] = await Promise.all([r?.ok ? r.json().catch(() => null) : null, get(CHART_URL).then((x) => x?.json().catch(() => null))]);
      if (stopped) return;
      setMode(live ? "LIVE" : "SNAPSHOT");
      setEnv({ webgl: hasWebGL() && !params.has("webgl-off"), reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
      if (!c?.notes?.length) return setNote("The Twinkle chart couldn't be loaded.");
      setChart(c);
      if (!isBoard(b)) return setNote(live ? "The live board couldn't be loaded." : "No snapshot frozen yet: freeze one on /operator.");
      setBoard(b);
      if (!b.prs) setNote("This board has no PR data (gh failed, or an older snapshot): nothing to replay.");
    })();
    return () => {
      stopped = true;
    };
  }, []);

  const data = useMemo(() => {
    if (!board || !chart) return null;
    const ss = steps(board.prs ?? [], chart);
    const done = doneAt(board, ss);
    const tl = timeline(board.prs ?? [], Date.parse(board.at));
    return { ss, done, tl, chs: chapters(board, ss, done, tl.peak), pos: layout(board.features) };
  }, [board, chart]);

  // The stage lives as long as the data; leaving the page frees its WebGL resources.
  useEffect(() => {
    if (!data || !board || !env.webgl || !host.current) return;
    const s = createStage(host.current, board.features, data.pos, { reduced: env.reduced, onPick: setPicked });
    if (!s) {
      requestAnimationFrame(() => setEnv((e) => ({ ...e, webgl: false })));
      return;
    }
    stage.current = s;
    shownK.current = -1;
    return () => {
      s.dispose();
      stage.current = null;
    };
  }, [data, board, env]);

  // Show step k: the next step animates; anything else (scrubbing, restarting) jumps.
  useEffect(() => {
    if (!data) return;
    const s = data.ss[k];
    if (k === shownK.current + 1 && s?.feat && data.done.get(s.feat) === k) stage.current?.raise(s.feat);
    else if (k !== shownK.current + 1) stage.current?.setBuilt(new Set([...data.done].filter(([, at]) => at <= k).map(([slug]) => slug)));
    shownK.current = k;
  }, [k, data]);

  const time = (i: number) => (data ? (wall ? data.ss[i].wallMs : data.ss[i].atMs) : 0);
  // Step k is "now": anchor the clock there (on play, scrub or a wall-clock switch).
  const anchor = (at: number) => (origin.current = performance.now() - (at >= 0 ? time(at) : -LEAD_MS));

  // The clock: step i fires at origin + its time on the chart's beats (or on the merges' wall clock).
  useEffect(() => {
    if (!playing || !data) return;
    const { ss } = data;
    const next = k + 1;
    const delay = next >= ss.length ? 0 : origin.current + (wall ? ss[next].wallMs : ss[next].atMs) - performance.now();
    const t = setTimeout(() => {
      if (next >= ss.length) {
        voice.current?.stop();
        return setPlaying(false);
      }
      // Badly late (a stalled tab, the first WebGL frames): move the clock on rather than rush notes to catch up.
      const late = performance.now() - (origin.current + (wall ? ss[next].wallMs : ss[next].atMs));
      if (late > MAX_LATE_MS) origin.current += late;
      if (!wall) voice.current?.note(ss[next].note.pitch, ss[next].noteMs);
      setK(next);
    }, Math.max(0, delay));
    return () => clearTimeout(t);
  }, [playing, k, wall, data]);

  async function toggle() {
    if (playing) {
      voice.current?.stop();
      return setPlaying(false);
    }
    if (!voice.current) {
      const access = await navigator.requestMIDIAccess?.().catch(() => null);
      const out = pickOutput(access ?? null);
      if (out) {
        voice.current = pianoVoice(out);
        setVoiceName(`🎹 ${out.name}`);
      } else {
        audio.current = new AudioContext();
        voice.current = toneVoice(audio.current);
        setVoiceName("♪ laptop tone (no Portable Grand found)");
      }
    }
    await audio.current?.resume();
    const from = data && k >= data.ss.length - 1 ? -1 : k;
    setK(from);
    anchor(from);
    setPlaying(true);
  }
  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || (e.target as HTMLElement).tagName === "BUTTON") return; // a focused button clicks itself
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      voice.current?.stop(); // leaving the page: no stuck notes
      audio.current?.close();
    };
  }, []);

  const repo = board?.prs?.[0]?.url.match(/^https:\/\/github\.com\/[^/]+\/[^/]+/)?.[0] ?? null;
  const c = board && data ? counters(board, data.ss, data.done, k) : null;
  const chapter = data?.chs.filter((x) => x.step <= k && k - x.step < 8).at(-1);
  const ticker = data ? data.ss.slice(Math.max(0, k - 2), k + 1).reverse() : [];
  const snapQ = mode === "SNAPSHOT" ? "?snapshot" : "";

  return (
    <main className={op.page}>
      <header className={op.header}>
        <div className={op.titleRow}>
          <h1 className={op.title}>ATTRACT MODE</h1>
          <a className={op.attract} href={`/operator${snapQ}`}>
            ◀ OPERATOR MODE
          </a>
        </div>
        {mode && board && (
          <p className={op.meta}>
            <span className={mode === "LIVE" ? op.live : op.snapshot}>{mode === "LIVE" ? "● LIVE" : "❄ SNAPSHOT"}</span>
            <span>data {clock(Date.parse(board.at))}</span>
            <span>files {board.sha}</span>
            <span>Space plays and pauses</span>
          </p>
        )}
      </header>

      {note && (
        <div className={op.banner} role="status">
          <p>⚠ {note}</p>
        </div>
      )}
      {!mode && !note && <p className={op.loading}>INSERT COIN… loading the build</p>}

      {board && data && c && (
        <>
          <section className={styles.cabinet} aria-label="The build, replayed">
            {env.webgl ? (
              <div ref={host} className={styles.stage} />
            ) : (
              <FlatList board={board} pos={data.pos} built={new Set([...data.done].filter(([, at]) => at <= k).map(([s]) => s))} onPick={setPicked} />
            )}
            <dl className={styles.counters}>
              <div>
                <dt>FEATURES DONE</dt>
                <dd>
                  {c.done} / {c.planned}
                </dd>
              </div>
              <div>
                <dt>PRS MERGED</dt>
                <dd>{c.merged}</dd>
              </div>
              <div>
                <dt>AGENTS AT WORK</dt>
                <dd>{c.agents}</dd>
              </div>
            </dl>
            {chapter && (
              <p className={styles.chapter} key={chapter.text} role="status">
                {chapter.text}
              </p>
            )}
            {ticker.length > 0 && <ol className={styles.ticker} aria-label="Latest merges">
              {ticker.map((s) => (
                <li key={s.pr.number}>
                  #{s.pr.number} {s.pr.title}
                </li>
              ))}
            </ol>}
            {picked && <Picked slug={picked} board={board} repo={repo} prUrl={[...data.ss].reverse().find((s) => s.feat === picked)?.pr.url} onClose={() => setPicked(null)} />}
          </section>

          <div className={styles.controls}>
            <button className={op.freeze} onClick={toggle} disabled={!data.ss.length}>
              {playing ? "❚❚ Pause" : k >= data.ss.length - 1 && k >= 0 ? "↺ Replay" : "▶ Play"}
            </button>
            <input
              className={styles.scrub}
              type="range"
              min={-1}
              max={data.ss.length - 1}
              value={k}
              onChange={(e) => {
                const at = Number(e.target.value);
                setK(at);
                anchor(at);
              }}
              aria-label="Step"
            />
            <span className={styles.stepNo}>
              {k + 1} / {data.ss.length}
            </span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={wall}
                onChange={(e) => {
                  setWall(e.target.checked);
                  if (data && k >= 0) origin.current = performance.now() - (e.target.checked ? data.ss[k].wallMs : data.ss[k].atMs);
                }}
              /> wall clock (no notes)
            </label>
            {voiceName && <span className={op.dim}>{voiceName}</span>}
          </div>

          <CrewTimeline tl={data.tl} marker={k >= 0 ? Date.parse(data.ss[k].pr.mergedAt!) : null} />
        </>
      )}
    </main>
  );
}

function Picked({ slug, board, repo, prUrl, onClose }: { slug: string; board: Board; repo: string | null; prUrl?: string; onClose: () => void }) {
  const f = board.features.find((x) => x.slug === slug);
  if (!f) return null;
  const pr = prUrl ?? f.pr;
  return (
    <div className={styles.picked} role="dialog" aria-label={`${slug} links`}>
      <p>
        <strong>
          {GLYPH[f.state]} {slug}
        </strong>{" "}
        · {f.state}
      </p>
      <p className={op.dim}>{f.name}</p>
      <ul className={op.list}>
        <li>{repo ? <a href={`${repo}/blob/main/specs/features/${slug}/spec.md`} target="_blank" rel="noreferrer">spec ↗</a> : "spec: unknown repo"}</li>
        <li>{pr ? <a href={pr} target="_blank" rel="noreferrer">PR ↗</a> : "PR: none merged or open"}</li>
        <li>
          {f.state === "done" && repo ? (
            <a href={`${repo}/blob/main/changes/${slug}.md`} target="_blank" rel="noreferrer">done note ↗</a>
          ) : (
            "done note: not done yet"
          )}
        </li>
      </ul>
      <button className={op.freeze} onClick={onClose}>
        Close
      </button>
    </div>
  );
}

// No WebGL: the same graph, row by row, and the replay still steps, counts and plays.
function FlatList({ board, pos, built, onPick }: { board: Board; pos: Map<string, { x: number; z: number }>; built: Set<string>; onPick: (s: string) => void }) {
  const rows = new Map<number, string[]>();
  for (const [slug, p] of pos) rows.set(p.z, [...(rows.get(p.z) ?? []), slug]);
  return (
    <div className={styles.flat}>
      <p className={op.dim}>No WebGL here: the graph as a list, front row first.</p>
      {[...rows].sort(([a], [b]) => a - b).map(([z, slugs]) => (
        <div key={z} className={styles.flatRow}>
          <span className={op.dim}>row {z + 1}</span>
          {slugs.sort().map((s) => {
            const f = board.features.find((x) => x.slug === s)!;
            const up = built.has(s);
            return (
              <button key={s} className={`${styles.flatItem} ${up ? styles.up : ""}`} onClick={() => onPick(s)}>
                {up ? "▲" : "▫"} {GLYPH[f.state]} {s}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const KIND_LABEL: Record<Kind, string> = { feat: "feat", fix: "fix · refactor · perf · test", plan: "plan · contract", other: "other" };
const LANE = 12;
const LEFT = 150;
const W = 1000;
const STRIP = 44;

function CrewTimeline({ tl, marker }: { tl: Timeline; marker: number | null }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const span = Math.max(1, tl.end - tl.start);
  const x = (t: number) => LEFT + ((t - tl.start) / span) * (W - LEFT - 10);
  const rowsY = tl.rows.map((_, i) => STRIP + 16 + tl.rows.slice(0, i).reduce((h, r) => h + r.lanes * LANE + 10, 0));
  const y = STRIP + 16 + tl.rows.reduce((h, r) => h + r.lanes * LANE + 10, 0);
  const maxOpen = Math.max(1, tl.peak.open);
  const level = (n: number) => (STRIP - (n / maxOpen) * (STRIP - 6)).toFixed(1);
  const strip = `M${LEFT} ${STRIP} ${tl.open.map((o) => `H${x(o.t).toFixed(1)} V${level(o.n)}`).join(" ")} H${W - 10} V${STRIP} Z`;
  const fmt = (t: number) => new Date(t).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  return (
    <section className={op.screen} aria-labelledby="crew-timeline">
      <h2 id="crew-timeline" className={op.screenTitle}>
        CREW TIMELINE · PEAK {tl.peak.open} PRS OPEN AT ONCE
      </h2>
      <p className={styles.legend}>
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <span key={k}>
            <i className={styles[`k_${k}`]} /> {KIND_LABEL[k]}
          </span>
        ))}
        <span>▭ open · ┅ closed unmerged</span>
      </p>
      <div className={styles.timelineWrap} onMouseLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${y}`} className={styles.timeline} role="img" aria-label="Every PR per worker over time; table below">
          <text x={8} y={STRIP - 4} className={styles.axis}>
            open PRs
          </text>
          <path d={strip} className={styles.strip} />
          {tl.rows.map((r, i) => (
            <g key={r.worker}>
              <text x={8} y={rowsY[i] + 10} className={styles.worker}>
                {r.worker}
              </text>
              {r.bars.map((b) => {
                const bx = x(b.start);
                const bw = Math.max(2, x(b.end) - bx);
                const text = `#${b.pr.number} ${b.pr.title} · ${b.pr.worker} · opened ${fmt(b.start)} · ${b.how === "open" ? "still open" : `${b.how} ${fmt(b.end)}`}`;
                return (
                  <a key={b.pr.number} href={b.pr.url} target="_blank" rel="noreferrer" aria-label={text}>
                    <rect
                      x={bx}
                      y={rowsY[i] + b.lane * LANE}
                      width={bw}
                      height={LANE - 3}
                      className={`${styles[`k_${b.kind}`]} ${styles[`how_${b.how}`]}`}
                      onMouseEnter={(e) => {
                        const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                        setTip({ x: ((bx + bw / 2) / W) * r.width, y: ((rowsY[i] + b.lane * LANE) / y) * r.height, text });
                      }}
                    />
                  </a>
                );
              })}
            </g>
          ))}
          {marker !== null && <line x1={x(marker)} x2={x(marker)} y1={0} y2={y} className={styles.marker} />}
        </svg>
        {tip && (
          <div className={styles.tip} style={{ left: tip.x, top: tip.y }} role="tooltip">
            {tip.text}
          </div>
        )}
      </div>
      <details className={styles.details}>
        <summary>Timeline as a table</summary>
        <table className={op.table}>
          <thead>
            <tr>
              <th scope="col">Worker</th>
              <th scope="col">PR</th>
              <th scope="col">Opened</th>
              <th scope="col">Ended</th>
            </tr>
          </thead>
          <tbody>
            {tl.rows.flatMap((r) =>
              r.bars.map((b) => (
                <tr key={b.pr.number}>
                  <td>{r.worker}</td>
                  <td>
                    <a href={b.pr.url}>
                      #{b.pr.number} {b.pr.title}
                    </a>
                  </td>
                  <td className={op.num}>{fmt(b.start)}</td>
                  <td className={op.num}>{b.how === "open" ? "still open" : `${b.how} ${fmt(b.end)}`}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </details>
    </section>
  );
}
