"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fetchHandle, fetchUserDetails, takeHello } from "../../data/account";
import { isConfigured } from "../../data/config";
import { signOutAfterSaving } from "../../data/save-plugin";
import { useSession } from "../../data/useSession";
import { signInLights } from "./lights";

// The profile button, top right: "Sign in" for guests, or the Google player's avatar (else their initial). Click it
// for who's signed in, Progress, Account and Sign out. Right after a sign-in it says hi for a moment and the LED strip
// sweeps once (lights.ts). It follows the one session (useSession), so signing in or out anywhere updates it.
// Square like every button here (globals.css).
// One line to mount (`<AccountChip />`); it hides itself when Supabase isn't configured and in capture mode.
// The sign-in greeting, read once per page load. Kept here, not in the effect, because React runs a dev effect twice
// and the second run would find it already taken.
let greeting: string | null | undefined;
let greeted = false;

export function AccountChip() {
  const any = useSession();
  const session = any === undefined ? undefined : any && !any.is_anonymous ? any : null;
  const [who, setWho] = useState<{ id: string; label: string | null; avatar: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [hello, setHello] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const me = session && who?.id === session.user_id ? who : null;
  const label = me?.label ?? session?.email?.split("@")[0] ?? "Profile";

  useEffect(() => {
    if (!session) return;
    let live = true;
    void Promise.all([fetchHandle(session), fetchUserDetails(session)]).then(([handle, details]) => {
      if (live) setWho({ id: session.user_id, label: handle || details?.name || null, avatar: details?.avatarUrl ?? null });
    });
    return () => {
      live = false;
    };
  }, [session?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps -- a refreshed token is the same player

  // Once, after sign-in: "Hi, Name" beside the button and a sweep on the lights.
  useEffect(() => {
    greeting ??= takeHello();
    const name = greeting;
    if (!name) return;
    if (!greeted) signInLights();
    greeted = true;
    const show = setTimeout(() => setHello(name), 0);
    const hide = setTimeout(() => {
      greeting = null;
      setHello(null);
    }, 2800);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", away);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", away);
    };
  }, [open]);

  if (!isConfigured() || session === undefined) return null;

  if (!session) {
    return (
      <div data-capture-hide data-testid="account-chip" style={corner}>
        <Link href="/auth/login" style={pill} data-testid="account-signin">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div data-capture-hide data-testid="account-chip" style={corner} ref={box}>
      <span aria-live="polite" style={{ ...bubble, opacity: hello ? 1 : 0, transform: hello ? "none" : "translateX(6px)" }}>
        {hello && <>Hi, {hello}</>}
      </span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`${label}: profile menu`}
        title={label}
        style={{ ...avatar, boxShadow: hello ? "0 0 0 2px var(--pa-cyan), 0 0 18px var(--pa-cyan)" : avatar.boxShadow }}
        data-testid="account-profile"
      >
        {me?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google's avatar host, sized here; no image pipeline
          <img src={me.avatar} alt="" width={32} height={32} referrerPolicy="no-referrer" style={{ width: "100%", height: "100%" }} />
        ) : (
          label.slice(0, 1).toUpperCase()
        )}
      </button>
      {open && (
        <div role="menu" style={menu} data-testid="account-menu">
          <div style={{ padding: "10px 14px 8px" }}>
            <div style={{ fontWeight: 700, color: "var(--pa-ink)", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
            {session.email && <div style={{ fontSize: 12, color: "var(--pa-ink-dim)", overflow: "hidden", textOverflow: "ellipsis" }}>{session.email}</div>}
          </div>
          <Link role="menuitem" href="/progress" style={row} onClick={() => setOpen(false)}>
            Progress
          </Link>
          <Link role="menuitem" href="/auth/login" style={row} onClick={() => setOpen(false)}>
            Account
          </Link>
          <button role="menuitem" type="button" style={row} onClick={() => void signOutAfterSaving().then(() => setOpen(false))} data-testid="account-signout">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const corner: React.CSSProperties = {
  position: "fixed",
  top: 32,
  right: 24,
  zIndex: 41,
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
};
const pill: React.CSSProperties = {
  padding: "6px 14px",
  border: "1px solid rgba(242,242,245,0.25)",
  borderRadius: 999,
  color: "var(--pa-ink)",
  textDecoration: "none",
  background: "rgba(10,10,16,0.6)",
};
const avatar: React.CSSProperties = {
  width: 34,
  height: 34,
  padding: 0,
  border: 0,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, var(--pa-magenta), var(--pa-cyan))",
  color: "#0b0b10",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 0 0 1px rgba(242,242,245,0.25)",
  transition: "box-shadow 300ms ease-out",
};
const bubble: React.CSSProperties = {
  color: "var(--pa-ink)",
  whiteSpace: "nowrap",
  transition: "opacity 300ms ease-out, transform 300ms ease-out",
  pointerEvents: "none",
};
const menu: React.CSSProperties = {
  position: "absolute",
  top: 42,
  right: 0,
  minWidth: 200,
  maxWidth: 260,
  padding: "4px 0",
  background: "var(--pa-panel, #111118)",
  border: "1px solid rgba(242,242,245,0.16)",
  borderRadius: 8,
  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
};
const row: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 14px",
  border: 0,
  background: "transparent",
  color: "var(--pa-ink-dim)",
  font: "inherit",
  textAlign: "left",
  textDecoration: "none",
  cursor: "pointer",
};
