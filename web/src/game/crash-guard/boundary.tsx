"use client";
// GameBoundary (spec: crash-guard): a render error anywhere under the layout shows one card with a way back, not a
// blank page. catchError is Next 16's component boundary; its error state clears on a client navigation.
import { catchError, type ErrorInfo } from "next/error";
import { useSyncExternalStore, type ReactNode } from "react";
import { Button, Panel } from "../duo-tokens";
import styles from "./crash-guard.module.css";

// Exported for its test; catchError below is what the app uses.
export function Card(_props: object, { error, retry }: ErrorInfo) {
  return (
    <main className={styles.screen} data-testid="crash-card">
      <Panel style={{ width: "fit-content", maxWidth: "min(32em, 100%)", padding: "calc(var(--size) * 1.6) calc(var(--size) * 1.8)", borderLeft: "3px solid var(--pa-wrong)" }}>
        <section role="alert" aria-labelledby="crash-title">
        <h1 id="crash-title" className={styles.title}>
          Something broke.
        </h1>
        <p className={styles.message}>{error instanceof Error ? error.message : String(error)}</p>
        <div className={styles.actions}>
          {/* a full page load of /, so no state survives: router.push would keep the broken client state */}
          {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
          <Button type="button" style={{ fontSize: "var(--size)" }} autoFocus onClick={() => window.location.assign("/")}>
            Back to the song list
          </Button>
          <Button type="button" kind="secondary" style={{ fontSize: "var(--size)" }} onClick={() => retry()}>
            Try again
          </Button>
        </div>
        </section>
      </Panel>
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
