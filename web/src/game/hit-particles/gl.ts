// Hit particles on the GPU: one offscreen three.js renderer at DPR 1, outside the DOM, drawn into /play's overlay by
// juice's draw(), so the dust lies over the falling notes and under the HUD, with or without the stage (decision
// hit-particles-renderer). The shader computes each particle from (origin, born, seed): the CPU only writes spawns.
import * as THREE from "three";
import type { Frame } from "../../contracts";
import { DUST, FLOATS, WISP, governor, hitParticleSettings as S, particlePool, type Judgment } from "./pool";
import { feverHeat } from "../fever-arc";

export interface HitParticles {
  hit(x: number, width: number, y: number, judgment: Judgment, color: string): void;
  hold(x: number, width: number, y: number, color: string, dtMs: number): void; // a held hit key's stream
  draw(ctx: CanvasRenderingContext2D, f: Frame, dtMs: number): void;
  reset(): void;
  dispose(): void; // frees the renderer's WebGL context; the page made this one, so the page lets it go
}

const LIFE_MS = 3000; // the longest any particle lives (the shader's dust)
// The wisps' look (#1373, decision hit-particles-wisps-reference): life in ms, the head's lead over the tail in ms,
// and how high the head stops, as a share of the hit line's height (the space above it), and each segment's alpha.
const WISP_LIFE = [2200, 2600];
const WISP_LAG = [180, 260];
const WISP_RISE = [0.5, 0.85];
const WISP_ALPHA = 0.9;
const f = (n: number) => n.toFixed(4); // a GLSL float literal

const vertex = /* glsl */ `
uniform float uTime;
uniform vec2 uView;
uniform float uLine;
uniform float uRise;
uniform float uWarm; // fever's heat (fever-arc): the wisps' white core turns amber, the dust keeps the hand's color
attribute vec3 aParams; // seed, kind (a wisp's is 1 + its segment's place along the ribbon), bright
attribute vec3 aColor;
varying vec4 vColor;
varying float vWisp;
varying float vAngle;
varying float vThin;
varying float vLen;
float h(float n) { return fract(sin(aParams.x * 91.7 + n * 17.13) * 43758.5453); }
void hide() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }

// A wisp's path at age a (#1373, decision hit-particles-wisps-reference): slow out of the dust, a fast climb, then a
// stop where it hangs, drifting up a little. Sideways it makes one C or S bend, so its heading turns 90–180°.
vec2 path(float a, float life, float rise, float px) {
  float t = a / life;
  float stop = mix(0.65, 0.85, h(14.0));
  float k = pow(smoothstep(0.0, stop, t), 1.3);
  float bend = mix(0.6, 1.2, h(4.0)) * 3.1416;
  float side = mix(20.0, 45.0, h(15.0)) * px * sign(h(16.0) - 0.5);
  float x = (h(3.0) - 0.5) * 70.0 * px * k + side * (sin(bend * k + h(5.0) * 6.2832) - sin(h(5.0) * 6.2832));
  // A quicker wobble, about two body lengths long, bends the body itself into a crescent, a comma or an S.
  x += mix(10.0, 22.0, h(18.0)) * px * smoothstep(0.0, 0.3, t) * sin(a * mix(0.009, 0.014, h(19.0)) + h(20.0) * 6.2832);
  return vec2(x, -rise * k - 40.0 * px * max(0.0, t - stop));
}

// A wisp is a ribbon: each segment sits on the head's past path, s * lag ms behind it, so the body bends along where
// the head went, and when the head stops the tail catches up into a comma.
void ribbon() {
  float age = uTime - position.z;
  float life = mix(${f(WISP_LIFE[0])}, ${f(WISP_LIFE[1])}, h(1.0));
  float s = fract(aParams.y + 0.0001); // 0 the head, near 1 the tail
  float lag = mix(${f(WISP_LAG[0])}, ${f(WISP_LAG[1])}, h(17.0));
  float a = max(0.0, age - s * lag);
  if (age < 0.0 || age > life) { hide(); return; }
  float px = uView.y / 1080.0; // the reference's sizes are at 1080p
  float rise = max(uLine, 1.0) * mix(${f(WISP_RISE[0])}, ${f(WISP_RISE[1])}, h(2.0));
  vec2 p = path(a, life, rise, px);
  vec2 d = p - path(max(0.0, a - 16.0), life, rise, px);
  float x = position.x + p.x;
  float y = position.y + p.y;
  float gap = length(p - path(max(0.0, a - lag / ${f(S.wispSegments)}), life, rise, px)); // px to the next segment back
  // A blunt head and a needle tail, 5–9 px at the widest.
  float width = mix(8.0, 12.0, h(12.0)) * px * mix(0.8, 1.0, smoothstep(0.0, 0.1, s)) * pow(1.0 - s, 1.6);
  float size = clamp(max(width + 4.0, gap * 2.5), 3.0, 64.0);
  float lift = clamp((uLine - y) / 40.0, 0.0, 1.0);
  float fade = smoothstep(250.0, 600.0, age) * smoothstep(life, life - 450.0, age) * lift; // out of the dust, then gone
  vec3 hue = aColor / max(max(aColor.r, aColor.g), max(aColor.b, 0.01)); // the note's hue pushed to clipping
  vec3 core = mix(mix(hue, vec3(1.0), 0.3), vec3(1.0, 0.8, 0.38), uWarm); // #ffb02e lifted a little, in fever
  float head = mix(1.4, 1.0, smoothstep(0.0, 0.25, s)); // the blunt head burns brightest
  vColor = vec4(min(core * head, 1.0), aParams.z * fade * ${f(WISP_ALPHA)});
  vWisp = 1.0;
  vAngle = length(d) > 0.01 ? atan(d.y, d.x) : 1.5708;
  vThin = width / size;
  vLen = max(gap, 1.0) * 1.4 / size;
  gl_PointSize = size;
  gl_Position = vec4(x / uView.x * 2.0 - 1.0, 1.0 - y / uView.y * 2.0, 0.0, 1.0);
}

void main() {
  if (aParams.y > 0.5) { ribbon(); return; }
  float age = uTime - position.z;
  float life = mix(2000.0, 3000.0, h(1.0));
  if (age < 0.0 || age > life) { hide(); return; }
  float t = age / life;
  float ease = 1.0 - pow(1.0 - t, 2.2); // quick off the key, slowing as it rises
  float y = position.y - uRise * ease * mix(0.06, 1.0, pow(h(2.0), 3.0)); // most dust stays low, a cloud on the key
  float sway = sin(age * mix(0.0012, 0.0035, h(4.0)) + h(5.0) * 6.2832) * 12.0;
  float x = position.x + ((h(3.0) - 0.5) * 120.0 + sway) * ease;
  float lift = clamp((uLine - y) / 40.0, 0.0, 1.0); // dim on the line, full 40 px above it
  float fade = min(1.0, age / 70.0) * pow(1.0 - t, 1.6);
  float twinkle = 0.5 + 0.5 * sin(age * mix(0.008, 0.03, h(6.0)) + h(7.0) * 40.0);
  float puff = step(0.75, h(13.0)); // one speck in four is a faint soft puff: the clouds' haze
  float white = h(8.0) > 0.7 ? 0.8 : 0.3; // a white core among the note's hue
  vColor = vec4(mix(aColor, vec3(1.0), white), aParams.z * fade * twinkle * mix(0.35, 1.0, lift) * mix(1.0, 0.3, puff));
  vWisp = 0.0;
  vAngle = 0.0;
  vThin = 1.0;
  vLen = 1.0;
  gl_PointSize = mix(h(11.0) > 0.97 ? 3.0 : mix(1.2, 2.6, h(12.0)), mix(5.0, 9.0, h(12.0)), puff);
  gl_Position = vec4(x / uView.x * 2.0 - 1.0, 1.0 - y / uView.y * 2.0, 0.0, 1.0);
}`;

