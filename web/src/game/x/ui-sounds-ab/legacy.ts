// The UI sounds as they were before ui-sound-family: ui-sounds' old uiSound switch, kept as data so the Lab A/B can
// play it and the measurements can render it. Pruning the experiment deletes this.
import { beatSettings } from "../../beat";
import { tone } from "../../sound";
import type { UiSound } from "../../ui-sounds";
import { UI_PEAK } from "../../ui-sounds";

export interface LegacyTone {
  type: OscillatorType;
  hz: number;
  atS: number;
  lenS: number;
}

const C5 = 523.25;
const semis = (n: number) => C5 * 2 ** (n / 12);

export function legacyTones(name: UiSound): LegacyTone[] {
  switch (name) {
    case "move":
      return [{ type: "triangle", hz: semis(7), atS: 0, lenS: 0.03 }];
    case "confirm":
      return [
        { type: "triangle", hz: semis(7), atS: 0, lenS: 0.08 },
        { type: "triangle", hz: semis(12), atS: 0.07, lenS: 0.12 },
      ];
    case "back":
      return [
        { type: "triangle", hz: semis(12), atS: 0, lenS: 0.08 },
        { type: "triangle", hz: semis(7), atS: 0.07, lenS: 0.12 },
      ];
    case "sting":
      return [0, 4, 7, 12].map((s, i) => ({ type: "square" as const, hz: semis(s - 12), atS: i * 0.07, lenS: i === 3 ? 0.55 : 0.1 }));
    case "tick":
    case "tickAccent":
      return [{ type: "sine", hz: name === "tick" ? beatSettings.clickHz : beatSettings.clickAccentHz, atS: 0, lenS: beatSettings.clickLengthS }];
  }
}

export function playLegacy(ctx: AudioContext, out: AudioNode, name: UiSound, t: number): void {
  for (const x of legacyTones(name)) tone(ctx, out, x.type, x.hz, t + x.atS, x.lenS, UI_PEAK);
}
