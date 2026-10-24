// visual-direction.md's color tokens for canvas code, which can't read CSS variables cheaply. globals.css declares
// the same values as --pa-*; the test keeps the two equal.
export const handR = "#5ef2c4";
export const handL = "#6aa8ff";
export const bg = "#000000";
export const flare = "#ffffff";
export const miss = "#c98a9a";
export const wrong = "#ff4d5e";
export const gold = "#ffe27a";
export const good = "#7cb7ff";
export const panel = "rgba(12, 12, 16, 0.72)";
export const ink = "#f2f2f5";
export const inkDim = "rgba(242, 242, 245, 0.6)";
export const magenta = "#ff2fd0";
export const cyan = "#27e1ff";
export const sun = "#ffb02e";
export const sunFrom = "#ffe66b";
export const sunTo = "#ff3fa4";
export const sky = "#0b0220";
export const tierX1 = "#e8e8ec";
export const tierX2 = "#ff9f43";
export const tierX3 = "#8ee05e";
export const tierX4 = "#c47cff";

// layout.tsx loads Saira through next/font as --pa-font-display.
export const fontDisplay = "var(--pa-font-display), system-ui, sans-serif";

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
