// Cover art generated from a song's id: a cabinet-color gradient and one word, so no jacket is an image or another
// artist's cover (visual-direction.md). Palettes are picked by hand, not mixed at random, so every pair works.
import { cyan, ink, magenta, sky, sun, sunFrom, sunTo, tierX1, tierX2, tierX3, tierX4 } from "../ui-tokens";

export type Jacket = { angle: number; stops: string[]; text: string; word: string };

// Light palettes take sky-colored text, dark ones take ink.
// One dominant hue each, so two songs that share a palette at least differ in angle and word.
const palettes: { stops: string[]; text: string }[] = [
  { stops: [sunFrom, sunTo], text: sky }, // sunset
  { stops: [magenta, sky], text: ink }, // magenta night
  { stops: [cyan, sky], text: ink }, // cyan night
  { stops: [sun, magenta], text: sky }, // orange to magenta
  { stops: [tierX4, sky], text: ink }, // violet night
  { stops: [tierX3, cyan], text: sky }, // green to cyan
  { stops: [sky, sunTo], text: ink }, // night to pink
  { stops: [sunFrom, tierX3], text: sky }, // yellow to green
  { stops: [tierX1, magenta], text: sky }, // white to magenta
  { stops: [tierX2, sky], text: ink }, // orange night
];
const angles = [0, 45, 90, 135, 180, 225, 270, 315];

export const jacketColors = new Set([cyan, magenta, sky, sun, sunFrom, sunTo, tierX1, tierX2, tierX3, tierX4]);

const articles = new Set(["a", "an", "the", "le", "la", "les", "l'", "der", "die", "das", "el", "il"]);

// FNV-1a: tiny, stable across runs and machines.
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// 10 palettes x 8 angles is 80 looks, so a growing library collides. A song whose id lands on another's angle and
// first color re-rolls its hash here (song-jacket.test.ts finds the clash); a new entry moves no existing jacket.
const reroll: Record<string, number> = { "chopin-prelude-7": 1, "invention-1": 5, "mozart-331-theme": 2 };

export function jacketFor(id: string, title: string, composer: string): Jacket {
  const h = hash(reroll[id] ? `${id}#${reroll[id]}` : id);
  const p = palettes[h % palettes.length];
  const first = title.split(/\s+/)[0] ?? "";
  const word = articles.has(first.toLowerCase()) ? (composer.split(/\s+/).at(-1) ?? "") : first;
  return {
    angle: angles[(h >>> 8) % angles.length],
    stops: p.stops,
    text: p.text,
    word: word.replace(/[^\p{L}\p{N}'’-]/gu, ""),
  };
}
