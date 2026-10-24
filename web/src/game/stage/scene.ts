// The stage's three.js scene: a grid floor to a horizon a third down the screen, a banded sun, stars, a burst ring.
// Plain meshes and lines with built-in materials; no shaders, no postprocessing (spec: fever-stage, Defaults).
import * as THREE from "three";
import type { Frame } from "../../contracts";
import { stageSettings as S, type Look } from ".";

const SPACING = 2; // world units between grid lines
const FAR = 100; // the grid's depth
const HALF_WIDTH = 60;
const SUN_SIZE = 34;
const SUN_Z = -FAR - 10;
const STARS = 220;

export interface Scene {
  render(f: Frame, l: Look, phase: number): void;
  dispose(): void;
}

const mix = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
function desaturate(c: THREE.Color, dip: number): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s * (1 - dip), hsl.l);
}

// A round sun, top color to bottom color, with horizontal bands cut out of its lower half, thicker toward the bottom.
function paintSun(ctx: CanvasRenderingContext2D, top: THREE.Color, bottom: THREE.Color) {
  const n = ctx.canvas.width;
  ctx.clearRect(0, 0, n, n);
  const g = ctx.createLinearGradient(0, 0, 0, n);
  g.addColorStop(0, `#${top.getHexString()}`);
  g.addColorStop(1, `#${bottom.getHexString()}`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(n / 2, n / 2, n / 2, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const y = n * (0.5 + i * 0.07);
    ctx.clearRect(0, y, n, 2 + i * 1.6);
  }
}

export function makeScene(el: HTMLElement, opacity: number): Scene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power" });
  } catch {
    return null; // no WebGL: the game plays without a stage
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.pixelRatioCap));
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { position: "absolute", inset: "0", opacity: String(opacity) });
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  const sky = new THREE.Color(S.sky);
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, FAR * 0.25, FAR);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  camera.position.set(0, 2.2, 0);

  // Floor: a dark plane that hides the sun's lower edge, and the grid on it.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 4, FAR * 3), new THREE.MeshBasicMaterial({ color: sky }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.01, -FAR);
  const gridMat = new THREE.LineBasicMaterial({ color: S.grid });
  const rails: number[] = [];
  for (let x = -HALF_WIDTH; x <= HALF_WIDTH; x += SPACING) rails.push(x, 0, SPACING, x, 0, -FAR);
  const across: number[] = [];
  for (let z = SPACING; z >= -FAR; z -= SPACING) across.push(-HALF_WIDTH, 0, z, HALF_WIDTH, 0, z);
  const railLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(rails, 3)), gridMat);
  const acrossLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(across, 3)), gridMat);

  // Sun, painted on a small canvas; repainted only when its colors change.
  const sunCanvas = document.createElement("canvas");
  sunCanvas.width = sunCanvas.height = 256;
  const sunCtx = sunCanvas.getContext("2d")!;
  const sunTex = new THREE.CanvasTexture(sunCanvas);
  sunTex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false }));
  sun.position.set(0, SUN_SIZE * 0.3, SUN_Z);
  let sunKey = "";

  // Stars: short vertical segments high in the sky; in fever they stretch into streaks.
  const starPos = new Float32Array(STARS * 6);
  for (let i = 0; i < STARS; i++) {
    const x = (Math.random() - 0.5) * 320;
    const y = 12 + Math.random() * 90;
    starPos.set([x, y, SUN_Z - 20, x, y + 0.3, SUN_Z - 20], i * 6);
  }
  const starGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.LineBasicMaterial({ color: S.star, fog: false });
  const stars = new THREE.LineSegments(starGeo, starMat);
  let streak = 0.3;

  // Full-combo burst: a ring that grows out of the sun and fades.
  const burstMat = new THREE.MeshBasicMaterial({ color: S.sunTopHot, transparent: true, fog: false, blending: THREE.AdditiveBlending });
  const burst = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), burstMat);
  burst.position.copy(sun.position);

  scene.add(floor, railLines, acrossLines, sun, stars, burst);

  let size = "";
  return {
    render(f, l, phase) {
      if (`${f.width}x${f.height}` !== size) {
        size = `${f.width}x${f.height}`;
        renderer.setSize(f.width, f.height);
        camera.aspect = f.width / f.height;
        camera.setViewOffset(f.width, f.height, 0, f.height / 6, f.width, f.height); // horizon a third down
        camera.updateProjectionMatrix();
      }
      const bg = desaturate(mix(S.sky, S.skyHot, l.heat), l.dip);
      sky.copy(bg);
      (floor.material as THREE.MeshBasicMaterial).color.copy(bg);
      gridMat.color.copy(desaturate(mix(S.grid, S.gridHot, l.heat).multiplyScalar(l.glow + l.flash * 0.6), l.dip));
      acrossLines.position.z = phase * SPACING;

      const key = `${l.heat.toFixed(2)}:${l.dip.toFixed(2)}`;
      if (key !== sunKey) {
        sunKey = key;
        paintSun(sunCtx, desaturate(mix(S.sunTop, S.sunTopHot, l.heat), l.dip), desaturate(mix(S.sunBottom, S.sunBottomHot, l.heat), l.dip));
        sunTex.needsUpdate = true;
      }
      sun.scale.setScalar(SUN_SIZE * (1 + (S.sunSwell - 1) * l.heat));

      const len = 0.3 + S.starStreak * l.heat;
      if (len !== streak) {
        streak = len;
        for (let i = 0; i < STARS; i++) starPos[i * 6 + 4] = starPos[i * 6 + 1] + len;
        starGeo.attributes.position.needsUpdate = true;
      }
      starMat.color.copy(desaturate(new THREE.Color(S.star), l.dip));

      burst.visible = l.burst !== null;
      if (l.burst !== null) {
        burst.scale.setScalar(SUN_SIZE * (0.5 + l.burst * 3));
        burstMat.opacity = 1 - l.burst;
      }
      renderer.render(scene, camera);
    },
    dispose() {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      sunTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // free the WebGL context now, not at garbage collection, so Retries don't pile up
      canvas.remove();
    },
  };
}
