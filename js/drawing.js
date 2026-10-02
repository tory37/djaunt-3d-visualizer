import * as THREE from 'three';

/**
 * Drawing checks for box-shaped solids (shapes marked `cuboid` in shapes.js):
 * the things you'd compare by eye, or with a pencil held at arm's length, to
 * get a box right on paper. How wide each face is next to the other, how much
 * shorter the far edges are than the near one, how open the top is, how
 * steeply edges slope, and the angles at the near corner.
 *
 * Everything is measured on screen, from the live view.
 */

const deg = THREE.MathUtils.radToDeg;
const SIGNS = [-1, 1];
// The rule teachers give: no angle at a box's near corner looks sharper than a
// right angle. A sharper one means the VPs are too close together.
export const SHARP = 89.5;

export function measureBox(app, families) {
  if (!app.shape().cuboid) return null;
  const { model, camera } = app;
  const { min, max } = app.bounds();
  const eye = model.worldToLocal(camera.position.clone());
  // Which face you see along each axis: +1, -1, or 0 for neither.
  const seen = (k) => (eye[k] > max[k] ? 1 : eye[k] < min[k] ? -1 : 0);
  const sx = seen('x');
  const sy = seen('y');
  const sz = seen('z');

  const local = (x, y, z) => new THREE.Vector3(x > 0 ? max.x : min.x, y > 0 ? max.y : min.y, z > 0 ? max.z : min.z);
  const corner = (x, y, z) => app.projectPoint(local(x, y, z).applyMatrix4(model.matrixWorld));
  const colorOf = (label) => families.find((f) => f.label === label)?.color;

  const all = [];
  for (const x of SIGNS) for (const y of SIGNS) for (const z of SIGNS) all.push(corner(x, y, z));
  const bounds = {
    minX: Math.min(...all.map((p) => p.x)),
    maxX: Math.max(...all.map((p) => p.x)),
    minY: Math.min(...all.map((p) => p.y)),
    maxY: Math.max(...all.map((p) => p.y)),
  };

  const upright = new THREE.Vector3(0, 1, 0).applyQuaternion(model.quaternion).y > 0.999;
  // The circles the top and bottom corners travel around as the box spins.
  const ring = (y) => {
    const cx = (min.x + max.x) / 2;
    const cz = (min.z + max.z) / 2;
    const r = Math.hypot((max.x - min.x) / 2, (max.z - min.z) / 2);
    const pts = [];
    for (let i = 0; i <= 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      pts.push(app.projectPoint(new THREE.Vector3(cx + r * Math.cos(t), y, cz + r * Math.sin(t)).applyMatrix4(model.matrixWorld)));
    }
    return pts;
  };
  const rings = upright ? [ring(max.y), ring(min.y)] : null;
  const flat = sy > 0 ? 'top' : sy < 0 ? 'base' : null;
  const opening = (y) => {
    const pts = [corner(-1, y, -1), corner(1, y, -1), corner(1, y, 1), corner(-1, y, 1)];
    const wide = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
    const deep = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
    return wide > 0 ? deep / wide : 0;
  };

  // A vertical edge of the box, on screen.
  const edge = (x, z) => {
    const top = corner(x, 1, z);
    const bottom = corner(x, -1, z);
    const mid = new THREE.Vector3(x > 0 ? max.x : min.x, (min.y + max.y) / 2, z > 0 ? max.z : min.z);
    return { top, bottom, mid, x: (top.x + bottom.x) / 2, height: Math.hypot(top.x - bottom.x, top.y - bottom.y) };
  };

  if (upright && sx && sz) {
    // Two side faces in view, meeting at the near vertical edge.
    const near = edge(sx, sz);
    // The face you see along x has its horizontal edges along z, and vice versa.
    const faceX = { outer: edge(sx, -sz), color: colorOf('Z') };
    const faceZ = { outer: edge(-sx, sz), color: colorOf('X') };
    for (const f of [faceX, faceZ]) {
      f.width = Math.abs(f.outer.x - near.x);
      f.height = f.outer.height / near.height;
      f.lean = deg(Math.atan2(Math.abs(f.outer.top.x - f.outer.bottom.x), Math.abs(f.outer.top.y - f.outer.bottom.y)));
      f.slopeTop = slope(near.top, f.outer.top);
      f.slopeBase = slope(near.bottom, f.outer.bottom);
      // The face's centre, where its diagonals cross: nearer the far edge.
      f.centre = intersect(near.top, f.outer.bottom, near.bottom, f.outer.top);
      f.nearHalf = f.centre ? Math.abs(f.centre.x - near.x) / (f.width || 1) : 0.5;
    }
    const [left, right] = faceX.outer.x < faceZ.outer.x ? [faceX, faceZ] : [faceZ, faceX];
    return {
      kind: 'two',
      near,
      left,
      right,
      flat,
      open: flat ? opening(sy) : 0,
      angles: sy ? cornerAngles(corner(sx, sy, sz), [corner(-sx, sy, sz), corner(sx, -sy, sz), corner(sx, sy, -sz)]) : null,
      flatAngle: sy ? angleAt(corner(sx, sy, sz), corner(-sx, sy, sz), corner(sx, sy, -sz)) : null,
      rings,
      bounds,
    };
  }

  if (upright && (sx || sz)) {
    // Square-on: one side face faces you, the opposite one hides behind it.
    const s = sx || sz;
    const ends = (side) => (sx ? [edge(side, -1), edge(side, 1)] : [edge(-1, side), edge(1, side)]);
    const front = ends(s);
    const back = ends(-s);
    const avg = (pair) => (pair[0].height + pair[1].height) / 2;
    return {
      kind: 'one',
      front,
      back,
      backRatio: avg(back) / avg(front),
      flat,
      open: flat ? opening(sy) : 0,
      rings,
      bounds,
    };
  }

  if (sx && sy && sz) {
    // Tipped: three faces meet at the near corner.
    const c = corner(sx, sy, sz);
    return {
      kind: 'tilted',
      cornerAt: c,
      angles: cornerAngles(c, [corner(-sx, sy, sz), corner(sx, -sy, sz), corner(sx, sy, -sz)]),
      bounds,
    };
  }

  return { kind: 'none', bounds };
}

