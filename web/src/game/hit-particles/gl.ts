// Hit particles on the GPU: one offscreen three.js renderer at DPR 1, outside the DOM, drawn into /play's overlay by
// juice's draw(), so the dust lies over the falling notes and under the HUD, with or without the stage (decision
// hit-particles-renderer). The shader computes each particle from (origin, born, seed): the CPU only writes spawns.
import * as THREE from "three";
import type { Frame } from "../../contracts";
import { DUST, FLOATS, WISP, governor, hitParticleSettings as S, particlePool, type Judgment } from "./pool";

export interface HitParticles {
  hit(x: number, width: number, y: number, judgment: Judgment, color: string): void;
  hold(x: number, width: number, y: number, color: string, dtMs: number): void; // a held hit key's stream
  draw(ctx: CanvasRenderingContext2D, f: Frame, dtMs: number): void;
  reset(): void;
}

const LIFE_MS = 3000; // the longest any particle lives (the shader's dust)

const vertex = /* glsl */ `
uniform float uTime;
uniform vec2 uView;
uniform float uLine;
uniform float uRise;
attribute vec3 aParams; // seed, kind, bright
attribute vec3 aColor;
varying vec4 vColor;
varying float vWisp;
varying float vAngle;
float h(float n) { return fract(sin(aParams.x * 91.7 + n * 17.13) * 43758.5453); }
void main() {
  float age = uTime - position.z;
  float wisp = step(0.5, aParams.y);
  float life = mix(mix(2000.0, 3000.0, h(1.0)), mix(1600.0, 2600.0, h(1.0)), wisp);
  if (age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  float t = age / life;
  float ease = 1.0 - pow(1.0 - t, 2.2); // quick off the key, slowing as it rises
  float y = position.y - uRise * ease * mix(mix(0.2, 1.0, sqrt(h(2.0))), mix(0.55, 1.0, h(2.0)), wisp);
  float sway = sin(age * mix(0.0012, 0.0035, h(4.0)) + h(5.0) * 6.2832) * mix(12.0, 26.0, wisp);
  float x = position.x + ((h(3.0) - 0.5) * mix(130.0, 90.0, wisp) + sway) * ease;
  float lift = clamp((uLine - y) / (uView.y * 0.2), 0.0, 1.0); // dim near the line, brighter as it rises
  float fade = min(1.0, age / mix(70.0, 140.0, wisp)) * pow(1.0 - t, mix(1.6, 1.3, wisp));
  float twinkle = mix(0.5 + 0.5 * sin(age * mix(0.008, 0.03, h(6.0)) + h(7.0) * 40.0), 1.0, wisp);
  float white = mix(h(8.0) > 0.55 ? 0.85 : 0.2, 0.75, wisp); // a white core among the note's hue
  vColor = vec4(mix(aColor, vec3(1.0), white), aParams.z * fade * twinkle * mix(0.15, 1.0, lift) * mix(1.0, 0.7, wisp));
  vWisp = wisp;
  vAngle = h(9.0) * 6.2832 + age * mix(-0.003, 0.003, h(10.0));
  gl_PointSize = mix(h(11.0) > 0.97 ? 3.0 : mix(1.0, 2.2, h(12.0)), mix(40.0, 80.0, h(11.0)), wisp);
  gl_Position = vec4(x / uView.x * 2.0 - 1.0, 1.0 - y / uView.y * 2.0, 0.0, 1.0);
}`;

// Dust is a soft dot; a wisp is a crescent (a disc minus a slightly offset disc), tapered to two tips, turning.
const fragment = /* glsl */ `
varying vec4 vColor;
varying float vWisp;
varying float vAngle;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float a;
  if (vWisp > 0.5) {
    float c = cos(vAngle), s = sin(vAngle);
    p = mat2(c, s, -s, c) * p;
    a = smoothstep(0.46, 0.40, length(p)) * smoothstep(0.34, 0.41, length(p - vec2(0.08, 0.0)));
  } else a = exp(-dot(p, p) * 10.0);
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

export function hitParticles(): HitParticles | null {
  if (typeof document === "undefined") return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), alpha: true, antialias: false, powerPreference: "low-power" });
  } catch {
    return null; // no WebGL: juice keeps its 2D wisps and sparks
  }
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);

  const pool = particlePool();
  const buffer = new THREE.InterleavedBuffer(pool.data, FLOATS).setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  geometry.setAttribute("aParams", new THREE.InterleavedBufferAttribute(buffer, 3, 3));
  geometry.setAttribute("aColor", new THREE.InterleavedBufferAttribute(buffer, 3, 6));
  const uniforms = { uTime: { value: 0 }, uView: { value: new THREE.Vector2(1, 1) }, uLine: { value: 0 }, uRise: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    // Additive, and alpha adds too, so the canvas stays valid premultiplied color for the blit.
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(points);
  const camera = new THREE.Camera();

  const random = Math.random;
  const still = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const share = governor();
  let kept = 1; // the governor's share, times reduced motion's
  let clock = 0; // ms, advanced by the frames juice draws
  let aliveUntil = -Infinity;
  let lastWall: number | null = null;
  const rgbs = new Map<string, number[]>();
  const rgbOf = (hex: string) => {
    let c = rgbs.get(hex);
    if (!c) {
      const n = parseInt(hex.slice(1), 16);
      rgbs.set(hex, (c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]));
    }
    return c;
  };
  // n × kept, rounded at random, so a small share still spawns now and then instead of never.
  const scaled = (n: number) => {
    const v = n * kept;
    return Math.floor(v) + (random() < v - Math.floor(v) ? 1 : 0);
  };
  const spawn = (kind: number, n: number, x: number, width: number, y: number, color: string, bright: number) => {
    if (pool.spawn(kind, scaled(n), x, width, y, rgbOf(color), bright, clock, random) > 0) aliveUntil = clock + LIFE_MS;
  };
  const upload = (start: number, count: number) => {
    buffer.addUpdateRange(start * FLOATS, count * FLOATS);
    buffer.needsUpdate = true; // with no range three sends the whole pool, so only after a spawn
  };

  return {
    hit(x, width, y, judgment, color) {
      spawn(DUST, S.dust[judgment], x, width, y, color, S.bright[judgment]);
      spawn(WISP, S.wisps[judgment], x, width, y, color, S.bright[judgment]);
    },
    hold(x, width, y, color, dtMs) {
      spawn(DUST, (S.streamPerSec * dtMs) / 1000, x, width, y, color, 0.8);
    },
    draw(ctx, f, dtMs) {
      const wall = performance.now();
      kept = share(lastWall === null ? 0 : wall - lastWall) * (still?.matches ? S.reducedMotion : 1);
      lastWall = wall;
      clock += dtMs;
      if (clock > aliveUntil) return; // nothing alive: no render, no blit
      const w = Math.max(1, Math.round(f.width));
      const h = Math.max(1, Math.round(f.height));
      const size = renderer.getSize(uniforms.uView.value);
      if (size.x !== w || size.y !== h) renderer.setSize(w, h, false);
      uniforms.uView.value.set(w, h);
      uniforms.uTime.value = clock;
      uniforms.uLine.value = f.judgmentLineY;
      uniforms.uRise.value = h * 0.5; // spec: the dust rises to about half the screen
      pool.dirty(upload);
      renderer.render(scene, camera);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(renderer.domElement, 0, 0, f.width, f.height); // same task as the render: no preserveDrawingBuffer
      ctx.restore();
    },
    reset() {
      clock += LIFE_MS + 1; // every particle is past its life; nothing is written
    },
  };
}
