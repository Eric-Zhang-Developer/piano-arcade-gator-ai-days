"use client";

// /veritas's dashboard: the last real CI run, read from web/public/veritas/snapshot.json (freeze.mjs). Fetched from
// the page's own origin, so it works offline. Every null reads `unknown`, with what's missing; never a zero.
import { useEffect, useState } from "react";
import styles from "../app/veritas/veritas.module.css";

type Totals = { files: number | null; tests: number | null; passed: number | null; failed: number | null; skipped: number | null };
type Suite = { path: string; tests: number; passed: number; failed: number; skipped: number };
type Check = { check: string; result: string; seconds: number | null; knownRed: number | null };
export type Snapshot = {
  frozenAt: string;
  run: { id: number | null; url: string | null; sha: string | null; createdAt: string | null; conclusion: string | null };
  jobs: { name: string; conclusion: string | null }[] | null;
  unit: { source: "artifact" | "log"; totals: Totals; suites: Suite[] | null } | null;
  browser: Check[] | null;
  shots: { check: string; src: string }[] | null;
};

const URL_ = "/veritas/snapshot.json";
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }) + " ET" : null;
const short = (check: string) => check.replace(/^web\/(src\/)?/, "").replace(/\.mjs$/, "");

function V({ k, v }: { k: string; v: string | number | null | undefined }) {
  const s = v === null || v === undefined ? "unknown" : String(v);
  return (
    <span data-k={k} data-n={s} className={v === null || v === undefined ? styles.dim : styles.num}>
      {s}
    </span>
  );
}

function Missing({ what }: { what: string }) {
  return <p className={styles.dim}>unknown: CI didn&apos;t keep {what} for this run</p>;
}

export function Dashboard() {
  const [snap, setSnap] = useState<Snapshot | null | "none">(null);
  useEffect(() => {
    fetch(URL_)
      .then((r) => (r.ok ? r.json() : "none"))
      .then((s) => setSnap(s && s !== "none" && s.run ? s : "none"), () => setSnap("none"));
  }, []);

  if (snap === null) return <p className={styles.dim}>Loading the last CI run…</p>;
  if (snap === "none") return <p className={styles.dim}>No snapshot frozen yet: run node web/src/veritas/freeze.mjs</p>;

  const { run, jobs, unit, browser, shots } = snap;
  const folders = unit?.suites
    ? [...Map.groupBy(unit.suites, (s) => s.path.replace(/\/[^/]+$/, "/")).entries()].map(([folder, ss]) => ({
        folder,
        tests: ss.reduce((a, s) => a + s.tests, 0),
        failed: ss.reduce((a, s) => a + s.failed, 0),
      }))
    : null;
  return (
    <div className={styles.dash} data-dashboard="">
      <p>
        Run{" "}
        {run.url ? (
          <a href={run.url} target="_blank" rel="noreferrer">
            <V k="sha" v={run.sha?.slice(0, 7)} />
          </a>
        ) : (
          <V k="sha" v={run.sha?.slice(0, 7)} />
        )}{" "}
        on main, <V k="createdAt" v={when(run.createdAt)} />: <V k="conclusion" v={run.conclusion} />.{" "}
        <span className={styles.dim}>Frozen {when(snap.frozenAt)}.</span>
      </p>
      {jobs && (
        <ul className={styles.jobs}>
          {jobs.map((j) => (
            <li key={j.name}>
              {j.name}: <V k={`job:${j.name}`} v={j.conclusion} />
            </li>
          ))}
        </ul>
      )}

      <h3 className={styles.h3}>Unit tests</h3>
      {unit ? (
        <p data-unit="">
          <V k="unitPassed" v={unit.totals.passed} /> passed, <V k="unitFailed" v={unit.totals.failed} /> failed,{" "}
          <V k="unitSkipped" v={unit.totals.skipped} /> skipped, of <V k="unitTests" v={unit.totals.tests} /> tests in{" "}
          <V k="unitFiles" v={unit.totals.files} /> files.
        </p>
      ) : (
        <Missing what="unit results" />
      )}
      {unit && !folders && <Missing what="per-suite results (totals are from the log)" />}
      {folders && (
        <ul className={styles.suites}>
          {folders.map((f) => (
            <li key={f.folder} data-result={f.failed ? "fail" : "pass"}>
              <span className={f.failed ? styles.fail : styles.pass}>{f.failed ? "FAIL" : "pass"}</span> {f.folder} · {f.tests} tests
            </li>
          ))}
        </ul>
      )}

      <h3 className={styles.h3}>Browser checks</h3>
      {browser ? (
        <table className={styles.checks}>
          <tbody>
            {browser.map((c) => (
              <tr key={c.check}>
                <td>{short(c.check)}</td>
                <td className={c.result === "FAIL" ? styles.fail : styles.pass}>
                  {c.result}
                  {c.knownRed ? ` (known red #${c.knownRed})` : ""}
                </td>
                <td>{c.seconds === null ? "unknown" : `${c.seconds} s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Missing what="browser check results" />
      )}

      <h3 className={styles.h3}>Screenshots</h3>
      {shots?.length ? (
        <div className={styles.shots}>
          {shots.map((s) => (
            <figure key={s.check}>
              {/* eslint-disable-next-line @next/next/no-img-element -- committed evidence files, shown as they are */}
              <img src={s.src} alt={`${short(s.check)}, as the check saw it`} loading="lazy" />
              <figcaption>{short(s.check)}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <Missing what="screenshots" />
      )}
    </div>
  );
}
