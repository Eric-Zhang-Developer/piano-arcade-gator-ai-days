"use client";
// "Replay on piano" and Stop, for the results screen. Hidden without a piano output (laptop keys).
import { useSyncExternalStore } from "react";
import { getReplayState, startReplay, stopReplay, subscribeReplay } from "./index";

const SERVER = { take: null, canReplay: false, playing: false };

export function ReplayOnPiano({ style }: { style?: React.CSSProperties }) {
  const s = useSyncExternalStore(subscribeReplay, getReplayState, () => SERVER);
  if (!s.canReplay) return null;
  return s.playing ? (
    <button style={style} onClick={stopReplay} data-testid="replay-stop">
      Stop
    </button>
  ) : (
    <button style={style} onClick={startReplay} data-testid="replay">
      Replay on piano
    </button>
  );
}
