"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { validateChart, type Chart } from "../../contracts";
import { judgeTake } from "../../game/core/judge";
import { getSession, linkGoogle, signInWithGoogle, signOut, type Session } from "../../data/auth";
import { isConfigured } from "../../data/config";
import { takeRows } from "../../data/mapping";
import { readOutbox } from "../../data/outbox";
import {
  barTrends,
  formatDuration,
  sessionsFrom,
  sessionSummary,
  weakestBars,
  type BarTrendRow,
  type SessionRow,
} from "../../data/progress";
import { flushOutbox } from "../../data/save-plugin";

// The player's profile: every session they've played (when, how long, how it went), totals, and for one song
// (?song=<id>) the bars to practice. From the account when signed in; from this device's takes otherwise.

type Source = "account" | "device";

/** Fallback with no Supabase or no network: the same rows, from the takes queued on this device. */
async function localData(songId: string | null): Promise<{ sessions: SessionRow[]; bars: BarTrendRow[] }> {
  const items = readOutbox(localStorage).filter((i) => !songId || i.take.chartId === songId);
  const charts = new Map<string, Chart | null>();
  const rows = [];
  for (const i of items) {
    if (!charts.has(i.take.chartId)) {
      const c = await fetch(`/songs/${i.take.chartId}/chart.json`).then((r) => (r.ok ? (r.json() as Promise<Chart>) : null), () => null);
      charts.set(i.take.chartId, c && !validateChart(c).length ? c : null);
    }
    const chart = charts.get(i.take.chartId);
    if (!chart) continue;
    const r = takeRows({ takeId: i.id, playerId: "local", chartSha256: "" }, chart, i.take, judgeTake(chart, i.take));
    rows.push({ take: { ...r.take, created_at: i.queuedAt }, notes: r.notes, title: chart.title, composer: chart.composer });
  }
  return { sessions: sessionsFrom(rows), bars: songId ? barTrends(rows) : [] };
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
  const [songId, setSongId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [bars, setBars] = useState<BarTrendRow[]>([]);
  const [source, setSource] = useState<Source>("device");
  const [session, setSession] = useState<Session | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      await flushOutbox().catch(() => 0);
      if (live) setSongId(song);
      const s = await getSession();
      if (!live) return;
      setSession(s);
      if (isConfigured() && s) {
        try {
          const auth = { headers: { Authorization: `Bearer ${s.access_token}` } };
          const q = song ? `&song=${encodeURIComponent(song)}` : "";
          const [list, prog] = await Promise.all([
            fetch(`/api/progress?view=sessions${q}`, auth),
            song ? fetch(`/api/progress?song=${encodeURIComponent(song)}`, auth) : Promise.resolve(null),
          ]);
          if (list.ok && (!prog || prog.ok)) {
            const rows = ((await list.json()) as { sessions: SessionRow[] }).sessions;
            const trend = prog ? ((await prog.json()) as { bars: BarTrendRow[] }).bars : [];
            if (live) {
              setSessions(rows);
              setBars(trend);
              setSource("account");
            }
            return;
          }
        } catch {
          // offline: fall through to this device's takes
        }
        // Saving isn't affected (takes wait in the outbox); only reading the account's history failed.
        if (live) setNote("Your account's history didn't load just now, so this shows the takes saved in this browser. Refresh to try again.");
      }
      const local = await localData(song);
      if (live) {
        setSessions(local.sessions);
        setBars(local.bars);
      }
    })();
    return () => {
      live = false;
    };
  }, [song]); // ?song= changes in place when a song or "all songs" is clicked

  const google = Boolean(session && !session.is_anonymous);
  const total = sessions ? sessionSummary(sessions) : null;
  const weak = weakestBars(bars);
  const songTitle = songId && sessions?.find((r) => r.song_id === songId)?.title;

  return (
    <main style={page}>
      <Link href="/" style={back}>
        ← Menu
      </Link>
      <h1 style={title}>{google ? "Your profile" : "Your practice"}</h1>
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

      {!sessions && <p>Loading…</p>}

      {total && total.sessions > 0 && (
        <div style={tiles} data-testid="profile-totals">
          <Tile label="Sessions" value={String(total.sessions)} />
          <Tile label="Time played" value={formatDuration(total.totalMs)} />
          <Tile label={songId ? "Song" : "Songs"} value={songId ? songTitle ?? songId : String(total.songs)} />
          <Tile label="Best rank" value={total.bestRank ?? "—"} />
        </div>
      )}

      {sessions && sessions.length === 0 && (
        <p data-testid="no-takes">
          No sessions yet.{" "}
          <Link href="/" style={{ color: "var(--pa-cyan)" }}>
            Pick a song
          </Link>{" "}
          and play it to the end: every finished take shows up here.
        </p>
      )}

      {sessions && sessions.length > 0 && (
        <>
          <h2 style={h2}>
            {songId ? `Sessions: ${songTitle ?? songId}` : "Every session"}
            {songId && (
              <Link href="/progress" style={{ ...plainLink, marginLeft: 12 }}>
                all songs
              </Link>
            )}
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table data-testid="take-history" style={table}>
              <thead>
                <tr>
                  <th style={th}>When</th>
                  {!songId && <th style={th}>Song</th>}
                  <th style={th}>Played for</th>
                  <th style={th}>Rank</th>
                  <th style={th}>Accuracy</th>
                  <th style={th}>Perfect</th>
                  <th style={th}>Great</th>
                  <th style={th}>Good</th>
                  <th style={th}>Miss</th>
                  <th style={th}>Best combo</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((r) => (
                  <tr key={r.take_id}>
                    <td style={td}>{when(r.created_at)}</td>
                    {!songId && (
                      <td style={td}>
                        <Link href={`/progress?song=${encodeURIComponent(r.song_id)}`} style={plainLink}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {songId && (
            <>
              <h2 style={h2}>Bars to practice (last 5 takes)</h2>
              {weak.length === 0 ? (
                <p data-testid="weak-bars">No misses and steady timing in every bar. Nice.</p>
              ) : (
                <ul data-testid="weak-bars">
                  {weak.map((b) => (
                    <li key={b.bar}>
                      Bar {b.bar}: {b.misses} of {b.notes} notes missed
                      {b.mean_offset_ms !== null && `, ${Math.abs(b.mean_offset_ms)} ms ${b.mean_offset_ms > 0 ? "late" : "early"} on average`}
                      {b.spread_ms !== null && `, spread ${b.spread_ms} ms`}
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/play?song=${encodeURIComponent(songId)}`} style={playButton}>
                Play {songTitle ?? "it"} again
              </Link>
            </>
          )}
        </>
      )}
    </main>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={tile}>
      <div style={tileLabel}>{label}</div>
      <div style={{ ...tileValue, fontSize: value.length > 10 ? 18 : 28 }} title={value}>
        {value}
      </div>
    </div>
  );
}

const display = "var(--pa-font-display), system-ui, sans-serif";
const page: React.CSSProperties = { padding: "28px 32px 64px", minHeight: "100vh", background: "var(--pa-bg)", color: "var(--pa-ink)", fontFamily: "system-ui, sans-serif" };
const back: React.CSSProperties = { color: "var(--pa-ink-dim)", textDecoration: "none", fontSize: 14 };
const title: React.CSSProperties = { margin: "10px 0 4px", fontFamily: display, fontStyle: "italic", fontWeight: 900, fontSize: 40, textTransform: "uppercase", letterSpacing: 1 };
const h2: React.CSSProperties = { fontFamily: display, fontStyle: "italic", fontWeight: 800, fontSize: 20, textTransform: "uppercase", letterSpacing: 1, margin: "32px 0 10px" };
const tiles: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 20, maxWidth: 820 };
const tile: React.CSSProperties = { padding: "12px 16px", background: "var(--pa-panel)", border: "1px solid rgba(242,242,245,0.18)", borderRadius: 8 };
const tileLabel: React.CSSProperties = { fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--pa-ink-dim)" };
const tileValue: React.CSSProperties = { fontFamily: display, fontStyle: "italic", fontWeight: 900, fontSize: 28, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const table: React.CSSProperties = { borderCollapse: "collapse", fontVariantNumeric: "tabular-nums", minWidth: 640 };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 18px 6px 0", color: "var(--pa-ink-dim)", fontWeight: 500, fontSize: 13, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "7px 18px 7px 0", borderTop: "1px solid rgba(242,242,245,0.08)", whiteSpace: "nowrap" };
const plainLink: React.CSSProperties = { color: "var(--pa-cyan)", textDecoration: "none", fontFamily: "system-ui, sans-serif", fontStyle: "normal", fontWeight: 500, fontSize: 14, textTransform: "none", letterSpacing: 0 };
const plain: React.CSSProperties = { marginLeft: 12, padding: 0, border: 0, background: "transparent", color: "var(--pa-ink-dim)", textDecoration: "underline", cursor: "pointer" };
const linkButton: React.CSSProperties = { marginLeft: 16, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--pa-cyan)", background: "transparent", color: "var(--pa-cyan)", cursor: "pointer" };
const playButton: React.CSSProperties = { display: "inline-block", marginTop: 20, padding: "10px 18px", borderRadius: 8, background: "var(--pa-cyan)", color: "#000", fontFamily: display, fontStyle: "italic", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, textDecoration: "none" };
