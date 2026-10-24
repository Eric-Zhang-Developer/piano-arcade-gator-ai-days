"use client";
// GameBoundary (spec: crash-guard): a render error anywhere under the layout shows one card with a way back, not a
// blank page. catchError is Next 16's component boundary; its error state clears on a client navigation.
import { catchError, type ErrorInfo } from "next/error";
import { useSyncExternalStore, type ReactNode } from "react";
import styles from "./crash-guard.module.css";

function Card(_props: object, { error, retry }: ErrorInfo) {
  return (
    <main className={styles.screen} data-testid="crash-card">
      <section className={styles.card} role="alert" aria-labelledby="crash-title">
        <h1 id="crash-title" className={styles.title}>
          Something broke.
        </h1>
        <p className={styles.message}>{error instanceof Error ? error.message : String(error)}</p>
        <div className={styles.actions}>
          {/* a full page load of /, so no state survives: router.push would keep the broken client state */}
          {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
          <button type="button" className={styles.primary} autoFocus onClick={() => window.location.assign("/")}>
            Back to the song list
          </button>
          <button type="button" className={styles.secondary} onClick={() => retry()}>
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}

const Caught = catchError(Card);

// ?crash=render: throws while rendering, on any page. The server snapshot is false, so it throws only on the client,
// after hydration, where the boundary catches it.
const noop = () => () => {};
function Probe() {
  const crash = useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).get("crash") === "render", () => false);
  if (crash) throw new Error("test crash (?crash=render)");
  return null;
}

export function GameBoundary({ children }: { children: ReactNode }) {
  return (
    <Caught>
      <Probe />
      {children}
    </Caught>
  );
}
