"use client";

// The Lab's sound board (#1396): one button per milestone sound, and Play all, through the game's own mix and Effects
// volume, so every sound can be heard in about a minute without playing a song to reach it.
import Link from "next/link";
import { useRef, useState } from "react";
import { getPrefs, mixInto, playMissCue } from "../sound";
import styles from "../lab/lab.module.css";
import { playVoice, type Voice } from "./voices";

type Pad = { sound: Voice | "miss"; name: string; when: string; lenS: number };

export const PADS: Pad[] = [
  { sound: "start", name: "Start", when: "the Start press", lenS: 0.8 },
  { sound: "stinger", name: "Combo step", when: "25, 50, then every 100", lenS: 0.8 },
  { sound: "sweep", name: "Fever", when: "fever ignites, on the beat", lenS: 1.2 },
  { sound: "miss", name: "Miss", when: "a miss in a short combo", lenS: 0.5 },
  { sound: "comboBreak", name: "Combo break", when: "a miss ends a combo of 20 or more", lenS: 0.7 },
  { sound: "clear", name: "Clear", when: "the last note, with misses", lenS: 1.2 },
  { sound: "fullComboCard", name: "Full combo", when: "the last note, no misses (NOSTALGIA's timing)", lenS: 4.6 },
  { sound: "allPerfect", name: "All perfect", when: "the last note, every hit PERFECT", lenS: 4.6 },
  { sound: "drumroll", name: "Drumroll", when: "the song ends, before the rank (not after a full combo)", lenS: 1.2 },
  { sound: "rankHit", name: "Rank thud", when: "the rank stamp lands", lenS: 1.1 },
  { sound: "settle", name: "Results settle", when: "600 ms after the rank", lenS: 1.8 },
  { sound: "newRecord", name: "New record", when: "NEW RECORD stamps", lenS: 1.3 },
];

export function SoundBoard() {
  const out = useRef<{ ctx: AudioContext; head: GainNode } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const mix = () => {
    if (!out.current) {
      const ctx = new AudioContext();
      out.current = { ctx, head: mixInto(ctx) };
    }
    const p = getPrefs();
    out.current.head.gain.value = p.muted ? 0 : p.volume;
    void out.current.ctx.resume();
    return out.current;
  };
  const play = (pad: Pad, t: number) => {
    const { ctx, head } = mix();
    if (pad.sound === "miss") playMissCue(ctx, head, t);
    else playVoice(ctx, head, pad.sound, t, 1, 100);
  };
  const playAll = () => {
    const { ctx } = mix();
    let t = ctx.currentTime + 0.1;
    for (const pad of PADS) {
      play(pad, t);
      const at = t;
      setTimeout(() => setPlaying(pad.sound), (at - ctx.currentTime) * 1000);
      t += pad.lenS + 0.4;
    }
    setTimeout(() => setPlaying(null), (t - ctx.currentTime) * 1000);
  };

  return (
    <main className={styles.lab}>
      <header className={styles.head}>
        <h1 className={styles.title}>Sounds</h1>
        <p className={styles.sub}>Every milestone sound, through the game’s mix and your Effects volume. Never on a note.</p>
        <nav className={styles.links}>
          <button type="button" className={styles.back} onClick={playAll} style={{ background: "none", border: 0, font: "inherit", cursor: "pointer" }}>
            Play all ▶
          </button>
          <Link href="/lab" className={styles.back}>
            Lab
          </Link>
        </nav>
      </header>
      <ul className={styles.entries} style={{ columns: 3, columnGap: "2.2em", marginTop: "1em" }}>
        {PADS.map((pad) => (
          <li key={pad.sound}>
            <button
              type="button"
              className={styles.entry}
              onClick={() => play(pad, mix().ctx.currentTime + 0.02)}
              aria-pressed={playing === pad.sound}
              style={{ width: "100%", textAlign: "left", background: "none", border: 0, font: "inherit", color: "inherit", cursor: "pointer" }}
            >
              <span className={styles.name}>{pad.name}</span>
              <span className={styles.desc}>{pad.when}</span>
              <span className={styles.open}>{playing === pad.sound ? "playing" : "play ▶"}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
