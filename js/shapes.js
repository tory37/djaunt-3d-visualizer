import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Shape registry. To add a shape, append an entry here; the viewer picks it up
 * automatically.
 *
 *   id       unique key (used in the URL hash)
 *   name     label shown in the shape picker
 *   group    heading the shape is listed under in the picker
 *   build()  returns a THREE.BufferGeometry. Any size or position is fine:
 *            the viewer recenters it and scales it to a common size.
 *   curved (optional)
 *            true for smooth surfaces. They get smooth shading, and their
 *            outline (contour) is traced fresh for every view, because a curved
 *            surface has no fixed edges to draw.
 *   edgeAngle (optional)
 *            crease angle in degrees: an edge is drawn where neighbouring faces
 *            meet at more than this angle. Default 1 (every hard edge), or 30
 *            for curved shapes so their facets don't get outlined.
 *   guides() (optional)
 *            construction lines (centre axis, cross-contours, ellipse
 *            diameters) as a list of polylines, each a list of [x, y, z] points
 *            in the same space as build(). Lines meant to sit on a curved
 *            surface should pass through the mesh's vertices, so they hug it.
 *   cuboid (optional)
 *            true for boxes built axis-aligned (BoxGeometry): the explainer
 *            then measures them the way you'd check a drawn box (face
 *            widths, near corner angle, how much the far edges shrink).
 *   vanishingDirections (optional)
 *            directions whose parallel lines get vanishing-point guides; edges
 *            and construction lines running along them are extended to the
 *            point where they converge. When left out, every family of two or
 *            more parallel edges is found automatically, which suits most
 *            flat-faced shapes. Use [] to turn the guide off.
 */

const TAU = Math.PI * 2;
// Segments around curved shapes. Keep it a multiple of 4, so the guide circles
// and diameters below land on mesh vertices.
const ROUND = 64;

const X = [1, 0, 0];
const Y = [0, 1, 0];
const Z = [0, 0, 1];

// Circle around the vertical axis, matching three.js's vertex layout for
// cylinders, cones and spheres.
function ring(radius, y, segments = ROUND) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * TAU;
    points.push([radius * Math.sin(t), y, radius * Math.cos(t)]);
  }
  return points;
}

// Great circle through the poles, in the plane at `angle` around the vertical axis.
function meridian(radius, angle, segments = ROUND) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * TAU;
    const r = radius * Math.sin(t);
    points.push([r * Math.sin(angle), radius * Math.cos(t), r * Math.cos(angle)]);
  }
  return points;
}

// Cone, radius 1 and height 2. Built by hand rather than with ConeGeometry so
// the apex keeps its zero-area triangles: each one carries the normals of both
// neighbouring sides, which lets the traced outline run right up to the tip.
function cone() {
  const side = new THREE.LatheGeometry(
    [new THREE.Vector2(1, -1), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)],
    ROUND,
  );
  const base = new THREE.CircleGeometry(1, ROUND).rotateX(Math.PI / 2).translate(0, -1, 0);
  return mergeGeometries([side, base]);
}

const axis = (from, to) => [[0, from, 0], [0, to, 0]];

// The two diameters of a horizontal circle, along x and z: they cross at the
// circle's centre, which is how you find it on a drawn ellipse.
const diameters = (radius, y) => [
  [[-radius, y, 0], [radius, y, 0]],
  [[0, y, -radius], [0, y, radius]],
];

export const SHAPES = [
  {
    id: 'cube',
    name: 'Cube',
    group: 'Flat faces',
    cuboid: true,
    build: () => new THREE.BoxGeometry(2, 2, 2),
  },
  {
    id: 'box',
    name: 'Rectangular prism',
    group: 'Flat faces',
    cuboid: true,
    // Long and low, like a brick or a bed.
    build: () => new THREE.BoxGeometry(2.8, 1.4, 1.8),
  },
  {
    id: 'tall-box',
    name: 'Rectangular prism, tall',
    group: 'Flat faces',
    cuboid: true,
    // Standing up, like a tower or a fridge.
    build: () => new THREE.BoxGeometry(1.5, 3, 1.5),
  },
  {
    id: 'pyramid',
    name: 'Pyramid',
    group: 'Flat faces',
    // Square base 2 × 2 (corner radius √2), rotated so its sides run along x and z.
    build: () => new THREE.ConeGeometry(Math.SQRT2, 1.8, 4, 1, false, Math.PI / 4),
    guides: () => [
      axis(-0.9, 1.25),
      [[-1, -0.9, -1], [1, -0.9, 1]],
      [[-1, -0.9, 1], [1, -0.9, -1]],
    ],
    vanishingDirections: [X, Y, Z],
  },
  {
    id: 'triangular-prism',
    name: 'Triangular prism',
    group: 'Flat faces',
    // Lying down like a roof: ridge up, length along z.
    build: () => new THREE.CylinderGeometry(1, 1, 2.6, 3).rotateX(-Math.PI / 2),
  },
  {
    id: 'hexagonal-prism',
    name: 'Hexagonal prism',
    group: 'Flat faces',
    build: () => new THREE.CylinderGeometry(1, 1, 2, 6),
  },
  {
    id: 'cylinder',
    name: 'Cylinder',
    group: 'Curved',
    curved: true,
    build: () => new THREE.CylinderGeometry(1, 1, 2, ROUND, 2),
    guides: () => [
      axis(-1.4, 1.4),
      ring(1, 0),
      ...diameters(1, 1),
      ...diameters(1, -1),
    ],
    vanishingDirections: [X, Y, Z],
  },
  {
    id: 'cone',
    name: 'Cone',
    group: 'Curved',
    curved: true,
    build: cone,
    guides: () => [
      axis(-1, 1.4),
      ring(0.5, 0),
      ...diameters(1, -1),
    ],
    vanishingDirections: [X, Y, Z],
  },
  {
    id: 'sphere',
    name: 'Sphere',
    group: 'Curved',
    curved: true,
    build: () => new THREE.SphereGeometry(1, ROUND, ROUND / 2),
    // Equator and two meridians at right angles: the classic sphere wrap.
    guides: () => [
      axis(-1.35, 1.35),
      ring(1, 0),
      meridian(1, 0),
      meridian(1, Math.PI / 2),
    ],
    vanishingDirections: [Y],
  },
  {
    id: 'torus',
    name: 'Torus',
    group: 'Curved',
    curved: true,
    // Lying flat, hole facing up.
    build: () => new THREE.TorusGeometry(1, 0.4, 32, ROUND * 2).rotateX(Math.PI / 2),
    guides: () => [
      axis(-0.8, 0.8),
      ring(1, 0),
    ],
    vanishingDirections: [Y],
  },
];
