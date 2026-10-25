// visual-direction.md's color tokens (the Duo look, duo-tokens) for canvas code, which can't read CSS variables
// cheaply. globals.css declares the same values as --pa-*; the test keeps the two equal.
export const handR = "#2b9bff";
export const handL = "#a07cff";
export const bg = "#030607";
export const flare = "#ffffff";
export const miss = "#8a8f98";
export const wrong = "#ff4d5e";
export const gold = "#ffe27a";
export const good = "#7cb7ff";
export const panel = "#0a0d15";
export const ink = "#e2e6f0";
export const inkDim = "#7d8496";
export const magenta = "#2b9bff"; // aliases primary and secondary, so old readers repaint
export const cyan = "#a07cff";
export const primary = "#2b9bff";
export const secondary = "#a07cff";
export const line = "rgba(125, 132, 150, 0.25)";
export const paper = "#f2ede3"; // decision duo-tokens-paper
export const paperInk = "#16130f";
export const sun = "#ffb02e";
export const sunFrom = "#ffe66b";
export const sunTo = "#ff3fa4";
export const sky = "#0b0220";
export const tierX1 = "#e8e8ec";
export const tierX2 = "#ff9f43";
export const tierX3 = "#8ee05e";
export const tierX4 = "#c47cff";

// layout.tsx loads Saira through next/font as --pa-font-display, and JetBrains Mono as --pa-font-data.
export const fontDisplay = "var(--pa-font-display), system-ui, sans-serif";
export const fontData = "var(--pa-font-data), ui-monospace, monospace";

// Canvas text doesn't trigger a font load, so wait for the display face before drawing with it. Gives up after 1 s
// (offline, or no font) and the canvas draws with the fallback.
export function whenDisplayFontReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const family = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim() || "Saira";
  return Promise.race([
    document.fonts.load(`800 1em ${family}`).then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => setTimeout(resolve, 1000)),
  ]);
}
