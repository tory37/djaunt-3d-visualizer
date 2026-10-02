import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { SHAPES } from './shapes.js';
import { createExplainer } from './explain.js';

// ---------- constants ----------

const SHAPE_RADIUS = 1.7;      // every shape is scaled so its bounding sphere has this radius
const FRAME = 7;               // world units visible across the shorter screen side, at the shape's centre
const FILM = 24;               // treat the shorter screen side like a 24 mm full-frame sensor height
const FOCAL_MIN = 12;
const FOCAL_MAX = 300;
const SCALE_MIN = 0.2;

// Scene colors come from the Djaunt brand tokens (see css/style.css), so they
// follow the theme and the paper (light) mode.
const palette = {};
function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  palette.bg = token('--dj-bg');
  palette.line = token('--dj-text');
  palette.face = token('--face-color');
  palette.grid = token('--grid-color');
  palette.horizon = token('--dj-accent');
  palette.guide = token('--dj-accent');
  // Categorical accents: the brand's colors for coding several things at once.
  palette.vp = [token('--dj-accent-2'), token('--dj-accent-3'), token('--dj-accent-4')];
}

const OVERLAY_FONT = "'IBM Plex Mono', ui-monospace, monospace";

const DEFAULTS = {
  mode: 'solid',
  lineWidth: 2,
  hiddenEdges: true,
  focal: 35,
  elevation: 20,
  level: false,
  scale: 1,
  horizon: false,
  vanishing: false,
  guides: true,
  grid: false,
  paper: false,
};

const PRESETS = {
  one:   { yaw: 0,  elevation: 12, level: true },
  two:   { yaw: 35, elevation: 10, level: true },
  three: { yaw: 35, elevation: 35, level: false },
  reset: { yaw: 35, elevation: DEFAULTS.elevation, level: DEFAULTS.level },
};

const state = { ...DEFAULTS, shapeId: SHAPES[0].id };
let shape = SHAPES[0];

// ---------- renderer & scene ----------

const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (err) {
  document.body.insertAdjacentHTML('beforeend',
    '<p class="fallback">Your browser could not start WebGL, which this page needs.</p>');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
scene.add(camera);

// Light rides with the camera so the key light always comes from the upper
// left of the picture, giving the visible faces three distinct values.
scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 0.8));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
// Aim along a fixed camera-space direction (target at the camera) so the
// lighting doesn't drift with lens or distance.
keyLight.position.set(-2.5, 3, 2);
camera.add(keyLight, keyLight.target);

const grid = new THREE.GridHelper(24, 24);
grid.material.vertexColors = false; // one flat token color instead of GridHelper's two
scene.add(grid);

// `model` carries the user's rotation and scale; its children are swapped per shape.
const model = new THREE.Group();
scene.add(model);

