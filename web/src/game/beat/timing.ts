import type { Chart } from "../../contracts";
import { msPerBeat, settings } from "../core/settings";
import { meterFor } from "../sheet-xml";
import { overrides } from "../sheet-xml/overrides";

// Chart time and BPM use quarter notes. A musical pulse can be a dotted
// quarter (12/8), an eighth (3/8), or a half note (2/2).
export function beatTiming(chart: Pick<Chart, "id" | "bpm" | "beatsPerBar">) {
  const fallback = meterFor(chart.beatsPerBar);
  const meter = { ...fallback, ...overrides[chart.id] };
  const compound = meter.beatType === 8 && meter.beats >= 6 && meter.beats % 3 === 0;
  const pulseBeats = (4 / meter.beatType) * (compound ? 3 : 1);
  return {
    pulseBeats,
    pulseMs: pulseBeats * msPerBeat(chart.bpm),
    pulsesPerBar: chart.beatsPerBar / pulseBeats,
    countInBeats: countInBeats(chart),
    countInPulses: countInBeats(chart) / pulseBeats,
  };
}

// The existing eight-beat setting describes two 4/4 bars. Keep two complete
// bars in other meters too, so the count-in and song have the same phase.
export const countInBeats = (chart: Pick<Chart, "beatsPerBar">) =>
  (settings.countInBeats / 4) * chart.beatsPerBar;
