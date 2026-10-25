// /how/ci: the night the browser checks jammed, told in three charts. A server component: every number comes from
// web/src/how/ci-snapshot.json, which ci-freeze.mjs writes from GitHub's run and PR records. Nothing is typed in.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DataCell, MonoLabel, Panel } from "../../../game/duo-tokens";
import { AFTER_MIN_HOURS, beforeAfter, clock, cutoff, end, flight, mainWait, mergesPerHour, peak, rate, type CiSnapshot } from "../../../how/ci";
import { Flight, Green, Merges } from "../../../how/ci-charts";
import snapshot from "../../../how/ci-snapshot.json";
import { V } from "../../../how/diagrams";
import { Tabs } from "../../../how/tabs";
import styles from "../../../how/how.module.css";
import s from "../../../how/ci.module.css";

export const metadata: Metadata = { title: "CI · How it works · Étude" };

const MEASURING = "measuring";
const asOf = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }) + " ET";

function Beats({ broke, measured, changed, result }: { broke: ReactNode; measured: ReactNode; changed: ReactNode; result: ReactNode }) {
  const rows: [string, ReactNode][] = [
    ["What broke", broke],
    ["What we measured", measured],
    ["What we changed", changed],
    ["Result", result],
  ];
  return (
    <ul className={s.beats}>
      {rows.map(([label, text]) => (
        <li key={label}>
          <MonoLabel>{label}</MonoLabel>
          <span data-read="">{text}</span>
        </li>
      ))}
    </ul>
  );
}

function MarkKey({ snap }: { snap: CiSnapshot }) {
  return (
    <ul className={s.legend}>
      {snap.marks.map((m) => (
        <li key={m.n} data-read="">
          <MonoLabel dim={false}>#{m.n}</MonoLabel> {m.label}
          {m.t === null ? " (not yet)" : `, ${clock(snap, m.t)}`}
        </li>
      ))}
    </ul>
  );
}

