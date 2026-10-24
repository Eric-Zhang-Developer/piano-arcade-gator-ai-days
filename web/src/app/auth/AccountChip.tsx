"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchHandle, fetchUserDetails } from "../../data/account";
import { googleSession, signOut, type Session } from "../../data/auth";
import { isConfigured } from "../../data/config";

// Who's playing, for a menu corner: "Sign in" for guests, or the Google player (their handle, else their Google
// name, else their email's name) linking to the account page, with progress and sign-out.
// One line to mount (`<AccountChip />`); it hides itself when Supabase isn't configured and in capture mode.
export function AccountChip() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    void googleSession().then(async (s) => {
      setSession(s);
      if (!s) return;
      const [handle, details] = await Promise.all([fetchHandle(s), fetchUserDetails(s)]);
      setLabel(handle || details?.name || null);
    });
  }, []);
  if (!isConfigured() || session === undefined) return null;

  return (
    <div data-capture-hide data-testid="account-chip" style={chip}>
      {session ? (
        <>
          <span style={{ color: "var(--pa-cyan)" }}>●</span>
          <Link href="/auth/login" style={name} title={session.email}>
            {label ?? session.email?.split("@")[0] ?? "Signed in"}
          </Link>
          <Link href="/progress" style={item}>
            Progress
          </Link>
          <button style={item} onClick={() => void signOut().then(() => setSession(null))}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <Link href="/auth/login" style={{ ...item, color: "var(--pa-ink)" }}>
            Sign in
          </Link>
          <Link href="/progress" style={item}>
            Progress
          </Link>
        </>
      )}
    </div>
  );
}

const chip: React.CSSProperties = {
  position: "fixed",
  right: 24,
  bottom: 24,
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "6px 14px",
  background: "var(--pa-panel)",
  border: "1px solid rgba(242,242,245,0.18)",
  borderRadius: 6,
  color: "var(--pa-ink)",
  fontFamily: "var(--pa-font-display), system-ui, sans-serif",
  fontStyle: "italic",
  fontWeight: 800,
  fontSize: 16,
  letterSpacing: 1,
  textTransform: "uppercase",
};
const name: React.CSSProperties = { maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "none", color: "var(--pa-ink)", textDecoration: "none" };
const item: React.CSSProperties = {
  border: 0,
  padding: 0,
  background: "transparent",
  color: "var(--pa-ink-dim)",
  font: "inherit",
  letterSpacing: "inherit",
  textTransform: "inherit",
  textDecoration: "none",
  cursor: "pointer",
};
