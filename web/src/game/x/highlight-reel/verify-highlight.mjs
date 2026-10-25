// Headless check of the highlight-reel spike, the part that must keep working (CI runs it by name): three takes
// render to WebM, 15.0 ± 0.1 s long, with one audio and one video stream; a second render repeats the sound and every
// 30th frame; no console error. The spike's own question (60 fps, sync, the slow-motion frame) is measured by
// spikes/highlight-reel/measure.mjs, which a "no" can't turn red (FINDINGS.md).
// Usage: node web/src/game/x/highlight-reel/verify-highlight.mjs --out <dir>
import { outDir, runReelCheck } from "./reel-check.mjs";

const failures = await runReelCheck({ out: outDir("verify-highlight.mjs"), bars: [1, 3, 6, 7], label: "verify-highlight" });
process.stdout.write(failures.length ? `verify-highlight: FAIL (${failures.length}): ${failures.join("; ")}\n` : "verify-highlight: pass\n");
process.exit(failures.length ? 1 : 0);
