// <SelectStage />: a fixed layer behind the page on the ground color. It drew fever-stage's synthwave scene on a
// gradient to --pa-sky; the sun, the grid and the sky are retired everywhere (Eric, 2026-10-25; contract #728), and
// stars alone, still, outside fever, aren't worth a WebGL context (specs/decisions/select-stage-retire.md).
// /auth/login mounts it.
export function SelectStage() {
  return (
    <div
      data-testid="select-stage"
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", background: "var(--pa-bg)" }}
    />
  );
}
