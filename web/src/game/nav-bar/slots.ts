// The nav bar's slots (spec: nav-bar). A slot shows only once its feature's done note is on main, Lab's rule, so How
// it's built appears by itself when changes/how-it-works.md lands. Client-safe: done.ts does the file reading.
import { labEntries } from "../lab/entries";

export interface Slot {
  label: string;
  path: string;
  slug: string; // the feature whose changes/<slug>.md turns the slot on
  devOnly?: boolean; // left out of a production build
}

export const SLOTS: Slot[] = [
  { label: "Play", path: "/", slug: "song-select" },
  { label: "Learn", path: "/learn", slug: "learning-ui" },
  { label: "Lab", path: "/lab", slug: "lab" },
  { label: "How it's built", path: "/how", slug: "how-it-works" },
  { label: "Progress", path: "/progress", slug: "take-store" },
  { label: "Status", path: "/operator", slug: "operator-board", devOnly: true }, // /operator's API routes 404 in production
];

export const GITHUB_URL = "https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days";

// Pages the bar never covers: the take, the audience's /stage and the kiosk loops. /operator shows it (Eric, 2026-10-25). Capture mode hides it.
export const HIDDEN_ON = ["/play", "/stage", "/cabinet", "/attract"];

export const hideNav = (pathname: string, capture: boolean) =>
  capture || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const under = (path: string, pathname: string) => pathname === path || pathname.startsWith(`${path}/`);
const ownSlot = (slot: Slot, pathname: string) => (slot.path === "/" ? pathname === "/" : under(slot.path, pathname));

// The pages you reach from the Lab that no other slot owns (/simon, /wrong-note, /sim, …): Lab is current there (#1043).
// Read from the Lab's own list, so a new entry lights Lab without an edit here.
export const LAB_PAGES = [...new Set(labEntries.map((e) => new URL(e.href, "http://lab").pathname))].filter(
  (p) => !SLOTS.some((s) => s.path !== "/lab" && ownSlot(s, p)),
);

// A slot is the current page on its own path or below it; Play only on / itself; Lab also on the pages it lists.
export const isCurrent = (slot: Slot, pathname: string) =>
  ownSlot(slot, pathname) || (slot.path === "/lab" && LAB_PAGES.some((p) => under(p, pathname)));
