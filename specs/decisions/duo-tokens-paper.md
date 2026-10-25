# duo-tokens: the paper hex

**Context.** visual-direction.md wants sheet music on "warm off-white" paper with black ink, inside the dark UI.
Eric and Andres gave no value. The duo-tokens spec leaves the pick to its worker, agreed with sheet-paper's worker.
Both features are eric-agent-3's (planner, 2026-10-25), so this one pick serves both.

**Options.**
- A: `#f2ede3` paper, `#16130f` ink. A warm, low-chroma cream, and a near-black with the same warm cast.
- B: `#ffffff` / `#000000`. Neutral, and the glare the brief warns against.
- C: a yellower parchment such as `#efe4c8`. It reads as aged paper, a different mood than "a lit music stand".

**Choice.** A. Ink on paper measures 15.9:1 (WCAG relative luminance, computed). Gold `#ffe27a` measures 1.10:1 on
it, and miss grey `#8a8f98` 2.78:1, so judged noteheads need sheet-paper's darker variants, as its spec already
plans.

**How to undo.** Change `--pa-paper` and `--pa-paper-ink` in `web/src/app/globals.css`, and `paper` and `paperInk` in
`web/src/game/ui-tokens/index.ts` (a test keeps them equal).
