// The video's two cards (spec: video-shots): what they say and when each part moves. The page is Cards.tsx; the
// recording URLs are in specs/features/video-shots/shot-list.md.
import { APP_NAME } from "../app-name";
import { GITHUB_URL } from "../nav-bar/slots";

export const CARDS = ["title", "end"] as const;
export type Card = (typeof CARDS)[number];
export const isCard = (v: unknown): v is Card => CARDS.includes(v as Card);

// Quoted as written in the dialogue's Book I (specs/context/dialogues/2026-10-25-what-are-we-building.md).
export const TAGLINE = "a machine that hears every note, and a reason to play one more time.";
export { APP_NAME };
// The tagline as it's set on the card: a line per clause, split after each comma, words unchanged.
export const clauses = (s: string) => s.split(/(?<=,) /);

// The live URL, once #792 deploys it: set NEXT_PUBLIC_LIVE_URL at build. Unset, the end card shows the repo alone.
export const LIVE_URL = (process.env.NEXT_PUBLIC_LIVE_URL ?? "").trim();

// A URL as a viewer types it: no scheme, no trailing slash.
export const bare = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
export const endLinks = (live = LIVE_URL) => [GITHUB_URL, ...(live ? [live] : [])].map(bare);
// The end card's two URL slots: the big one is the live URL, or the repo while that's unset (decision
// video-cards-end); the small one is the repo, when the live URL took the big one.
export const endSlots = (live = LIVE_URL): [string, string | null] => (live ? [bare(live), bare(GITHUB_URL)] : [bare(GITHUB_URL), null]);

// Each part's entrance, in ms from the card's first frame (decision video-shots-brief: a hard cut in, one move,
// then dead still). The CSS reads these through --delay and --dur, so this table is the only timing.
export type Part = "line" | "notes" | "flash" | "name" | "words";
export const MOTION: Record<Card, Partial<Record<Part, { delay: number; dur: number }>>> = {
  title: {}, // played: its timing is motif.ts's (video-cards)
  end: {
    line: { delay: 0, dur: 300 },
    name: { delay: 150, dur: 400 },
    words: { delay: 350, dur: 450 },
  },
};

// When a card stops moving: every part's delay plus its duration. The spec's bar is 2000 ms.
export const motionEnd = (card: Card) => Math.max(0, ...Object.values(MOTION[card]).map((m) => m.delay + m.dur));
