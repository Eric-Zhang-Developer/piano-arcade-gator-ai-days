"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { googleSession, safeNext, signInWithGoogle, signOut, type Session } from "../../../data/auth";
import { isConfigured } from "../../../data/config";

// The front door: sign in with Google so your takes follow you, or play as a guest (takes still save, on this
// device's player). Either way the next stop is the menu, or the page in ?next=. Optional: the game never requires it.
export default function Login() {
  const [next, setNext] = useState("/");
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = still checking
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const target = safeNext(new URLSearchParams(window.location.search).get("next"));
    void googleSession().then((s) => {
      setNext(target);
      setSession(s);
    });
  }, []);

  const signIn = () => {
    setBusy(true);
    void signInWithGoogle(next).catch((e) => {
      setBusy(false);
      setError(String(e?.message ?? e));
    });
  };

  return (
    <main style={page}>
      <div style={card}>
        <h1 style={title}>Piano Arcade</h1>
        {session === undefined ? (
          <p style={dim}>Checking…</p>
        ) : session ? (
          <>
            <p style={lead} data-testid="login-signed-in">
              Signed in{session.email ? ` as ${session.email}` : ""}
            </p>
            <Link href={next} style={primary}>
              Continue
            </Link>
            <button style={link} onClick={() => void signOut().then(() => setSession(null))}>
              Not you? Sign out
            </button>
          </>
        ) : (
          <>
            <p style={lead}>Sign in to keep your scores and progress on any computer.</p>
            {isConfigured() ? (
              <button style={primary} onClick={signIn} disabled={busy} data-testid="login-google">
                {busy ? "Opening Google…" : "Sign in with Google"}
              </button>
            ) : (
              <p style={dim}>Sign-in isn&apos;t set up on this computer.</p>
            )}
            <Link href={next} style={secondary} data-testid="login-guest">
              Play as guest
            </Link>
            <p style={dim}>Guests&apos; takes stay with this browser. Sign in later and they come with you.</p>
          </>
        )}
        {error && (
          <p role="alert" style={{ ...dim, color: "var(--pa-magenta)" }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "radial-gradient(ellipse at 50% 110%, rgba(255,47,208,0.28), transparent 60%), var(--pa-bg)",
  color: "var(--pa-ink)",
  fontFamily: "system-ui, sans-serif",
};
const card: React.CSSProperties = {
  width: "min(420px, 100%)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "36px 32px",
  background: "var(--pa-panel)",
  border: "1px solid rgba(242,242,245,0.18)",
  borderRadius: 12,
  textAlign: "center",
};
const title: React.CSSProperties = {
  margin: "0 0 4px",
  fontFamily: "var(--pa-font-display), system-ui, sans-serif",
  fontStyle: "italic",
  fontWeight: 900,
  fontSize: 44,
  textTransform: "uppercase",
  letterSpacing: 1,
};
const lead: React.CSSProperties = { margin: "0 0 8px", fontSize: 17 };
const dim: React.CSSProperties = { margin: 0, fontSize: 13, color: "var(--pa-ink-dim)" };
const button: React.CSSProperties = {
  display: "block",
  padding: "12px 16px",
  borderRadius: 8,
  fontFamily: "var(--pa-font-display), system-ui, sans-serif",
  fontStyle: "italic",
  fontWeight: 800,
  fontSize: 18,
  letterSpacing: 1,
  textTransform: "uppercase",
  textDecoration: "none",
  cursor: "pointer",
};
const primary: React.CSSProperties = { ...button, border: 0, background: "var(--pa-cyan)", color: "#000" };
const secondary: React.CSSProperties = { ...button, border: "1px solid rgba(242,242,245,0.35)", background: "transparent", color: "var(--pa-ink)" };
const link: React.CSSProperties = { border: 0, background: "transparent", color: "var(--pa-ink-dim)", textDecoration: "underline", cursor: "pointer", fontSize: 13 };
