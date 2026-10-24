# ui-tokens: names for the tokens the table doesn't name

**Context:** `visual-direction.md` names one variable per row, but two rows carry more than one value: the sun's
gradient ends (`#ffe66b` → `#ff3fa4`) and the four tier colors.

**Options:** A) `--pa-sun-from` / `--pa-sun-to` and `--pa-tier-x1`…`--pa-tier-x4` (camelCase `sunFrom`, `tierX1`);
B) one gradient string token (`--pa-sun-gradient`) and a tier array in TypeScript only.

**Choice:** A. Every value is one variable with one TypeScript twin, so the equality test covers all of them and CSS
can use any end alone. Shipped in #168 (`globals.css`) and this feature's `web/src/game/ui-tokens/index.ts`.

**How to undo:** rename in both files; the test fails until they match.
