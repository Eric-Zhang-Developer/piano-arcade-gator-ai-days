// /how's four diagrams: inline SVG drawn on the server from HowData. The viewBox is 1600 wide, the page column's
// width at 1920×1080, so a 24-unit label is 24 px there (18 px at 1280×720). Every value carries data-value (its
// key) and data-n (the value, or "unknown") for verify-how.mjs to check against its own computation.
import { KIND_LABEL, KINDS, ROLES, type HowData } from "./data";
import type { Kind } from "../replay/model";
import styles from "./how.module.css";

const W = 1600;
const show = (v: number | string | null | undefined) => (v === null || v === undefined ? "unknown" : String(v));
export const KIND_COLOR: Record<Kind, string> = { feat: "var(--pa-magenta)", fix: "var(--pa-cyan)", plan: "var(--pa-sun)", other: "var(--pa-ink-dim)" };

// A value in HTML: data-value is its key, data-n what it says.
export function V({ k, v }: { k: string; v: number | string | null | undefined }) {
  return (
    <span data-value={k} data-n={show(v)} className={v === null || v === undefined ? styles.unknown : styles.num}>
      {show(v)}
    </span>
  );
}

function Box({ x, y, w, h, title, job, count, k, dim }: { x: number; y: number; w: number; h: number; title: string; job?: string; count?: number | null; k?: string; dim?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} className={dim ? styles.boxDim : styles.box} />
      <text x={x + w / 2} y={y + 36} className={styles.svgTitle} textAnchor="middle" data-read="">
        {title}
      </text>
      {job && (
        <text x={x + w / 2} y={y + 68} className={styles.svgLabel} textAnchor="middle" data-read="">
          {job}
        </text>
      )}
      {k && (
        <text x={x + w / 2} y={y + h - 18} className={styles.svgLabel} textAnchor="middle" data-read="" data-value={k} data-n={show(count)}>
          {count === undefined || count === null ? "unknown" : `${count} merged`}
        </text>
      )}
    </g>
  );
}

const Arrow = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles.arrow} markerEnd="url(#how-arrow)" />
);

const ArrowDefs = () => (
  <defs>
    <marker id="how-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--pa-magenta)" />
    </marker>
  </defs>
);

// A diagram with no data: still an SVG, saying so.
const Unknown = ({ label }: { label: string }) => (
  <svg viewBox={`0 0 ${W} 60`} className={styles.svg} role="img" aria-label={label}>
    <text x={0} y={40} className={styles.svgLabel} style={{ fill: "var(--pa-ink-dim)" }} data-read="">
      {label}
    </text>
  </svg>
);

// 1. Who does what: Eric -> the asking agent -> the planner -> the workers, with the foreman beside them.
export function Who({ d }: { d: HowData }) {
  const n = (name: string) => (d.byWorker ? (d.byWorker.get(name) ?? 0) : null);
  const bw = 196;
  const gap = 18;
  const workersW = ROLES.workers.names.length * bw + (ROLES.workers.names.length - 1) * gap;
  const x0 = 40;
  const mid = x0 + workersW / 2;
  return (
    <svg viewBox={`0 0 ${W} 680`} className={styles.svg} role="img" aria-label="Who does what; a text version follows">
      <ArrowDefs />
      <Box x={mid - 220} y={10} w={440} h={96} title={ROLES.eric.name} job={ROLES.eric.job} />
      <Arrow x1={mid} y1={106} x2={mid} y2={140} />
      <Box x={mid - 260} y={144} w={520} h={130} title={ROLES.asking.name} job={ROLES.asking.job} count={n(ROLES.asking.name)} k={`worker:${ROLES.asking.name}`} />
      <Arrow x1={mid} y1={274} x2={mid} y2={308} />
      <Box x={mid - 260} y={312} w={520} h={130} title={ROLES.planning.name} job={ROLES.planning.job} count={n(ROLES.planning.name)} k={`worker:${ROLES.planning.name}`} />
      {ROLES.workers.names.map((w, i) => {
        const x = x0 + i * (bw + gap);
        const standby = (ROLES.workers.standby as readonly string[]).includes(w);
        return (
          <g key={w}>
            <Arrow x1={mid} y1={442} x2={x + bw / 2} y2={496} />
            <Box x={x} y={500} w={bw} h={120} title={w} job={standby ? "standby" : undefined} count={n(w)} k={`worker:${w}`} dim={standby} />
          </g>
        );
      })}
      <text x={x0} y={662} className={styles.svgLabel} data-read="">
        workers: {ROLES.workers.job}
      </text>
      <line x1={x0 + workersW + 30} y1={490} x2={x0 + workersW + 30} y2={630} className={styles.rule} />
      <Box x={x0 + workersW + 60} y={500} w={W - (x0 + workersW + 60) - 20} h={120} title={ROLES.foreman.name} job="beside the workers" count={n(ROLES.foreman.name)} k={`worker:${ROLES.foreman.name}`} />
    </svg>
  );
}

