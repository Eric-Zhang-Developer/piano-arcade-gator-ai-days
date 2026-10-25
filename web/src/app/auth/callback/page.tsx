"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHandle, fetchUserDetails, greetingName, nameSkipped, rememberNameSkipped, saveHandle, suggestName } from "../../../data/account";
import { finishRedirect, getSession, takeNext } from "../../../data/auth";
import { NamePrompt, WelcomeScreen } from "./Welcome";

// Google sends the player back here after "Keep my progress" or "Sign in with Google". The session arrives in the URL
// hash. Then: "Name" the first time (no handle yet, not skipped on this device), "Welcome, Name" every time, and on
// to where sign-in started (the menu by default). In development, ?preview=name or ?preview=welcome shows a screen
// without signing in.

type Step =
  | { kind: "signing" }
  | { kind: "error"; message: string }
  | { kind: "name"; userId: string; suggestion: string }
  | { kind: "welcome"; name: string; holdMs?: number };

export default function AuthCallback() {
  const [step, setStep] = useState<Step>({ kind: "signing" });
  const go = useCallback(() => window.location.replace(takeNext()), []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const preview = process.env.NODE_ENV !== "production" ? q.get("preview") : null;
    void (async () => {
      if (preview) {
        const name = q.get("name") ?? "Sharan";
        const holdMs = Number(q.get("hold")) || undefined; // preview only: keep the welcome up to look at it
        return setStep(preview === "name" ? { kind: "name", userId: "preview", suggestion: name } : { kind: "welcome", name, holdMs });
      }
      const err = await finishRedirect(window.location.hash);
      if (err === "redirecting") return; // on to Google sign-in
      if (err) return setStep({ kind: "error", message: err });
      const s = await getSession();
      if (!s || s.is_anonymous) return go();
      const [handle, details] = await Promise.all([fetchHandle(s), fetchUserDetails(s)]);
      if (handle === null && !nameSkipped(s.user_id)) {
        return setStep({ kind: "name", userId: s.user_id, suggestion: suggestName(details) });
      }
      setStep({ kind: "welcome", name: greetingName(handle, details ?? { name: null, email: s.email ?? null }) });
    })();
  }, [go]);

  if (step.kind === "name") {
    return (
      <NamePrompt
        suggestion={step.suggestion}
        onSave={async (name) => {
          if (step.userId === "preview") {
            setStep({ kind: "welcome", name });
            return null;
          }
          const r = await saveHandle(name);
          if (!r.ok) return r.reason;
          setStep({ kind: "welcome", name: r.handle });
          return null;
        }}
        onSkip={() => {
          if (step.userId !== "preview") rememberNameSkipped(step.userId);
          setStep({ kind: "welcome", name: step.suggestion || "player" });
        }}
      />
    );
  }
  if (step.kind === "welcome") return <WelcomeScreen name={step.name} onDone={go} holdMs={step.holdMs} />;
  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", color: "#eee", background: "#0b0b10", minHeight: "100vh" }}>
      {step.kind === "error" ? <p role="alert">Sign-in didn&apos;t finish: {step.message}</p> : <p>Signing you in…</p>}
    </main>
  );
}
