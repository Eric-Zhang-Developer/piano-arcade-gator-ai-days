import type { Chart } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { meterFor } from "../sheet-xml";
import { overrides } from "../sheet-xml/overrides";

export const countdownSettings = { initialPulses: 3, resumePulses: 1 };

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
    countInBeats: countdownSettings.initialPulses * pulseBeats,
    countInPulses: countdownSettings.initialPulses,
  };
}

export const countInBeats = (chart: Pick<Chart, "id" | "bpm" | "beatsPerBar">) => beatTiming(chart).countInBeats;
