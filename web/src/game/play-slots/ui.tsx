"use client";
// The slots plugins' panels render in, and the pause menu (spec: play-slots).
import { Component, type CSSProperties, type ReactNode } from "react";
import type { GamePlugin } from "../../contracts";
import type { PauseMode } from ".";

// One plugin's panel. A panel that throws, when called or while rendering, logs one line and leaves its slot empty.
class Boundary extends Component<{ id: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    console.error(`play-slots: ${this.props.id}'s panel threw: ${e.message}`);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Each plugin's panel in plugin order, each in a wrapper with data-testid="slot-<id>"; null panels get no wrapper.
export function Slots({ plugins, panel }: { plugins: GamePlugin[]; panel: (p: GamePlugin) => ReactNode }) {
  return plugins.map((p) => {
    let node: ReactNode;
    try {
      node = panel(p);
    } catch (e) {
      console.error(`play-slots: ${p.id}'s panel threw: ${(e as Error).message}`);
      return null;
    }
    if (node === null || node === undefined) return null;
    return (
      <Boundary key={p.id} id={p.id}>
        <div data-testid={`slot-${p.id}`} style={{ marginTop: 16 }}>
          {node}
        </div>
      </Boundary>
    );
  });
}

export function PauseOverlay({
  mode,
  count,
  button,
  onResume,
  onRetry,
  onQuit,
}: {
  mode: PauseMode;
  count: number; // countdown beats left
  button: CSSProperties;
  onResume(): void;
  onRetry(): void;
  onQuit(): void;
}) {
  if (mode !== "menu" && mode !== "countdown") return null;
  return (
    <div data-testid="pause" style={overlay}>
      {mode === "menu" ? (
        <>
          <h2 style={{ margin: 0 }}>Paused</h2>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button style={button} onClick={onResume} autoFocus>
              Resume
            </button>
            <button style={{ ...button, background: "#ddd" }} onClick={onRetry}>
              Retry
            </button>
            <button style={{ ...button, background: "#ddd" }} onClick={onQuit}>
              Quit
            </button>
          </div>
          <p style={{ opacity: 0.6, fontSize: 14 }}>Esc resumes</p>
        </>
      ) : (
        <div data-testid="pause-countdown" style={{ fontSize: 96, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          {count}
        </div>
      )}
    </div>
  );
}

const overlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.6)",
};
