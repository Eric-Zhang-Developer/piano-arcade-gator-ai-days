// The Duo kit (duo-tokens): the pieces duo-select, duo-hud, duo-results and sheet-paper share, so there's one bracket
// style, not four. Sharp corners, hairlines, monospace caps for data, condensed numerals (visual-direction.md). The
// HUD's canvas has twins of these in canvas.ts.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { kitSettings } from "./canvas";
import s from "./kit.module.css";

const mono: CSSProperties = {
  fontFamily: "var(--pa-font-data), ui-monospace, monospace",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: kitSettings.dataTracking,
  textTransform: "uppercase",
};
const numeral: CSSProperties = {
  fontFamily: "var(--pa-font-display), system-ui, sans-serif",
  fontStretch: kitSettings.condensed,
  fontWeight: 800,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
};

// A hairline frame on the panel color, or the lit paper sheet music sits on (sheet-paper).
export function Panel({ paper = false, style, children }: { paper?: boolean; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div
      data-kit="panel"
      data-paper={paper || undefined}
      style={{
        background: paper ? "var(--pa-paper)" : "var(--pa-panel)",
        color: paper ? "var(--pa-paper-ink)" : "var(--pa-ink)",
        border: `${kitSettings.hairline}px solid ${paper ? "var(--pa-paper-ink)" : "var(--pa-line)"}`,
        borderRadius: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Corner brackets around whatever it holds: four L-shaped corners, in primary or the hairline color.
export function Brackets({ tone = "primary", style, children }: { tone?: "primary" | "line"; style?: CSSProperties; children?: ReactNode }) {
  const color = tone === "primary" ? "var(--pa-primary)" : "var(--pa-line)";
  const arm = kitSettings.bracketLen;
  const w = kitSettings.bracketWidth;
  const corner = (top: boolean, left: boolean): CSSProperties => ({
    position: "absolute",
    width: arm,
    height: arm,
    [top ? "top" : "bottom"]: 0,
    [left ? "left" : "right"]: 0,
    [top ? "borderTop" : "borderBottom"]: `${w}px solid ${color}`,
    [left ? "borderLeft" : "borderRight"]: `${w}px solid ${color}`,
    borderRadius: 0,
    pointerEvents: "none",
  });
  return (
    <div data-kit="brackets" style={{ position: "relative", padding: arm, ...style }}>
      {[
        [true, true],
        [true, false],
        [false, false],
        [false, true],
      ].map(([t, l]) => (
        <span key={`${t}${l}`} data-kit="corner" aria-hidden style={corner(t, l)} />
      ))}
      {children}
    </div>
  );
}

// primary: the blue fill, one per screen. secondary: a hairline. Both sharp, with a visible focus ring (kit.module.css).
export function Button({ kind = "primary", style, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "secondary" }) {
  const k = kitButton(kind);
  return <button data-kit={`button-${kind}`} className={[k.className, className].filter(Boolean).join(" ")} style={{ ...k.style, ...style }} {...rest} />;
}

// The Button's look on an element that isn't a <button>, such as a link to another mode: `<a {...kitButton("secondary")}>`.
export function kitButton(kind: "primary" | "secondary" = "primary"): { className: string; style: CSSProperties } {
  const primary = kind === "primary";
  return {
    className: [s.button, primary ? s.primary : s.secondary].join(" "),
    style: {
      ...mono,
      fontSize: 14,
      fontWeight: 700,
      padding: "12px 24px",
      borderRadius: 0,
      cursor: "pointer",
      display: "inline-block",
      textAlign: "center",
      textDecoration: "none",
      background: primary ? "var(--pa-primary)" : "transparent",
      color: primary ? "var(--pa-bg)" : "var(--pa-ink)",
      border: `1px solid ${primary ? "var(--pa-primary)" : "var(--pa-line)"}`,
    },
  };
}

// A small toggle, like the select's Hands and Speed chips: a hairline, lit in the primary blue when it's the setting in force.
export function kitChip(lit: boolean): { className: string; style: CSSProperties } {
  return {
    className: s.button,
    style: {
      ...mono,
      fontSize: "clamp(12px, 0.85vw, 17px)",
      fontWeight: 700,
      padding: "0.4em 0.8em",
      borderRadius: 0,
      cursor: "pointer",
      border: `1px solid ${lit ? "var(--pa-primary)" : "var(--pa-line)"}`,
      background: lit ? "color-mix(in srgb, var(--pa-primary) 14%, transparent)" : "transparent",
      color: lit ? "var(--pa-primary)" : "var(--pa-ink)",
    },
  };
}

// Small monospace caps with wide tracking: labels, levels, bar numbers, ms, hints.
export function MonoLabel({ dim = true, style, children }: { dim?: boolean; style?: CSSProperties; children?: ReactNode }) {
  return (
    <span data-kit="mono" style={{ ...mono, color: dim ? "var(--pa-ink-dim)" : "var(--pa-ink)", ...style }}>
      {children}
    </span>
  );
}

// A data cell: a monospace caps label over a big condensed numeral. `tone` colors the number only, for judgments.
export function DataCell({ label, value, tone, size = 40, style }: { label: ReactNode; value: ReactNode; tone?: string; size?: number; style?: CSSProperties }) {
  return (
    <div data-kit="cell" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 14px", borderLeft: "1px solid var(--pa-line)", borderRadius: 0, ...style }}>
      <MonoLabel>{label}</MonoLabel>
      <span data-kit="numeral" style={{ ...numeral, fontSize: size, color: tone ?? "var(--pa-ink)" }}>
        {value}
      </span>
    </div>
  );
}
