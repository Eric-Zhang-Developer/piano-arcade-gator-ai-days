// Hold to speak (speak-polish, #1201): the mic opens on press, and the take ends on release or after `ms`. dispose()
// is the page leaving: it clears the timer, stops a mic that's open or still opening, and hands nothing on, so a
// client navigation mid-hold can't play the take on the DGX.
export interface Take {
  samples: Float32Array;
  rate: number;
}
export interface Mic {
  stop: () => Take; // stops the tracks and closes the context
}

export function micHold(open: () => Promise<Mic>, ms: number, onTake: (take: Take) => void) {
  let mic: Mic | null = null;
  let opening = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let gone = false;
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const up = () => {
    clearTimer();
    const m = mic;
    mic = null;
    if (m && !gone) onTake(m.stop());
  };
  return {
    get open() {
      return opening || mic !== null;
    },
    // Resolves once the mic is open (or the page has gone); throws when it can't open.
    async down() {
      if (gone || opening || mic) return;
      opening = true;
      try {
        const m = await open();
        if (gone) {
          m.stop();
          return;
        }
        mic = m;
        timer = setTimeout(up, ms);
      } finally {
        opening = false;
      }
    },
    up,
    dispose() {
      gone = true;
      clearTimer();
      mic?.stop();
      mic = null;
    },
  };
}
