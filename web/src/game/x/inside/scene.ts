// Inside's three.js scene (spec: inside, The look): one key's action in section, and all 88 hammers, dampers, keys and
// strings as instanced rows. Units are mm from geometry.ts; s (front to back) maps to −z. Materials are small textures
// drawn in code: no model or image is downloaded. Choices are logged in specs/decisions/inside-look.md.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Pose } from "./action";
import { blowAngle, dipAngle, G, stringY } from "./geometry";

export type View = "cutaway" | "row";

export const lookSettings = {
  bg: "#030607", // the Duo ground
  felt: "#d8ccb2",
  damperFelt: "#d4d5da", // the texture is light; each damper is tinted dark at rest and blue as it lifts
  damperRest: "#2a2a31",
  maple: "#c9a06a",
  keybed: "#2b2018",
  ivory: "#ece8de",
  ebony: "#121214",
  steel: { color: "#c9ced8", metalness: 1, roughness: 0.25 },
  lit: "#4f9bff", // a sounding string's glint: the kit's primary blue
  key: { color: "#ffe6c0", intensity: 2.4 },
  rim: { color: "#9fb4ff", intensity: 1.0 },
  swayDeg: 10, // the slow orbit: the camera swings this far each side
  swayS: 24, // one full swing
  shimmerHz: 7, // a ringing string's wave, slowed to be seen
  shimmerMm: 0.9, // its height at full amplitude, exaggerated to be seen
  escapeRad: 0.22, // how far the jack tips out from under the knuckle at let-off
  repetitionRad: 0.05, // the repetition lever's rise under the knuckle
  moveS: 0.8, // a camera move between the views; reduced motion jumps
  pixelRatioCap: 1.5,
  scale: (k: number) => 1980 * Math.pow(0.5, k / 16), // string length by key: an illustrative scale, not a measured one
};

export interface InsideScene {
  frame(poses: Pose[], amps: number[], latest: number, nowMs: number, still: boolean): void;
  setView(view: View, instant: boolean): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

// A small noisy texture of one colour, with optional grain streaks along u.
function texture(color: string, grain: number, speckle: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 128 && grain; y++) {
    g.fillStyle = `rgba(0,0,0,${(rand() * grain).toFixed(3)})`;
    g.fillRect(0, y, 128, 1);
  }
  for (let i = 0; i < 1400 && speckle; i++) {
    g.fillStyle = rand() < 0.5 ? `rgba(0,0,0,${speckle})` : `rgba(255,255,255,${speckle})`;
    g.fillRect(rand() * 128, rand() * 128, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const z = (s: number) => -s;
const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(p % 12);

// Each key's x across the keyboard: white keys side by side, black keys over the gap.
function keyXs(): number[] {
  const xs: number[] = [];
  let white = 0;
  for (let k = 0; k < 88; k++) {
    const p = k + 21;
    if (isBlack(p)) xs.push((white - 0.5) * G.row.keyWidth);
    else xs.push(white++ * G.row.keyWidth);
  }
  const mid = (xs[0] + xs[87]) / 2;
  return xs.map((x) => x - mid);
}

export function makeInside(canvas: HTMLCanvasElement, labelList: HTMLUListElement | null): InsideScene | null {
  const L = lookSettings;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, L.pixelRatioCap));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(L.bg);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.7;
  const keyLight = new THREE.DirectionalLight(L.key.color, L.key.intensity);
  keyLight.position.set(600, 900, 400);
  const rimLight = new THREE.DirectionalLight(L.rim.color, L.rim.intensity);
  rimLight.position.set(-500, 300, -900);
  scene.add(keyLight, rimLight);

  const textures = [texture(L.felt, 0, 0.06), texture(L.maple, 0.12, 0), texture(L.damperFelt, 0, 0.08), texture(L.keybed, 0.15, 0)];
  const felt = new THREE.MeshStandardMaterial({ map: textures[0], roughness: 1 });
  const maple = new THREE.MeshStandardMaterial({ map: textures[1], roughness: 0.6 });
  const damperFelt = new THREE.MeshStandardMaterial({ map: textures[2], roughness: 1 });
  const damperCut = new THREE.MeshStandardMaterial({ map: textures[2], roughness: 1, color: L.damperRest });
  const keybed = new THREE.MeshStandardMaterial({ map: textures[3], roughness: 0.8 });
  const ivory = new THREE.MeshStandardMaterial({ color: L.ivory, roughness: 0.35 });
  const ebony = new THREE.MeshStandardMaterial({ color: L.ebony, roughness: 0.4 });
  const steel = new THREE.MeshStandardMaterial(L.steel);
  const strings = new THREE.MeshStandardMaterial({ ...L.steel, color: "#ffffff" });
  const materials = [felt, maple, damperFelt, damperCut, keybed, ivory, ebony, steel, strings];
  const geometries: THREE.BufferGeometry[] = [];
  const geo = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g);
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(geo(g), m);

