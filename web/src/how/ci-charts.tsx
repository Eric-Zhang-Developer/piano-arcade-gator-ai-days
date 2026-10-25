// /how/ci's three charts: inline SVG drawn on the server from ci.ts. The viewBox is 1600 wide, /how's column at
// 1920×1080, so a 22-unit label is 22 px there. Values carry data-value/data-n like the rest of /how.
import { clock, end, type CiSnapshot, type FlightPoint, type Hour, type Mark } from "./ci";
import s from "./ci.module.css";

const W = 1600;
const L = 70; // left gutter for the y axis
const R = 20;
const plotW = W - L - R;

const xOf = (snap: CiSnapshot, t: number) => L + (Math.max(0, Math.min(t, end(snap))) / end(snap)) * plotW;

// Hour ticks along the bottom, in New York time.
function Hours({ snap, y }: { snap: CiSnapshot; y: number }) {
  const start = Date.parse(snap.since);
  const first = Math.ceil(start / 3_600_000) * 3_600_000;
  const ticks: number[] = [];
  for (let ms = first; ms < start + end(snap) * 1000; ms += 3_600_000) ticks.push((ms - start) / 1000);
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={xOf(snap, t)} x2={xOf(snap, t)} y1={20} y2={y} className={s.grid} />
          <text x={xOf(snap, t)} y={y + 28} className={s.axis} textAnchor="middle">
            {clock(snap, t).replace(":00", "")}
          </text>
        </g>
      ))}
    </g>
  );
}

// The fixes, as dashed rules tagged with their PR number on staggered rows; the HTML key under the chart says what
// each one did. A tag near the right edge sits left of its rule, so nothing is clipped.
function Marks({ snap, marks, y }: { snap: CiSnapshot; marks: Mark[]; y: number }) {
  return (
    <g>
      {marks
        .filter((m) => m.t !== null)
        .map((m, i) => {
          const x = xOf(snap, m.t!);
          const right = x > W - 160;
          return (
            <g key={m.n} data-mark={m.n}>
              <line x1={x} x2={x} y1={14 + (i % 3) * 24} y2={y} className={s.mark} />
              <text x={right ? x - 6 : x + 6} y={30 + (i % 3) * 24} className={s.markLabel} textAnchor={right ? "end" : "start"}>
                #{m.n}
              </text>
            </g>
          );
        })}
    </g>
  );
}

function YAxis({ max, y0, h, unit }: { max: number; y0: number; h: number; unit: string }) {
  const steps = [0, 0.5, 1].map((f) => Math.round(max * f));
  return (
    <g>
      {steps.map((v) => (
        <text key={v} x={L - 10} y={y0 + h - (v / max) * h + 7} className={s.axis} textAnchor="end">
          {v}
        </text>
      ))}
      <text x={L - 10} y={y0 - 28} className={s.axis} textAnchor="end">
        {unit}
      </text>
    </g>
  );
}