// How steeply the line from p to q runs, in degrees from horizontal, and which way.
function slope(p, q) {
  const angle = deg(Math.atan2(Math.abs(q.y - p.y), Math.abs(q.x - p.x)));
  return { angle, dir: q.y > p.y ? 'down' : 'up' };
}

function intersect(p1, p2, p3, p4) {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

function angleAt(c, p, q) {
  const a = Math.atan2(p.y - c.y, p.x - c.x);
  const b = Math.atan2(q.y - c.y, q.x - c.x);
  let d = Math.abs(a - b);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return deg(d);
}

// The three angles around a corner where three faces meet (they add up to 360°).
function cornerAngles(c, neighbours) {
  const dirs = neighbours.map((p) => Math.atan2(p.y - c.y, p.x - c.x)).sort((a, b) => a - b);
  const gaps = dirs.map((d, i) => (i < 2 ? dirs[i + 1] - d : dirs[0] + 2 * Math.PI - d)).map(deg);
  return { list: gaps, min: Math.min(...gaps), dirs, at: c };
}

// ---------- words ----------

const pct = (v) => `${Math.round(v * 100)}%`;
const degrees = (v) => `${Math.round(v)}°`;
const one = (v) => (v >= 9.5 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ''));

// Face widths as a ratio, narrow face = 1, in left : right order.
export function widthRatio(m) {
  const narrow = Math.min(m.left.width, m.right.width) || 1;
  return `${one(m.left.width / narrow)} : ${one(m.right.width / narrow)}`;
}

