"use client";

import { useEffect, useState } from "react";
import { validateChart, type Chart } from "../../contracts";
import { judgeTake } from "../../game/core/judge";
import { getSession, linkGoogle, signInWithGoogle, signOut, type Session } from "../../data/auth";
import { isConfigured } from "../../data/config";
import { takeRows } from "../../data/mapping";
import { readOutbox } from "../../data/outbox";
import { barTrends, takeHistory, weakestBars, type Progress } from "../../data/progress";
import { flushOutbox } from "../../data/save-plugin";

type Source = "account" | "device";

/** Fallback with no Supabase or no network: the same numbers, from the takes queued on this device. */
async function localProgress(songId: string): Promise<Progress> {
  const items = readOutbox(localStorage).filter((i) => i.take.chartId === songId);
  if (!items.length) return { history: [], bars: [] };
  const chart = (await (await fetch(`/songs/${songId}/chart.json`)).json()) as Chart;
  if (validateChart(chart).length) return { history: [], bars: [] };
  const rows = items.map((i) => {
    const r = takeRows({ takeId: i.id, playerId: "local", chartSha256: "" }, chart, i.take, judgeTake(chart, i.take));
    return { take: { ...r.take, created_at: i.queuedAt }, notes: r.notes };
  });
  return { history: takeHistory(rows), bars: barTrends(rows) };
}

export default function ProgressPage() {
  const [songId, setSongId] = useState("twinkle");
  const [data, setData] = useState<Progress | null>(null);
  const [source, setSource] = useState<Source>("device");
  const [session, setSession] = useState<Session | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const song = new URLSearchParams(window.location.search).get("song") ?? "twinkle";
    let live = true;
    (async () => {
      await flushOutbox().catch(() => 0);
      if (live) setSongId(song);
      const s = await getSession();
      if (!live) return;
      setSession(s);
      if (isConfigured() && s) {
        try {
          const res = await fetch(`/api/progress?song=${encodeURIComponent(song)}`, {
            headers: { Authorization: `Bearer ${s.access_token}` },
          });
          if (res.ok) {
            const p = (await res.json()) as Progress;
            if (live) {
              setData(p);
              setSource("account");
            }
            return;
          }
        } catch {
          // offline: fall through to this device's takes
        }
        if (live) setNote("Couldn't reach the server, so this shows the takes saved on this device.");
      }
      const p = await localProgress(song);
      if (live) setData(p);
    })();
    return () => {
      live = false;
    };
  }, []);

  const weak = data ? weakestBars(data.bars) : [];
  return (
    <main style={page}>
      <h1 style={{ margin: "0 0 4px" }}>Your progress</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>
        {songId} · {source === "account" ? "saved to your account" : "on this device"}
        {isConfigured() && (!session || session.is_anonymous) && (
          <>
            {session && (
              <button style={linkButton} onClick={() => void linkGoogle().catch((e) => setNote(String(e.message ?? e)))}>
                Keep my progress with Google
              </button>
            )}
            <button style={plainButton} onClick={() => void signInWithGoogle()}>
              Already have an account? Sign in with Google
            </button>
          </>
        )}
        {session && !session.is_anonymous && (
          <span data-testid="signed-in" style={{ marginLeft: 16 }}>
            Signed in with Google{session.email ? ` as ${session.email}` : ""}
            <button style={plainButton} onClick={() => void signOut().then(() => window.location.reload())}>
              Sign out
            </button>
          </span>
        )}
      </p>
      {note && <p role="status" style={{ opacity: 0.8 }}>{note}</p>}
      {!data && <p>Loading…</p>}
      {data && data.history.length === 0 && (
        <p data-testid="no-takes">
          No takes yet. <a href={`/play`} style={{ color: "#5ef2c4" }}>Play a song</a> and your takes show up here.
        </p>
      )}
      {data && data.history.length > 0 && (
        <>
          <h2 style={h2}>Every take</h2>
          <table data-testid="take-history" style={table}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>When</th>
                <th style={th}>Accuracy</th>
                <th style={th}>Rank</th>
                <th style={th}>Misses</th>
                <th style={th}>Avg timing off (ms)</th>
                <th style={th}>Timing spread (ms)</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((t, i) => (
                <tr key={t.take_id}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{new Date(t.created_at).toLocaleString()}</td>
                  <td style={td}>{(Number(t.accuracy) * 100).toFixed(1)}%</td>
                  <td style={td}>{t.rank}</td>
                  <td style={td}>{t.miss}</td>
                  <td style={td}>{t.mean_abs_offset_ms ?? "—"}</td>
                  <td style={td}>{t.spread_ms ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
        </>
      )}
    </main>
  );
}

const page: React.CSSProperties = { padding: 32, minHeight: "100vh", background: "#0b0b10", color: "#eee", fontFamily: "system-ui, sans-serif" };
const h2: React.CSSProperties = { fontSize: 18, marginTop: 32 };
const table: React.CSSProperties = { borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 16px 6px 0", opacity: 0.7, fontWeight: 500 };
const td: React.CSSProperties = { padding: "6px 16px 6px 0" };
const plainButton: React.CSSProperties = { marginLeft: 12, padding: 0, border: 0, background: "transparent", color: "#9aa", textDecoration: "underline", cursor: "pointer" };
const linkButton: React.CSSProperties = { marginLeft: 16, padding: "4px 12px", borderRadius: 6, border: "1px solid #5ef2c4", background: "transparent", color: "#5ef2c4", cursor: "pointer" };
