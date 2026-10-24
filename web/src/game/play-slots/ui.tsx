"use client";
// The slots plugins' panels render in (spec: play-slots). The pause menu is pause-skin's PauseMenu.
import { Component, type ReactNode } from "react";
import type { GamePlugin } from "../../contracts";

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
