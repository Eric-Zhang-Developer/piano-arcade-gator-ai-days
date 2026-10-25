// Any unknown path (#891): the Duo kit's card with the wordmark and one way back to the songs, not Next's stock 404.
import Link from "next/link";
import type { CSSProperties } from "react";
import { APP_NAME } from "../game/app-name";
import { Brackets, MonoLabel, Panel, kitButton } from "../game/duo-tokens";

// The tab says what the page says (#1046), like every other page since #1001.
export const metadata = { title: `Not found · ${APP_NAME}` };

export default function NotFound() {
  return (
    <main style={screen}>
      <Brackets>
        <Panel style={{ padding: "clamp(24px, 3vw, 56px)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2.4vh" }}>
          <MonoLabel style={{ fontSize: "clamp(13px, 1vw, 18px)" }}>404 · {APP_NAME}</MonoLabel>
          <h1 style={title}>Nothing to play here.</h1>
          <Link href="/" {...kitButton("primary")}>
            Songs
          </Link>
        </Panel>
      </Brackets>
    </main>
  );
}

const screen: CSSProperties = {
  minHeight: "100dvh",
  boxSizing: "border-box",
  display: "grid",
  placeItems: "center",
  padding: 16,
  background: "var(--pa-bg)",
  color: "var(--pa-ink)",
};

// The kit's display type: upright and condensed, like the select's titles.
const title: CSSProperties = {
  margin: 0,
  fontFamily: "var(--pa-font-display), system-ui, sans-serif",
  fontStretch: "75%",
  fontWeight: 800,
  fontSize: "clamp(32px, 3.6vw, 64px)",
  lineHeight: 1,
};
