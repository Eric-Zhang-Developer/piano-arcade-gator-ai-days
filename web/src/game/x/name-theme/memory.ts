// The one place a typed name lives (spec: name-theme, Privacy): this module's variable, while the tab is open. Never
// storage, a cookie, a URL or a request; nothing logs it. /name holds a theme, /play's swap reads it, and leaving
// those two pages clears it (Guard.tsx).
import { holdPedal } from "../../pedal";
import type { Theme } from "./compose";

export const SONG = "x/name-theme";

let held: { name: string; theme: Theme } | null = null;

export const heldTheme = () => held;

export function hold(name: string, theme: Theme): void {
  held = { name, theme };
  holdPedal(SONG, theme.pedal);
}

export function clear(): void {
  held = null;
  holdPedal(SONG, null);
}

// The pages that keep it: /name, where it's made, and /play, where it's played.
export const keepsName = (pathname: string) => pathname === "/name" || pathname === "/play";