  // The parts, authored about their pivots. The key: maple body, ivory cap over its front 140 mm.
  const keyBody = () => geo(new THREE.BoxGeometry(1, G.key.h, G.key.len - 140).translate(0, G.key.h / 2, -(G.key.len + 140) / 2 + G.key.balance));
  const keyCap = () => geo(new THREE.BoxGeometry(1, G.key.h + 2, 140).translate(0, (G.key.h + 2) / 2, -70 + G.key.balance));
  const hammerGeo = geo(
    mergeGeometries([
      new THREE.CylinderGeometry(G.shank.r, G.shank.r, G.shank.len, 12).rotateX(Math.PI / 2).translate(0, 0, -G.shank.len / 2),
      new THREE.BoxGeometry(10, G.head.molding, G.head.w).translate(0, G.head.molding / 2, -G.shank.len),
    ])!,
  );
  const headGeo = geo(new THREE.CapsuleGeometry(G.head.w / 2, G.head.h - G.head.w, 4, 12).translate(0, G.head.molding + G.head.h / 2, -G.shank.len));
  const damperGeo = geo(new THREE.BoxGeometry(12, G.damper.block[1], G.damper.block[0]).translate(0, stringY + G.string.r + G.damper.block[1] / 2, z(G.damper.s)));

  // --- One key, in section ---
  const cut = new THREE.Group();
  const bed = mesh(new THREE.BoxGeometry(60, 8, 820).translate(0, -4, -380), keybed);
  const balanceRail = mesh(new THREE.BoxGeometry(40, 6, 20).translate(0, -1, z(G.key.balance)), maple);
  cut.add(bed, balanceRail);
  const key = new THREE.Group();
  key.position.set(0, 0, z(G.key.balance));
  const kb = new THREE.Mesh(keyBody(), maple);
  const kc = new THREE.Mesh(keyCap(), ivory);
  kb.scale.x = kc.scale.x = 22;
  const capstan = mesh(new THREE.CylinderGeometry(5, 5, G.capstan.h, 16).translate(0, G.key.h + G.capstan.h / 2, -(G.capstan.s - G.key.balance)), steel);
  const backcheck = mesh(new THREE.BoxGeometry(14, G.backcheck.h, G.backcheck.w).translate(0, G.key.h + G.backcheck.h / 2, -(G.backcheck.s - G.key.balance)), felt);
  key.add(kb, kc, capstan, backcheck);
  cut.add(key);

  const wippen = new THREE.Group();
  wippen.position.set(0, G.wippen.pivotY, z(G.wippen.pivotS));
  wippen.add(mesh(new THREE.BoxGeometry(16, G.wippen.h, G.wippen.len).translate(0, 0, -G.wippen.len / 2), maple));
  const jack = new THREE.Group();
  jack.position.set(0, G.wippen.h / 2, -(G.jack.s - G.wippen.pivotS));
  jack.add(mesh(new THREE.BoxGeometry(G.jack.w, G.jack.h, G.jack.w).translate(0, G.jack.h / 2, 0), maple));
  const rep = new THREE.Group();
  rep.position.set(0, G.jack.h - 6, -(G.repetition.s - G.wippen.pivotS));
  rep.add(mesh(new THREE.BoxGeometry(12, G.repetition.h, G.repetition.len).translate(0, 0, -G.repetition.len / 2), maple));
  wippen.add(jack, rep);
  cut.add(wippen);

  const hammer = new THREE.Group();
  hammer.position.set(0, G.shank.pivotY, z(G.shank.pivotS));
  hammer.add(new THREE.Mesh(hammerGeo, maple), new THREE.Mesh(headGeo, felt));
  hammer.add(mesh(new THREE.CylinderGeometry(6, 6, 14, 16).rotateZ(Math.PI / 2).translate(0, -G.shank.r - 5, -(G.jack.s - G.shank.pivotS)), felt)); // the knuckle
  cut.add(hammer);

