"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { validateChart, type Chart } from "../../contracts";
import { judgeTake } from "../../game/core/judge";
import { getSession } from "../../data/auth";
import { isConfigured } from "../../data/config";
import { takeRows, type NoteRow } from "../../data/mapping";
import { readOutbox } from "../../data/outbox";
import {
  barTrends,
  formatDuration,
  handSummary,
  judgmentMix,
  practiceDays,
  sessionsFrom,
  sessionSummary,
  songStats,
  streak,
  weakestBars,
  type BarTrendRow,
  type HandStatRow,
  type SessionRow,
} from "../../data/progress";
import { flushOutbox, signOutAfterSaving } from "../../data/save-plugin";
import { AccountChip } from "../auth/AccountChip";
import { useSession } from "../../data/useSession";
import { inputName, LearnerSwitch, useLearners } from "./LearnerSwitch";
import { AccuracyChart, HandsPanel, JudgmentBar, panel, panelTitle, PracticeCalendar, SongsTable, StatTile, tableStyle, td, th } from "./panels";

// The player's profile: headline numbers, accuracy over time, a practice calendar, every note's judgment, both
// hands, each song, and every session (when, how long, how it went). ?song=<id> narrows it all to one song and adds
// the bars to practice. From the account when signed in; from this browser's takes otherwise. ?as=synthetic-042 shows
// one of the 200 synthetic learners instead, from the server, without touching the signed-in session.

type Source = "account" | "device" | "synthetic";
interface ProfileData {
  sessions: SessionRow[];
  hands: HandStatRow[];
  bars: BarTrendRow[];
}

