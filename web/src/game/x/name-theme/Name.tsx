"use client";
// /name (spec: name-theme, #1190): type a name, see each letter fall to its note, see the theme it makes, then hear
// it on the DGX or play it in Learn. The name stays in memory.ts; nothing here stores or sends it.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { kitButton, kitChip, MonoLabel } from "../../duo-tokens";
import { chartProblems } from "../../songs/rules";
import { CIPHERS, spelled, type CipherId } from "./cipher";
import { ANCHOR } from ".";
import { compose, composeSettings, fold, pcName, type Theme } from "./compose";
import { clear, heldTheme, hold, SONG } from "./memory";
import css from "./name.module.css";

export const LISTEN = `/play?song=${SONG}&bot=perfect&audible=1&demo=1&x=name-theme`;
export const PLAY = `/play?song=${SONG}&mode=wait&x=name-theme`;

// What the page offers for a typed name: the theme, or the reason there's none. Pure, for the tests.
export function offer(
  name: string,
  id: CipherId,
): { letters: string; theme: Theme | null; why: string | null } {
  const { cipher } = CIPHERS[id];
  const letters = fold(name);
  const notes = spelled(letters, cipher);
  if (!name.trim()) return { letters, theme: null, why: null };
  if (!notes)
    return {
      letters,
      theme: null,
      why: letters
        ? "None of these letters is a note in this system."
        : "No letters A–Z here, so there's no theme to make.",
    };
  const theme = compose(notes, cipher)!;
  const problems = chartProblems(`songs/${SONG}/chart.json`, theme.chart);
  return problems.length
    ? {
        letters,
        theme: null,
        why: `This theme breaks a chart rule (${problems[0]}), so it isn't offered.`,
      }
    : { letters, theme, why: null };
}

function Strip({
  letters,
  id,
  theme,
  example,
}: {
  letters: string;
  id: CipherId;
  theme: Theme;
  example: boolean;
}) {
  const { cipher } = CIPHERS[id];
  return (
    <ol
      className={css.strip}
      data-example={example || undefined}
      aria-label="Each letter and the note it becomes"
      data-testid="name-strip" style={{ "--n": Math.max(letters.length, 5) } as React.CSSProperties}
    >
      {[...letters].map((l, i) => {
        const pc = cipher[l];
        return (
          <li key={i} className={pc === undefined ? css.silent : css.cell}>
            <span className={css.letter}>{l}</span>
            <span className={css.note}>
              {pc === undefined ? "—" : pcName(pc, theme.key)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// The theme and its variation as a roll: right hand in the kit's blue, left hand dim, bars as hairlines.
function Roll({ theme }: { theme: Theme }) {
  const { notes, beatsPerBar } = theme.chart;
  const end = Math.max(...notes.map((n) => n.beat + n.duration));
  const lo = Math.min(...notes.map((n) => n.pitch)) - 1;
  const hi = Math.max(...notes.map((n) => n.pitch)) + 1;
  const W = 1000;
  const H = 300;
  const x = (b: number) => (b / end) * W;
  const y = (p: number) => ((hi - p) / (hi - lo)) * H;
  const row = H / (hi - lo);
  return (
    <div className={css.rollBox}>
      <svg
        className={css.roll}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`The theme and its variation: ${notes.length} notes over ${end / beatsPerBar} bars`}
      >
        {Array.from({ length: end / beatsPerBar + 1 }, (_, i) => (
          <line
            key={i}
            x1={x(i * beatsPerBar)}
            x2={x(i * beatsPerBar)}
            y1={0}
            y2={H}
            className={
              i * beatsPerBar === theme.variationAt ? css.seam : css.bar
            }
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {notes.map((n) => (
          <rect
            key={n.id}
            x={x(n.beat) + 1}
            y={y(n.pitch) - row / 2}
            width={Math.max(2, x(n.duration) - 2)}
            height={Math.max(2, row - 1)}
            className={n.hand === "R" ? css.right : css.left}
          />
        ))}
      </svg>
      {notes
        .filter((n) => n.id in theme.letterOf)
        .map((n) => (
          <span
            key={n.id}
            className={css.tag}
            style={{
              left: `${(n.beat / end) * 100}%`,
              top: `${(y(n.pitch) / H) * 100}%`,
            }}
            aria-hidden
          >
            {theme.letters[theme.letterOf[n.id]]}
          </span>
        ))}
    </div>
  );
}

export function Name() {
  const [name, setName] = useState(() => heldTheme()?.name ?? "");
  const [id, setId] = useState<CipherId>(
    () => (heldTheme()?.cipher as CipherId) ?? "french",
  );
  const { letters, theme, why } = useMemo(() => offer(name, id), [name, id]);
  const example = useMemo(() => offer(ANCHOR, "french").theme!, []);
  useEffect(() => {
    if (theme) hold(name, id, theme);
    else clear();
  }, [name, id, theme]);

  const shown = theme ?? example;
  const seconds = Math.round(
    (Math.max(...shown.chart.notes.map((n) => n.beat + n.duration)) * 60) /
      shown.chart.bpm,
  );
  return (
    <main className={css.page} data-testid="name-page">
      <header className={css.head}>
        <h1 className={css.title}>Your name, in music</h1>
        <Link href="/lab" className={css.back}>
          Lab
        </Link>
      </header>
      <div className={css.body}>
        <section className={css.side} aria-label="Your name">
          <label className={css.field}>
            <MonoLabel>Your name</MonoLabel>
            <input
              className={css.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ANCHOR}
              maxLength={60}
              autoComplete="off"
              spellCheck={false}
              data-testid="name-input"
            />
          </label>
          <div className={css.row} role="group" aria-label="Cipher">
            {(Object.keys(CIPHERS) as CipherId[]).map((c) => (
              <button
                key={c}
                type="button"
                {...kitChip(c === id)}
                aria-pressed={c === id}
                onClick={() => setId(c)}
                data-testid={`name-cipher-${c}`}
              >
                {CIPHERS[c].label}
              </button>
            ))}
          </div>
          <p className={css.small}>{CIPHERS[id].line}</p>
          <p className={css.status} role="status" data-testid="name-status">
            {why ??
              (theme
                ? `${pcName(theme.key, theme.key)} major · ${theme.chart.bpm} bpm · ${seconds} s, the theme then its inversion`
                : `Type a name. Under it, ${ANCHOR}: the motif the 1909 centenary pieces were written on.`)}
          </p>
          {theme && (
            <div className={css.actions}>
              <Link
                href={LISTEN}
                {...kitButton("primary")}
                data-testid="name-listen"
              >
                Listen
              </Link>
              <Link
                href={PLAY}
                {...kitButton("secondary")}
                data-testid="name-play"
              >
                Play your name
              </Link>
              <button
                type="button"
                {...kitButton("secondary")}
                onClick={() => setName("")}
                data-testid="name-clear"
              >
                Clear
              </button>
            </div>
          )}
          <p className={css.small}>
            Your name stays in this tab. It&rsquo;s never saved or sent, and
            leaving this page and the take clears it. Letters past{" "}
            {composeSettings.maxLetters} are left out.
          </p>
        </section>
        <section className={css.main} aria-label="The theme">
          <Strip
            letters={theme ? letters : ANCHOR}
            id={theme ? id : "french"}
            theme={shown}
            example={!theme}
          />
          <Roll theme={shown} />
          <p className={css.chords} aria-label="Chords">
            {shown.chords
              .filter((c, i) => i === 0 || c !== shown.chords[i - 1])
              .join(" · ")}
          </p>
        </section>
      </div>
    </main>
  );
}
