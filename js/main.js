import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { SHAPES } from './shapes.js';

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

function applyPalette() {
  document.documentElement.classList.toggle('dj-light', state.paper);
  readPalette();
  renderer.setClearColor(palette.bg);
  solidMaterial.color.set(palette.face);
  edgeMaterial.color.set(palette.line);
  hiddenEdgeMaterial.color.set(palette.line);
  grid.material.color.set(palette.grid);
}

let mesh, edges, hiddenEdges, edgeSegments = [];

function loadShape(id) {
  const shape = SHAPES.find((s) => s.id === id) || SHAPES[0];
  state.shapeId = shape.id;

  for (const child of [...model.children]) {
    model.remove(child);
    child.geometry.dispose();
  }

  const geometry = shape.build();
  geometry.computeBoundingSphere();
  const { center, radius } = geometry.boundingSphere;
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(SHAPE_RADIUS / radius, SHAPE_RADIUS / radius, SHAPE_RADIUS / radius);
  geometry.computeBoundingSphere();

  const edgesGeometry = new THREE.EdgesGeometry(geometry, shape.edgeAngle ?? 1);
  const lineGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edgesGeometry);

  mesh = new THREE.Mesh(geometry, solidMaterial);
  edges = new LineSegments2(lineGeometry, edgeMaterial);
  edges.renderOrder = 1;
  hiddenEdges = new LineSegments2(lineGeometry, hiddenEdgeMaterial);
  hiddenEdges.computeLineDistances();
  hiddenEdges.renderOrder = 2;
  model.add(mesh, edges, hiddenEdges);

  edgeSegments = classifyEdges(edgesGeometry, shape.vanishingDirections);
  edgesGeometry.dispose();

  applyMode();
  syncUI();
  requestRender();
}

// Group the shape's edges by which vanishing direction (if any) they run along.
function classifyEdges(edgesGeometry, directions) {
  if (!directions) return [];
  const dirs = directions.map((d) => new THREE.Vector3(...d).normalize());
  const pos = edgesGeometry.attributes.position;
  const segments = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const u = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 2) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    u.subVectors(b, a).normalize();
    const family = dirs.findIndex((d) => Math.abs(d.dot(u)) > 0.999);
    if (family >= 0) segments.push({ a: a.clone(), b: b.clone(), family });
  }
  return segments.length ? { dirs, segments } : [];
}

function hasVanishingPoints() {
  return !Array.isArray(edgeSegments);
}

function applyMode() {
  const wire = state.mode === 'wireframe';
  mesh.material = wire ? depthMaterial : solidMaterial;
  // A plain wireframe needs no depth stand-in: every edge is drawn the same.
  mesh.visible = !wire || state.hiddenEdges;
  hiddenEdges.visible = wire && state.hiddenEdges;
  edgeMaterial.linewidth = state.lineWidth;
  hiddenEdgeMaterial.linewidth = Math.max(1, state.lineWidth * 0.75);
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

function maxScale() {
  const e = THREE.MathUtils.degToRad(state.elevation);
  // Keep the whole shape comfortably in front of the camera.
  const depth = cameraDistance() * (state.level ? Math.cos(e) : 1);
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

  if (state.level) {
    // Look straight ahead (no tilt), then shift the lens vertically so the
    // shape is centred again. Like an architectural shift lens, this keeps
    // vertical edges parallel: true 1- and 2-point perspective.
    camera.lookAt(0, camera.position.y, 0);
    camera.updateProjectionMatrix();
    const m = camera.projectionMatrix.elements;
    m[9] = -m[5] * Math.tan(e);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  } else {
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
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
  grid.visible = state.grid;
  renderer.render(scene, camera);
  drawOverlay();
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

// Screen position where lines running in world direction `dir` converge.
// Returns null when the lines are parallel to the picture plane (no vanishing point).
function vanishingPoint(dir) {
  tmp3.copy(dir).transformDirection(camera.matrixWorldInverse);
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

  if (state.horizon) drawHorizon(w);
  if (state.vanishing && hasVanishingPoints()) drawVanishingPoints();
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
  const { dirs, segments } = edgeSegments;
  const worldDir = new THREE.Vector3();
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const labels = ['X', 'Y', 'Z'];

  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = `500 11px ${OVERLAY_FONT}`;

  dirs.forEach((dir, family) => {
    worldDir.copy(dir).transformDirection(model.matrixWorld);
    const vp = vanishingPoint(worldDir);
    if (!vp) return;
    const color = palette.vp[family % palette.vp.length];

    // Extend each edge in this family to the vanishing point.
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (const seg of segments) {
      if (seg.family !== family) continue;
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
    ctx.beginPath();
    ctx.arc(vp.x, vp.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(`VP ${labels[family] ?? family + 1}`, vp.x + 8, vp.y - 8);
  });

  ctx.restore();
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
  grid: $('grid'),
  paper: $('paper'),
  panel: $('panel'),
  panelToggle: $('panelToggle'),
};

const focalFromSlider = (t) => FOCAL_MIN * Math.pow(FOCAL_MAX / FOCAL_MIN, t / 1000);
const sliderFromFocal = (f) => Math.round((1000 * Math.log(f / FOCAL_MIN)) / Math.log(FOCAL_MAX / FOCAL_MIN));

for (const shape of SHAPES) {
  ui.shape.add(new Option(shape.name, shape.id));
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

ui.shape.addEventListener('change', () => {
  loadShape(ui.shape.value);
  history.replaceState(null, '', `#${state.shapeId}`);
});

for (const btn of ui.modeButtons) {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
}

bindCheckbox(ui.hiddenEdges, 'hiddenEdges', applyMode);
bindCheckbox(ui.level, 'level');
bindCheckbox(ui.horizon, 'horizon');
bindCheckbox(ui.vanishing, 'vanishing');
bindCheckbox(ui.grid, 'grid');
bindCheckbox(ui.paper, 'paper', applyPalette);

ui.lineWidth.addEventListener('input', () => {
  state.lineWidth = Number(ui.lineWidth.value);
  applyMode();
  syncUI();
  requestRender();
});

ui.focal.addEventListener('input', () => {
  state.focal = focalFromSlider(Number(ui.focal.value));
  syncUI();
  requestRender();
});

ui.elevation.addEventListener('input', () => {
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

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLSelectElement) return;
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
  };
  const action = actions[e.key.toLowerCase()];
  if (action) {
    e.preventDefault();
    action();
  }
});

// ---------- start ----------

setPanelOpen(window.innerWidth > 640);
applyPalette();
loadShape(location.hash.slice(1) || SHAPES[0].id);
applyPreset('reset');
resize();
// Overlay labels use the brand mono face; redraw once it has loaded.
document.fonts?.ready.then(requestRender);