// Dust is a soft dot. A wisp segment is a short sharp-edged stroke turned along its path, vThin of the sprite across
// and vLen along; a run of them overlapping reads as one blade with at most a pixel or two of soft edge.
const fragment = /* glsl */ `
varying vec4 vColor;
varying float vWisp;
varying float vAngle;
varying float vThin;
varying float vLen;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  if (vWisp > 0.5) {
    float c = cos(vAngle), s = sin(vAngle);
    p = mat2(c, -s, s, c) * p; // along, across
    float across = abs(p.y) / max(vThin * 0.5, 0.001);
    float along = abs(p.x) / max(vLen * 0.5, 0.001);
    gl_FragColor = vec4(vColor.rgb, vColor.a * smoothstep(1.25, 0.8, across) * smoothstep(1.0, 0.4, along));
  } else gl_FragColor = vec4(vColor.rgb, vColor.a * exp(-dot(p, p) * 10.0));
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
  const uniforms = { uTime: { value: 0 }, uView: { value: new THREE.Vector2(1, 1) }, uLine: { value: 0 }, uRise: { value: 0 }, uWarm: { value: 0 } };
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
    const segments = kind === WISP ? S.wispSegments : 1;
    if (pool.spawn(kind, scaled(n), x, width, y, rgbOf(color), bright, clock, random, segments) > 0) aliveUntil = clock + LIFE_MS;
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
      spawn(WISP, (S.wispsPerSecHeld * dtMs) / 1000, x, width, y, color, 0.8);
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
      uniforms.uWarm.value = feverHeat();
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
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // Chrome keeps about 16 contexts a page; dispose alone leaves this one counted
    },
  };
}