// 2. A feature's life, with today's stage counts under their stages.
const STAGES = ["idea", "issue", "spec", "ready", "draft-PR\nclaim", "checks:\nci, browser", "done note", "merge"];
export function Life({ d }: { d: HowData }) {
  const bw = 176;
  const gap = (W - 40 - STAGES.length * bw) / (STAGES.length - 1);
  const x = (i: number) => 20 + i * (bw + gap);
  const s = d.stages;
  const under: Record<number, [string, string, number | null][]> = {
    2: [["backlog", "stage:backlog", s?.backlog ?? null]],
    3: [["ready", "stage:ready", s?.ready ?? null], ["blocked", "stage:blocked", s?.blocked ?? null]],
    4: [["in flight", "stage:inFlight", s?.inFlight ?? null]],
    7: [["done", "stage:done", s?.done ?? null]],
  };
  return (
    <svg viewBox={`0 0 ${W} 400`} className={styles.svg} role="img" aria-label="A feature's life; a text version follows">
      <ArrowDefs />
      {STAGES.map((label, i) => (
        <g key={label}>
          <rect x={x(i)} y={20} width={bw} height={110} rx={10} className={styles.box} />
          {label.split("\n").map((part, j, all) => (
            <text key={part} x={x(i) + bw / 2} y={all.length > 1 ? 66 + j * 32 : 84} textAnchor="middle" className={styles.svgTitle} data-read="">
              {part}
            </text>
          ))}
          {i < STAGES.length - 1 && <Arrow x1={x(i) + bw + 2} y1={75} x2={x(i + 1) - 4} y2={75} />}
          {(under[i] ?? []).map(([word, k, v], j) => (
            <text key={k} x={x(i) + bw / 2} y={176 + j * 34} textAnchor="middle" className={styles.svgLabel} data-read="" data-value={k} data-n={show(v)}>
              {word}: {show(v)}
            </text>
          ))}
        </g>
      ))}
      <path d={`M${x(4) + bw / 2} 270 V300 H${x(7) + bw / 2} V270`} className={styles.bracket} />
      <text x={(x(4) + x(7) + bw) / 2} y={350} textAnchor="middle" className={styles.svgLabel} data-read="" data-value="medianMergeMin" data-n={show(d.medianMergeMin)}>
        median open to merge: {d.medianMergeMin === null ? "unknown" : `${d.medianMergeMin} min`}
      </text>
    </svg>
  );
}

// 3. The repo's lanes: one bar per folder under web/src/, by lines of code, with its owner.
export function Lanes({ d }: { d: HowData }) {
  if (!d.folders) return <Unknown label="Lines of code: unknown (git couldn't be read)" />;
  const label = 640;
  const row = 44;
  const max = Math.max(1, ...d.folders.map((f) => f.lines));
  const barW = W - label - 160;
  return (
    <svg viewBox={`0 0 ${W} ${d.folders.length * row + 10}`} className={styles.svg} role="img" aria-label="Lines of code per folder and its owner; a text version follows">
      {d.folders.map((f, i) => {
        const y = 5 + i * row;
        return (
          <g key={f.folder}>
            <text x={0} y={y + 29} className={styles.svgLabel} data-read="">
              <tspan data-value={`folder:${f.folder}:owner`} data-n={f.owner}>
                {f.folder.replace(/^web\/src\//, "")} · {f.owner}
              </tspan>
            </text>
            <rect x={label} y={y + 6} width={Math.max(2, (f.lines / max) * barW)} height={row - 14} className={styles.bar} />
            <text x={label + Math.max(2, (f.lines / max) * barW) + 12} y={y + 29} className={styles.svgNum} data-read="" data-value={`folder:${f.folder}:lines`} data-n={f.lines}>
              {f.lines.toLocaleString("en-US")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// 4. Merges per hour, stacked by kind.
export function Time({ d }: { d: HowData }) {
  if (!d.hours) return <Unknown label="Merges per hour: unknown (no snapshot)" />;
  const left = 70;
  const top = 20;
  const h = 360;
  const max = Math.max(1, ...d.hours.map((x) => x.total));
  const slot = (W - left - 10) / d.hours.length;
  const every = Math.max(1, Math.ceil(130 / slot)); // room for a "Sat 9 AM" label
  return (
    <svg viewBox={`0 0 ${W} ${top + h + 50}`} className={styles.svg} role="img" aria-label="Merges per hour by kind; a text version follows">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={left} x2={W - 10} y1={top + h - f * h} y2={top + h - f * h} className={styles.grid} />
          <text x={left - 12} y={top + h - f * h + 8} textAnchor="end" className={styles.svgNum} data-read="">
            {Math.round(f * max)}
          </text>
        </g>
      ))}
      {d.hours.map((hr, i) => {
        let y = top + h;
        return (
          <g key={hr.at}>
            {KINDS.map((k) => {
              const bh = (hr.counts[k] / max) * h;
              y -= bh;
              return <rect key={k} x={left + i * slot + 3} y={y} width={slot - 6} height={bh} fill={KIND_COLOR[k]} data-value={`hour:${hr.at}:${k}`} data-n={hr.counts[k]} />;
            })}
            {i % every === 0 && (
              <text x={left + i * slot + slot / 2} y={top + h + 36} textAnchor="middle" className={styles.svgLabel} data-read="">
                {hr.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const kindLegend = KINDS.map((k) => ({ k, label: KIND_LABEL[k], color: KIND_COLOR[k] }));