  const damper = new THREE.Group();
  damper.add(new THREE.Mesh(damperGeo, damperCut));
  damper.add(mesh(new THREE.CylinderGeometry(1.2, 1.2, stringY - G.key.h, 8).translate(0, G.key.h + (stringY - G.key.h) / 2, z(G.damper.s)), steel));
  cut.add(damper);
  const cutString = mesh(new THREE.CylinderGeometry(G.string.r * 1.6, G.string.r * 1.6, G.string.to - G.string.from, 8).rotateX(Math.PI / 2).translate(0, stringY, z((G.string.from + G.string.to) / 2)), steel);
  cut.add(cutString);
  scene.add(cut);

  // The parts' names, pinned to the moving groups.
  const named: [string, THREE.Object3D, THREE.Vector3][] = [
    ["Key", key, new THREE.Vector3(0, G.key.h + 8, 60)],
    ["Wippen", wippen, new THREE.Vector3(0, -G.wippen.h - 4, -G.wippen.len + 25)],
    ["Jack", jack, new THREE.Vector3(0, G.jack.h + 30, 0)],
    ["Repetition lever", rep, new THREE.Vector3(0, 4, -G.repetition.len - 45)],
    ["Hammer", hammer, new THREE.Vector3(0, G.head.molding + G.head.h + 6, -G.shank.len)],
    ["Backcheck", key, new THREE.Vector3(0, G.key.h + G.backcheck.h + 6, -(G.backcheck.s - G.key.balance))],
    ["Damper", damper, new THREE.Vector3(0, stringY + G.damper.block[1] + 10, z(G.damper.s))],
    ["String", cut, new THREE.Vector3(0, stringY + 6, z(420))],
  ];
  const labelEls = named.map(([text]) => {
    const li = document.createElement("li");
    li.textContent = text;
    labelList?.append(li);
    return li;
  });

