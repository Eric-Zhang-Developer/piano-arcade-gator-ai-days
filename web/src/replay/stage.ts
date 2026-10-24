// The attract-mode stage: a synthwave grid running to a low sun, one pillar per feature, a floor line per depends_on.
// Plain three.js meshes, lines and built-in materials; no postprocessing. createStage returns null without WebGL.
import * as THREE from "three";
import type { State } from "../operator/board";
import type { Pos } from "./model";

export type StageFeature = { slug: string; state: State; dependsOn: string[] };
export interface Stage {
  setBuilt(built: Set<string>): void; // jump (scrubbing): no animation
  raise(slug: string): void; // a feat merge: rise, flash, ring, lines outward, camera eases over
  dispose(): void;
}

const SPACING = 3.2;
const TALL = 3.2;
const LOW = 0.14;
const SKY = 0x12001f;
const COLOR: Record<State, number> = {
  done: 0x74ffa6, "in flight": 0x4ef6ff, ready: 0xf4ecff, blocked: 0xff7b7b, backlog: 0xc9b8e6, cut: 0xc9b8e6, unknown: 0xffd36b,
};
export const GLYPH: Record<State, string> = {
  done: "✔", "in flight": "▶", ready: "○", blocked: "■", backlog: "…", cut: "✂", unknown: "?",
};

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  [c.width, c.height] = [w, h];
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function label(text: string, color: number) {
  const tex = canvasTexture(512, 96, (g) => {
    g.font = "600 44px ui-monospace, Menlo, monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(13,0,28,0.78)";
    const w = Math.min(500, g.measureText(text).width + 36);
    g.fillRect(256 - w / 2, 12, w, 72);
    g.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    g.fillText(text, 256, 50);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(4, 0.75, 1);
  return s;
}

type Pillar = { group: THREE.Group; body: THREE.Mesh; edges: THREE.LineSegments; tag: THREE.Sprite; state: State; built: boolean };

export function createStage(
  host: HTMLElement,
  features: StageFeature[],
  pos: Map<string, Pos>,
  opts: { reduced: boolean; onPick: (slug: string) => void },
): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    return null; // no WebGL: the page shows the flat list
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  scene.background = canvasTexture(4, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#05000c");
    grad.addColorStop(0.62, "#1b0038");
    grad.addColorStop(1, "#3a0a4a");
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
  });
  scene.fog = new THREE.Fog(SKY, 30, 110);

  const depth = Math.max(0, ...[...pos.values()].map((p) => p.z));
  const width = Math.max(1, ...[...pos.values()].map((p) => Math.abs(p.x) * 2));
  const center = new THREE.Vector3(0, 1, (-depth * SPACING) / 2);
  const at = (slug: string) => {
    const p = pos.get(slug) ?? { x: 0, z: 0 };
    return new THREE.Vector3(p.x * SPACING, 0, -p.z * SPACING);
  };

  const grid = new THREE.GridHelper(400, 160, 0xff5ad9, 0xff5ad9);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshBasicMaterial({
      fog: false,
      transparent: true,
      map: canvasTexture(256, 256, (g) => {
        const grad = g.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, "#ffd36b");
        grad.addColorStop(1, "#ff2fb4");
        g.fillStyle = grad;
        g.fillRect(0, 0, 256, 256);
        for (let k = 0; k < 7; k++) g.clearRect(0, 150 + k * 16, 256, 3 + k); // the stripes of a synthwave sun
      }),
    }),
  );
  scene.add(sun); // kept on the horizon behind whatever the camera looks at, every frame

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  const radius = Math.max(width * 0.55, depth) * SPACING + 9;

  const pillars = new Map<string, Pillar>();
  const bodies: THREE.Mesh[] = [];
  for (const f of features) {
    const group = new THREE.Group();
    group.position.copy(at(f.slug));
    const geo = new THREE.BoxGeometry(1.3, 1, 1.3);
    const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLOR[f.state], transparent: true, opacity: 0.08 }));
    body.userData.slug = f.slug;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: COLOR[f.state], transparent: true, opacity: 0.55 }));
    body.add(edges);
    const tag = label(`${GLYPH[f.state]} ${f.slug}`, COLOR[f.state]);
    group.add(body, tag);
    scene.add(group);
    bodies.push(body);
    pillars.set(f.slug, { group, body, edges, tag, state: f.state, built: false });
  }

  // One floor line per depends_on, from the dependency to the dependent. Lit once the dependency is built.
  const lines: { from: string; to: string; line: THREE.Line; mat: THREE.LineBasicMaterial }[] = [];
  for (const f of features)
    for (const d of f.dependsOn) {
      if (!pillars.has(d)) continue;
      const a = at(d).setY(0.03);
      const mat = new THREE.LineBasicMaterial({ color: 0x4ef6ff, transparent: true, opacity: 0.18 });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, at(f.slug).setY(0.03)]), mat);
      scene.add(line);
      lines.push({ from: d, to: f.slug, line, mat });
    }

  // Tweens run on the render loop; with reduced motion nothing is tweened at all.
  const tweens = new Set<{ t0: number; ms: number; fn: (p: number) => void }>();
  const tween = (ms: number, fn: (p: number) => void) => {
    if (opts.reduced) return fn(1);
    tweens.add({ t0: performance.now(), ms, fn });
  };
  const outBack = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

  function shape(p: Pillar, h: number) {
    p.body.scale.y = h;
    p.body.position.y = h / 2;
    p.tag.position.y = h + 0.55;
  }
  function look(p: Pillar, built: boolean) {
    const m = p.body.material as THREE.MeshBasicMaterial;
    const color = built ? COLOR.done : COLOR[p.state];
    m.color.setHex(color);
    m.opacity = built ? 0.82 : 0.08;
    (p.edges.material as THREE.LineBasicMaterial).color.setHex(built ? 0xffffff : color);
    (p.edges.material as THREE.LineBasicMaterial).opacity = built ? 0.9 : 0.55;
  }
  function setLine(l: (typeof lines)[number], lit: boolean, grow: boolean) {
    l.mat.opacity = lit ? 0.85 : 0.18;
    l.mat.color.setHex(lit ? 0x4ef6ff : 0x7a5aa0);
    const a = at(l.from).setY(0.03);
    const b = at(l.to).setY(0.03);
    const set = (q: number) => l.line.geometry.setFromPoints([a, a.clone().lerp(b, q)]);
    if (grow) tween(650, (q) => set(q));
    else set(1);
  }
  for (const p of pillars.values()) {
    shape(p, LOW);
    look(p, false);
  }
  for (const l of lines) setLine(l, false, false);

  const focus = center.clone();
  let focusGoal = center.clone();
  let angle = 0.35;

  function ring(where: THREE.Vector3) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x74ffa6, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(where).setY(0.05);
    scene.add(mesh);
    tween(900, (p) => {
      mesh.scale.setScalar(1 + p * 3.5);
      mat.opacity = 0.9 * (1 - p);
      if (p >= 1) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mat.dispose();
      }
    });
  }

  const stage: Stage = {
    setBuilt(built) {
      for (const [slug, p] of pillars) {
        p.built = built.has(slug);
        shape(p, p.built ? TALL : LOW);
        look(p, p.built);
      }
      for (const l of lines) setLine(l, built.has(l.from), false);
    },
    raise(slug) {
      const p = pillars.get(slug);
      if (!p || p.built) return;
      p.built = true;
      look(p, true);
      const m = p.body.material as THREE.MeshBasicMaterial;
      if (!opts.reduced) m.color.setHex(0xffffff); // the flash, fading to the done color as it rises
      tween(700, (q) => {
        shape(p, LOW + (TALL - LOW) * outBack(q));
        m.color.setHex(0xffffff).lerp(new THREE.Color(COLOR.done), q);
      });
      if (!opts.reduced) ring(p.group.position);
      for (const l of lines) if (l.from === slug) setLine(l, true, true);
      focusGoal = center.clone().lerp(p.group.position.clone().setY(1), 0.6);
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointer);
      scene.traverse((o) => {
        const x = o as THREE.Mesh;
        x.geometry?.dispose();
        for (const m of [x.material].flat()) {
          const mm = m as THREE.MeshBasicMaterial | undefined;
          mm?.map?.dispose();
          mm?.dispose();
        }
      });
      (scene.background as THREE.Texture).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };

  const pointer = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  function onPointer(e: PointerEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(bodies, false)[0];
    if (hit) opts.onPick(hit.object.userData.slug);
  }
  renderer.domElement.addEventListener("pointerdown", onPointer);

  const observer = new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = host;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  });
  observer.observe(host);

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const t of tweens) {
      const p = Math.min(1, (now - t.t0) / t.ms);
      t.fn(p);
      if (p >= 1) tweens.delete(t);
    }
    if (!opts.reduced) angle += dt * 0.06;
    focus.lerp(focusGoal, opts.reduced ? 1 : Math.min(1, dt * 1.6));
    camera.position.set(focus.x + Math.sin(angle) * radius, 6 + depth * 0.5, focus.z + Math.cos(angle) * radius);
    camera.lookAt(focus);
    const away = focus.clone().sub(camera.position).setY(0).normalize();
    sun.position.copy(focus).addScaledVector(away, 95).setY(9);
    sun.lookAt(camera.position);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  return stage;
}
