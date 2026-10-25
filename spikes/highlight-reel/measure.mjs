// The highlight-reel spike's measurement (#913): every bar of the spec's Validation 2 on the three takes, each
// labeled PASS or FAIL. It exits 0 once it has measured, whatever the answer, so it lives outside web/src where CI
// doesn't run it; verify-highlight.mjs is the regression check. FINDINGS.md quotes this output.
// Usage: node spikes/highlight-reel/measure.mjs --out <dir>
import { outDir, runReelCheck } from "../../web/src/game/x/highlight-reel/reel-check.mjs";

const failures = await runReelCheck({ out: outDir("measure.mjs"), bars: [1, 2, 3, 4, 5, 6, 7], label: "highlight-measure" });
process.stdout.write(`highlight-measure: measured, ${failures.length ? `${failures.length} bar results FAIL` : "every bar PASS"}\n`);
process.exit(0);
