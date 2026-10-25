// /harmony/all (spec: harmony-map): the atlas. Every library song's constellation at one scale, each a link to its
// map. Rendered on the server from atlas.ts.
import Link from "next/link";
import css from "./harmony.module.css";
import { Legend } from "./Legend";
import type { WallSong } from "./atlas";

export function Wall({ songs }: { songs: WallSong[] }) {
  return (
    <main className={css.page} data-testid="harmony-wall">
      <header className={css.head}>
        <h1 className={css.title}>The Harmony Atlas</h1>
        <span className={css.sub}>
          {songs.length} songs, each triad a triangle on Euler&rsquo;s Tonnetz, all at one scale
        </span>
        <nav className={css.nav}>
          <Link href="/harmony?song=moonlight-1">The map, live</Link>
          <Link href="/lab">Lab</Link>
        </nav>
      </header>
      <Legend />
      <ul className={css.wall}>
        {songs.map((s) => (
          <li key={s.id}>
            <Link className={css.plate} href={`/harmony?song=${encodeURIComponent(s.id)}`} data-song={s.id}>
              <span dangerouslySetInnerHTML={{ __html: s.svg }} />
              <span className={css.plateTitle}>{s.title}</span>
              <span className={css.plateMeta}>
                {s.composer} · {s.chords ? `${s.chords} changes, home ${s.home}` : "no full triad: a melody"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
