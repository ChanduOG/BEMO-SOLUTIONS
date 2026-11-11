/*
  BEMO-SOLUTIONS hero: "The Intelligent System"
  A layered central core (coordination) connected by illuminated pathways to five
  technology clusters: AI, Automation, Digital Platforms, Integrations, Data Systems.

  initHeroScene(container, options) -> { destroy() }
    options.mobile        fewer components, lighter rendering
    options.reducedMotion render one settled frame, no animation loop
    options.capture       render one settled frame and keep the buffer (fallback image)
*/
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const COLOR = {
  navy: 0x0B1220, cyan: 0x20C7D9, blue: 0x4D83F5, slate: 0x65758B,
  white: 0xF4F7FA, deep: 0x172438,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeOutBack = t => { t = clamp(t, 0, 1); const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const phase = (t, start, dur) => clamp((t - start) / dur, 0, 1);

export function initHeroScene(container, options = {}) {
  const { mobile = false, reducedMotion = false, capture = false } = options;
  const canvas = container.querySelector('canvas');
  const settled = reducedMotion || capture;

  /* ---------- Renderer ---------- */
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: capture,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  let maxDpr = capture ? 2 : (mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const camTarget = new THREE.Vector3(0, -0.05, 0);

  /* ---------- Lighting ---------- */
  scene.add(new THREE.HemisphereLight(0xa8c4e6, 0x0b1220, 0.35));
  const key = new THREE.DirectionalLight(COLOR.white, 1.1);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(COLOR.cyan, 1.6);
  rim.position.set(-6, 2.5, -5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(COLOR.blue, 0.45);
  fill.position.set(5, -3, 2);
  scene.add(fill);
  const cursorLight = new THREE.PointLight(COLOR.cyan, 9, 14, 2);
  cursorLight.position.set(2, 1.5, 4.5);
  scene.add(cursorLight);

  /* ---------- Shared materials ---------- */
  const M = {
    core: new THREE.MeshPhysicalMaterial({ color: 0x111b2e, metalness: 0.88, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.75 }),
    graphite: new THREE.MeshStandardMaterial({ color: COLOR.deep, metalness: 0.78, roughness: 0.36, envMapIntensity: 0.65 }),
    slate: new THREE.MeshStandardMaterial({ color: 0x24344c, metalness: 0.85, roughness: 0.28, envMapIntensity: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fdfea, metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
    seam: new THREE.MeshBasicMaterial({ color: COLOR.cyan, transparent: true, opacity: 0.9, toneMapped: false }),
    seamBlue: new THREE.MeshBasicMaterial({ color: COLOR.blue, transparent: true, opacity: 0.85, toneMapped: false }),
    node: new THREE.MeshBasicMaterial({ color: COLOR.cyan, toneMapped: false }),
    edgeCyan: new THREE.LineBasicMaterial({ color: COLOR.cyan, transparent: true, opacity: 0.75, toneMapped: false }),
    edgeSlate: new THREE.LineBasicMaterial({ color: COLOR.slate, transparent: true, opacity: 0.45 }),
    edgeBlue: new THREE.LineBasicMaterial({ color: COLOR.blue, transparent: true, opacity: 0.5, toneMapped: false }),
    path: new THREE.LineBasicMaterial({ color: COLOR.cyan, transparent: true, opacity: 0.55, toneMapped: false }),
    link: new THREE.LineBasicMaterial({ color: COLOR.blue, transparent: true, opacity: 0.22, toneMapped: false }),
  };
  M.aiCore = new THREE.MeshStandardMaterial({ color: 0x0f2a3a, emissive: COLOR.cyan, emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.25, flatShading: true });

  // Soft glow sprite (pulses, nodes); a tiny canvas texture, no image download.
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)');
    r.addColorStop(0.6, 'rgba(255,255,255,.1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: COLOR.cyan, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });

  /* ---------- Shared geometry ---------- */
  const G = {
    node: new THREE.SphereGeometry(1, 12, 8),
    box: new THREE.BoxGeometry(1, 1, 1),
  };
  const boxEdges = new THREE.EdgesGeometry(G.box);
  const edges = (w, h, d, mat) => { const l = new THREE.LineSegments(boxEdges, mat); l.scale.set(w, h, d); return l; };
  const disposables = [envTex, glowTex, boxEdges, ...Object.values(G), ...Object.values(M), glowMat];
  const track = g => { disposables.push(g); return g; };

  /* ---------- System root ---------- */
  const root = new THREE.Group();      // scroll + pointer transforms
  const system = new THREE.Group();    // idle rotation / float
  root.add(system);
  scene.add(root);

  /* Central core: three stacked precision slabs; cyan light escapes from the seams. */
  const core = new THREE.Group();
  const slabGeo = track(new RoundedBoxGeometry(1.7, 0.44, 1.7, 4, 0.1));
  [-0.54, 0, 0.54].forEach(y => { const m = new THREE.Mesh(slabGeo, M.core); m.position.y = y; core.add(m); });
  const seamGeo = track(new THREE.BoxGeometry(1.56, 0.03, 1.56));
  const seams = [-0.27, 0.27].map(y => { const m = new THREE.Mesh(seamGeo, M.seam); m.position.y = y; core.add(m); return m; });
  const chip = edges(0.82, 0.001, 0.82, M.edgeCyan); chip.position.y = 0.775; core.add(chip);
  const chipInner = edges(0.46, 0.001, 0.46, M.edgeCyan); chipInner.position.y = 0.775; core.add(chipInner);
  const coreFrame = edges(2.3, 2.05, 2.3, M.edgeSlate); core.add(coreFrame);
  const cornerMesh = new THREE.InstancedMesh(G.node, M.node, 8);
  { const d = new THREE.Object3D(); let i = 0;
    for (const x of [-1.15, 1.15]) for (const y of [-1.025, 1.025]) for (const z of [-1.15, 1.15]) {
      d.position.set(x, y, z); d.scale.setScalar(0.035); d.updateMatrix(); cornerMesh.setMatrixAt(i++, d.matrix);
    } }
  core.add(cornerMesh);
  // short vertical "spine" through the core
  const spineGeo = track(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(0, -1.025, 0), new THREE.Vector3(0, 1.025, 0), new THREE.Vector3(0, 1.5, 0)]));
  const spine = new THREE.LineSegments(spineGeo, M.edgeBlue); core.add(spine);
  system.add(core);

  /* ---------- Clusters ---------- */
  const clusters = [];
  function addCluster(name, base, organised, build) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    const info = build(inner) || {};
    g.position.copy(base);
    g.lookAt(0, base.y, 0);                 // face the core
    g.rotateY(Math.PI);                     // ...so "front" faces outward
    system.add(g);
    const c = { name, group: g, inner, base: base.clone(), organised: organised.clone(), anchor: info.anchor || new THREE.Vector3(0, 0, 0), tick: info.tick, phase: clusters.length * 1.3, depth: 1 };
    clusters.push(c);
    return c;
  }
  const polar = (deg, r, y) => new THREE.Vector3(Math.cos(deg * Math.PI / 180) * r, y, Math.sin(deg * Math.PI / 180) * r);

  // AI INTELLIGENCE: faceted processor suspended inside a transparent precision cube.
  addCluster('ai', polar(28, 3.15, 1.25), polar(28, 3.5, 1.3), g => {
    const shell = new THREE.Mesh(track(new RoundedBoxGeometry(0.95, 0.95, 0.95, 3, 0.08)), M.glass);
    g.add(shell, edges(0.98, 0.98, 0.98, M.edgeCyan));
    const ico = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.3, 0)), M.aiCore);
    const icoEdges = new THREE.LineSegments(track(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.42, 0))), M.edgeCyan);
    g.add(ico, icoEdges);
    return { anchor: new THREE.Vector3(0, 0, -0.5), tick: (t) => { ico.rotation.set(t * 0.35, t * 0.5, 0); icoEdges.rotation.set(-t * 0.2, -t * 0.3, 0); } };
  });

  // DIGITAL PLATFORMS: layered dashboard panels with a live chart.
  addCluster('platforms', polar(78, 3.2, -1.25), polar(78, 3.55, -1.15), g => {
    const panelGeo = track(new RoundedBoxGeometry(1.25, 0.8, 0.045, 2, 0.03));
    const back = new THREE.Mesh(panelGeo, M.graphite); back.position.set(-0.2, 0.18, -0.36);
    const mid = new THREE.Mesh(panelGeo, M.slate); mid.position.set(-0.1, 0.09, -0.18);
    const front = new THREE.Mesh(panelGeo, M.glass);
    g.add(back, mid, front, edges(1.27, 0.82, 0.05, M.edgeCyan));
    const bars = new THREE.InstancedMesh(G.box, M.seam, 6);
    const hs = [0.16, 0.24, 0.2, 0.33, 0.42, 0.52];
    const d = new THREE.Object3D();
    hs.forEach((h, i) => { d.position.set(-0.42 + i * 0.13, -0.3 + h / 2, 0.03); d.scale.set(0.07, h, 0.01); d.updateMatrix(); bars.setMatrixAt(i, d.matrix); });
    g.add(bars);
    const ruleGeo = track(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, 0.3, 0.03), new THREE.Vector3(0.1, 0.3, 0.03),
      new THREE.Vector3(-0.5, 0.22, 0.03), new THREE.Vector3(-0.1, 0.22, 0.03),
      new THREE.Vector3(0.3, 0.3, 0.03), new THREE.Vector3(0.5, 0.3, 0.03)]));
    g.add(new THREE.LineSegments(ruleGeo, M.edgeSlate));
    return { anchor: new THREE.Vector3(0, 0, -0.38) };
  });

  // INTEGRATIONS: an API hub with connected endpoints.
  addCluster('integrations', polar(152, 3.2, 0.85), polar(152, 3.55, 0.95), g => {
    const hub = new THREE.Mesh(track(new RoundedBoxGeometry(0.3, 0.3, 0.3, 2, 0.05)), M.slate);
    g.add(hub, edges(0.33, 0.33, 0.33, M.edgeCyan));
    const pts = [[0.55, 0.3, 0.1], [0.45, -0.38, 0.25], [-0.5, 0.35, 0.2], [-0.55, -0.25, -0.1], [0.1, 0.55, -0.35], [0.05, -0.55, -0.3]].map(p => new THREE.Vector3(...p));
    const nodes = new THREE.InstancedMesh(G.node, M.node, pts.length);
    const d = new THREE.Object3D();
    pts.forEach((p, i) => { d.position.copy(p); d.scale.setScalar(i % 2 ? 0.045 : 0.06); d.updateMatrix(); nodes.setMatrixAt(i, d.matrix); });
    g.add(nodes);
    const seg = []; pts.forEach(p => seg.push(new THREE.Vector3(), p));
    seg.push(pts[0], pts[4], pts[2], pts[4], pts[1], pts[5], pts[3], pts[5]);
    g.add(new THREE.LineSegments(track(new THREE.BufferGeometry().setFromPoints(seg)), M.edgeBlue));
    return { anchor: new THREE.Vector3(0, 0, -0.2), tick: t => { g.rotation.y = Math.sin(t * 0.3) * 0.25; } };
  });

  // DATA SYSTEMS: layered storage discs with illuminated rims.
  addCluster('data', polar(218, 3.05, -0.95), polar(218, 3.4, -1.0), g => {
    const discGeo = track(new THREE.CylinderGeometry(0.46, 0.46, 0.13, 40));
    const ringGeo = track(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => { const a = i / 64 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 0.47, 0, Math.sin(a) * 0.47); })));
    for (let i = 0; i < 4; i++) {
      const y = -0.3 + i * 0.2;
      const disc = new THREE.Mesh(discGeo, i === 3 ? M.slate : M.graphite); disc.position.y = y;
      const ring = new THREE.Line(ringGeo, i === 3 ? M.edgeCyan : M.edgeBlue); ring.position.y = y + 0.066;
      g.add(disc, ring);
    }
    return { anchor: new THREE.Vector3(0, 0, -0.47) };
  });

  // AUTOMATION: a sequence of workflow modules handing work along a track.
  addCluster('automation', polar(300, 3.1, 0.25), polar(300, 3.45, 0.3), g => {
    const modGeo = track(new RoundedBoxGeometry(0.36, 0.26, 0.36, 2, 0.05));
    const xs = [-0.55, 0, 0.55];
    xs.forEach((x, i) => {
      const m = new THREE.Mesh(modGeo, i === 1 ? M.slate : M.graphite);
      m.position.set(x, (i - 1) * 0.14, 0);
      const e = edges(0.38, 0.28, 0.38, i === 1 ? M.edgeCyan : M.edgeSlate);
      e.position.copy(m.position);
      g.add(m, e);
    });
    const track3 = track(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.37, -0.14, 0), new THREE.Vector3(-0.18, -0.14, 0), new THREE.Vector3(-0.18, 0, 0), new THREE.Vector3(-0.18, 0, 0),
      new THREE.Vector3(0.18, 0, 0), new THREE.Vector3(0.37, 0, 0), new THREE.Vector3(0.37, 0, 0), new THREE.Vector3(0.37, 0.14, 0)]));
    g.add(new THREE.LineSegments(track3, M.edgeCyan));
    const token = new THREE.Sprite(glowMat); token.scale.setScalar(0.22); g.add(token);
    return {
      anchor: new THREE.Vector3(0, 0, -0.2),
      tick: t => { const u = (t * 0.35) % 1; token.position.set(lerp(-0.55, 0.55, u), lerp(-0.14, 0.14, u) + 0.17, 0); token.material.opacity = Math.sin(u * Math.PI); },
    };
  });

  // Integration points: every cluster anchor gets a small node.
  const anchorNodes = new THREE.InstancedMesh(G.node, M.node, clusters.length);
  anchorNodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  system.add(anchorNodes);

  /* ---------- Pathways (core -> cluster), recomputed every frame ---------- */
  const MAXP = 6;
  const paths = clusters.map((c, i) => {
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3));
    const line = new THREE.Line(geo, M.path);
    line.frustumCulled = false;
    system.add(line);
    return { cluster: c, geo, line, pts: [], len: 0, seamY: i % 2 ? 0.27 : -0.27 };
  });
  const bendNodes = new THREE.InstancedMesh(G.node, M.node, paths.length * 2);
  bendNodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  system.add(bendNodes);

  // Faint cluster-to-cluster links show the ecosystem is interconnected.
  const linkPairs = mobile ? [[0, 2]] : [[0, 1], [1, 3], [2, 4], [0, 4]];
  const links = linkPairs.map(([a, b]) => {
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 3), 3));
    const line = new THREE.Line(geo, M.link); line.frustumCulled = false; system.add(line);
    return { a: clusters[a], b: clusters[b], geo, line };
  });

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function anchorPoint(c, out) {
    return out.copy(c.anchor).applyQuaternion(c.group.quaternion).multiplyScalar(c.group.scale.x).add(c.group.position);
  }
  function computePath(p) {
    const end = anchorPoint(p.cluster, tmpA);
    const dir = tmpB.set(end.x, 0, end.z).normalize();
    const y0 = p.seamY;
    const p0 = new THREE.Vector3(dir.x * 0.86, y0, dir.z * 0.86);      // leaves the core at a seam
    const p1 = new THREE.Vector3(dir.x * 1.55, y0, dir.z * 1.55);      // straight out
    const p2 = new THREE.Vector3(dir.x * 1.55, end.y, dir.z * 1.55);    // engineered vertical turn
    p.pts = [p0, p1, p2, end.clone()];
    p.len = 0;
    for (let i = 1; i < p.pts.length; i++) p.len += p.pts[i].distanceTo(p.pts[i - 1]);
  }
  function pointAt(p, u, out) {
    let d = u * p.len;
    for (let i = 1; i < p.pts.length; i++) {
      const s = p.pts[i].distanceTo(p.pts[i - 1]);
      if (d <= s || i === p.pts.length - 1) return out.lerpVectors(p.pts[i - 1], p.pts[i], s ? clamp(d / s, 0, 1) : 0);
      d -= s;
    }
    return out.copy(p.pts[p.pts.length - 1]);
  }
  function writePath(p, reveal) {
    const arr = p.geo.attributes.position.array;
    let d = reveal * p.len, n = 0;
    arr[0] = p.pts[0].x; arr[1] = p.pts[0].y; arr[2] = p.pts[0].z; n = 1;
    for (let i = 1; i < p.pts.length && d > 0; i++) {
      const s = p.pts[i].distanceTo(p.pts[i - 1]);
      const q = d >= s ? p.pts[i] : tmpB.lerpVectors(p.pts[i - 1], p.pts[i], d / s);
      arr[n * 3] = q.x; arr[n * 3 + 1] = q.y; arr[n * 3 + 2] = q.z; n++;
      d -= s;
    }
    p.geo.setDrawRange(0, n);
    p.geo.attributes.position.needsUpdate = true;
  }

  /* ---------- Pulses: light travelling through selected pathways ---------- */
  const pulseCount = mobile ? 3 : 6;
  const pulses = Array.from({ length: pulseCount }, (_, i) => {
    const s = new THREE.Sprite(glowMat.clone()); s.scale.setScalar(0.32); s.visible = false;
    system.add(s); disposables.push(s.material);
    return { sprite: s, path: i % paths.length, u: 0, speed: 0, active: false, wait: 0.4 + i * 0.9, dir: i % 2 ? -1 : 1 };
  });

  /* ---------- Floating precision components ---------- */
  const floaters = [];
  if (!mobile) {
    const blockGeo = track(new RoundedBoxGeometry(0.2, 0.2, 0.2, 2, 0.03));
    [
      [-1.9, 2.2, -1.2, 'frame', 0.42], [2.2, -2.15, -0.6, 'block'], [-3.9, -1.7, 0.4, 'frame', 0.3],
      [4.1, 0.2, -1.3, 'block'], [0.6, 2.45, 1.6, 'block'], [-1.2, -2.35, 1.9, 'frame', 0.26],
    ].forEach(([x, y, z, kind, s], i) => {
      const o = kind === 'frame' ? edges(s, s, s, i % 2 ? M.edgeBlue : M.edgeSlate) : new THREE.Mesh(blockGeo, M.graphite);
      o.position.set(x, y, z);
      system.add(o);
      floaters.push({ o, base: o.position.clone(), spin: 0.1 + (i % 3) * 0.06, ph: i * 1.7 });
    });
  }

  /* ---------- Sizing ---------- */
  const R = 4.15; // radius of the main composition kept in frame (faint floaters may sit just outside)
  // Fit the sculpture into the space to the right of the hero text (desktop),
  // or the full visual area (mobile, where it sits below the text).
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    let left = 0;
    const copy = !mobile && hero.querySelector('.hero-copy');
    if (copy) {
      const cr = container.getBoundingClientRect(), tr = copy.getBoundingClientRect();
      left = clamp(tr.right - cr.left + 28, 0, w * 0.55);
    }
    const availW = w - left;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitV = R / tanV;
    const fitH = R / (tanV * (availW / h));
    const dist = Math.max(fitV, fitH) * (mobile ? 0.84 : 0.94);
    camera.position.set(0, dist * 0.2, dist);
    camera.lookAt(camTarget);
    const cx = left + availW / 2;            // where the centre of the system should land
    camera.setViewOffset(w, h, w / 2 - cx, 0, w, h);
    camera.updateProjectionMatrix();
  }

  /* ---------- Input: pointer + scroll (read only, never prevents default) ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollP = 0, scrollT = 0;
  const hero = container.closest('section') || container;
  function onPointer(e) {
    pointer.tx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
    pointer.ty = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
  }
  function onScroll() {
    const r = hero.getBoundingClientRect();
    scrollT = clamp(-r.top / Math.max(r.height, 1), 0, 1);
  }
  if (!settled) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Frame update ---------- */
  const INTRO = 2.6;
  const dummy = new THREE.Object3D();
  const v = new THREE.Vector3();
  let time = settled ? 40 : 0;   // settled frames skip the intro
  let introT = settled ? INTRO : 0;

  function update(dt) {
    time += dt;
    introT = Math.min(INTRO, introT + dt);
    const k = 1 - Math.pow(0.001, dt);          // frame-rate independent smoothing
    pointer.x = lerp(pointer.x, pointer.tx, k * 0.6);
    pointer.y = lerp(pointer.y, pointer.ty, k * 0.6);
    scrollP = lerp(scrollP, scrollT, k);
    const motion = settled ? 0 : 1;

    // Intro: core first, then modules, then pathways, then pulses.
    const coreIn = easeOut(phase(introT, 0, 0.8));
    core.scale.setScalar(lerp(0.86, 1, coreIn));
    seams.forEach(s => { s.scale.set(lerp(0.2, 1, coreIn), 1, lerp(0.2, 1, coreIn)); });

    // Whole structure: very slow rotation, gentle float, subtle pointer response, scroll drift.
    system.rotation.y = 0.55 + time * 0.035 * motion;
    system.position.y = Math.sin(time * 0.5) * 0.07 * motion;
    root.rotation.x = 0.06 + pointer.y * 0.07 + scrollP * 0.22;
    root.rotation.y = pointer.x * 0.16;
    root.position.y = -scrollP * 1.1;     // counter-drift: lingers as the hero scrolls away
    root.position.x = -scrollP * 0.3;

    // Seams breathe very slightly.
    M.seam.opacity = 0.78 + Math.sin(time * 1.1) * 0.12 * motion;

    // Clusters: staggered reveal, independent drift, parallax, organise on scroll.
    clusters.forEach((c, i) => {
      const t = easeOutBack(phase(introT, 0.35 + i * 0.16, 0.85));
      v.lerpVectors(c.base, c.organised, easeOut(scrollP * 1.4));
      v.multiplyScalar(lerp(0.7, 1, t));
      v.y += Math.sin(time * 0.7 + c.phase) * 0.06 * motion;
      v.x += pointer.x * 0.08 * (1 + Math.sin(c.phase));
      v.y -= pointer.y * 0.05;
      c.group.position.copy(v);
      c.group.scale.setScalar(Math.max(0.001, t));
      c.inner.rotation.y = Math.sin(time * 0.25 + c.phase) * 0.12 * motion;
      if (c.tick) c.tick(settled ? 6 + i : time);
      anchorPoint(c, dummy.position); dummy.scale.setScalar(0.05 * t); dummy.updateMatrix();
      anchorNodes.setMatrixAt(i, dummy.matrix);
    });
    anchorNodes.instanceMatrix.needsUpdate = true;

    // Pathways draw progressively, then stay; slightly brighter as the visitor scrolls.
    paths.forEach((p, i) => {
      computePath(p);
      const reveal = easeOut(phase(introT, 1.0 + i * 0.12, 0.9));
      writePath(p, reveal);
      [p.pts[1], p.pts[2]].forEach((q, j) => {
        dummy.position.copy(q); dummy.scale.setScalar(reveal > 0.3 + j * 0.3 ? 0.03 : 0.0001); dummy.updateMatrix();
        bendNodes.setMatrixAt(i * 2 + j, dummy.matrix);
      });
    });
    bendNodes.instanceMatrix.needsUpdate = true;
    M.path.opacity = (0.5 + scrollP * 0.4) * easeOut(phase(introT, 1.0, 0.6));
    M.link.opacity = (0.18 + scrollP * 0.3) * easeOut(phase(introT, 1.8, 0.8));
    links.forEach(l => {
      const a = anchorPoint(l.a, tmpA), b = anchorPoint(l.b, new THREE.Vector3());
      const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += 0.6;
      const arr = l.geo.attributes.position.array;
      [a, mid, b].forEach((q, j) => { arr[j * 3] = q.x; arr[j * 3 + 1] = q.y; arr[j * 3 + 2] = q.z; });
      l.geo.attributes.position.needsUpdate = true;
    });

    // Occasional pulses of light along the pathways.
    pulses.forEach(pl => {
      const s = pl.sprite;
      if (settled) { s.visible = false; return; }
      if (!pl.active) {
        pl.wait -= dt;
        if (pl.wait <= 0 && introT > 1.8) {
          pl.active = true; pl.u = 0; pl.speed = 0.45 + Math.random() * 0.25;
          pl.path = (pl.path + 2) % paths.length; pl.dir = Math.random() < 0.6 ? 1 : -1;
        }
        s.visible = false; return;
      }
      pl.u += dt * pl.speed;
      if (pl.u >= 1) { pl.active = false; pl.wait = 1.5 + Math.random() * 3; s.visible = false; return; }
      const p = paths[pl.path];
      pointAt(p, pl.dir > 0 ? pl.u : 1 - pl.u, s.position);
      s.visible = true;
      s.material.opacity = Math.sin(pl.u * Math.PI) * 0.95;
    });

    floaters.forEach(f => {
      f.o.position.set(f.base.x, f.base.y + Math.sin(time * 0.4 + f.ph) * 0.12 * motion, f.base.z);
      f.o.rotation.set(time * f.spin * 0.6 * motion + f.ph, time * f.spin * motion, 0);
      f.o.scale.setScalar(f.o.isLineSegments ? f.o.scale.x : easeOut(phase(introT, 1.4, 1)));
    });

    // Light follows the cursor gently.
    cursorLight.position.set(1.5 + pointer.x * 3.5, 1.4 - pointer.y * 2.5, 4.5);
    cursorLight.intensity = 9 + Math.sin(time * 0.6) * 1.2 * motion;
  }

  /* ---------- Loop, visibility, adaptive quality ---------- */
  let raf = 0, last = 0, running = false, visible = true;
  let frames = 0, slowFrames = 0, degraded = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    update(dt);
    renderer.render(scene, camera);
    // After the intro, watch frame times; step quality down on slow devices.
    if (introT >= INTRO && degraded < 2) {
      frames++; if (dt > 0.034) slowFrames++;
      if (frames === 90) {
        if (slowFrames > 45) {
          degraded++;
          maxDpr = degraded === 1 ? 1 : 0.75;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
          resize();
        }
        frames = slowFrames = 0;
      }
    }
  }
  function start() { if (running || settled) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const sync = () => (visible && !document.hidden ? start() : stop());

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '80px' });
  io.observe(container);
  document.addEventListener('visibilitychange', sync);
  const ro = new ResizeObserver(() => { resize(); if (settled) { update(0); renderer.render(scene, camera); } });
  ro.observe(container);

  resize();
  update(0);
  renderer.render(scene, camera);
  if (!settled) start();

  return {
    renderer,
    destroy() {
      stop(); io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      disposables.forEach(d => d && d.dispose && d.dispose());
      renderer.dispose();
    },
  };
}
