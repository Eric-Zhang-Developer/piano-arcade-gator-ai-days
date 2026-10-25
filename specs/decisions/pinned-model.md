# Pinned: the model's sizes, the pin shape, the triangle cap

Feature: `pinned` (#1171). The spec leaves these to the worker. Each is a value in `modelSettings`
(`web/src/game/x/pinned/stl.ts`), in millimetres, and the scene draws from the same values, so the export is what's on
screen. Undo any one by changing its value.

## The drum
- **Choice:** radius 12, 64 sides; its length is the comb's span (1.6 a tooth) plus 3 each end.
- **Why:** one revolution holds the whole take, so a bigger drum only spaces the pins further apart; 12 gives the 0:28 demo
  about 2.7 mm of rim per second (2π × 12 ÷ 28). 64 sides read as round in the scene and cost 256 triangles.
- **Not checked:** any real movement's drum. The page says "The STL is a model, not fitted to a commercial movement."

## The pins and the comb
- **Pins:** octagonal prisms, radius 0.4, standing 1 out of the drum. A round pin would need more sides for no visible
  gain at this size.
- **Teeth:** 1.2 wide, 0.6 thick, on a 1.6 pitch; the longest is 14. It was 22 until the design pass: at 22 the comb
  hung nearly twice the drum's radius below it and read as a slab (shots round 1 vs round 3). Lengths go as 1/√f
  from there (`toothLengths`), so only the scale changed, not the ratios the test checks.
- **Free teeth:** each tooth is its own shell, standing on a root block where it's shorter than the longest, so every
  tip sits the same 0.4 below the pins' reach.

## The triangle cap
- **Choice:** 200 000 triangles; `writeStl` throws past it.
- **What it holds:** a prism of n sides is 4n triangles, so the drum is 256, a pin 32, a box 16. The Twinkle demo
  (42 pins, 6 teeth, 5 roots, the base) is 256 + 42 × 32 + 12 × 16 = 1 792 triangles, about 90 KB. The cap allows
  about 6 200 pins, far past any take's length.
- **Why throw, not decimate:** a take past the cap is a bug upstream, and a silently thinner model would hide it.
