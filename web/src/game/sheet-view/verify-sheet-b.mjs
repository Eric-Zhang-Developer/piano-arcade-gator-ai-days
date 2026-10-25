// One of verify-sheet.mjs's three CI groups (#673): its follow run, every assertion unchanged, on these songs only.
// CI runs the three in parallel shards instead of the whole file (seven songs, 7 min, one shard's floor).
// Usage: node web/src/game/sheet-view/verify-sheet-b.mjs --out <dir>
process.argv.push("--songs", "minuet-g,chopin-prelude-4");
await import("./verify-sheet.mjs");
