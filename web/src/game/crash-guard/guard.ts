// The take's guard (spec: crash-guard). Pure apart from console.error, so it tests with no DOM. One throw from a plugin
// hook turns that plugin off for the rest of the take; every other plugin, and the frame loop, keep going.

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface Guard {
  // Runs fn unless the plugin is off. A throw logs one line, turns the plugin off and calls onFail.
  run(id: string, hook: string, fn: () => void): void;
  off(id: string): boolean;
}

export function createGuard(onFail: (id: string) => void): Guard {
  const offIds = new Set<string>();
  return {
    run(id, hook, fn) {
      if (offIds.has(id)) return;
      try {
        fn();
      } catch (e) {
        offIds.add(id);
        console.error(`crash-guard: ${id}'s ${hook} threw: ${message(e)}`);
        onFail(id);
      }
    },
    off: (id) => offIds.has(id),
  };
}

// Core's own frame work (drawHighway, the judge): it can't be turned off, so a throw is caught, logged once per
// distinct message, and the frame goes on. One per take.
export function coreGuard() {
  const seen = new Set<string>();
  return (what: string, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      const line = `crash-guard: ${what} threw: ${message(e)}`;
      if (seen.has(line)) return;
      seen.add(line);
      console.error(line);
    }
  };
}
