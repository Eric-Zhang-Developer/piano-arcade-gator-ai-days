// /how: how the agents built Piano Arcade, the process not the game, for the judges. A server component: every
// number is read from the operator snapshot, git and the repo's files (web/src/how/read.ts), never typed in.
import type { Metadata } from "next";
import { KIND_LABEL, KINDS, ROLES, howData } from "../../how/data";
import { kindLegend, Life, Lanes, Time, V, Who } from "../../how/diagrams";
import { readInputs } from "../../how/read";
import { Tabs } from "../../how/tabs";
import styles from "../../how/how.module.css";

export const metadata: Metadata = { title: "How it works · Piano Arcade" };

const at = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }) + " ET" : null;

export default function HowPage() {
  const d = howData(readInputs());
  const gh = (n: number, kind: "pull" | "issues" = "pull") =>
    d.repo ? (
      <a href={`${d.repo}/${kind}/${n}`} target="_blank" rel="noreferrer">
        #{n}
      </a>
    ) : (
      <>#{n}</>
    );
  const workers = [ROLES.asking.name, ROLES.planning.name, ...ROLES.workers.names, ROLES.foreman.name];
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>HOW IT WORKS</h1>
        <Tabs current="/how" />
        <p data-read="">This page is about how Piano Arcade was built (the process), not the game.</p>
        <p className={styles.dim} data-read="">
          Data as of <V k="at" v={at(d.at)} /> · main <V k="mainSha" v={d.mainSha} />
        </p>
      </header>

      <section className={styles.intro}>
        <p data-read="">
          Everything runs on one laptop as separate Claude Code sessions: Eric, an agent he talks to, a planner, a crew of
          workers, and a foreman. Each is its own session with its own job.
        </p>
        <p data-read="">
          GitHub is the shared memory. Specs, milestones and the rules are files on <code>origin/main</code>; work moves
          through issues and pull requests, and a feature is done only when its done note is on main.
        </p>
        <p data-read="">No agent trusts chat or its own memory: each run starts by reading main again.</p>
      </section>

      <figure className={styles.figure} data-visual="who">
        <h2 className={styles.h2}>Who does what</h2>
        <Who d={d} />
        {d.others.length > 0 && (
          <p data-read="">
            other: {d.others.map(([w, n], i) => (
              <span key={w}>
                {i ? ", " : ""}
                {w} <V k={`worker:${w}`} v={n} />
              </span>
            ))}
          </p>
        )}
        <div className={styles.lanes}>
          {d.lanes.map((l) => (
            <div key={l.lane} className={styles.lane}>
              <strong data-read="">{l.person}</strong>
              <span className={styles.dim} data-read="">
                {l.lane}
              </span>
              <code data-read="">{l.folders.join(", ")}</code>
            </div>
          ))}
        </div>
        <figcaption data-read="">Each box counts the PRs merged under that name (the PR&apos;s Worker: line).</figcaption>
        <details>
          <summary data-read="">Who does what, as a list</summary>
          <ul>
            <li>
              {ROLES.eric.name}: {ROLES.eric.job}
            </li>
            {workers.map((w) => (
              <li key={w}>
                {w}: {w === ROLES.asking.name ? ROLES.asking.job : w === ROLES.planning.name ? ROLES.planning.job : w === ROLES.foreman.name ? ROLES.foreman.job : ROLES.workers.job}
                {(ROLES.workers.standby as readonly string[]).includes(w) ? " (standby)" : ""}. Merged: {d.byWorker ? (d.byWorker.get(w) ?? 0) : "unknown"}
              </li>
            ))}
            {d.others.map(([w, n]) => (
              <li key={w}>
                other, {w}: merged {n}
              </li>
            ))}
            {d.lanes.map((l) => (
              <li key={l.lane}>
                Lane {l.lane}: {l.person}, {l.folders.join(", ")}
              </li>
            ))}
          </ul>
        </details>
      </figure>

      <figure className={styles.figure} data-visual="life">
        <h2 className={styles.h2}>A feature&apos;s life</h2>
        <Life d={d} />
        <figcaption data-read="">Today&apos;s features at each stage, from the snapshot. The bracket is the median time a PR stays open.</figcaption>
        <details>
          <summary data-read="">A feature&apos;s life, as a list</summary>
          <ol>
            <li>idea → issue → spec (backlog: {d.stages?.backlog ?? "unknown"})</li>
            <li>ready (ready: {d.stages?.ready ?? "unknown"}, blocked: {d.stages?.blocked ?? "unknown"})</li>
            <li>draft-PR claim (in flight: {d.stages?.inFlight ?? "unknown"})</li>
            <li>checks: ci, browser → done note → merge (done: {d.stages?.done ?? "unknown"})</li>
            <li>median open to merge: {d.medianMergeMin === null ? "unknown" : `${d.medianMergeMin} min`}</li>
          </ol>
        </details>
      </figure>

      <figure className={styles.figure} data-visual="lanes">
        <h2 className={styles.h2}>The repo, by lines of code</h2>
        <Lanes d={d} />
        <figcaption data-read="">Each folder under web/src/, with the owner from CODEOWNERS or AGENTS.md&apos;s Lanes table.</figcaption>
        <details>
          <summary data-read="">Lines per folder, as a table</summary>
          <table>
            <thead>
              <tr>
                <th>Folder</th>
                <th>Lines</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {(d.folders ?? []).map((f) => (
                <tr key={f.folder}>
                  <td>{f.folder}</td>
                  <td>{f.lines}</td>
                  <td>{f.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figure>

      <figure className={styles.figure} data-visual="time">
        <h2 className={styles.h2}>The build over time</h2>
        <ul className={styles.legend}>
          {kindLegend.map((l) => (
            <li key={l.k} data-read="">
              <i style={{ background: l.color }} /> {l.label}
            </li>
          ))}
        </ul>
        <Time d={d} />
        <figcaption data-read="">
          Merges per hour (New York time). <V k="totalMerged" v={d.totalMerged} /> merged in all; the busiest hour was{" "}
          <V k="busiest" v={d.busiest ? `${d.busiest.label} (${d.busiest.total})` : null} />.
        </figcaption>
        <p data-read="">
          <a href="/attract?snapshot">Watch the build replayed: ATTRACT MODE ▶</a>
        </p>
        <details>
          <summary data-read="">Merges per hour, as a table</summary>
          <table>
            <thead>
              <tr>
                <th>Hour</th>
                {KINDS.map((k) => (
                  <th key={k}>{KIND_LABEL[k]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.hours ?? []).map((h) => (
                <tr key={h.at}>
                  <td>{h.label}</td>
                  {KINDS.map((k) => (
                    <td key={k}>{h.counts[k]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figure>

      <section className={styles.incidents} data-incidents="">
        <h2 className={styles.h2}>What went wrong and what we changed</h2>
        <article>
          <h3 data-read="">Parallel merges turned main red</h3>
          <p data-read="">
            {gh(387)} and {gh(391)} merged <V k="gapSec" v={d.incident?.gapSec} /> s apart, so neither PR&apos;s checks ran with the other
            in place, and main stayed red until {gh(397)} merged <V k="fixMin" v={d.incident?.fixMin} /> min later (incident{" "}
            {gh(396, "issues")}). What we changed: {gh(397)} fixed the test.
          </p>
        </article>
        <article>
          <h3 data-read="">A stale playtest</h3>
          <p data-read="">
            A long-running dev server served an old build, and nothing on screen said so. What we changed: a build stamp (
            {gh(422, "issues")}, state: <V k="buildStamp" v={d.buildStamp} />) and the rule that agents read state from a fresh{" "}
            <code>origin/main</code> ({gh(425)}).
          </p>
        </article>
        <article>
          <h3 data-read="">The browser checks moved to GitHub</h3>
          <p data-read="">
            {gh(407, "issues")} (state: <V k="ciBrowser" v={d.ciBrowser} />): the first run ({gh(433)}) found{" "}
            <V k="knownRedFirst" v={d.knownRedFirst} /> checks already red on main. They run but don&apos;t gate, each with its issue; today{" "}
            <V k="knownRedNow" v={d.knownRedNow} /> remain.
          </p>
        </article>
      </section>

      <footer className={styles.footer}>
        <p data-read="">
          Data: web/public/operator/snapshot.json, git and the repo&apos;s own files, read when this page was built.{" "}
          {d.repo && (
            <a href={d.repo} target="_blank" rel="noreferrer">
              The source on GitHub
            </a>
          )}
        </p>
      </footer>
    </main>
  );
}
