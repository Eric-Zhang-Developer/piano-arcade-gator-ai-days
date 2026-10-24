"use client";
import { Home } from "../../game/navigation/Home";

// The arcade's operator menu: what needs a person, who's working, and the bookkeeping. LIVE polls /api/operator
// (development only); SNAPSHOT (?snapshot, or any production build) reads only the frozen file.
import { useEffect, useState } from "react";
import type { Board, Ci, Heartbeat, State } from "../../operator/board";
import styles from "./operator.module.css";

const REFETCH_MS = 15_000;
const FRESH_MIN = 10; // a heartbeat this recent means the worker ran
const SNAPSHOT_URL = "/operator/snapshot.json";

const STATE_GLYPH: Record<State, string> = {
  done: "✔", "in flight": "▶", ready: "○", blocked: "■", backlog: "…", cut: "✂", unknown: "?",
};
const CI_TEXT: Record<Ci, string> = { pass: "● CI pass", fail: "✖ CI fail", pending: "◐ CI running", none: "○ no CI" };

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 60 ? `${s} s ago` : `${duration(s / 60)} ago`;
}

function duration(min: number): string {
  const m = Math.round(min);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

// Enough of the shape to render: an old or hand-edited snapshot shows a banner, never a crash.
function isBoard(b: unknown): b is Board {
  const x = b as Board | null;
  return (
    !!x && typeof x.at === "string" && !!x.gh && Array.isArray(x.banner) && Array.isArray(x.features) &&
    Array.isArray(x.needs) && Array.isArray(x.needsUnknown) && (x.crew === null || Array.isArray(x.crew)) &&
    !!x.books && Array.isArray(x.books.milestones)
  );
}

const clock = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", second: "2-digit" });

export default function OperatorPage() {
  const [mode, setMode] = useState<"LIVE" | "SNAPSHOT" | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [note, setNote] = useState(""); // why there's no (fresh) board
  const [frozen, setFrozen] = useState(""); // the last freeze's result; polls don't clear it
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const snap = new URLSearchParams(window.location.search).has("snapshot");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const loadSnapshot = async () => {
      const r = await fetch(SNAPSHOT_URL, { cache: "no-store" }).catch(() => null);
      if (stopped) return;
      setMode("SNAPSHOT");
      if (!r?.ok) return setNote("No snapshot frozen yet: run pnpm dev, open /operator and press Freeze snapshot.");
      const b = await r.json().catch(() => null);
      if (isBoard(b)) setBoard(b);
      else setNote("The snapshot file isn't a board this page can read: freeze a new one.");
    };
    const loadLive = async () => {
      const r = await fetch("/api/operator", { cache: "no-store" }).catch(() => null);
      if (stopped) return;
      if (r?.status === 404) return loadSnapshot(); // a production build has no live data
      setMode("LIVE");
      const b = r?.ok ? await r.json().catch(() => null) : null;
      if (stopped) return;
      if (isBoard(b)) {
        setBoard(b);
        setFetchedAt(Date.now());
        setNote("");
      } else setNote(`Live fetch failed (${r ? `HTTP ${r.status}` : "server unreachable"}); showing the last board.`);
      timer = setTimeout(loadLive, REFETCH_MS);
    };
    if (snap) loadSnapshot();
    else loadLive();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !["1", "2", "3"].includes(e.key)) return;
      const el = document.getElementById(`screen-${e.key}`);
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
      el?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function freeze() {
    setFrozen("Freezing…");
    const r = await fetch("/api/operator/snapshot", { method: "POST" }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setFrozen(j ? `Snapshot frozen at ${clock(j.at)} (${j.sha}) → web/public/operator/snapshot.json. Commit it for judges.` : "Freeze failed.");
  }

  const gh = board ? (board.gh.status === "ok" ? `gh: ok · ${board.gh.calls} calls` : `gh: ${board.gh.status}`) : "";
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Home />
        <div className={styles.titleRow}>
          <h1 className={styles.title}>OPERATOR MODE</h1>
          <a className={styles.attract} href={`/attract${mode === "SNAPSHOT" ? "?snapshot" : ""}`}>ATTRACT MODE ▶</a>
        </div>
        {mode && (
          <p className={styles.meta}>
            <span className={mode === "LIVE" ? styles.live : styles.snapshot}>{mode === "LIVE" ? "● LIVE" : "❄ SNAPSHOT"}</span>
            {board && (
              <>
                <span>data {clock(board.at)} ({ago(board.at, now)})</span>
                {mode === "LIVE" && fetchedAt > 0 && <span>fetched {ago(new Date(fetchedAt).toISOString(), now)}</span>}
                <span>
                  files {board.sha}
                  {board.mainSha && board.mainSha !== board.sha ? ` · main ${board.mainSha}` : ""}
                </span>
                <span className={board.gh.status === "ok" ? undefined : styles.warn}>{gh}</span>
              </>
            )}
            {mode === "LIVE" && board && (
              <button className={styles.freeze} onClick={freeze}>
                ❄ Freeze snapshot
              </button>
            )}
          </p>
        )}
        <nav className={styles.keys} aria-label="Screens">
          <a href="#screen-1">[1] Needs a person</a>
          <a href="#screen-2">[2] Crew</a>
          <a href="#screen-3">[3] Bookkeeping</a>
        </nav>
      </header>

      {(note || frozen || board?.banner.length) && (
        <div className={styles.banner} role="status">
          {board?.banner.map((b) => <p key={b}>⚠ {b}</p>)}
          {note && <p>{note}</p>}
          {frozen && <p>❄ {frozen}</p>}
        </div>
      )}

      {board && <Totals board={board} />}
      {!board && !note && <p className={styles.loading}>INSERT COIN… loading the books</p>}
      {board && (
        <>
          <Needs board={board} />
          <Crew board={board} heartbeats={mode === "LIVE" ? board.heartbeats : null} now={now} />
          <Books board={board} />
        </>
      )}
    </main>
  );
}

