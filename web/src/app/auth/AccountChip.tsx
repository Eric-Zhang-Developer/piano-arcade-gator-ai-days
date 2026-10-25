"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchHandle, fetchUserDetails } from "../../data/account";
import { isConfigured } from "../../data/config";
import { signOutAfterSaving } from "../../data/save-plugin";
import { useSession } from "../../data/useSession";

// Who's playing, for a menu corner: "Sign in" for guests, or the Google player (their handle, else their Google
// name, else their email's name; click it for the profile: every session, when and for how long) with History and
// Sign out. It follows the one session (useSession), so signing in or out anywhere updates it.
// One line to mount (`<AccountChip />`); it hides itself when Supabase isn't configured and in capture mode.
export function AccountChip() {
  const any = useSession();
  const session = any === undefined ? undefined : any && !any.is_anonymous ? any : null;
  const [named, setNamed] = useState<{ id: string; label: string | null } | null>(null); // whose label it is
  const label = session && named?.id === session.user_id ? named.label : null;
  useEffect(() => {
    if (!session) return;
    let live = true;
    void Promise.all([fetchHandle(session), fetchUserDetails(session)]).then(([handle, details]) => {
      if (live) setNamed({ id: session.user_id, label: handle || details?.name || null });
    });
    return () => {
      live = false;
    };
  }, [session?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps -- a refreshed token is the same player
  if (!isConfigured() || session === undefined) return null;

  return (
    <div data-capture-hide data-testid="account-chip" style={chip}>
      {session ? (
        <>
          <span style={{ color: "var(--pa-cyan)" }}>●</span>
          <Link href="/progress" style={{ ...item, ...name, color: "var(--pa-ink)" }} title={`${session.email ?? ""}: your profile`} data-testid="account-profile">
            {label ?? session.email?.split("@")[0] ?? "Profile"}
          </Link>
          <Link href="/progress" style={item}>
            History
          </Link>
          <button style={item} onClick={() => void signOutAfterSaving()}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <Link href="/auth/login" style={{ ...item, color: "var(--pa-ink)" }}>
            Sign in
          </Link>
          <Link href="/progress" style={item}>
            History
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