// 1. Browser jobs running and waiting across the night, main's waiting jobs as a line, the fixes marked.
export function Flight({ snap, points, peakRunning }: { snap: CiSnapshot; points: FlightPoint[]; peakRunning: number | null }) {
  const H = 420;
  const y0 = 90;
  const h = H - y0 - 50;
  const max = Math.max(1, ...points.map((p) => p.running + p.queued));
  const y = (v: number) => y0 + h - (v / max) * h;
  const step = points.length > 1 ? points[1].t - points[0].t : 300;
  const area = (top: (p: FlightPoint) => number, bottom: (p: FlightPoint) => number) =>
    points.map((p) => `M${xOf(snap, p.t)},${y(bottom(p))}H${xOf(snap, p.t + step)}V${y(top(p))}H${xOf(snap, p.t)}Z`).join("");
  const mainPeak = points.reduce<FlightPoint | null>((b, p) => (p.mainQueued > (b?.mainQueued ?? 0) ? p : b), null);
  const mainLine = points.map((p, i) => `${i ? "L" : "M"}${xOf(snap, p.t + step / 2)},${y(p.mainQueued)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label="Browser jobs running and waiting across the night; a table follows">
      <Hours snap={snap} y={y0 + h} />
      <path d={area((p) => p.running, () => 0)} className={s.running} />
      <path d={area((p) => p.running + p.queued, (p) => p.running)} className={s.queued} />
      <path d={mainLine} className={s.mainLine} />
      {mainPeak && (
        <text x={xOf(snap, mainPeak.t + step / 2)} y={y(mainPeak.mainQueued) - 10} className={s.mainLabel} textAnchor="end" data-value="mainPeak" data-n={mainPeak.mainQueued}>
          main waiting: {mainPeak.mainQueued}
        </text>
      )}
      {peakRunning !== null && (
        <g>
          <line x1={L} x2={W - R} y1={y(peakRunning)} y2={y(peakRunning)} className={s.ceiling} />
          <text x={L + 10} y={y(peakRunning) - 8} className={s.axis} data-value="peakRunning" data-n={peakRunning}>
            most running at once: {peakRunning}
          </text>
        </g>
      )}
      <Marks snap={snap} marks={snap.marks} y={y0 + h} />
      <YAxis max={max} y0={y0} h={h} unit="jobs" />
    </svg>
  );
}

// 2. Each green PR run: when it started and how long from push to green. Past the switch, "measuring" until ready.
export function Green({ snap, runs, cut, afterReady }: { snap: CiSnapshot; runs: { t: number; min: number }[]; cut: number | null; afterReady: boolean }) {
  const H = 380;
  const y0 = 50;
  const h = H - y0 - 50;
  const max = Math.max(1, ...runs.map((r) => r.min));
  const y = (v: number) => y0 + h - (v / max) * h;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label="Minutes from push to green for each PR run; a table follows">
      <Hours snap={snap} y={y0 + h} />
      {cut !== null && !afterReady && (
        <g>
          <rect x={xOf(snap, cut)} y={y0} width={W - R - xOf(snap, cut)} height={h} className={s.measuring} />
          <text x={(xOf(snap, cut) + W - R) / 2} y={y0 + h / 2} className={s.measuringLabel} textAnchor="middle">
            MEASURING
          </text>
        </g>
      )}
      {runs
        .filter((r) => afterReady || cut === null || r.t < cut)
        .map((r, i) => (
          <circle key={i} cx={xOf(snap, r.t)} cy={y(r.min)} r={7} className={cut !== null && r.t >= cut ? s.dotAfter : s.dot} />
        ))}
      {cut !== null && <line x1={xOf(snap, cut)} x2={xOf(snap, cut)} y1={y0} y2={y0 + h} className={s.mark} />}
      <YAxis max={max} y0={y0} h={h} unit="min" />
    </svg>
  );
}

// 3. PRs merged each hour, the fixes marked.
export function Merges({ snap, hours }: { snap: CiSnapshot; hours: Hour[] }) {
  const H = 440;
  const y0 = 130; // room above the tallest bar's count for the fixes' tags
  const h = H - y0 - 50;
  const max = Math.max(1, ...hours.map((x) => x.count));
  const bw = (3600 / end(snap)) * plotW;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label="PRs merged each hour; a table follows">
      <Hours snap={snap} y={y0 + h} />
      {hours.map((x) => (
        <g key={x.t}>
          <rect x={xOf(snap, x.t) + 4} y={y0 + h - (x.count / max) * h} width={Math.max(0, bw - 8)} height={(x.count / max) * h} className={s.bar} />
          <text x={xOf(snap, x.t) + bw / 2} y={y0 + h - (x.count / max) * h - 8} className={s.axis} textAnchor="middle" data-value={`merges:${x.label}`} data-n={x.count}>
            {x.count}
          </text>
        </g>
      ))}
      <Marks snap={snap} marks={snap.marks} y={y0 + h} />
      <YAxis max={max} y0={y0} h={h} unit="PRs" />
    </svg>
  );
}