// Rows for the card's checklist.
export function checks(m, eyeLevel) {
  if (!m) return null;
  const rows = [];
  if (m.kind === 'two') {
    rows.push({ label: 'Faces, left : right', value: widthRatio(m) });
    rows.push({ label: 'Far corners vs near', value: `${pct(m.left.height)} · ${pct(m.right.height)}` });
    if (m.flatAngle) rows.push({ label: `Near corner of ${m.flat}`, value: degrees(m.flatAngle), warn: m.flatAngle < SHARP });
    rows.push(openRow(m, eyeLevel));
    rows.push({ label: 'Top edges slope', value: `${degrees(m.left.slopeTop.angle)} · ${degrees(m.right.slopeTop.angle)}` });
    rows.push({ label: 'Base edges slope', value: `${degrees(m.left.slopeBase.angle)} · ${degrees(m.right.slopeBase.angle)}` });
    const lean = Math.max(m.left.lean, m.right.lean);
    rows.push({ label: 'Verticals', value: lean < 0.5 ? 'vertical' : `lean ${degrees(m.left.lean)} · ${degrees(m.right.lean)}` });
  } else if (m.kind === 'one') {
    rows.push({ label: 'Front face', value: 'true shape' });
    rows.push({ label: 'Back face vs front', value: pct(m.backRatio) });
    rows.push(openRow(m, eyeLevel));
  } else if (m.kind === 'tilted') {
    rows.push({ label: 'Angles at near corner', value: m.angles.list.map(degrees).join(' · '), warn: m.angles.min < SHARP });
  }
  return rows;
}

function openRow(m, eyeLevel) {
  if (eyeLevel === 'through' || !m.flat) return { label: 'Top and base', value: 'edge-on' };
  return { label: m.flat === 'top' ? 'Top opening' : 'Base opening', value: pct(m.open) };
}

// ---------- marks on the view ----------

/**
 * Measuring marks drawn over the 3D view, like the guide lines and notes a
 * teacher sketches beside a drawing.
 *   widths   brackets under the box comparing the two side faces
 *   centre   each face's diagonals, crossing at its centre
 *   heights  how tall each vertical edge is next to the near one
 *   corner   the angle at the near corner
 *   slopes   a level pencil line through the near corner, with edge angles
 *   lean     true verticals beside the outer edges (3-point)
 *   ring     the ellipses the top and bottom corners ride as the box spins
 * With `plain` set (the tour), the marks are drawn without their numbers,
 * except the corner angle: the ideas matter there, not the measurements.
 */
