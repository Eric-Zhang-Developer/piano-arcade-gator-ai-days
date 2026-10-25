// /shots: the video's title and end cards, recorded under ?capture=1 at 1920×1080 (spec: video-shots). The idea is the
// game's own hit line: on the title the two hands fall onto it and the name lands there; the end card is that line at
// rest. Each part's timing comes from MOTION; reduced motion shows the end state at once.
import type { CSSProperties } from "react";
import Link from "next/link";
import { APP_NAME, CARDS, clauses, endLinks, MOTION, TAGLINE, type Card, type Part } from ".";
import styles from "./cards.module.css";

const timing = (card: Card, part: Part): CSSProperties => {
  const m = MOTION[card][part]!;
  return { "--delay": `${m.delay}ms`, "--dur": `${m.dur}ms` } as CSSProperties;
};

function TitleCard() {
  return (
    <main className={styles.card} data-card="title">
      <div className={styles.stage}>
        <span className={`${styles.note} ${styles.right}`} style={timing("title", "notes")} aria-hidden>
          <span className={styles.flash} style={timing("title", "flash")} />
        </span>
        <span className={`${styles.note} ${styles.left}`} style={timing("title", "notes")} aria-hidden>
          <span className={styles.flash} style={timing("title", "flash")} />
        </span>
        <h1 className={styles.name} style={timing("title", "name")}>{APP_NAME}</h1>
      </div>
      <div className={styles.line} style={timing("title", "line")} aria-hidden />
      <p className={styles.tagline} style={timing("title", "words")}>
        {clauses(TAGLINE).map((c) => (
          <span key={c} className={styles.clause}>{c}</span>
        ))}
      </p>
    </main>
  );
}

function EndCard() {
  const [repo, live] = endLinks();
  return (
    <main className={styles.card} data-card="end">
      <div className={styles.stage}>
        <span className={`${styles.note} ${styles.right} ${styles.rest}`} aria-hidden />
        <span className={`${styles.note} ${styles.left} ${styles.rest}`} aria-hidden />
        <h1 className={`${styles.name} ${styles.small}`} style={timing("end", "name")}>{APP_NAME}</h1>
      </div>
      <div className={styles.line} style={timing("end", "line")} aria-hidden />
      <div className={styles.links} style={timing("end", "words")}>
        {live && <p className={styles.live} data-testid="end-live">{live}</p>}
        <p className={styles.repo} data-testid="end-repo">{repo}</p>
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
