"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchHandle, fetchUserDetails, greetingName, nameSkipped, rememberHello, rememberNameSkipped, saveHandle, suggestName } from "../../../data/account";
import { finishRedirect, getSession, signInWithGoogle, takeNext } from "../../../data/auth";
import { NamePrompt } from "./Welcome";

// Google sends the player back here after "Keep my progress" or "Sign in with Google". The session arrives in the URL
// hash. Then: "Name" the first time (no handle yet, not skipped on this device), and straight on to where sign-in
// started (the menu by default), where the profile button says hi and the lights sweep once. In development,
// ?preview=name shows the Name screen without signing in.

type Step =
  | { kind: "signing" }
  | { kind: "error"; message: string }
  | { kind: "name"; userId: string; suggestion: string };

export default function AuthCallback() {
  const [step, setStep] = useState<Step>({ kind: "signing" });
  const go = useCallback(() => window.location.replace(takeNext()), []);
  const hello = useCallback(
    (name: string) => {
      rememberHello(name);
      go();
    },
    [go],
  );

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const preview = process.env.NODE_ENV !== "production" ? q.get("preview") : null;
    void (async () => {
      if (preview) {
        return setStep({ kind: "name", userId: "preview", suggestion: q.get("name") ?? "Sharan" });
      }
      const err = await finishRedirect(window.location.hash, window.location.search);
      if (err === "redirecting") return; // on to Google sign-in
      if (err) return setStep({ kind: "error", message: err });
      const s = await getSession();
      if (!s || s.is_anonymous) return go();
      const [handle, details] = await Promise.all([fetchHandle(s), fetchUserDetails(s)]);
      if (handle === null && !nameSkipped(s.user_id)) {
        return setStep({ kind: "name", userId: s.user_id, suggestion: suggestName(details) });
      }
      hello(greetingName(handle, details ?? { name: null, email: s.email ?? null }));
    })();
  }, [go, hello]);

  if (step.kind === "name") {
    return (
      <NamePrompt
        suggestion={step.suggestion}
        onSave={async (name) => {
          if (step.userId === "preview") return null;
          const r = await saveHandle(name);
          if (!r.ok) return r.reason;
          hello(r.handle);
          return null;
        }}
        onSkip={() => {
          if (step.userId !== "preview") rememberNameSkipped(step.userId);
          hello(step.suggestion || "player");
        }}
      />
    );
  }
  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", color: "#eee", background: "#0b0b10", minHeight: "100vh" }}>
      {step.kind === "error" ? (
        <>
          <p role="alert">Sign-in didn&apos;t finish: {step.message}</p>
          <p style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <button type="button" onClick={() => void signInWithGoogle(takeNext())} style={retry} data-testid="callback-retry">
              Try Google again
            </button>
            <Link href="/" style={{ color: "#aab" }}>
              Keep playing as guest
            </Link>
          </p>
        </>
      ) : (
        <p>Signing you in…</p>
      )}
    </main>
  );
}

const retry: React.CSSProperties = { padding: "8px 16px", border: "1px solid #ff2fd0", borderRadius: 6, background: "transparent", color: "#eee", font: "inherit", cursor: "pointer" };
