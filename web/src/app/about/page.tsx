import type { Metadata } from "next";
import Link from "next/link";
import HeroHighway from "./HeroHighway";
import { readProgress } from "./progress";
import styles from "./page.module.css";

// Every claim here comes from a file on main, cited next to it (specs/features/landing/spec.md).

export const metadata: Metadata = {
  title: "Piano Arcade: an arcade rhythm game on a real piano",
  description:
    "Notes fall toward the keys of a real 88-key piano, every note you play is judged to the millisecond, and the game answers back.",
};

const REPO = "https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days";
const file = (p: string) => `${REPO}/blob/main/${p}`;

function Source({ path, label }: { path: string; label?: string }) {
  return (
    <a className={styles.source} href={file(path)}>
      {label ?? path}
    </a>
  );
}

const STATS = [
  {
    value: "3.1 ms",
    label: "Two neighbouring keys grazed at once still arrived as two separate events, through a USB hub.",
    path: "docs/story.md",
  },
  {
    value: "116 = 116",
    label: "Notes seen by Python and by Chrome on the same piano over 158 s. Their timing agreed within 1 ms for 114 of 115 gaps.",
    path: "docs/story.md",
  },
  {
    value: "125.0 ms",
    label: "Chrome schedules each note ahead of time: 16 fast notes came back exactly 125.0 ms apart.",
    path: "docs/story.md",
  },
];

// Zone boundaries as a share of the ±150 ms bar above (zones are 50, 50, 25, 50, 25, 50, 50 ms wide).
const TICKS = [
  ["−100", 100 / 6],
  ["−50", 100 / 3],
  ["−25", 125 / 3],
  ["0 ms", 50],
  ["+25", 175 / 3],
  ["+50", 200 / 3],
  ["+100", 500 / 6],
] as const;

const SHIPPED = [
  { route: "/play", text: "Twinkle on the highway, every key judged, a results screen with rank and max combo." },
  { route: "/play", text: "The piano plays its own drum beat from the count-in to the end, scheduled on the chart clock." },
  { route: "/play", text: "Results say how early or late you played, and offer a latency fix when the data supports one." },
  { route: "/sim", text: "A virtual DGX-660 behind Web MIDI, with faults to inject and a bot that plays Twinkle." },
];

const STACK = [
  ["Next.js + TypeScript", "App Router in web/, pnpm, pinned versions."],
  ["One canvas per layer", "Driven by requestAnimationFrame. Game state per frame lives in refs, never React state."],
  ["Web MIDI + laptop keys", "One input interface. The game is playable with the piano unplugged."],
  ["Web Audio + the piano itself", "Event sounds on the audio clock; the drum beat is GM drums on the piano's channel 10."],
  ["One pure judge", "Vitest drives it with synthetic players; Playwright plays Twinkle as the Perfect player on every PR."],
  ["Agents from specs", "Claude Code workers build from specs/ on main. A feature is done only when its done note lands."],
] as const;

function title(name: string) {
  const i = name.indexOf(":");
  return i > 0 ? name.slice(0, i) : name;
}
function blurb(name: string) {
  const i = name.indexOf(":");
  return i > 0 ? name.slice(i + 1).trim() : "";
}

