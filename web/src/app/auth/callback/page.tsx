"use client";

import { useEffect, useState } from "react";
import { finishRedirect } from "../../../data/auth";

// Google sends the player back here after "Keep my progress". The session arrives in the URL hash.
export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void finishRedirect(window.location.hash).then((err) => {
      if (err) setError(err);
      else window.location.replace("/progress");
    });
  }, []);
  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", color: "#eee", background: "#0b0b10", minHeight: "100vh" }}>
      {error ? <p role="alert">Sign-in didn&apos;t finish: {error}</p> : <p>Signing you in…</p>}
    </main>
  );
}
