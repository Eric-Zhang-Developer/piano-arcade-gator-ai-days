// The login page's right side: two fans of thin lines sweeping across the panel, each with a bright stretch that
// travels along it, magenta into cyan, and a wireframe keyboard lying in them whose keys light up playing the start
// of Twinkle. Plain SVG and CSS (no WebGL, no animation library), so it's up on the first frame. `rush` (Google is
// opening) speeds it all up. Reduced motion keeps everything still.
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

// Two octaves from C: 14 white keys, and the black keys after C, D, F, G and A.
const WHITES = 14;
const KEY_W = 40;
const BLACKS = Array.from({ length: WHITES - 1 }, (_, i) => i).filter((i) => [0, 1, 3, 4, 5].includes(i % 7));
// "Twinkle, twinkle, little star, how I wonder what you are": white-key indexes, one note a beat.
const TUNE = [0, 0, 4, 4, 5, 5, 4, -1, 3, 3, 2, 2, 1, 1, 0, -1];
const BEAT_S = 0.42;

function Keys() {
  const loop = TUNE.length * BEAT_S;
  return (
    <svg className={styles.keys} viewBox={`-2 -2 ${WHITES * KEY_W + 4} 164`} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="key-ink" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff2fd0" />
          <stop offset="1" stopColor="#22e6ff" />
        </linearGradient>
      </defs>
      {Array.from({ length: WHITES }, (_, i) => (
        <rect key={i} x={i * KEY_W} y={0} width={KEY_W} height={160} stroke="url(#key-ink)" strokeOpacity={0.55} strokeWidth={1} />
      ))}
      {TUNE.map((k, n) =>
        k < 0 ? null : (
          <rect
            key={`n${n}`}
            className={styles.keyLit}
            x={k * KEY_W + 1}
            y={1}
            width={KEY_W - 2}
            height={158}
            fill="url(#key-ink)"
            style={{ animationDuration: `${loop}s`, animationDelay: `${n * BEAT_S}s` }}
          />
        ),
      )}
      {BLACKS.map((i) => (
        <rect key={`b${i}`} x={(i + 1) * KEY_W - 12} y={0} width={24} height={98} fill="#05050a" stroke="url(#key-ink)" strokeOpacity={0.7} strokeWidth={1} />
      ))}
    </svg>
  );
}

export function FlowLines({ rush }: { rush: boolean }) {
  return (
    <div className={`${styles.flowWrap} ${rush ? styles.rush : ""}`}>
      <Lines />
      <div className={styles.keysStage}>
        <Keys />
      </div>
    </div>
  );
}

function Lines() {
  return (
    <svg className={styles.flow} viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-testid="login-flow">
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
