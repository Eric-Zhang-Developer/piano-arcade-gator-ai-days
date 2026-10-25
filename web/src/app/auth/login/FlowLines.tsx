// The login page's right side: two fans of thin lines sweeping across the panel, each with a bright stretch that
// travels along it, magenta into cyan. Plain SVG and CSS (no WebGL, no animation library), so it's up on the first
// frame. `rush` (Google is opening) speeds the travel up. Reduced motion keeps the lines still.
import styles from "./login.module.css";

const COUNT = 30;

function paths(side: 1 | -1) {
  return Array.from({ length: COUNT }, (_, i) => {
    const s = i * 5 * side;
    return {
      d: `M-${380 - s} -${189 + i * 6}C-${380 - s} -${189 + i * 6} -${312 - s} ${216 - i * 6} ${152 - s} ${343 - i * 6}C${616 - s} ${470 - i * 6} ${684 - s} ${875 - i * 6} ${684 - s} ${875 - i * 6}`,
      width: 0.5 + i * 0.035,
      opacity: 0.15 + i * 0.025,
      // Fixed per line, not random, so the server and the browser draw the same thing.
      dur: 14 + ((i * 7) % 11),
      delay: -((i * 3.7) % 14),
    };
  });
}

const FANS = [paths(1), paths(-1)];

export function FlowLines({ rush }: { rush: boolean }) {
  return (
    <svg className={`${styles.flow} ${rush ? styles.rush : ""}`} viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-testid="login-flow">
      <defs>
        <linearGradient id="flow-ink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff2fd0" />
          <stop offset="1" stopColor="#22e6ff" />
        </linearGradient>
      </defs>
      {FANS.map((fan, f) =>
        fan.map((p, i) => (
          <g key={`${f}-${i}`}>
            <path d={p.d} stroke="url(#flow-ink)" strokeWidth={p.width} strokeOpacity={p.opacity * 0.35} />
            <path
              className={styles.flowRun}
              d={p.d}
              pathLength={1}
              stroke="url(#flow-ink)"
              strokeWidth={p.width + 0.4}
              strokeOpacity={Math.min(1, p.opacity + 0.25)}
              strokeLinecap="round"
              style={{ animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
            />
          </g>
        )),
      )}
    </svg>
  );
}