export default function CiPage() {
  const snap = snapshot as unknown as CiSnapshot;
  const last = end(snap);
  const cut = cutoff(snap);
  const pts = flight(snap);
  const before = (key: "running" | "queued" | "mainQueued") => peak(pts, key, -Infinity, cut ?? Infinity);
  const ba = beforeAfter(snap);
  const afterReady = ba.after !== null;
  const after = (key: "running" | "queued" | "mainQueued") => (afterReady ? peak(pts, key, cut!, Infinity) : null);
  const waitBefore = mainWait(snap, -Infinity, cut ?? Infinity);
  const waitAfter = afterReady ? mainWait(snap, cut!, Infinity) : null;
  const hours = mergesPerHour(snap);
  const counts = hours.filter((h) => cut === null || h.t + 3600 <= cut).map((h) => h.count);
  const busiest = hours.reduce<(typeof hours)[number] | null>((b, h) => (!b || h.count > b.count ? h : b), null);
  const rateBefore = rate(hours, 0, cut ?? last);
  const rateAfter = afterReady ? rate(hours, cut!, last) : null;
  const mark = (n: number) => snap.marks.find((m) => m.n === n)?.t ?? null;
  const at673 = mark(673);
  const gh = (n: number, kind: "pull" | "issues" = "pull") => (
    <a href={`${snap.repo}/${kind}/${n}`} target="_blank" rel="noreferrer">
      #{n}
    </a>
  );
  const pending = cut === null ? <> ({gh(687)} isn&apos;t merged yet)</> : <> (the smoke-only checks need {AFTER_MIN_HOURS} hours of runs)</>;
  const mins = (v: number | null | undefined) => (v === null || v === undefined ? null : `${v} min`);
  const peakR = before("running");
  const peakQ = before("queued");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>HOW IT WORKS</h1>
        <Tabs current="/how/ci" />
        <p data-read="">How the browser checks jammed one night, how we measured it, and what we changed.</p>
        <p className={styles.dim} data-read="">
          From GitHub&apos;s run and PR records since <V k="since" v={asOf(snap.since)} />, frozen <V k="at" v={asOf(snap.at)} />.
        </p>
      </header>

      <section className={s.panel} data-visual="flight">
        <h2 className={styles.h2}>Runners: who got one, and who waited</h2>
        <Panel style={{ padding: 16 }}>
          <Beats
            broke={
              <>
                A full run&apos;s shard kept hitting the job time limit ({gh(673, "issues")}, opened <V k="at673" v={at673 === null ? null : clock(snap, at673)} />), and while main was red nothing else could merge.
              </>
            }
            measured={
              <>
                At <V k="peakRunningAt" v={peakR && clock(snap, peakR.t)} />, <V k="peakRunningBefore" v={peakR?.value} /> browser jobs ran at once and up to{" "}
                <V k="peakQueuedBefore" v={peakQ?.value} /> waited; main&apos;s own jobs waited up to <V k="mainWaitBefore" v={mins(waitBefore?.min)} /> for a runner.
              </>
            }
            changed={
              <>
                {gh(674)} balanced the shards by measured time, {gh(679)} let a run use up to 16 shards, and {gh(692)} with {gh(687)} cut a PR to one smoke check.
              </>
            }
            result={
              afterReady ? (
                <>
                  Since {gh(687)}: at most <V k="peakRunningAfter" v={after("running")?.value ?? 0} /> running, <V k="peakQueuedAfter" v={after("queued")?.value ?? 0} /> waiting, and main waited
                  up to <V k="mainWaitAfter" v={mins(waitAfter?.min ?? 0)} />.
                </>
              ) : (
                <>
                  <V k="flightAfter" v={MEASURING} />
                  {pending}.
                </>
              )
            }
          />
          <ul className={s.legend}>
            <li data-read="">
              <i style={{ background: "var(--pa-primary)" }} /> browser jobs running
            </li>
            <li data-read="">
              <i style={{ background: "var(--pa-secondary)" }} /> waiting for a runner
            </li>
            <li data-read="">
              <i style={{ background: "var(--pa-ink)", height: 3 }} /> main&apos;s jobs waiting
            </li>
          </ul>
          <Flight snap={snap} points={pts} peakRunning={peak(pts, "running")?.value ?? null} />
          <MarkKey snap={snap} />
        </Panel>
      </section>

      <section className={s.panel} data-visual="green">
        <h2 className={styles.h2}>A PR&apos;s time from push to green</h2>
        <Panel style={{ padding: 16 }}>
          <Beats
            broke={<>A change to shared code ran every browser check, so most PRs waited for the full suite.</>}
            measured={
              <>
                Before: <V k="greenBeforeN" v={ba.beforeStats?.n} /> green PR runs, a median of <V k="greenBeforeMedian" v={mins(ba.beforeStats?.median)} /> from push to green, the slowest{" "}
                <V k="greenBeforeMax" v={mins(ba.beforeStats?.max)} />.
              </>
            }
            changed={<>{gh(687)}: a PR runs one smoke check unless it changes the check runner or the workflow; the full suite runs on a schedule ({gh(692)}).</>}
            result={
              ba.afterStats ? (
                <>
                  After: <V k="greenAfterN" v={ba.afterStats.n} /> green PR runs, a median of <V k="greenAfterMedian" v={mins(ba.afterStats.median)} />, the slowest{" "}
                  <V k="greenAfterMax" v={mins(ba.afterStats.max)} />.
                </>
              ) : (
                <>
                  <V k="greenAfter" v={MEASURING} />
                  {pending}.
                </>
              )
            }
          />
          <div className={s.cells}>
            <DataCell label="Before · median" value={<V k="cellBefore" v={mins(ba.beforeStats?.median)} />} />
            <DataCell label="After · median" value={<V k="cellAfter" v={ba.afterStats ? mins(ba.afterStats.median) : MEASURING} />} tone={ba.afterStats ? undefined : "var(--pa-ink-dim)"} />
          </div>
          <Green snap={snap} runs={ba.before.concat(ba.after ?? [])} cut={cut} afterReady={afterReady} />
        </Panel>
      </section>

      <section className={s.panel} data-visual="merges">
        <h2 className={styles.h2}>Merges per hour</h2>
        <Panel style={{ padding: 16 }}>
          <Beats
            broke={<>The rule was: while main is red, merge nothing but the fix. A job timeout stopped every PR.</>}
            measured={
              <>
                Before: <V k="mergesMin" v={counts.length ? Math.min(...counts) : null} /> to <V k="mergesMax" v={counts.length ? Math.max(...counts) : null} /> PRs an hour, averaging{" "}
                <V k="rateBefore" v={rateBefore} />; the busiest hour was <V k="busiest" v={busiest && `${busiest.label} (${busiest.count})`} />.
              </>
            }
            changed={<>{gh(692)}: a red full run opens a ci-red issue instead of freezing merges.</>}
            result={
              afterReady ? (
                <>
                  Since {gh(687)}: <V k="rateAfter" v={rateAfter} /> PRs an hour on average.
                </>
              ) : (
                <>
                  <V k="mergesAfter" v={MEASURING} />
                  {pending}.
                </>
              )
            }
          />
          <Merges snap={snap} hours={hours} />
          <MarkKey snap={snap} />
        </Panel>
      </section>

      <details>
        <summary data-read="">The charts, as tables</summary>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Running</th>
              <th>Waiting</th>
              <th>Main waiting</th>
            </tr>
          </thead>
          <tbody>
            {pts
              .filter((p) => p.t % 1800 === 0)
              .map((p) => (
                <tr key={p.t}>
                  <td>{clock(snap, p.t)}</td>
                  <td>{p.running}</td>
                  <td>{p.queued}</td>
                  <td>{p.mainQueued}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <th>Hour</th>
              <th>Merged</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h.t}>
                <td>{h.label}</td>
                <td>{h.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <footer className={styles.footer}>
        <p data-read="">
          Data: web/src/how/ci-snapshot.json, written by <code>node web/src/how/ci-freeze.mjs</code> from GitHub. Times are New York time.
        </p>
      </footer>
    </main>
  );
}