const solidMaterial = new THREE.MeshStandardMaterial({
  roughness: 1,
  metalness: 0,
  flatShading: true,
  // Push faces back slightly so edges lying on them win the depth test.
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
// Curved shapes are shaded smoothly from their vertex normals.
const smoothMaterial = solidMaterial.clone();
smoothMaterial.flatShading = false;
// Invisible, depth-only stand-in used in wireframe mode to tell front edges from back edges.
const depthMaterial = new THREE.MeshBasicMaterial({
  colorWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
const edgeMaterial = new LineMaterial({ linewidth: DEFAULTS.lineWidth });
const hiddenEdgeMaterial = new LineMaterial({
  linewidth: DEFAULTS.lineWidth,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
  dashed: true,
  dashSize: 0.14,
  gapSize: 0.1,
});
hiddenEdgeMaterial.depthFunc = THREE.GreaterDepth;
// Construction lines: lighter than the edges, like a colored pencil underdrawing.
const guideMaterial = new LineMaterial({ linewidth: 1, transparent: true, opacity: 0.9 });
const hiddenGuideMaterial = new LineMaterial({
  linewidth: 1,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  dashed: true,
  dashSize: 0.08,
  gapSize: 0.08,
});
hiddenGuideMaterial.depthFunc = THREE.GreaterDepth;

function applyPalette() {
  document.documentElement.classList.toggle('dj-light', state.paper);
  readPalette();
  renderer.setClearColor(palette.bg);
  solidMaterial.color.set(palette.face);
  smoothMaterial.color.set(palette.face);
  guideMaterial.color.set(palette.guide);
  hiddenGuideMaterial.color.set(palette.guide);
  edgeMaterial.color.set(palette.line);
  hiddenEdgeMaterial.color.set(palette.line);
  grid.material.color.set(palette.grid);
  if (mesh) colorEdges();
}

let mesh, edges, hiddenEdges, guides, hiddenGuides, contour = null, edgeSegments = [];
// Every edge of the shape (no construction lines), with the index of the
// vanishing direction it runs along, or -1.
let edgeList = [];

function loadShape(id) {
  shape = SHAPES.find((s) => s.id === id) || SHAPES[0];
  state.shapeId = shape.id;

  for (const child of [...model.children]) {
    model.remove(child);
    child.geometry.dispose();
  }

  // Recenter and resize to the common size; the guides get the same treatment.
  const geometry = shape.build();
  geometry.computeBoundingSphere();
  const { center, radius } = geometry.boundingSphere;
  const k = SHAPE_RADIUS / radius;
  const normalize = new THREE.Matrix4().makeScale(k, k, k)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  geometry.applyMatrix4(normalize);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  const edgesGeometry = new THREE.EdgesGeometry(geometry, shape.edgeAngle ?? (shape.curved ? 30 : 1));
  const lineGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edgesGeometry);

  mesh = new THREE.Mesh(geometry, solidMaterial);
  edges = new LineSegments2(lineGeometry, edgeMaterial);
  edges.renderOrder = 1;
  hiddenEdges = new LineSegments2(lineGeometry, hiddenEdgeMaterial);
  hiddenEdges.computeLineDistances();
  hiddenEdges.renderOrder = 2;
  model.add(mesh, edges, hiddenEdges);

  contour = shape.curved ? createContour(geometry) : null;
  if (contour) model.add(contour.visible, contour.hidden);

  const guideSegments = buildGuides(shape, normalize);
  guides = hiddenGuides = null;
  if (guideSegments.length) {
    const guideGeometry = new LineSegmentsGeometry()
      .setPositions(guideSegments.flatMap(({ a, b }) => [...a.toArray(), ...b.toArray()]));
    guides = new LineSegments2(guideGeometry, guideMaterial);
    guides.renderOrder = 1;
    hiddenGuides = new LineSegments2(guideGeometry, hiddenGuideMaterial);
    hiddenGuides.computeLineDistances();
    hiddenGuides.renderOrder = 2;
    model.add(guides, hiddenGuides);
  }

  const edgeSegs = segmentsOf(edgesGeometry);
  edgeSegments = classifyEdges(edgeSegs, guideSegments, shape);
  const families = hasVanishingPoints() ? edgeSegments.families : [];
  edgeList = edgeSegs.map((seg) => ({ ...seg, family: familyOf(families, seg) }));
  edgesGeometry.dispose();
  colorEdges();

  applyMode();
  syncUI();
  requestRender();
}

function segmentsOf(edgesGeometry) {
  const pos = edgesGeometry.attributes.position;
  const segments = [];
  for (let i = 0; i < pos.count; i += 2) {
    segments.push({
      a: new THREE.Vector3().fromBufferAttribute(pos, i),
      b: new THREE.Vector3().fromBufferAttribute(pos, i + 1),
    });
  }
  return segments;
}

function buildGuides(shape, normalize) {
  if (!shape.guides) return [];
  const segments = [];
  for (const line of shape.guides()) {
    const points = line.map((p) => new THREE.Vector3(...p).applyMatrix4(normalize));
    for (let i = 1; i < points.length; i++) {
      segments.push({ a: points[i - 1], b: points[i], guide: true });
    }
  }
  return segments;
}

const isParallel = (u, v) => Math.abs(u.dot(v)) > 0.999;
const direction = (seg) => new THREE.Vector3().subVectors(seg.b, seg.a).normalize();

// Every direction shared by two or more edges: the shape's vanishing directions.
function findEdgeFamilies(segments) {
  const families = [];
  for (const seg of segments) {
    const u = direction(seg);
    const family = families.find((f) => isParallel(f.dir, u));
    if (family) family.count++;
    else families.push({ dir: u, count: 1 });
  }
  return families.filter((f) => f.count >= 2).map((f) => f.dir);
}

// Group the shape's edges and construction lines by which vanishing direction
// they run along, and give each direction a label and a color.
function classifyEdges(edgeSegs, guideSegs, shape) {
  const directions = shape.vanishingDirections
    ? shape.vanishingDirections.map((d) => new THREE.Vector3(...d).normalize())
    : shape.curved ? [] : findEdgeFamilies(edgeSegs);
  if (!directions.length) return [];

  // Axis-aligned directions keep the same label and color on every shape.
  const axisOf = (d) => [d.x, d.y, d.z].findIndex((c) => Math.abs(Math.abs(c) - 1) < 1e-3);
  const families = directions
    .map((dir) => ({ dir, axis: axisOf(dir) }))
    .sort((p, q) => (p.axis < 0 ? 3 : p.axis) - (q.axis < 0 ? 3 : q.axis));
  const usedColors = new Set(families.map((f) => f.axis).filter((a) => a >= 0));
  const spareColors = [0, 1, 2].filter((c) => !usedColors.has(c));
  let oblique = 0;
  for (const f of families) {
    if (f.axis >= 0) {
      f.label = 'XYZ'[f.axis];
      f.color = f.axis;
    } else {
      f.label = String(oblique + 1);
      f.color = spareColors.length ? spareColors[oblique % spareColors.length] : oblique % 3;
      oblique++;
    }
  }

  const segments = [];
  for (const seg of [...edgeSegs, ...guideSegs]) {
    const family = familyOf(families, seg);
    if (family >= 0) segments.push({ ...seg, family });
  }
  return { families, segments };
}

function familyOf(families, seg) {
  const u = direction(seg);
  return families.findIndex((f) => isParallel(f.dir, u));
}

// While the explainer is open, edges take their vanishing direction's color,
// matching the VP lines and the readout. Curved shapes keep plain edges: their
// traced outline shares the edge material and carries no colors.
function colorEdges() {
  const on = explainer.isOpen() && !shape.curved && edgeList.some((e) => e.family >= 0);
  if (on) {
    const colors = new Float32Array(edgeList.length * 6);
    const c = new THREE.Color();
    edgeList.forEach(({ family }, i) => {
      c.set(family >= 0 ? palette.vp[edgeSegments.families[family].color] : palette.line);
      colors.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    });
    edges.geometry.setColors(colors);
  }
  for (const material of [edgeMaterial, hiddenEdgeMaterial]) {
    if (material.vertexColors === on) continue;
    material.vertexColors = on;
    material.needsUpdate = true;
  }
  const lineColor = on ? '#ffffff' : palette.line; // vertex colors are multiplied by this
  edgeMaterial.color.set(lineColor);
  hiddenEdgeMaterial.color.set(lineColor);
}

// ---------- contours of curved shapes ----------

// A curved surface's outline depends on where you look from, so it is traced
// again for every frame: on each triangle, find where the surface turns from
// facing the eye to facing away (n · (p - eye) = 0, interpolated from the
// vertex normals) and draw a segment there. The result is the exact silhouette
// plus any inner contours (the inside of a torus), smooth rather than stepped.
function createContour(geometry) {
  const index = geometry.index ? geometry.index.array : null;
  const position = geometry.attributes.position.array;
  const normal = geometry.attributes.normal.array;
  const vertexCount = position.length / 3;
  const triangles = index ? index.length / 3 : vertexCount / 3;

  // Fixed-size buffers, refilled in place: at most one segment per triangle.
  const lineGeometry = new LineSegmentsGeometry();
  lineGeometry.setPositions(new Float32Array(triangles * 6));
  const distances = new THREE.InstancedInterleavedBuffer(new Float32Array(triangles * 2), 2, 1);
  lineGeometry.setAttribute('instanceDistanceStart', new THREE.InterleavedBufferAttribute(distances, 1, 0));
  lineGeometry.setAttribute('instanceDistanceEnd', new THREE.InterleavedBufferAttribute(distances, 1, 1));
  lineGeometry.instanceCount = 0;
  const out = lineGeometry.attributes.instanceStart.data;

  const visible = new LineSegments2(lineGeometry, edgeMaterial);
  visible.renderOrder = 1;
  const hidden = new LineSegments2(lineGeometry, hiddenEdgeMaterial);
  hidden.renderOrder = 2;
  for (const line of [visible, hidden]) line.frustumCulled = false; // bounds change every frame

  // Vertices that share a position (UV seams, poles, apexes) count as one, so
  // contour pieces on either side of a seam still join up.
  const weld = new Uint32Array(vertexCount);
  const seen = new Map();
  for (let v = 0; v < vertexCount; v++) {
    const key = `${position[v * 3].toFixed(5)},${position[v * 3 + 1].toFixed(5)},${position[v * 3 + 2].toFixed(5)}`;
    if (!seen.has(key)) seen.set(key, v);
    weld[v] = seen.get(key);
  }

  const facing = new Float32Array(vertexCount);
  const eye = new THREE.Vector3();
  const corner = [0, 0, 0];
  const cross = [];
  const crossKeys = [];
  const pieces = new Float32Array(triangles * 6);
  // link[2i + end] = the neighbouring piece's end (2j + end) touching that end, or -1.
  const link = new Int32Array(triangles * 2);
  const used = new Uint8Array(triangles);
  const openEnds = new Map();

  function connect(slot, key) {
    const other = openEnds.get(key);
    if (other === undefined) {
      openEnds.set(key, slot);
    } else {
      openEnds.delete(key);
      link[slot] = other;
      link[other] = slot;
    }
  }

  function update() {
    eye.copy(camera.position);
    model.worldToLocal(eye);
    for (let v = 0, i = 0; v < vertexCount; v++, i += 3) {
      facing[v] = normal[i] * (position[i] - eye.x)
        + normal[i + 1] * (position[i + 1] - eye.y)
        + normal[i + 2] * (position[i + 2] - eye.z);
    }

    // One piece per triangle the contour crosses, keyed by the mesh edges it
    // starts and ends on, so neighbouring pieces can be joined.
    let count = 0;
    openEnds.clear();
    for (let t = 0; t < triangles; t++) {
      for (let c = 0; c < 3; c++) corner[c] = index ? index[t * 3 + c] : t * 3 + c;
      cross.length = 0;
      crossKeys.length = 0;
      for (let c = 0; c < 3; c++) {
        const p = corner[c];
        const q = corner[(c + 1) % 3];
        const fp = facing[p];
        const fq = facing[q];
        if ((fp < 0) === (fq < 0)) continue;
        const s = fp / (fp - fq);
        for (let k = 0; k < 3; k++) {
          cross.push(position[p * 3 + k] + s * (position[q * 3 + k] - position[p * 3 + k]));
        }
        const wp = weld[p];
        const wq = weld[q];
        crossKeys.push(Math.min(wp, wq) * vertexCount + Math.max(wp, wq));
      }
      if (cross.length !== 6) continue;
      if (Math.hypot(cross[3] - cross[0], cross[4] - cross[1], cross[5] - cross[2]) < 1e-7) {
        continue; // collapsed triangles at poles and apexes
      }
      pieces.set(cross, count * 6);
      link[count * 2] = link[count * 2 + 1] = -1;
      used[count] = 0;
      connect(count * 2, crossKeys[0]);
      connect(count * 2 + 1, crossKeys[1]);
      count++;
    }

    // Walk the pieces into continuous lines, so the dashes of hidden contours
    // run evenly along each line instead of restarting on every piece.
    let n = 0;
    let travelled = 0;
    for (let first = 0; first < count; first++) {
      if (used[first]) continue;
      // Back up to one end of the line (or all the way round a loop).
      let slot = first * 2;
      for (let steps = 0; steps < count; steps++) {
        const next = link[slot];
        if (next < 0 || next >> 1 === first) break;
        slot = next ^ 1;
      }
      let piece = slot >> 1;
      let from = slot & 1;
      while (piece >= 0 && !used[piece]) {
        used[piece] = 1;
        const a = piece * 6 + from * 3;
        const b = piece * 6 + (from ^ 1) * 3;
        out.array.set(pieces.subarray(a, a + 3), n * 6);
        out.array.set(pieces.subarray(b, b + 3), n * 6 + 3);
        distances.array[n * 2] = travelled;
        travelled += Math.hypot(pieces[b] - pieces[a], pieces[b + 1] - pieces[a + 1], pieces[b + 2] - pieces[a + 2]);
        distances.array[n * 2 + 1] = travelled;
        n++;
        const next = link[piece * 2 + (from ^ 1)];
        piece = next >> 1;
        from = next & 1;
      }
    }

    lineGeometry.instanceCount = n;
    out.needsUpdate = true;
    distances.needsUpdate = true;
  }

  return { visible, hidden, update };
}

function hasVanishingPoints() {
  return !Array.isArray(edgeSegments);
}

function applyMode() {
  const wire = state.mode === 'wireframe';
  const showHidden = wire && state.hiddenEdges;
  mesh.material = wire ? depthMaterial : shape.curved ? smoothMaterial : solidMaterial;
  // A plain wireframe needs no depth stand-in: every edge is drawn the same.
  mesh.visible = !wire || state.hiddenEdges;
  hiddenEdges.visible = showHidden;
  if (contour) contour.hidden.visible = showHidden;
  if (guides) {
    guides.visible = state.guides;
    hiddenGuides.visible = state.guides && showHidden;
  }
  edgeMaterial.linewidth = state.lineWidth;
  hiddenEdgeMaterial.linewidth = Math.max(1, state.lineWidth * 0.75);
  guideMaterial.linewidth = Math.max(1, state.lineWidth * 0.6);
  hiddenGuideMaterial.linewidth = Math.max(1, state.lineWidth * 0.5);
}

// ---------- camera ----------

// The stage shrinks above the controls sheet on phones, so measure it, not the window.
const stage = document.getElementById('stage');
function viewSize() {
  return { w: stage.clientWidth, h: stage.clientHeight };
}

// The camera always frames FRAME world units across the shorter screen side at
// the shape's centre. Changing the lens therefore moves the camera (a "dolly
// zoom"): the shape stays the same size on screen while the perspective changes.
function cameraDistance() {
  return (FRAME * state.focal) / FILM;
}

// How level the camera is: 1 looks straight ahead (Level camera on), 0 tilts
// to look at the shape. The tour eases between the two; otherwise it follows
// the checkbox.
let levelMix = null;
const levelAmount = () => levelMix ?? (state.level ? 1 : 0);

function maxScale() {
  const e = THREE.MathUtils.degToRad(state.elevation);
  // Keep the whole shape comfortably in front of the camera.
  const depth = cameraDistance() * Math.cos(e * levelAmount());
  return (0.8 * depth) / SHAPE_RADIUS;
}

function effectiveScale() {
  return THREE.MathUtils.clamp(state.scale, SCALE_MIN, Math.max(SCALE_MIN, maxScale()));
}

function updateCamera() {
  const { w, h } = viewSize();
  const aspect = w / h;
  const tanHalfShort = FILM / 2 / state.focal;
  const tanHalfV = aspect >= 1 ? tanHalfShort : tanHalfShort / aspect;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalfV));
  camera.aspect = aspect;

  const dist = cameraDistance();
  const e = THREE.MathUtils.degToRad(state.elevation);
  camera.position.set(0, dist * Math.sin(e), dist * Math.cos(e));
  camera.near = Math.max(0.01, dist * 0.01);
  camera.far = dist * 4 + 100;

  // A level camera looks straight ahead (no tilt), then shifts the lens
  // vertically so the shape is centred again. Like an architectural shift
  // lens, this keeps vertical edges parallel: true 1- and 2-point perspective.
  // In between, it tilts part of the way and shifts for the rest.
  const shift = e * levelAmount();
  const tilt = e - shift;
  camera.lookAt(0, camera.position.y - dist * Math.cos(e) * Math.tan(tilt), 0);
  camera.updateProjectionMatrix();
  if (shift !== 0) {
    const m = camera.projectionMatrix.elements;
    m[9] = -m[5] * Math.tan(shift);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  camera.updateMatrixWorld();

  const s = effectiveScale();
  model.scale.setScalar(s);
  grid.position.y = -SHAPE_RADIUS * s - 0.02;
}

// ---------- rendering ----------

let renderQueued = false;

function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(render);
}

function render() {
  renderQueued = false;
  updateCamera();
  if (contour) {
    model.updateMatrixWorld();
    contour.update();
  }
  grid.visible = state.grid;
  renderer.render(scene, camera);
  drawOverlay();
  explainer.update();
}

function resize() {
  const { w, h } = viewSize();
  renderer.setSize(w, h, false);
  const dpr = Math.min(window.devicePixelRatio, 2);
  overlay.width = Math.round(w * dpr);
  overlay.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  requestRender();
}
new ResizeObserver(resize).observe(stage);

// ---------- overlay guides ----------

const tmp4 = new THREE.Vector4();
const tmp3 = new THREE.Vector3();

// Lines closer than half a degree to the picture plane count as parallel: their
// vanishing point would be over a hundred times further away than the shape.
const PARALLEL = Math.sin(THREE.MathUtils.degToRad(0.5));

// Screen position where lines running in world direction `dir` converge.
// Returns null when the lines are parallel to the picture plane (no vanishing point).
function vanishingPoint(dir) {
  tmp3.copy(dir).transformDirection(camera.matrixWorldInverse);
  if (Math.abs(tmp3.z) < PARALLEL) return null;
  tmp4.set(tmp3.x, tmp3.y, tmp3.z, 0).applyMatrix4(camera.projectionMatrix);
  if (Math.abs(tmp4.w) < 1e-4) return null;
  return ndcToScreen(tmp4.x / tmp4.w, tmp4.y / tmp4.w);
}

function ndcToScreen(x, y) {
  const { w, h } = viewSize();
  return { x: ((x + 1) / 2) * w, y: ((1 - y) / 2) * h };
}

function projectPoint(p) {
  tmp3.copy(p).project(camera);
  return ndcToScreen(tmp3.x, tmp3.y);
}

function drawOverlay() {
  const { w, h } = viewSize();
  ctx.clearRect(0, 0, w, h);

  // The explainer always shows both: its narration refers to them.
  const explaining = explainer.isOpen();
  if (state.horizon || explaining) drawHorizon(w);
  if ((state.vanishing || explaining) && hasVanishingPoints()) drawVanishingPoints();
  explainer.drawMarks(ctx);
}

function drawHorizon(w) {
  // The horizon is where every horizontal direction vanishes.
  const forward = camera.getWorldDirection(new THREE.Vector3());
  forward.y = 0;
  if (forward.lengthSq() < 1e-8) return;
  const vp = vanishingPoint(forward.normalize());
  if (!vp) return;

  ctx.save();
  ctx.strokeStyle = palette.horizon;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(0, vp.y);
  ctx.lineTo(w, vp.y);
  ctx.stroke();
  ctx.fillStyle = palette.horizon;
  ctx.font = `500 11px ${OVERLAY_FONT}`;
  // Keep the label clear of the top bar.
  ctx.fillText('HORIZON / EYE LEVEL', 16, vp.y < 80 ? vp.y + 16 : vp.y - 6);
  ctx.restore();
}

function drawVanishingPoints() {
  const { families, segments } = edgeSegments;
  const worldDir = new THREE.Vector3();
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();

  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = `500 11px ${OVERLAY_FONT}`;

  families.forEach(({ dir, label, color: colorIndex }, family) => {
    worldDir.copy(dir).transformDirection(model.matrixWorld);
    const vp = vanishingPoint(worldDir);
    if (!vp) return;
    const color = palette.vp[colorIndex];

    // Extend each edge in this family to the vanishing point.
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (const seg of segments) {
      if (seg.family !== family || (seg.guide && !state.guides)) continue;
      const a = projectPoint(pa.copy(seg.a).applyMatrix4(model.matrixWorld));
      const b = projectPoint(pb.copy(seg.b).applyMatrix4(model.matrixWorld));
      const far = Math.hypot(a.x - vp.x, a.y - vp.y) > Math.hypot(b.x - vp.x, b.y - vp.y) ? a : b;
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(vp.x, vp.y);
    }
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    if (onScreen(vp)) {
      ctx.beginPath();
      ctx.arc(vp.x, vp.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(`VP ${label}`, vp.x + 8, vp.y - 8);
    } else {
      drawOffscreenMarker(vp, `VP ${label}`);
    }
  });

  ctx.restore();
}

const EDGE_MARGIN = 18;
const TOP_MARGIN = 70; // clear of the top bar

function onScreen(p) {
  const { w, h } = viewSize();
  return p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
}

// A vanishing point beyond the edge of the view: an arrow at the edge,
// pointing the way to it.
function drawOffscreenMarker(vp, label) {
  const { w, h } = viewSize();
  const cx = w / 2;
  const cy = h / 2;
  const dx = vp.x - cx;
  const dy = vp.y - cy;
  const top = Math.min(TOP_MARGIN, h / 3);
  const sx = dx > 0 ? (w - EDGE_MARGIN - cx) / dx : dx < 0 ? (EDGE_MARGIN - cx) / dx : Infinity;
  const sy = dy > 0 ? (h - EDGE_MARGIN - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity;
  const s = Math.min(sx, sy);
  const x = cx + dx * s;
  const y = cy + dy * s;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const text = `${label} \u2192 off page`;
  const width = ctx.measureText(text).width;
  const tx = THREE.MathUtils.clamp(x - Math.cos(angle) * (width / 2 + 16) - width / 2, 6, w - width - 6);
  const ty = THREE.MathUtils.clamp(y - Math.sin(angle) * 16 + 4, top - 6, h - 6);
  ctx.fillText(text, tx, ty);
}

// ---------- pointer interaction ----------

const pointers = new Map();
let pinch = null;

function rotateBy(dx, dy, roll) {
  const { w, h } = viewSize();
  const speed = (Math.PI * 1.2) / Math.min(w, h);
  const q = new THREE.Quaternion();
  if (roll) {
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    q.setFromAxisAngle(axis, -dx * speed);
  } else {
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    // Trackball: rotate about the screen-space axis perpendicular to the drag.
    const axis = new THREE.Vector3(dy / len, dx / len, 0).applyQuaternion(camera.quaternion);
    q.setFromAxisAngle(axis, len * speed);
  }
  model.quaternion.premultiply(q);
  requestRender();
}

function setScale(s) {
  state.scale = THREE.MathUtils.clamp(s, SCALE_MIN, maxScale());
  requestRender();
}

function pinchInfo() {
  const [p1, p2] = [...pointers.values()];
  return {
    dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
    angle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  explainer.takeOver();
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.classList.add('dragging');
  if (pointers.size === 2) pinch = { ...pinchInfo(), scale: effectiveScale() };
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;

  if (pointers.size === 1) {
    rotateBy(dx, dy, e.shiftKey);
  } else if (pointers.size === 2 && pinch) {
    const now = pinchInfo();
    setScale(pinch.scale * (now.dist / pinch.dist));
    // Two-finger twist spins the shape in the picture plane.
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
      -(now.angle - pinch.angle),
    );
    model.quaternion.premultiply(q);
    pinch.angle = now.angle;
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  setScale(effectiveScale() * Math.exp(-delta * 0.0015));
}, { passive: false });

// ---------- presets ----------

function applyPreset(name) {
  explainer.takeOver();
  if (name === 'random') {
    model.quaternion.random();
    state.level = false;
  } else {
    const p = PRESETS[name];
    model.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-p.yaw));
    state.elevation = p.elevation;
    state.level = p.level;
    if (name === 'reset') {
      // Keep the display preferences; reset the view.
      Object.assign(state, DEFAULTS, { mode: state.mode, paper: state.paper });
    }
  }
  applyMode();
  syncUI();
  requestRender();
}

// ---------- UI wiring ----------

const $ = (id) => document.getElementById(id);
const ui = {
  shape: $('shapeSelect'),
  modeButtons: document.querySelectorAll('.mode-toggle button'),
  hiddenEdges: $('hiddenEdges'),
  hiddenEdgesRow: $('hiddenEdgesRow'),
  lineWidth: $('lineWidth'),
  lineWidthOut: $('lineWidthOut'),
  focal: $('focal'),
  focalOut: $('focalOut'),
  elevation: $('elevation'),
  elevationOut: $('elevationOut'),
  level: $('level'),
  horizon: $('horizon'),
  vanishing: $('vanishing'),
  vanishingRow: $('vanishingRow'),
  guides: $('guides'),
  guidesRow: $('guidesRow'),
  grid: $('grid'),
  paper: $('paper'),
  panel: $('panel'),
  panelToggle: $('panelToggle'),
  explain: $('explainToggle'),
  explainLive: $('explainLive'),
  tour: $('tourStart'),
};

const focalFromSlider = (t) => FOCAL_MIN * Math.pow(FOCAL_MAX / FOCAL_MIN, t / 1000);
const sliderFromFocal = (f) => Math.round((1000 * Math.log(f / FOCAL_MIN)) / Math.log(FOCAL_MAX / FOCAL_MIN));

for (const { name, id, group } of SHAPES) {
  let parent = ui.shape;
  if (group) {
    parent = [...ui.shape.querySelectorAll('optgroup')].find((g) => g.label === group);
    if (!parent) {
      parent = document.createElement('optgroup');
      parent.label = group;
      ui.shape.append(parent);
    }
  }
  parent.append(new Option(name, id));
}

function syncUI() {
  ui.shape.value = state.shapeId;
  ui.shape.disabled = SHAPES.length < 2;

  for (const btn of ui.modeButtons) {
    btn.setAttribute('aria-checked', String(btn.dataset.mode === state.mode));
  }

  ui.hiddenEdges.checked = state.hiddenEdges;
  ui.hiddenEdgesRow.classList.toggle('disabled', state.mode !== 'wireframe');

  ui.lineWidth.value = state.lineWidth;
  ui.lineWidthOut.textContent = `${state.lineWidth} px`;

  ui.focal.value = sliderFromFocal(state.focal);
  const fov = THREE.MathUtils.radToDeg(2 * Math.atan(FILM / 2 / state.focal));
  ui.focalOut.textContent = `${Math.round(state.focal)} mm · ${Math.round(fov)}°`;

  ui.elevation.value = state.elevation;
  ui.elevationOut.textContent =
    state.elevation === 0 ? 'level' : `${Math.abs(state.elevation)}° ${state.elevation > 0 ? 'above' : 'below'}`;
  ui.level.checked = state.level;

  ui.horizon.checked = state.horizon;
  ui.grid.checked = state.grid;
  ui.paper.checked = state.paper;
  const vpAvailable = hasVanishingPoints();
  ui.vanishing.checked = state.vanishing && vpAvailable;
  ui.vanishing.disabled = !vpAvailable;
  ui.vanishingRow.classList.toggle('disabled', !vpAvailable);
  ui.vanishingRow.title = vpAvailable ? '' : 'This shape has no parallel edges to converge';
  const guidesAvailable = Boolean(guides);
  ui.guides.checked = state.guides && guidesAvailable;
  ui.guides.disabled = !guidesAvailable;
  ui.guidesRow.classList.toggle('disabled', !guidesAvailable);
  ui.guidesRow.title = guidesAvailable ? '' : 'No construction lines for this shape';

  ui.explain.setAttribute('aria-pressed', String(explainer.isOpen()));
  ui.explainLive.checked = explainer.isOpen();
}

function setMode(mode) {
  state.mode = mode;
  applyMode();
  syncUI();
  requestRender();
}

function toggleMode() {
  setMode(state.mode === 'solid' ? 'wireframe' : 'solid');
}

function bindCheckbox(el, key, after) {
  el.addEventListener('change', () => {
    state[key] = el.checked;
    after?.();
    syncUI();
    requestRender();
  });
}

function toggleState(key, after) {
  state[key] = !state[key];
  after?.();
  syncUI();
  requestRender();
}

function selectShape(id) {
  loadShape(id);
  history.replaceState(null, '', `#${state.shapeId}`);
}

function stepShape(by) {
  const i = SHAPES.findIndex((s) => s.id === state.shapeId);
  selectShape(SHAPES[(i + by + SHAPES.length) % SHAPES.length].id);
}

ui.shape.addEventListener('change', () => {
  explainer.takeOver();
  selectShape(ui.shape.value);
});

for (const btn of ui.modeButtons) {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
}

bindCheckbox(ui.hiddenEdges, 'hiddenEdges', applyMode);
bindCheckbox(ui.level, 'level', () => explainer.takeOver());
bindCheckbox(ui.horizon, 'horizon');
bindCheckbox(ui.vanishing, 'vanishing');
bindCheckbox(ui.guides, 'guides', applyMode);
bindCheckbox(ui.grid, 'grid');
bindCheckbox(ui.paper, 'paper', applyPalette);

ui.lineWidth.addEventListener('input', () => {
  state.lineWidth = Number(ui.lineWidth.value);
  applyMode();
  syncUI();
  requestRender();
});

ui.focal.addEventListener('input', () => {
  explainer.takeOver();
  state.focal = focalFromSlider(Number(ui.focal.value));
  syncUI();
  requestRender();
});

ui.elevation.addEventListener('input', () => {
  explainer.takeOver();
  state.elevation = Number(ui.elevation.value);
  syncUI();
  requestRender();
});

for (const btn of document.querySelectorAll('[data-preset]')) {
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
}

function setPanelOpen(open) {
  ui.panel.hidden = !open;
  document.body.classList.toggle('panel-open', open);
  ui.panelToggle.setAttribute('aria-expanded', String(open));
}
ui.panelToggle.addEventListener('click', () => setPanelOpen(ui.panel.hidden));

ui.explain.addEventListener('click', () => (explainer.isOpen() ? explainer.close() : explainer.startTour()));
ui.tour.addEventListener('click', () => explainer.startTour());
ui.explainLive.addEventListener('change', () => {
  if (ui.explainLive.checked !== explainer.isOpen()) explainer.toggleLive();
});

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLSelectElement) return;
  // Leave Space and the arrow keys to focused buttons and sliders.
  if ((e.key === ' ' || e.key.startsWith('Arrow')) && e.target instanceof HTMLElement
    && e.target.matches('button, input')) return;
  const actions = {
    w: toggleMode,
    1: () => applyPreset('one'),
    2: () => applyPreset('two'),
    3: () => applyPreset('three'),
    n: () => applyPreset('random'),
    r: () => applyPreset('reset'),
    h: () => document.body.classList.toggle('ui-hidden'),
    g: () => toggleState('grid'),
    p: () => toggleState('paper', applyPalette),
    v: () => hasVanishingPoints() && toggleState('vanishing'),
    l: () => toggleState('horizon'),
    c: () => guides && toggleState('guides', applyMode),
    '[': () => { explainer.takeOver(); stepShape(-1); },
    ']': () => { explainer.takeOver(); stepShape(1); },
    t: () => explainer.startTour(),
    e: () => explainer.toggleLive(),
    ' ': () => explainer.isTour() && explainer.togglePlay(),
    arrowleft: () => explainer.isTour() && explainer.step(-1),
    arrowright: () => explainer.isTour() && explainer.step(1),
    escape: () => explainer.isOpen() && explainer.close(),
  };
  const action = actions[e.key.toLowerCase()];
  if (action) {
    e.preventDefault();
    action();
  }
});

// ---------- explainer ----------

const explainer = createExplainer({
  state,
  model,
  camera,
  palette,
  viewSize,
  vanishingPoint,
  projectPoint,
  requestRender,
  syncUI,
  applyMode,
  setMode,
  selectShape,
  setPanelOpen,
  levelAmount,
  setLevelMix: (v) => { levelMix = v; },
  families: () => (hasVanishingPoints() ? edgeSegments.families : []),
  edges: () => edgeList,
  bounds: () => mesh.geometry.boundingBox,
  radius: () => SHAPE_RADIUS,
  shape: () => shape,
  onOpenChange: () => {
    colorEdges();
    syncUI();
  },
});

// ---------- start ----------

setPanelOpen(window.innerWidth > 640);
applyPalette();
loadShape(location.hash.slice(1) || SHAPES[0].id);
applyPreset('reset');
resize();
// Overlay labels use the brand mono face; redraw once it has loaded.
document.fonts?.ready.then(requestRender);
