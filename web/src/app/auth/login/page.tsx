"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { SelectStage } from "@/game/select-stage";
import { fetchHandle, fetchUserDetails, HANDLE_MAX, saveHandle, type UserDetails } from "../../../data/account";
import { linkGoogle, safeNext, signInWithGoogle, type Session } from "../../../data/auth";
import { isConfigured } from "../../../data/config";
import { signOutAfterSaving } from "../../../data/save-plugin";
import { useSession } from "../../../data/useSession";
import styles from "./login.module.css";

// The front door, optional: sign in with Google so your takes follow you, or play as a guest (takes still save, on
// this device's anonymous player). A guest who has played can set a handle and keep their progress by linking Google;
// a Google player sees their name, email and avatar as Google gives them. Then the menu, or the page in ?next=.

// Real lines, each from the file named next to it.
const QUOTES = [
  { text: "yup it worked!", who: "Eric, the first time the laptop played the piano (docs/story.md)" },
  { text: "much much better", who: "Eric, after the piano started playing drums (specs/context/findings.md)" },
  { text: "it feels a lot better", who: "Eric, same playtest (specs/context/findings.md)" },
];
const LINES = QUOTES.map((q) => q.text);

const reducedMotion = (onChange: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
};

// Types a line out, holds it, then moves to the next. Reduced motion shows each line whole.
function useTypewriter(lines: string[]) {
  const still = useSyncExternalStore(
    reducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const line = lines[i];
  useEffect(() => {
    const done = still || n >= line.length;
    const t = setTimeout(
      () => {
        if (done) {
          setI((i + 1) % lines.length);
          setN(0);
        } else setN(n + 1);
      },
      done ? 3200 : 70,
    );
    return () => clearTimeout(t);
  }, [i, n, line, lines.length, still]);
  return { shown: still ? line : line.slice(0, n), index: i };
}

const noSubscribe = () => () => {};
const nextFromUrl = () => safeNext(new URLSearchParams(window.location.search).get("next"));

type View = { kind: "checking" } | { kind: "none" } | { kind: "guest"; session: Session } | { kind: "google"; session: Session };

export default function Login() {
  const next = useSyncExternalStore(noSubscribe, nextFromUrl, () => "/");
  const session = useSession();
  const view: View =
    session === undefined ? { kind: "checking" } : !session ? { kind: "none" } : session.is_anonymous ? { kind: "guest", session } : { kind: "google", session };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const quote = useTypewriter(LINES);


  const toGoogle = (go: (next: string) => Promise<void>) => () => {
    setBusy(true);
    void go(next).catch((e) => {
      setBusy(false);
      setError(String(e?.message ?? e));
    });
  };

  return (
    <main className={styles.page}>
      <SelectStage />

      <section className={styles.form}>
        <Link href="/" className={styles.wordmark}>
          Piano Arcade
        </Link>

        <div className={styles.inner}>
          {view.kind === "checking" ? (
            <p className={styles.sub}>Checking…</p>
          ) : view.kind === "google" ? (
            <SignedIn session={view.session} next={next} />
          ) : (
            <>
              <div className={styles.head}>
                <h1 className={styles.title}>Player 1</h1>
                <p className={styles.sub}>
                  {view.kind === "guest" ? "Your scores are saving to this browser." : "Your scores save either way."}
                </p>
              </div>

              {isConfigured() && (
                <button
                  type="button"
                  className={`${styles.play} ${styles.withMark}`}
                  onClick={toGoogle(view.kind === "guest" ? linkGoogle : signInWithGoogle)}
                  disabled={busy}
                  data-testid="login-google"
                >
                  <GoogleMark />
                  {busy ? "Opening Google…" : "Continue with Google"}
                </button>
              )}
              <Link className={styles.google} href={next} data-testid="login-guest">
                {view.kind === "guest" ? "Keep playing as guest" : "Play as guest"}
              </Link>
              <p className={styles.note}>
                {isConfigured()
                  ? "Google keeps your scores on every computer. Anything you played as a guest comes with you."
                  : "Sign-in isn’t set up on this computer."}
              </p>
            </>
          )}
          {error && (
            <p role="alert" className={styles.refused}>
              {error}
            </p>
          )}
        </div>
      </section>

      <aside className={styles.visual} aria-label="Quotes from our playtests">
        <blockquote className={styles.quote}>
          <p>
            &ldquo;{quote.shown}
            <span className={styles.cursor} aria-hidden="true">
              |
            </span>
            &rdquo;
          </p>
          <cite>— {QUOTES[quote.index].who}</cite>
        </blockquote>
      </aside>
    </main>
  );
}

function SignedIn({ session, next }: { session: Session; next: string }) {
  const [details, setDetails] = useState<UserDetails | null | undefined>(undefined); // undefined = loading
  useEffect(() => {
    void fetchUserDetails(session).then(setDetails);
  }, [session.user_id]); // eslint-disable-line react-hooks/exhaustive-deps -- a refreshed token is the same player

  return (
    <>
      <div className={styles.profile} data-testid="login-signed-in">
        {details?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google's avatar host, sized here; no image pipeline
          <img className={styles.avatar} src={details.avatarUrl} alt="" referrerPolicy="no-referrer" width={72} height={72} />
        ) : (
          <span className={styles.avatar} aria-hidden="true" />
        )}
        <div className={styles.who}>
          <span className={styles.label}>Signed in with Google</span>
          <strong className={styles.name} data-testid="login-name">
            {details === undefined ? "…" : (details?.name ?? <span className={styles.empty}>No name from Google</span>)}
          </strong>
          <span className={styles.email} data-testid="login-email">
            {details === undefined ? "" : (details?.email ?? session.email ?? <span className={styles.empty}>No email from Google</span>)}
          </span>
        </div>
      </div>
      {details === null && <p className={styles.note}>Couldn&apos;t read your Google details right now.</p>}

      <HandleEntry session={session} />

      <Link className={styles.play} href={next} data-testid="login-continue">
        Continue
      </Link>
      <div className={styles.links}>
        <Link href="/progress">My progress</Link>
        <button type="button" className={styles.textButton} onClick={() => void signOutAfterSaving()} data-testid="login-signout">
          Sign out
        </button>
      </div>
    </>
  );
}

