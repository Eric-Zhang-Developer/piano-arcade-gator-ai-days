# perf-budget: headless Chromium draws on the Mac's GPU

Context: the spec runs Playwright's headless Chromium, where WebGL defaults to SwiftShader (software). On the first
full run at 2514495, fever-stage's own frame guard (mean rAF interval over 20 ms for 1 s) froze the stage in all 3
runs, so every run was invalid and the number said nothing about the stage.

Options: (A) keep SwiftShader and report invalid runs; (B) on macOS, launch with `--use-angle=metal --enable-gpu
--ignore-gpu-blocklist` so WebGL draws on the GPU (renderer "ANGLE Metal Renderer: Apple M2"); (C) a `--gpu` switch,
off by default.

Choice: B. The target is Eric's MacBook, which draws on its GPU, so B is closer to the scene being filmed than A, and
C would make the one command give an invalid result by default. Other platforms keep Chromium's default; the renderer
string in perf.json says which ran. The line ends `invalid` (not `over budget`) when a run is invalid, so an invalid
run isn't read as a slow one.

How to undo: drop the `gpu` args in `perf.mjs`'s `chromium.launch`.
