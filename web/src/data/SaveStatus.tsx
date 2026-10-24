"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { googleSession } from "./auth";
import type { StatusStore } from "./save-plugin";

// One line under the score: did this take reach the player's history, and if not, why. take-store's results panel.
export function SaveStatusLine({ store }: { store: StatusStore }) {
  const status = useSyncExternalStore(store.subscribe, store.get, () => null);
  const [google, setGoogle] = useState<boolean | null>(null);
  useEffect(() => {
    if (status?.state === "saved") void googleSession().then((s) => setGoogle(Boolean(s)));
  }, [status?.state]);
  if (!status) return null;

  let text: React.ReactNode;
  let color = "var(--pa-ink-dim)";
  switch (status.state) {
    case "checking":
    case "sending":
      text = "Saving…";
      break;
    case "saved":
      color = "var(--pa-cyan)";
      text =
        google === false ? (
          <>
            Saved as a guest ✓ ·{" "}
            <Link href="/auth/login?next=/progress" style={{ color: "inherit" }}>
              sign in to keep it everywhere
            </Link>
          </>
        ) : (
          <>
            Saved to your account ✓ ·{" "}
            <Link href="/progress" style={{ color: "inherit" }}>
              see progress
            </Link>
          </>
        );
      break;
    case "waiting":
      color = "var(--pa-gold)";
      text = `Not saved yet: ${status.why}`;
      break;
    case "skipped":
      text = `Not saved: ${status.why}`;
      break;
  }
  return (
    <p data-testid="save-status" data-state={status.state} role="status" style={{ margin: "8px 0", fontSize: 15, color, textAlign: "center" }}>
      {text}
    </p>
  );
}
