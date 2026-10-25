// The nav bar's slots (spec: nav-bar). A slot shows only once its feature's done note is on main, Lab's rule, so How
// it's built appears by itself when changes/how-it-works.md lands. Client-safe: done.ts does the file reading.
export interface Slot {
  label: string;
  path: string;
  slug: string; // the feature whose changes/<slug>.md turns the slot on
}

export const SLOTS: Slot[] = [
  { label: "Play", path: "/", slug: "song-select" },
  { label: "Learn", path: "/learn", slug: "learning-ui" },
  { label: "Lab", path: "/lab", slug: "lab" },
  { label: "How it's built", path: "/how", slug: "how-it-works" },
  { label: "Progress", path: "/progress", slug: "take-store" },
];

// Pages the bar never covers: the take, the kiosk loop and the operator's own screens. Capture mode hides it too.
export const HIDDEN_ON = ["/play", "/cabinet", "/attract", "/operator"];

export const hideNav = (pathname: string, capture: boolean) =>
  capture || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));

// A slot is the current page on its own path or below it; Play only on / itself.
export const isCurrent = (slot: Slot, pathname: string) =>
  slot.path === "/" ? pathname === "/" : pathname === slot.path || pathname.startsWith(`${slot.path}/`);
