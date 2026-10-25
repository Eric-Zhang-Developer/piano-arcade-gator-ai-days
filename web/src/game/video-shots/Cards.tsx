// /shots: the video's title and end cards, recorded under ?capture=1 at 1920×1080 (specs: video-shots, video-cards). The
// title is played: each letter lands on a note of the name's cipher motif (Title.tsx). The end card is the game's hit
// line at rest: the name, the tagline, the URL to type, and a facts line counted from git (facts.ts). Its timing comes
// from MOTION; reduced motion shows the end state at once.
import type { CSSProperties } from "react";
import Link from "next/link";
import { APP_NAME, CARDS, endSlots, MOTION, TAGLINE, type Card, type Part } from ".";
import styles from "./cards.module.css";
import { factsLine } from "./facts";
import facts from "./facts.json";
import { TitleCard } from "./Title";

const timing = (card: Card, part: Part): CSSProperties => {
  const m = MOTION[card][part]!;
  return { "--delay": `${m.delay}ms`, "--dur": `${m.dur}ms` } as CSSProperties;
};

function EndCard() {
  const [lead, second] = endSlots();
  const line = factsLine(facts.merged ? facts : null);
  return (
    <main className={styles.card} data-card="end">
      <div className={styles.stage}>
        <span className={`${styles.note} ${styles.right} ${styles.rest}`} aria-hidden />
        <span className={`${styles.note} ${styles.left} ${styles.rest}`} aria-hidden />
        <h1 className={`${styles.name} ${styles.small}`} style={timing("end", "name")}>{APP_NAME}</h1>
      </div>
      <div className={styles.line} style={timing("end", "line")} aria-hidden />
      <div className={styles.links} style={timing("end", "words")}>
        <p className={styles.endTagline}>{TAGLINE}</p>
        <p className={`${styles.live} ${styles.lead}`} style={{ "--chars": lead.length } as CSSProperties} data-testid="end-lead">
          {lead}
        </p>
        {second && <p className={`${styles.repo} ${styles.second}`} data-testid="end-repo">{second}</p>}
        {line && <p className={styles.facts} data-testid="end-facts">{line}</p>}
      </div>
    </main>
  );
}

// No card (or an unknown one): the cards as links, for whoever is recording. Not linked from any page.
function Index() {
  return (
    <main className={styles.index}>
      <h1 className={styles.indexTitle}>Video cards</h1>
      {CARDS.map((c) => (
        <Link key={c} className={styles.indexLink} href={`/shots?card=${c}&capture=1`}>
          {c === "title" ? "Title card" : "End card"}
        </Link>
      ))}
    </main>
  );
}

export function Shots({ card }: { card?: Card }) {
  if (card === "title") return <TitleCard />;
  if (card === "end") return <EndCard />;
  return <Index />;
}
