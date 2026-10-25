// The stage's three.js scene: a star field on a transparent canvas, so the page's own ground shows behind it. The
// synthwave sun, the grid floor and the sky are retired everywhere, fever included (Eric, 2026-10-25; contract #728).
// Plain lines with a built-in material; no shaders, no postprocessing (spec: fever-stage, Defaults).
import * as THREE from "three";
import type { Frame } from "../../contracts";
import { stageSettings as S, type Look } from ".";

const STARS = 220;
const AMBER = new THREE.Color("#ffb02e"); // fever's amber (fever-arc)
const STAR_Z = -130;

export interface Scene {
  render(f: Frame, l: Look): void;
  dispose(): void;
}

function desaturate(c: THREE.Color, dip: number): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s * (1 - dip), hsl.l);
}

export function makeScene(el: HTMLElement, opacity: number): Scene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
  } catch {
    return null; // no WebGL: the game plays without a stage
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.pixelRatioCap));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { position: "absolute", inset: "0", opacity: String(opacity) });
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  camera.position.set(0, 0, 0);

  // Stars: short vertical segments across the whole view (there's no horizon to sit above now); in fever they stretch
  // into streaks. At STAR_Z the view is about 150 units tall and 270 wide at 16:9.
  const starPos = new Float32Array(STARS * 6);
  const starY = new Float32Array(STARS); // each star's resting height; fever's updraft scrolls them up from it
  for (let i = 0; i < STARS; i++) {
    const x = (Math.random() - 0.5) * 320;
    const y = (Math.random() - 0.5) * 170;
    starY[i] = y;
    starPos.set([x, y, STAR_Z, x, y + 0.3, STAR_Z], i * 6);
  }
  const starGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.LineBasicMaterial({ color: S.star });
  scene.add(new THREE.LineSegments(starGeo, starMat));
  let streak = 0.3;
  let rise = 0;
  let lastMs: number | null = null;

  let size = "";
  return {
    render(f, l) {
      if (`${f.width}x${f.height}` !== size) {
        size = `${f.width}x${f.height}`;
        renderer.setSize(f.width, f.height);
        camera.aspect = f.width / f.height;
        camera.updateProjectionMatrix();
      }
      const len = 0.3 + S.starStreak * l.heat;
      // Fever's updraft (#1374): the streaks rise with the fire instead of hanging still, faster as it burns hotter.
      const dt = lastMs === null ? 0 : Math.max(0, Math.min(100, f.nowMs - lastMs));
      lastMs = f.nowMs;
      const lift = (dt / 1000) * S.riseSpeed * Math.min(1, l.heat);
      if (len !== streak || lift > 0) {
        streak = len;
        rise = (rise + lift) % 170;
        for (let i = 0; i < STARS; i++) {
          const y = ((starY[i] + rise + 85) % 170) - 85;
          starPos[i * 6 + 1] = y;
          starPos[i * 6 + 4] = y + len;
        }
        starGeo.attributes.position.needsUpdate = true;
      }
      starMat.color.copy(desaturate(new THREE.Color(S.star).lerp(AMBER, l.tint ?? 0), l.dip));
      renderer.render(scene, camera);
    },
    dispose() {
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // free the WebGL context now, not at garbage collection, so Retries don't pile up
      canvas.remove();
    },
  };
}