// The cabinet's coin counter: the four numbers worth a glance before reading anything else.
function Totals({ board }: { board: Board }) {
  const ms = board.books.milestones; // planned = in a milestone, as the bookkeeping counts it
  const planned = ms.reduce((n, m) => n + m.planned, 0);
  const done = ms.reduce((n, m) => n + m.done, 0);
  const flying = board.features.filter((f) => f.state === "in flight").length;
  const merged = board.books.mergedByType?.reduce((n, [, k]) => n + k, 0);
  const waiting = board.needs.length;
  const cells: [string, string][] = [
    ["NEEDS A PERSON", board.needsUnknown.length ? `${waiting}+?` : String(waiting)],
    ["FEATURES DONE", ms.length ? `${done} / ${planned}` : "?"],
    ["IN FLIGHT", board.crew === null ? "?" : String(flying)],
    ["PRS MERGED", merged === undefined ? "?" : String(merged)],
  ];
  return (
    <dl className={styles.totals}>
      {cells.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Screen({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={`screen-${n}`} className={styles.screen} tabIndex={-1} aria-labelledby={`screen-${n}-title`}>
      <h2 id={`screen-${n}-title`} className={styles.screenTitle}>
        <span className={styles.screenKey}>{n}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function Needs({ board }: { board: Board }) {
  return (
    <Screen n={1} title="NEEDS A PERSON">
      {board.needs.length === 0 && board.needsUnknown.length === 0 && <p className={styles.empty}>✔ nothing waiting</p>}
      <ul className={styles.list}>
        {board.needs.map((n) => (
          <li key={`${n.kind}${n.text}`} className={styles.need}>
            <span className={styles.tag}>{n.kind}</span>{" "}
            {n.url ? (
              <a href={n.url} target="_blank" rel="noreferrer">
                {n.text} ↗
              </a>
            ) : (
              n.text
            )}
          </li>
        ))}
        {board.needsUnknown.map((u) => (
          <li key={u} className={styles.need}>
            <span className={styles.tag}>? unknown</span> {u}: no data, check GitHub
          </li>
        ))}
      </ul>
    </Screen>
  );
}

function Crew({ board, heartbeats, now }: { board: Board; heartbeats: Heartbeat[] | null; now: number }) {
  const fresh = (w: string) => {
    const beat = heartbeats?.find((h) => h.worker === w);
    return !!beat && now - Date.parse(beat.at) < FRESH_MIN * 60_000;
  };
  const busy = (w: string) => !!board.crew?.find((c) => c.worker === w)?.prs.length;
  const rank = (w: string) => (busy(w) ? 0 : fresh(w) ? 1 : 2); // open PRs first, then whoever just ran
  const names = [...new Set([...(board.crew ?? []).map((c) => c.worker), ...(heartbeats ?? []).map((h) => h.worker)])].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  );
  return (
    <Screen n={2} title="CREW">
      {board.crew === null && <p className={styles.empty}>? open PRs unknown (no GitHub data)</p>}
      {board.crew?.length === 0 && !heartbeats?.length && <p className={styles.empty}>nobody has an open PR</p>}
      <div className={styles.crew}>
        {names.map((w) => {
          const prs = board.crew?.find((c) => c.worker === w)?.prs ?? [];
          const beat = heartbeats?.find((h) => h.worker === w);
          return (
            <div key={w} className={styles.worker}>
              <div className={styles.workerHead}>
                <span className={styles.workerName}>{w}</span>
                {heartbeats && (
                  <span className={fresh(w) ? styles.fresh : styles.idle}>
                    {beat ? (fresh(w) ? `● ran ${ago(beat.at, now)}` : `○ idle · last ${ago(beat.at, now)}`) : "○ no heartbeat"}
                  </span>
                )}
              </div>
              {board.crew === null ? (
                <p className={styles.dim}>? open PRs unknown</p>
              ) : (
                prs.length === 0 && <p className={styles.dim}>no open PRs</p>
              )}
              <ul className={styles.list}>
                {prs.map((p) => (
                  <li key={p.number}>
                    <span className={styles[`ci_${p.ci}`]}>{CI_TEXT[p.ci]}</span>{" "}
                    <a href={p.url} target="_blank" rel="noreferrer">
                      #{p.number} {p.title}
                    </a>
                    {p.isDraft && <span className={styles.dim}> · draft</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

function Books({ board }: { board: Board }) {
  const { books } = board;
  const backlog = board.features.filter((f) => !f.milestone);
  const rows = [
    ...books.milestones.map((m) => ({ ...m, features: board.features.filter((f) => f.milestone === m.name) })),
    ...(backlog.length ? [{ name: books.milestones.length ? "backlog" : "milestones unknown", done: NaN, planned: NaN, cut: 0, features: backlog }] : []),
  ];
  return (
    <Screen n={3} title="BOOKKEEPING">
      <table className={styles.table}>
        <caption className={styles.caption}>Features done of planned, per milestone</caption>
        <thead>
          <tr>
            <th scope="col">Milestone</th>
            <th scope="col" className={styles.num}>Done</th>
            <th scope="col">Features</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.name}>
              <th scope="row">{m.name}</th>
              <td className={styles.num}>
                {Number.isNaN(m.done) ? "—" : `${m.done} / ${m.planned}`}
                {m.planned > 0 && (
                  <span className={styles.meter} aria-hidden="true">
                    {Array.from({ length: m.planned }, (_, k) => (
                      <span key={k} className={k < m.done ? styles.pip : styles.pipEmpty} />
                    ))}
                  </span>
                )}
                {m.cut > 0 && <span className={styles.dim}> ({m.cut} cut)</span>}
              </td>
              <td>
                {m.features.map((f) => {
                  const cls = `${styles.chip} ${styles[`st_${f.state.replace(" ", "_")}`]}`;
                  const label = `${STATE_GLYPH[f.state]} ${f.slug}`;
                  return f.pr ? (
                    <a key={f.slug} className={cls} href={f.pr} target="_blank" rel="noreferrer" title={`${f.name} · ${f.state}: open its PR`}>
                      {label}
                    </a>
                  ) : (
                    <span key={f.slug} className={cls} title={`${f.name} · ${f.state}`}>
                      {label}
                    </span>
                  );
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.legend}>
        {(Object.keys(STATE_GLYPH) as State[]).map((s) => (
          <span key={s}>
            {STATE_GLYPH[s]} {s}
          </span>
        ))}
      </p>

      <table className={styles.table}>
        <caption className={styles.caption}>Pull requests</caption>
        <tbody>
          <tr>
            <th scope="row">Merged, by type</th>
            <td className={styles.num}>
              {books.mergedByType ? books.mergedByType.map(([t, n]) => `${t} ${n}`).join(" · ") || "none yet" : "unknown"}
            </td>
          </tr>
          <tr>
            <th scope="row">Median open → merge</th>
            <td className={styles.num}>{books.medianMergeMin === null ? "unknown" : duration(books.medianMergeMin)}</td>
          </tr>
          <tr>
            <th scope="row">Longest builds</th>
            <td>
              {books.longest === null
                ? "unknown"
                : books.longest.length === 0
                  ? "none yet"
                  : books.longest.map((l) => (
                      <div key={l.number}>
                        <span className={styles.num}>{duration(l.minutes)}</span>{" "}
                        <a href={l.url} target="_blank" rel="noreferrer">
                          #{l.number} {l.title}
                        </a>
                      </div>
                    ))}
            </td>
          </tr>
          <tr>
            <th scope="row">Song requests</th>
            <td>
              {!books.songRequests
                ? "unknown"
                : books.songRequests.length === 0
                  ? "none yet"
                  : books.songRequests.map((r) => (
                      <div key={`${r.issue}-${r.pr}`}>
                        <a href={r.url} target="_blank" rel="noreferrer">
                          song request #{r.issue}
                        </a>
                        : <span className={styles.num}>{r.minutes}</span> min from issue to merge
                      </div>
                    ))}
            </td>
          </tr>
          <tr>
            <th scope="row">First PR</th>
            <td className={styles.num}>{books.firstPrAt ? clock(books.firstPrAt) : "unknown"}</td>
          </tr>
        </tbody>
      </table>
    </Screen>
  );
}
