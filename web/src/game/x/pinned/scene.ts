// Pinned's three.js scene (spec: pinned, Look): the brass cylinder and its pins, the steel comb, a crank, under a
// RoomEnvironment map and one warm key light. The geometry and units are stl.ts's, so the export is what's on screen.
// The values are choices (decision pinned-model).
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { toothLengths, type Pinned } from "./cylinder";
import { modelSettings as M } from "./stl";

export const sceneSettings = {
  bg: "#030607", // the Duo ground
  brass: { color: "#c8a04a", metalness: 0.95, roughness: 0.35 },
  steel: { color: "#c9ced8", metalness: 1, roughness: 0.22 },
  key: { color: "#ffe2b0", intensity: 2.2 }, // one warm light, high and to the right
  liftDeg: 5, // how far before the comb a pin starts lifting its tooth
  deflectRad: 0.09, // a tooth's tip swing at full lift
  wobbleHz: 9, // the ring, slowed to be seen
  wobbleS: 0.35,
  pixelRatioCap: 1.5,
  wide: { position: [38, 12, 48], target: [0, -8, 0] },
  macro: { offset: [4, -2, 10], aperture: 0.0035, maxblur: 0.009 },
  moveS: 0.7, // a camera move between wide and macro; reduced motion jumps
};

export interface MusicBox {
  frame(turnRad: number, still: boolean): void; // the drum's turn: a pin at angle a is at the comb when turn = a
  setMacro(on: boolean, instant: boolean): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export function makeMusicBox(canvas: HTMLCanvasElement, p: Pinned): MusicBox | null {
  const S = sceneSettings;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null; // no WebGL: the page says so
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.pixelRatioCap));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(S.bg);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(S.key.color, S.key.intensity);
  key.position.set(30, 40, 30);
  scene.add(key);

  const brass = new THREE.MeshStandardMaterial(S.brass);
  const steel = new THREE.MeshStandardMaterial(S.steel);
  const span = Math.max(1, p.teeth.length) * M.toothPitch;
  const x0 = -span / 2;
  const toothX = (i: number) => x0 + (i + 0.5) * M.toothPitch;
  const length = span + 2 * M.margin;

  // The drum turns about x. Its pins stand radially out of it, as in stl.ts.
  const drum = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(M.drumRadius, M.drumRadius, length, 128).rotateZ(Math.PI / 2), brass);
  drum.add(body);
  const pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(M.pinRadius, M.pinRadius, M.pinHeight, M.pinSides), brass, Math.max(1, p.pins.length));
  const m = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  p.pins.forEach((pin, i) => {
    const a = (pin.angleDeg * Math.PI) / 180;
    const d = new THREE.Vector3(0, -Math.cos(a), Math.sin(a));
    const q = new THREE.Quaternion().setFromUnitVectors(up, d);
    m.compose(d.clone().multiplyScalar(M.drumRadius + M.pinHeight / 2).setX(toothX(pin.tooth)), q, new THREE.Vector3(1, 1, 1));
    pins.setMatrixAt(i, m);
  });
  pins.count = p.pins.length;
  drum.add(pins);
  // The crank, past the drum's right end: an axle, an arm and a knob, turning with it.
  const end = length / 2;
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 6, 24).rotateZ(Math.PI / 2), steel);
  axle.position.x = end + 3;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 10, 1.6), brass);
  arm.position.set(end + 6, 4.4, 0);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 4, 24).rotateZ(Math.PI / 2), brass);
  knob.position.set(end + 8.4, 8.6, 0);
  drum.add(axle, arm, knob);
  scene.add(drum);

  // The comb: a base bar, roots under the shorter teeth, and teeth that pivot at their roots.
  const tip = -(M.drumRadius + M.pinHeight - M.combGap);
  const baseTop = tip - M.longestTooth;
  const base = new THREE.Mesh(new THREE.BoxGeometry(span + 2, M.baseDepth, M.toothThick * 2), steel);
  base.position.set(0, baseTop - M.baseDepth / 2, 0);
  scene.add(base);
  const teeth = toothLengths(p.teeth, M.longestTooth).map((len, i) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(M.toothWidth, len, M.toothThick).translate(0, len / 2, 0), steel);
    t.position.set(toothX(i), tip - len, 0);
    scene.add(t);
    const rootH = tip - len - baseTop;
    if (rootH > 1e-6) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(M.toothPitch * 0.95, rootH, M.toothThick * 2), steel);
      r.position.set(toothX(i), baseTop + rootH / 2, 0);
      scene.add(r);
    }
    return t;
  });
  // Each tooth's pins, by angle, for the lift and the ring.
  const byTooth = p.teeth.map((_, i) => p.pins.filter((x) => x.tooth === i).map((x) => (x.angleDeg * Math.PI) / 180));
  const lengthS = p.lengthMs / 1000;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 600);
  const target = new THREE.Vector3(...(S.wide.target as [number, number, number]));
  camera.position.set(...(S.wide.position as [number, number, number]));
  camera.lookAt(target);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 140;

  // The macro view: close to the pluck point of the middle tooth, focused there.
  const mid = toothX(Math.floor(p.teeth.length / 2));
  const pluck = new THREE.Vector3(mid, tip + 0.3, 0);
  const macroAt = pluck.clone().add(new THREE.Vector3(...(S.macro.offset as [number, number, number])));
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: macroAt.distanceTo(pluck), aperture: S.macro.aperture, maxblur: S.macro.maxblur });
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  let macro = false;
  let move: { from: THREE.Vector3; to: THREE.Vector3; look0: THREE.Vector3; look1: THREE.Vector3; t0: number } | null = null;

  return {
    frame(turn, still) {
      drum.rotation.x = turn;
      teeth.forEach((t, i) => {
        let lift = 0;
        for (const a of byTooth[i]) {
          const ahead = a - turn; // > 0: the pin is still coming
          const liftRad = (S.liftDeg * Math.PI) / 180;
          if (ahead > 0 && ahead < liftRad) lift = Math.max(lift, 1 - ahead / liftRad);
          else if (!still && ahead <= 0) {
            const since = (-ahead / (2 * Math.PI)) * lengthS; // seconds since this pin let go
            if (since < S.wobbleS * 4) lift = Math.max(lift, Math.abs(Math.exp(-since / S.wobbleS) * Math.cos(2 * Math.PI * S.wobbleHz * since)) * 0.6);
          }
        }
        t.rotation.x = lift * S.deflectRad;
      });
      if (move) {
        const k = Math.min(1, (performance.now() - move.t0) / (S.moveS * 1000));
        const e = k * k * (3 - 2 * k);
        camera.position.lerpVectors(move.from, move.to, e);
        controls.target.lerpVectors(move.look0, move.look1, e);
        if (k >= 1) move = null;
      }
      controls.update();
      if (macro) {
        (bokeh.uniforms as Record<string, { value: number }>).focus.value = camera.position.distanceTo(pluck);
        composer.render();
      } else renderer.render(scene, camera);
    },
    setMacro(on, instant) {
      macro = on;
      const to = on ? macroAt : new THREE.Vector3(...(S.wide.position as [number, number, number]));
      const look1 = on ? pluck : target;
      if (instant) {
        camera.position.copy(to);
        controls.target.copy(look1);
        move = null;
      } else move = { from: camera.position.clone(), to, look0: controls.target.clone(), look1, t0: performance.now() };
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
    dispose() {
      controls.dispose();
      composer.dispose();
      pmrem.dispose();
      env.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      brass.dispose();
      steel.dispose();
      renderer.dispose();
    },
  };
}