type Status = { kind: "idle" | "saving" | "saved" } | { kind: "refused"; reason: string };

function HandleEntry({ session }: { session: Session }) {
  const [stored, setStored] = useState<string | null | undefined>(undefined); // undefined = loading or unreadable
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    void fetchHandle(session).then((h) => {
      setStored(h);
      if (h) setValue(h);
    });
  }, [session.user_id]); // eslint-disable-line react-hooks/exhaustive-deps -- a refreshed token is the same player

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ kind: "saving" });
    void saveHandle(value).then((r) => {
      if (r.ok) {
        setStored(r.handle);
        setValue(r.handle);
        setStatus({ kind: "saved" });
      } else setStatus({ kind: "refused", reason: r.reason });
    });
  };

  return (
    <form className={styles.handle} onSubmit={submit}>
      <label className={styles.label} htmlFor="handle">
        Your handle
      </label>
      <div className={styles.handleRow}>
        <input
          id="handle"
          className={styles.handleInput}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus({ kind: "idle" });
          }}
          maxLength={HANDLE_MAX + 8 /* room to type past the limit and be told why */}
          autoComplete="nickname"
          spellCheck={false}
          data-testid="handle-input"
        />
        <button type="submit" className={styles.save} disabled={status.kind === "saving" || value.trim() === (stored ?? "")} data-testid="handle-save">
          {status.kind === "saving" ? "…" : "Save"}
        </button>
      </div>
      <p className={status.kind === "refused" ? styles.refused : styles.status} role="status" data-testid="handle-status">
        {status.kind === "refused"
          ? status.reason
          : status.kind === "saved"
            ? "Saved"
            : stored
              ? "Shown on your account instead of your name"
              : `Up to ${HANDLE_MAX} letters, numbers, spaces or _`}
      </p>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#ffc107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#ff3d00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4caf50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976d2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
