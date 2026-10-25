// Types for the vendored solver (fluid.js), as wet-paint calls it.
export interface FluidConfig {
  SIM_RESOLUTION: number;
  DYE_RESOLUTION: number;
  DENSITY_DISSIPATION: number;
  VELOCITY_DISSIPATION: number;
  PRESSURE: number;
  PRESSURE_ITERATIONS: number;
  CURL: number;
  SPLAT_RADIUS: number;
  SHADING: boolean;
  BACK_COLOR: { r: number; g: number; b: number }; // 0-255
  TRANSPARENT: boolean;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Fluid {
  config: FluidConfig;
  // x, y in 0-1 from the bottom left; dx, dy a force in the solver's units; color linear, unclamped
  splat(x: number, y: number, dx: number, dy: number, color: Rgb, radius?: number): void;
  step(dt: number): void;
  fix(): void;
  clear(): void;
  render(): void;
  resize(): boolean;
  reinit(): void;
  simSize(): { width: number; height: number };
  gl: WebGL2RenderingContext | WebGLRenderingContext;
}

export function createFluid(canvas: HTMLCanvasElement, overrides?: Partial<FluidConfig>): Fluid;