  // --- All 88, in a row ---
  const row = new THREE.Group();
  const xs = keyXs();
  const hx = (k: number) => xs[0] + (k / 87) * (xs[87] - xs[0]);
  const whites = xs.map((_, k) => !isBlack(k + 21));
  const nWhite = whites.filter(Boolean).length;
  const whiteKeys = new THREE.InstancedMesh(geo(keyCap().clone().scale(G.row.keyWidth - 1, 1, 1)), ivory, nWhite);
  const blackKeys = new THREE.InstancedMesh(geo(new THREE.BoxGeometry(13, 12, 90).translate(0, G.key.h + 8, -45 + G.key.balance)), ebony, 88 - nWhite);
  const hammers = new THREE.InstancedMesh(hammerGeo, maple, 88);
  const heads = new THREE.InstancedMesh(headGeo, felt, 88);
  const dampers = new THREE.InstancedMesh(damperGeo, damperFelt, 88);
  const unit = geo(new THREE.CylinderGeometry(G.string.r * 1.4, G.string.r * 1.4, 1, 6).rotateX(Math.PI / 2).translate(0, 0, -0.5));
  const rowStrings = new THREE.InstancedMesh(unit, strings, 88);
  const rowBed = mesh(new THREE.BoxGeometry(xs[87] - xs[0] + 80, 8, 820).translate(0, -4, -380), keybed);
  row.add(whiteKeys, blackKeys, hammers, heads, dampers, rowStrings, rowBed);
  row.visible = false;
  scene.add(row);
  const steelColor = new THREE.Color(L.steel.color);
  const litColor = new THREE.Color(L.lit);
  const tint = new THREE.Color();
  const damperRest = new THREE.Color(L.damperRest);
  for (let k = 0; k < 88; k++) {
    rowStrings.setColorAt(k, steelColor);
    dampers.setColorAt(k, damperRest);
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const ax = new THREE.Vector3(1, 0, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  const place = (im: THREE.InstancedMesh, i: number, x: number, y: number, zz: number, angle: number, scale = one) => {
    q.setFromAxisAngle(ax, angle);
    im.setMatrixAt(i, m4.compose(pos.set(x, y, zz), q, scale));
  };

  // --- Cameras: one per view, each with its slow sway ---
  const camera = new THREE.PerspectiveCamera(30, 1, 5, 8000);
  const views: Record<View, { at: THREE.Vector3; look: THREE.Vector3 }> = {
    cutaway: { at: new THREE.Vector3(750, 190, -380), look: new THREE.Vector3(0, 118, -385) },
    row: { at: new THREE.Vector3(0, 1100, 1250), look: new THREE.Vector3(0, 80, -420) },
  };
  let view: View = "cutaway";
  camera.position.copy(views.cutaway.at);
  camera.lookAt(views.cutaway.look);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(views.cutaway.look);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 300;
  controls.maxDistance = 3200;
  let move: { from: THREE.Vector3; to: THREE.Vector3; look0: THREE.Vector3; look1: THREE.Vector3; t0: number } | null = null;
  let swayWas = 0;
  const v3 = new THREE.Vector3();
  let width = 1;
  let height = 1;

  return {
    frame(poses, amps, latest, nowMs, still) {
      // One key: the latest one's pose.
      const p = poses[latest];
      const phi = p.key * dipAngle;
      key.rotation.x = phi;
      const rise = Math.sin(phi) * (G.capstan.s - G.key.balance);
      wippen.rotation.x = Math.asin(Math.min(1, rise / (G.capstan.s - G.wippen.pivotS)));
      const escaped = p.phase === "flight" || p.phase === "strike" || p.phase === "rebound" || p.phase === "checked";
      jack.rotation.x = escaped ? -L.escapeRad : 0;
      rep.rotation.x = p.phase === "repetition" || escaped ? L.repetitionRad : 0;
      hammer.rotation.x = p.hammer * blowAngle;
      damper.position.y = p.damper * G.damper.lift;
      damperCut.color.copy(damperRest).lerp(litColor, p.damper);
      const shake = (k: number) => (still ? 0 : Math.sin((nowMs / 1000) * 2 * Math.PI * L.shimmerHz + k) * amps[k] * L.shimmerMm);
      cutString.position.y = shake(latest);
      (cutString.material as THREE.MeshStandardMaterial).emissive.copy(litColor).multiplyScalar(still ? 0 : amps[latest] * 0.6);

      // All 88.
      if (row.visible) {
        let w = 0;
        let b = 0;
        for (let k = 0; k < 88; k++) {
          const pk = poses[k];
          const a = pk.key * dipAngle;
          if (whites[k]) place(whiteKeys, w++, xs[k], 0, z(G.key.balance), a);
          else place(blackKeys, b++, xs[k], 0, z(G.key.balance), a);
          place(hammers, k, hx(k), G.shank.pivotY, z(G.shank.pivotS), pk.hammer * blowAngle);
          place(heads, k, hx(k), G.shank.pivotY, z(G.shank.pivotS), pk.hammer * blowAngle);
          place(dampers, k, hx(k), pk.damper * G.damper.lift, 0, 0);
          dampers.setColorAt(k, tint.copy(damperRest).lerp(litColor, pk.damper));
          place(rowStrings, k, hx(k), stringY + shake(k), z(G.shank.pivotS + G.shank.len - 60), 0, v3.set(1, 1, L.scale(k)));
          rowStrings.setColorAt(k, still ? steelColor : tint.copy(steelColor).lerp(litColor, Math.min(1, amps[k])));
        }
        for (const im of [whiteKeys, blackKeys, hammers, heads, dampers, rowStrings]) im.instanceMatrix.needsUpdate = true;
        rowStrings.instanceColor!.needsUpdate = true;
        dampers.instanceColor!.needsUpdate = true;
      }

      // The camera: a move between views, then the slow sway about the target.
      if (move) {
        const k = Math.min(1, (performance.now() - move.t0) / (L.moveS * 1000));
        const e = k * k * (3 - 2 * k);
        camera.position.lerpVectors(move.from, move.to, e);
        controls.target.lerpVectors(move.look0, move.look1, e);
        if (k >= 1) move = null;
      } else if (!still) {
        const sway = THREE.MathUtils.degToRad(L.swayDeg) * Math.sin((nowMs / 1000 / L.swayS) * 2 * Math.PI);
        v3.subVectors(camera.position, controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), sway - swayWas);
        camera.position.copy(controls.target).add(v3);
        swayWas = sway;
      }
      controls.update();
      renderer.render(scene, camera);

      // The names, over the parts they name.
      if (view === "cutaway" && labelList)
        named.forEach(([, obj, at], i) => {
          v3.copy(at).applyMatrix4(obj.matrixWorld).project(camera);
          labelEls[i].style.left = `${((v3.x + 1) / 2) * width}px`;
          labelEls[i].style.top = `${((1 - v3.y) / 2) * height}px`;
        });
    },
    setView(next, instant) {
      view = next;
      cut.visible = next === "cutaway";
      row.visible = next === "row";
      const to = views[next];
      if (instant) {
        camera.position.copy(to.at);
        controls.target.copy(to.look);
        move = null;
      } else move = { from: camera.position.clone(), to: to.at.clone(), look0: controls.target.clone(), look1: to.look.clone(), t0: performance.now() };
    },
    resize(w, h) {
      [width, height] = [w, h];
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    dispose() {
      controls.dispose();
      pmrem.dispose();
      env.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      labelEls.forEach((li) => li.remove());
      renderer.dispose();
    },
  };
}