export default function About() {
  const progress = readProgress();
  const features = progress?.flatMap((m) => m.features) ?? [];
  const doneCount = features.filter((f) => f.done).length;
  const isDone = (slug: string) => features.find((f) => f.slug === slug)?.done ?? false;
  const goodShipped = isDone("judging-tiers");
  const ledsShipped = isDone("led-strip");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <HeroHighway />
        <div className={styles.heroShade} />
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Gator AI Days · Oct 23–25, 2026</p>
          <h1 className={styles.logo}>
            Piano <span>Arcade</span>
          </h1>
          <p className={styles.lede}>
            An arcade rhythm game played on a real 88-key piano. Notes fall toward the keys, every note you play is
            judged to the millisecond, and the game answers back.
          </p>
          <div className={styles.ctas}>
            <Link className={styles.primary} href="/play">
              Play now
            </Link>
            <Link className={styles.secondary} href="/sim">
              Try it without a piano
            </Link>
          </div>
          <p className={styles.fine}>Built for a Yamaha DGX-660 over Chrome&apos;s Web MIDI. Laptop keys always work.</p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.kicker}>Why</h2>
        <p className={styles.big}>
          Practicing piano is lonely and quiet. Arcade rhythm games are loud, instant and addictive, but they don&apos;t
          teach a real instrument. Piano Arcade is both.
        </p>
        <div className={styles.versus}>
          <div className={styles.card}>
            <h3>What learning apps grade</h3>
            <p>
              Simply Piano, Flowkey, Yousician and Playground Sessions all grade <em>which</em> notes you hit. None of
              the four grades <em>how</em> you played them: timing direction, evenness and dynamics go ungraded, and
              none lets you bring your own song.
            </p>
            <Source path="specs/context/raw/competitors.md" />
          </div>
          <div className={`${styles.card} ${styles.cardLit}`}>
            <h3>What Piano Arcade grades</h3>
            <p>
              Every note, against the chart&apos;s clock, to the millisecond. The results screen tells you whether you
              rushed or dragged and by how much. Next, a coach (the learning side, still being built) reads your takes
              and tells you what to practice.
            </p>
            <Source path="specs/mission.md" />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.kicker}>How it judges</h2>
        <p className={styles.big}>Hit the right key, on time. Punish only what a listener would hear as wrong.</p>
        <div className={styles.windows} role="img" aria-label="Timing windows: PERFECT within 25 ms, GREAT within 50 ms, GOOD within 100 ms, MISS beyond">
          <div className={`${styles.zone} ${styles.miss}`}>MISS</div>
          <div className={`${styles.zone} ${styles.good}`}>GOOD</div>
          <div className={`${styles.zone} ${styles.great}`}>GREAT</div>
          <div className={`${styles.zone} ${styles.perfect}`}>PERFECT</div>
          <div className={`${styles.zone} ${styles.great}`}>GREAT</div>
          <div className={`${styles.zone} ${styles.good}`}>GOOD</div>
          <div className={`${styles.zone} ${styles.miss}`}>MISS</div>
        </div>
        <div className={styles.ticks} aria-hidden="true">
          <span style={{ left: 0 }}>early</span>
          {TICKS.map(([ms, at]) => (
            <span key={ms} className={styles.tick} style={{ left: `${at}%` }}>
              {ms}
            </span>
          ))}
          <span style={{ right: 0 }}>late</span>
        </div>
        <ul className={styles.rules}>
          <li>A note matches a key press only if they&apos;re the same pitch, and each press matches at most one note.</li>
          <li>PERFECT, GREAT and GOOD keep the combo. A MISS breaks it, and so does a wrong note.</li>
          <li>A repeat of the same key within 150 ms of its note, or a stray key before the song starts or after it ends, is never punished.</li>
        </ul>
        <p className={styles.note}>
          {goodShipped ? null : "The GOOD tier is the rule on main and in review in the game. "}
          <Source path="specs/mission.md" label="The judging rule, mission.md" />
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.kicker}>Measured, not made up</h2>
        <p className={styles.big}>
          The whole idea rests on one bet: a laptop can hear every key with millisecond timing. We tested it on the
          real piano before writing the game.
        </p>
        <div className={styles.stats}>
          {STATS.map((s) => (
            <div className={styles.stat} key={s.value}>
              <div className={styles.statValue}>{s.value}</div>
              <p>{s.label}</p>
              <Source path={s.path} />
            </div>
          ))}
        </div>
        <div className={styles.playtest}>
          <div>
            <div className={styles.score}>
              <span className={styles.scoreOld}>~10%</span>
              <span className={styles.arrow}>→</span>
              <span className={styles.scoreNew}>71.4%</span>
            </div>
            <p className={styles.scoreLabel}>Eric&apos;s accuracy on Twinkle: first runs with no beat, then with the piano playing a drum beat (rank C).</p>
          </div>
          <div>
            <p>
              At the first playtest the players said they didn&apos;t know when to press the key: with only the
              picture, the judgment line was the clock. So the piano now plays its own beat, from a two-bar count-in to
              the last note, and the results screen says how early or late you were.
            </p>
            <Source path="specs/context/findings.md" />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.kicker}>On main today</h2>
        <ul className={styles.shipped}>
          {SHIPPED.map((s) => (
            <li key={s.text}>
              <Link href={s.route} className={styles.route}>
                {s.route}
              </Link>
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.lights}`}>
        <div>
          <h2 className={styles.kicker}>The keys light up</h2>
          <p className={styles.big}>The next note glows on the piano before it arrives, and every hit shows on the keys themselves.</p>
          <p>
            Two 1 m WS2812B strips, 144 LEDs per metre, sit along the back of the keys, driven by an ESP32 over USB
            serial. The browser decides what lights; the board maps notes to LEDs and animates. A standalone tester page
            works with no game at all.
          </p>
          <p className={styles.note}>
            {ledsShipped ? "Shipped. " : "In progress. "}
            <Source path="specs/features/led-strip/spec.md" label="led-strip spec" />
          </p>
        </div>
        <div className={styles.strip} aria-hidden="true">
          <div className={styles.leds}>
            {Array.from({ length: 36 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${(i % 12) * 0.18 + Math.floor(i / 12) * 0.07}s` }} />
            ))}
          </div>
          <div className={styles.miniKeys}>
            {Array.from({ length: 21 }, (_, i) => (
              <b key={i} />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.kicker}>Build progress</h2>
        {progress ? (
          <>
            <p className={styles.big}>
              {doneCount} of {features.length} planned features are done.
            </p>
            <p className={styles.note}>
              Read from <Source path="specs/milestones.toml" /> and <Source path="changes" label="changes/" /> when this
              page was built. A feature counts as done only when its done note is on main.
            </p>
            <ol className={styles.milestones}>
              {progress.map((m) => (
                <li key={m.name} className={styles.milestone}>
                  <h3>{m.name}</h3>
                  <ul>
                    {m.features.map((f) => (
                      <li key={f.slug} className={f.done ? styles.done : styles.todo}>
                        <span className={styles.dot} />
                        <span>
                          <strong>{title(f.name)}</strong>
                          {blurb(f.name) ? <span className={styles.blurb}>{blurb(f.name)}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className={styles.note}>
            The milestone files weren&apos;t available when this page was built, so progress isn&apos;t shown. See{" "}
            <Source path="specs/milestones.toml" />.
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.kicker}>Under the hood</h2>
        <div className={styles.stack}>
          {STACK.map(([name, text]) => (
            <div key={name} className={styles.stackItem}>
              <h3>{name}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <p className={styles.note}>
          <Source path="specs/tech-stack.md" />
        </p>
      </section>

      <footer className={styles.footer}>
        <div className={styles.team}>
          <div>
            <strong>Eric Zhang</strong>
            <span>Game: playing, highway, judging, MIDI</span>
          </div>
          <div>
            <strong>Sharan Santharam</strong>
            <span>Lights: the LED strip and its firmware</span>
          </div>
        </div>
        <div className={styles.footerLinks}>
          <Link className={styles.primary} href="/play">
            Play now
          </Link>
          <a className={styles.secondary} href={REPO}>
            Source on GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
