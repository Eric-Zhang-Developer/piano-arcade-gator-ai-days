# ui-sounds: the AudioContext is made in idle time after load

Context: the spec's default makes the one AudioContext on the first sound after a gesture. Measured in Playwright's
Chromium on Eric's M2 while other agents ran, `new AudioContext()` blocked the main thread 294 ms headless and
1600 ms headed, and the first ↓ on `/` played its blip 604 ms after the key, with the focus move held up behind it.

Options: (A) the spec's default, and the first move hitches; (B) defer the first sound with setTimeout, so the
focus moves but the blip plays late; (C) make the context in `requestIdleCallback` after load, suspended and silent,
and `resume()` it on the first sound after a gesture.

Choice: C. The cost moves to idle time, nothing plays before a gesture (the activation gate is unchanged), and the
first move sounds at once. Not gated on the context's state: `resume()` is called and the nodes are scheduled
straight away, so they play as soon as it runs.

How to undo: delete the `requestIdleCallback` line in `web/src/game/ui-sounds/index.ts`.