export function drawMarks(ctx, m, marks, colors, view, plain = false) {
  if (!m || !marks?.length) return;
  ctx.save();
  ctx.font = `500 11px ${colors.font}`;
  ctx.textBaseline = 'middle';
  ctx.lineCap = 'round';
  const label = (str, x, y, align = 'center', color = colors.text) => {
    ctx.textAlign = align;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colors.bg;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  };
  // A measurement's label, left out in plain mode.
  const num = (...args) => { if (!plain) label(...args); };
  const seg = (x0, y0, x1, y1) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  if (m.kind === 'two') {
    const { near, left, right } = m;

    if (marks.includes('widths')) {
      const y = Math.min(m.bounds.maxY + 26, view.h - 18);
      const narrow = Math.min(left.width, right.width) || 1;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = colors.muted;
      for (const e of [near, left.outer, right.outer]) seg(e.bottom.x, e.bottom.y + 4, e.bottom.x, y + 6);
      ctx.setLineDash([]);
      for (const f of [left, right]) {
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2;
        seg(near.bottom.x, y, f.outer.bottom.x, y);
        seg(f.outer.bottom.x, y - 5, f.outer.bottom.x, y + 5);
        num(one(f.width / narrow), (near.bottom.x + f.outer.bottom.x) / 2, y + 12, 'center', f.color);
      }
      ctx.strokeStyle = colors.text;
      seg(near.bottom.x, y - 5, near.bottom.x, y + 5);
    }

    if (marks.includes('heights')) {
      label(plain ? 'tallest' : '100%', near.bottom.x, near.bottom.y + 13);
      for (const f of [left, right]) {
        const outside = f === left ? -8 : 8;
        num(pct(f.height), f.outer.x + outside, (f.outer.top.y + f.outer.bottom.y) / 2, f === left ? 'right' : 'left');
      }
    }

    if (marks.includes('slopes')) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const x0 = left.outer.x - 30;
      const x1 = right.outer.x + 30;
      seg(x0, near.top.y, x1, near.top.y);
      seg(x0, near.bottom.y, x1, near.bottom.y);
      ctx.setLineDash([]);
      for (const f of [left, right]) {
        const outside = f === left ? -6 : 6;
        const align = f === left ? 'right' : 'left';
        const edgeX = f === left ? Math.min(f.outer.top.x, f.outer.bottom.x) : Math.max(f.outer.top.x, f.outer.bottom.x);
        num(degrees(f.slopeTop.angle), edgeX + outside, f.outer.top.y + (f.slopeTop.dir === 'down' ? -9 : 9), align, colors.accent);
        num(degrees(f.slopeBase.angle), edgeX + outside, f.outer.bottom.y + (f.slopeBase.dir === 'down' ? -9 : 9), align, colors.accent);
      }
    }

    if (marks.includes('centre')) {
      for (const f of [left, right]) {
        if (!f.centre || f.width < 24) continue;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;
        ctx.setLineDash([3, 3]);
        seg(near.top.x, near.top.y, f.outer.bottom.x, f.outer.bottom.y);
        seg(near.bottom.x, near.bottom.y, f.outer.top.x, f.outer.top.y);
        ctx.setLineDash([]);
        // The vertical through the centre, from top edge to bottom edge.
        const u = (f.centre.x - near.x) / ((f.outer.x - near.x) || 1);
        const top = { x: near.top.x + u * (f.outer.top.x - near.top.x), y: near.top.y + u * (f.outer.top.y - near.top.y) };
        const bottom = { x: near.bottom.x + u * (f.outer.bottom.x - near.bottom.x), y: near.bottom.y + u * (f.outer.bottom.y - near.bottom.y) };
        ctx.lineWidth = 1.5;
        seg(top.x, top.y, bottom.x, bottom.y);
        ctx.globalAlpha = 1;
        num(`${pct(f.nearHalf)} | ${pct(1 - f.nearHalf)}`, f.centre.x, bottom.y + 12, 'center', f.color);
      }
    }

    if (marks.includes('lean')) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      for (const f of [left, right]) {
        const b = f.outer.bottom;
        seg(b.x, b.y, b.x, f.outer.top.y);
        const outside = f === left ? -8 : 8;
        const x = f === left ? Math.min(f.outer.top.x, b.x) : Math.max(f.outer.top.x, b.x);
        num(degrees(f.lean), x + outside, (f.outer.top.y * 3 + b.y) / 4, f === left ? 'right' : 'left', colors.accent);
      }
      ctx.setLineDash([]);
    }
  }

  if (marks.includes('corner')) {
    const angles = m.kind === 'two' && m.flatAngle ? null : m.angles;
    if (m.kind === 'two' && m.flatAngle) {
      const c = m.flat === 'top' ? m.near.top : m.near.bottom;
      const a = m.flat === 'top' ? m.left.outer.top : m.left.outer.bottom;
      const b = m.flat === 'top' ? m.right.outer.top : m.right.outer.bottom;
      arc(ctx, c, Math.atan2(a.y - c.y, a.x - c.x), Math.atan2(b.y - c.y, b.x - c.x), m.flatAngle, colors, label);
    } else if (angles) {
      const { dirs, at, list } = angles;
      dirs.forEach((d, i) => arc(ctx, at, d, i < 2 ? dirs[i + 1] : dirs[0] + Math.PI * 2, list[i], colors, label));
    }
  }

  if (m.kind === 'one' && marks.includes('heights')) {
    const back = m.back[1];
    const front = m.front[1];
    num('100%', front.x + 8, (front.top.y + front.bottom.y) / 2, 'left');
    num(pct(m.backRatio), back.x - 6, back.top.y - 10, 'right');
  }

  if (marks.includes('ring') && m.rings) {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    for (const pts of m.rings) {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// An angle arc at corner c, from direction a to b, labelled in degrees.
function arc(ctx, c, a, b, value, colors, label) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  ctx.strokeStyle = value < SHARP ? colors.warn : colors.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 18, a, a + d, d < 0);
  ctx.stroke();
  const mid = a + d / 2;
  label(degrees(value), c.x + Math.cos(mid) * 34, c.y + Math.sin(mid) * 34, 'center', value < SHARP ? colors.warn : colors.accent);
}
