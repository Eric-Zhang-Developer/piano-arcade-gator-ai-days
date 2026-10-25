// The action's proportions in mm (spec: inside, build step 1). Side profile: s runs from the key's front (the player)
// to the back, y up from the keybed. Where each number comes from is in specs/decisions/inside-geometry.md; numbers
// no readable source gives are choices, and the page says so.

export const SOURCE: { label: string; url: string | null } = {
  label: "Blow and let-off after Askenfelt & Jansson (KTH); key dip, backcheck and damper after two expired patents; the rest illustrative.",
  url: "https://www.speech.kth.se/music/5_lectures/askenflt/timing.html",
};

export const G = {
  key: { len: 520, h: 22, balance: 240, dip: 9.9 }, // dip: the front's travel, mm (Voit US 8,865,989's worked example)
  capstan: { s: 330, h: 12 },
  wippen: { pivotS: 270, pivotY: 40, len: 150, h: 12 },
  jack: { s: 360, h: 40, w: 6 },
  repetition: { s: 300, len: 100, h: 7 }, // the lever along the wippen's top, pivoted near its front
  shank: { pivotS: 342, pivotY: 93, len: 130, r: 4 }, // the knuckle sits over the jack, 18 mm behind the pivot
  head: { w: 22, h: 46, molding: 12 },
  blow: 47, // the hammer's travel to the string (KTH: typically 45–47 mm)
  letOff: 2, // the hammer's distance from the string at let-off (KTH: typically 1–3 mm)
  check: 12, // the hammer's distance from the string where the backcheck catches it (Kawai US 5,159,762's rule: 10–15 mm)
  backcheck: { s: 500, h: 40, w: 10 },
  damper: { s: 560, lift: 8, block: [40, 22] as [number, number] },
  string: { from: 300, to: 760, r: 0.6 },
  row: { keyWidth: 23.41 }, // the row view: key pitch 1194/51 mm (Voit); hammers spread evenly over the keys' span
};

// The hammer's angle per unit of travel: the head swings `blow` mm on a shank `len` long.
export const blowAngle = Math.asin(G.blow / (G.shank.len + G.head.w / 2));
// The key's tilt at full dip, about the balance point.
export const dipAngle = Math.atan(G.key.dip / G.key.balance);
// Where the string sits: the hammer's top at rest, plus the blow distance.
export const stringY = G.shank.pivotY + G.head.molding + G.head.h + G.blow;