/** Fallback with no Supabase or no network: the same rows, from the takes saved in this browser. */
async function localData(songId: string | null): Promise<ProfileData> {
  const items = readOutbox(localStorage).filter((i) => !songId || i.take.chartId === songId);
  const charts = new Map<string, Chart | null>();
  const rows = [];
  const notes: NoteRow[] = [];
  for (const i of items) {
    if (!charts.has(i.take.chartId)) {
      const c = await fetch(`/songs/${i.take.chartId}/chart.json`).then((r) => (r.ok ? (r.json() as Promise<Chart>) : null), () => null);
      charts.set(i.take.chartId, c && !validateChart(c).length ? c : null);
    }
    const chart = charts.get(i.take.chartId);
    if (!chart) continue;
    const r = takeRows({ takeId: i.id, playerId: "local", chartSha256: "" }, chart, i.take, judgeTake(chart, i.take));
    rows.push({ take: { ...r.take, created_at: i.queuedAt }, notes: r.notes, title: chart.title, composer: chart.composer });
    notes.push(...r.notes);
  }
  const hands: HandStatRow[] = (["L", "R"] as const).flatMap((hand) => {
    const mine = notes.filter((n) => n.hand === hand);
    if (!mine.length) return [];
    const offs = mine.flatMap((n) => (n.offset_ms === null ? [] : [n.offset_ms]));
    const mean = offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : null;
    const spread = offs.length > 1 && mean !== null ? Math.sqrt(offs.reduce((a, x) => a + (x - mean) ** 2, 0) / (offs.length - 1)) : null;
    const count = (j: string) => mine.filter((n) => n.judgment === j).length;
    return [
      {
        song_id: "*",
        hand,
        notes: mine.length,
        perfect: count("PERFECT"),
        great: count("GREAT"),
        good: count("GOOD"),
        miss: count("MISS"),
        mean_offset_ms: mean === null ? null : Math.round(mean * 10) / 10,
        spread_ms: spread === null ? null : Math.round(spread * 10) / 10,
        mean_velocity: null,
      },
    ];
  });
  return { sessions: sessionsFrom(rows), hands, bars: songId ? barTrends(rows) : [] };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// useSearchParams needs a Suspense boundary on a client page, so the song can change without a reload.
export default function ProgressPageWithParams() {
  return (
    <Suspense fallback={null}>
      <ProgressPage />
    </Suspense>
  );
}

function ProgressPage() {
  const params = useSearchParams();
  const song = params.get("song");
  const as = params.get("as");
  const router = useRouter();
  const learners = useLearners();
  const learner = as ? learners?.find((l) => l.id === as) : undefined;
  // Every link on the page keeps the learner being shown.
  const progressHref = (songId?: string) => {
    const q = new URLSearchParams({ ...(songId && { song: songId }), ...(as && { as }) }).toString();
    return q ? `/progress?${q}` : "/progress";
  };
  // Whose data it is, so switching learners shows "Loading…" instead of the last one's numbers under a new name.
  const [loaded, setLoaded] = useState<{ as: string | null; data: ProfileData } | null>(null);
  const data = loaded && loaded.as === as ? loaded.data : null;
  const [source, setSource] = useState<Source>("device");
  const session = useSession();
  const player = session === undefined ? undefined : (session?.user_id ?? null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    if (as) {
      // A synthetic learner, read by the server. Never this browser's takes, and nothing here touches the session.
      (async () => {
        const q = `as=${encodeURIComponent(as)}${song ? `&song=${encodeURIComponent(song)}` : ""}`;
        try {
          const [prof, prog] = await Promise.all([fetch(`/api/progress?view=profile&${q}`), song ? fetch(`/api/progress?${q}`) : Promise.resolve(null)]);
          if (!prof.ok || (prog && !prog.ok)) throw new Error(String(prof.status));
          const p = (await prof.json()) as { sessions: SessionRow[]; hands: HandStatRow[] };
          const bars = prog ? ((await prog.json()) as { bars: BarTrendRow[] }).bars : [];
          if (!live) return;
          setLoaded({ as, data: { sessions: p.sessions, hands: p.hands, bars } });
          setSource("synthetic");
          setNote("");
        } catch {
          if (live) setNote(`${as}'s progress didn't load. Refresh to try again, or go back to your progress.`);
        }
      })();
      return () => {
        live = false;
      };
    }
    if (player === undefined) return; // still checking who's playing
    (async () => {
      await flushOutbox().catch(() => 0);
      const s = await getSession();
      if (!live) return;
      if (isConfigured() && s) {
        try {
          const auth = { headers: { Authorization: `Bearer ${s.access_token}` } };
          const q = song ? `&song=${encodeURIComponent(song)}` : "";
          const [prof, prog] = await Promise.all([
            fetch(`/api/progress?view=profile${q}`, auth),
            song ? fetch(`/api/progress?song=${encodeURIComponent(song)}`, auth) : Promise.resolve(null),
          ]);
          if (prof.ok && (!prog || prog.ok)) {
            const p = (await prof.json()) as { sessions: SessionRow[]; hands: HandStatRow[] };
            const bars = prog ? ((await prog.json()) as { bars: BarTrendRow[] }).bars : [];
            if (live) {
              setLoaded({ as: null, data: { sessions: p.sessions, hands: p.hands, bars } });
              setSource("account");
              setNote("");
            }
            return;
          }
        } catch {
          // offline: fall through to this browser's takes
        }
        // Saving isn't affected (takes wait in the outbox); only reading the account's history failed.
        if (live) setNote("Your account's history didn't load just now, so this shows the takes saved in this browser. Refresh to try again.");
      }
      const local = await localData(song);
      if (!live) return;
      setLoaded({ as: null, data: local });
      setSource("device");
    })();
    return () => {
      live = false;
    };
  }, [song, player, as]); // ?song= and ?as= change in place when a song, "all songs" or a learner is picked; sign-in or out reloads

  const google = Boolean(session && !session.is_anonymous);
  const mine = !as;
  const sessions = data?.sessions ?? null;
  const total = sessions ? sessionSummary(sessions) : null;
  const mix = data ? judgmentMix(data.hands) : null;
  const hands = data ? handSummary(data.hands) : [];
  const songs = sessions ? songStats(sessions) : [];
  const today = new Date();
  const days = sessions ? practiceDays(sessions, today) : [];
  const run = sessions ? streak(sessions, today) : 0;
  const bestCombo = sessions?.length ? Math.max(...sessions.map((r) => r.max_combo)) : 0;
  const bestAccuracy = sessions?.length ? Math.max(...sessions.map((r) => Number(r.accuracy))) : 0;
  const songTitle = song && sessions?.find((r) => r.song_id === song)?.title;
  const weak = weakestBars(data?.bars ?? []);
  const last = sessions?.[0];

  return (
    <main style={page}>
      <AccountChip />
      <Link href={song ? progressHref() : "/"} style={back}>
        {song ? "← All songs" : "← Menu"}
      </Link>
      {learners && (
        <LearnerSwitch learners={learners} as={as} onPick={(id) => router.push(id ? `/progress?as=${encodeURIComponent(id)}` : "/progress")} />
      )}
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 16px", margin: "10px 0 2px" }}>
        <h1 style={title}>{song ? (songTitle ?? song) : as ? as : google ? "Your profile" : "Your practice"}</h1>
        {last && !song && <span style={{ color: "var(--pa-ink-dim)" }}>last played {when(last.created_at)}</span>}
      </header>
      <p style={{ color: "var(--pa-ink-dim)", margin: "0 0 4px", minHeight: "1.6em" }}>
        {as ? (
          learner && (
            <>
              Started as {learner.level.toLowerCase()} · plays on {inputName(learner.input)}
              {learner.goals.length > 0 && ` · wants to play ${learner.goals.join(", ")}`}
            </>
          )
        ) : session === undefined ? null : google ? (
          <>
            Signed in with Google{session?.email ? ` as ${session.email}` : ""} · saved to your account
            <button style={plain} onClick={() => void signOutAfterSaving()} data-testid="progress-signout">
              Sign out
            </button>
          </>
        ) : (
          <>
            {source === "account" ? "Guest · saved to this browser's player" : "On this device"}
            {isConfigured() && (
              <Link href="/auth/login?next=/progress" style={linkButton} data-testid="progress-signin">
                Continue with Google
              </Link>
            )}
          </>
        )}
      </p>
      {note && (
        <p role="status" style={{ color: "var(--pa-gold)" }}>
          {note}
        </p>
      )}

      {!data && <p>Loading…</p>}

      {sessions && sessions.length === 0 && as && <p data-testid="no-takes">No takes are loaded for {as}.</p>}
      {sessions && sessions.length === 0 && mine && (
        <p data-testid="no-takes">
          No sessions yet.{" "}
          <Link href="/" style={{ color: "var(--pa-cyan)" }}>
            Pick a song
          </Link>{" "}
          and play it to the end: every finished take shows up here.
        </p>
      )}

      {sessions && total && total.sessions > 0 && mix && (
        <>
          <div style={tiles} data-testid="profile-totals">
            <StatTile label="Sessions" value={String(total.sessions)} />
            <StatTile label="Time played" value={formatDuration(total.totalMs)} />
            <StatTile label="Notes played" value={String(mix.notes)} sub={mix.hitRate === null ? undefined : `${(mix.hitRate * 100).toFixed(1)}% hit`} />
            {song ? <StatTile label="Best accuracy" value={`${(bestAccuracy * 100).toFixed(1)}%`} /> : <StatTile label="Songs" value={String(total.songs)} />}
            <StatTile label="Best rank" value={total.bestRank ?? "—"} />
            <StatTile label="Best combo" value={String(bestCombo)} />
            <StatTile label="Day streak" value={String(run)} sub={run === 1 ? "day" : "days in a row"} />
          </div>

          <div style={twoUp}>
            <AccuracyChart sessions={sessions} />
            <PracticeCalendar days={days} />
          </div>
          <div style={twoUp}>
            <JudgmentBar mix={mix} mine={mine} />
            <HandsPanel hands={hands} mine={mine} />
          </div>

          {song ? (
            <section style={{ ...panel, marginTop: 16 }}>
              <h2 style={panelTitle}>Bars to practice (last 5 takes)</h2>
              {weak.length === 0 ? (
                <p data-testid="weak-bars" style={{ margin: 0 }}>
                  No misses and steady timing in every bar. Nice.
                </p>
              ) : (
                <ul data-testid="weak-bars" style={{ margin: 0, paddingLeft: 18 }}>
                  {weak.map((b) => (
                    <li key={b.bar}>
                      Bar {b.bar}: {b.misses} of {b.notes} notes missed
                      {b.mean_offset_ms !== null && `, ${Math.abs(b.mean_offset_ms)} ms ${b.mean_offset_ms > 0 ? "late" : "early"} on average`}
                      {b.spread_ms !== null && `, spread ${b.spread_ms} ms`}
                    </li>
                  ))}
                </ul>
              )}
              {mine && (
                <Link href={`/play?song=${encodeURIComponent(song)}`} style={playButton}>
                  Play {songTitle ?? "it"} again
                </Link>
              )}
            </section>
          ) : (
            <div style={{ marginTop: 16 }}>
              <SongsTable songs={songs} mine={mine} songHref={progressHref} />
            </div>
          )}

          <section style={{ ...panel, marginTop: 16 }}>
            <h2 style={panelTitle}>Every session</h2>
            <div style={{ overflowX: "auto" }}>
              <table data-testid="take-history" style={tableStyle}>
                <thead>
                  <tr>
                    {["When", ...(song ? [] : ["Song"]), "Played for", "Rank", "Accuracy", "Perfect", "Great", "Good", "Miss", "Best combo", "Played on"].map((c) => (
                      <th key={c} style={th}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((r) => (
                    <tr key={r.take_id}>
                      <td style={td}>{when(r.created_at)}</td>
                      {!song && (
                        <td style={td}>
                          <Link href={progressHref(r.song_id)} style={{ color: "var(--pa-cyan)", textDecoration: "none" }}>
                            {r.title}
                          </Link>
                        </td>
                      )}
                      <td style={td}>{formatDuration(r.duration_ms)}</td>
                      <td style={{ ...td, fontWeight: 800, color: "var(--pa-gold)" }}>{r.rank}</td>
                      <td style={td}>{(Number(r.accuracy) * 100).toFixed(1)}%</td>
                      <td style={td}>{r.perfect}</td>
                      <td style={td}>{r.great}</td>
                      <td style={td}>{r.good}</td>
                      <td style={td}>{r.miss}</td>
                      <td style={td}>{r.max_combo}</td>
                      <td style={{ ...td, color: "var(--pa-ink-dim)" }}>{r.input_device === "midi" ? "piano" : "laptop keys"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

const display = "var(--pa-font-display), system-ui, sans-serif";
const page: React.CSSProperties = {
  padding: "28px clamp(16px, 4vw, 32px) 64px",
  minHeight: "100vh",
  background: "var(--pa-bg)",
  color: "var(--pa-ink)",
  fontFamily: "system-ui, sans-serif",
  maxWidth: 1280,
  margin: "0 auto",
};
const back: React.CSSProperties = { color: "var(--pa-ink-dim)", textDecoration: "none", fontSize: 14 };
const title: React.CSSProperties = { margin: 0, fontFamily: display, fontStyle: "italic", fontWeight: 900, fontSize: 40, textTransform: "uppercase", letterSpacing: 1 };
const tiles: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap: 12, marginTop: 20 };
const twoUp: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 16, marginTop: 16 };
const plain: React.CSSProperties = { marginLeft: 12, padding: 0, border: 0, background: "transparent", color: "var(--pa-ink-dim)", textDecoration: "underline", cursor: "pointer" };
const linkButton: React.CSSProperties = { marginLeft: 16, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--pa-cyan)", background: "transparent", color: "var(--pa-cyan)", cursor: "pointer", textDecoration: "none" };
const playButton: React.CSSProperties = {
  display: "inline-block",
  marginTop: 16,
  padding: "10px 18px",
  borderRadius: 8,
  background: "var(--pa-cyan)",
  color: "#000",
  fontFamily: display,
  fontStyle: "italic",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 1,
  textDecoration: "none",
};
