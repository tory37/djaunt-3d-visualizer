import * as THREE from 'three';

/**
 * Shape registry. To add a shape, append an entry here; the viewer picks it up
 * automatically.
 *
 *   id       unique key (used in the URL hash)
 *   name     label shown in the shape picker
 *   build()  returns a THREE.BufferGeometry. Any size or position is fine:
 *            the viewer recenters it and scales it to a common size.
 *   edgeAngle (optional)
 *            crease angle in degrees: an edge is drawn where neighbouring faces
 *            meet at more than this angle. Default 1 (every hard edge). Raise it
 *            for curved shapes so their facets don't all get outlined.
 *   vanishingDirections (optional)
 *            local-space directions of the shape's parallel edge families. When
 *            given, the "Vanishing points" guide extends those edges to where
 *            they converge. Leave it out for shapes without parallel edges.
 */
export const SHAPES = [
  {
    id: 'cube',
    name: 'Cube',
    build: () => new THREE.BoxGeometry(2, 2, 2),
    vanishingDirections: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  },
];
