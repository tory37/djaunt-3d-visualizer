# Djaunt 3D Visualizer

A browser tool for drawing practice: rotate and scale simple 3D shapes and see
them in true perspective, as solid forms or as see-through wireframes.

Shapes: cube, box, pyramid, triangular and hexagonal prisms, cylinder, cone,
sphere and torus.

## Use

| Input | Does |
|---|---|
| Drag | Rotate the shape (trackball) |
| Shift + drag, two-finger twist | Spin it in the picture plane |
| Scroll, pinch | Scale |
| `W` or the top toggle | Solid / wireframe |
| `[` `]` | Previous / next shape |
| `1` `2` `3` | 1-, 2- and 3-point perspective presets |
| `N` / `R` | Random pose / reset |
| `C` | Construction lines (centre axis, cross-contours, ellipse diameters) |
| `G` `L` `V` `P` | Ground grid, horizon line, vanishing points, paper background |
| `H` | Hide every control, for a clean reference |

## How the perspective works

- The view is a pinhole perspective projection (three.js `PerspectiveCamera`),
  so foreshortening is geometrically exact for the chosen eye position.
- **Lens** is a 35 mm-equivalent focal length (12–300 mm) measured on the
  short side of the screen. Changing it moves the camera so the shape stays the
  same size on screen. Only the strength of the foreshortening changes:
  short lens means strong convergence, long lens means nearly parallel edges.
- **Eye level** raises or lowers the viewpoint. With **Level camera** on, the
  camera stays horizontal and the lens shifts instead of tilting (like an
  architectural shift lens), so vertical edges stay parallel. That gives true
  1- and 2-point perspective. Off, the camera tilts to look at the shape and
  verticals converge (3-point).
- **Vanishing points** extends each family of parallel edges to where it
  converges. Families parallel to the picture plane have no vanishing point,
  so none is drawn for them.
- Curved shapes have no fixed edges, so their outline is traced again for
  every view: it's the exact contour where the surface turns away from your
  eye, the line you'd draw.

## Adding shapes

Shapes live in [`js/shapes.js`](js/shapes.js). Add an entry with an `id`, a
`name` and a `build()` that returns a `THREE.BufferGeometry`. The viewer
recenters and normalizes its size. Optional fields mark a shape as curved,
add construction lines, and control edge creasing and vanishing-point guides;
see the comment at the top of that file.

## Run locally

No build step. Serve the folder with any static server, for example:

```sh
python3 -m http.server
```

then open <http://localhost:8000>. Opening `index.html` directly from disk
won't work, because browsers block ES modules over `file://`.

## Deploy to GitHub Pages

Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.

## Dependencies

Everything loads from jsDelivr at runtime:
[three.js](https://threejs.org) (pinned in the import map in `index.html`), and
the Djaunt brand tokens, fonts and mark from
[`tory37/djaunt-branding`](https://github.com/tory37/djaunt-branding).
