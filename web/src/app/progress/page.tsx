"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { validateChart, type Chart } from "../../contracts";
import { judgeTake } from "../../game/core/judge";
import { getSession, linkGoogle, signInWithGoogle, signOut, type Session } from "../../data/auth";
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
import { flushOutbox } from "../../data/save-plugin";
import { AccuracyChart, HandsPanel, JudgmentBar, panel, panelTitle, PracticeCalendar, SongsTable, StatTile, tableStyle, td, th } from "./panels";

// The player's profile: headline numbers, accuracy over time, a practice calendar, every note's judgment, both
// hands, each song, and every session (when, how long, how it went). ?song=<id> narrows it all to one song and adds
// the bars to practice. From the account when signed in; from this browser's takes otherwise.

type Source = "account" | "device";
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
  const song = useSearchParams().get("song");
  const [data, setData] = useState<ProfileData | null>(null);
  const [source, setSource] = useState<Source>("device");
  const [session, setSession] = useState<Session | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      await flushOutbox().catch(() => 0);
      const s = await getSession();
      if (!live) return;
      setSession(s);
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
              setData({ sessions: p.sessions, hands: p.hands, bars });
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
      if (live) setData(local);
    })();
    return () => {
      live = false;
    };
  }, [song]); // ?song= changes in place when a song or "all songs" is clicked

  const google = Boolean(session && !session.is_anonymous);
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
      <Link href={song ? "/progress" : "/"} style={back}>
        {song ? "← All songs" : "← Menu"}
      </Link>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 16px", margin: "10px 0 2px" }}>
        <h1 style={title}>{song ? (songTitle ?? song) : google ? "Your profile" : "Your practice"}</h1>
        {last && !song && <span style={{ color: "var(--pa-ink-dim)" }}>last played {when(last.created_at)}</span>}
      </header>
      <p style={{ color: "var(--pa-ink-dim)", margin: "0 0 4px" }}>
        {google ? (
          <>
            Signed in with Google{session?.email ? ` as ${session.email}` : ""} · saved to your account
            <button style={plain} onClick={() => void signOut().then(() => window.location.reload())}>
              Sign out
            </button>
          </>
        ) : (
          <>
            {source === "account" ? "Guest · saved to this browser's player" : "On this device"}
            {isConfigured() && (
              <>
                {session && (
                  <button style={linkButton} onClick={() => void linkGoogle().catch((e) => setNote(String(e.message ?? e)))}>
                    Keep my progress with Google
                  </button>
                )}
                <button style={plain} onClick={() => void signInWithGoogle()}>
                  Already have an account? Sign in with Google
                </button>
              </>
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

      {sessions && sessions.length === 0 && (
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
            <JudgmentBar mix={mix} />
            <HandsPanel hands={hands} />
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
              <Link href={`/play?song=${encodeURIComponent(song)}`} style={playButton}>
                Play {songTitle ?? "it"} again
              </Link>
            </section>
          ) : (
            <div style={{ marginTop: 16 }}>
              <SongsTable songs={songs} />
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
                          <Link href={`/progress?song=${encodeURIComponent(r.song_id)}`} style={{ color: "var(--pa-cyan)", textDecoration: "none" }}>
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
const linkButton: React.CSSProperties = { marginLeft: 16, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--pa-cyan)", background: "transparent", color: "var(--pa-cyan)", cursor: "pointer" };
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
