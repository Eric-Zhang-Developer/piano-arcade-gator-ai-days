// The jacket as a square that fills its parent (song-card's slot); the word is sized to the square and cropped by it.
import { jacketFor } from ".";
import styles from "./song-jacket.module.css";

export function SongJacket({ id, title, composer }: { id: string; title: string; composer: string }) {
  const j = jacketFor(id, title, composer);
  return (
    <div
      className={styles.jacket}
      style={{ background: `linear-gradient(${j.angle}deg, ${j.stops.join(", ")})`, color: j.text }}
      aria-hidden
    >
      <span className={styles.word}>{j.word}</span>
    </div>
  );
}
