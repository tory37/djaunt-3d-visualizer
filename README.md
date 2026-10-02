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
| `T` or **Explain** | Guided tour of perspective (see below) |
| `E` | Explain as I rotate: live narration of the current view |
| `Space` `←` `→` | During the tour: pause / play, previous / next step |
| `Esc` | Close the explainer |
| `H` | Hide every control, for a clean reference |

## Explainer

**Explain** plays a two-minute tour on the cube that turns it, tilts the view
and changes the lens while captions explain what happens: 1-, 2- and 3-point
perspective, why the two horizontal vanishing points always move together,
eye level and the horizon, and how lens and distance spread the vanishing points.
Drag the cube at any point and the tour pauses. The panel then narrates your
own view instead, and play picks the tour back up.

What the panel shows, for the tour and for **Explain as I rotate** alike:

- **Edges colored by direction.** Each set of parallel edges, its vanishing
  point and its lines in the captions share one color. A vanishing point that
  falls off the screen gets an arrow at the edge pointing to it.
- **Length on screen.** How long each set of edges looks compared with its
  full length (the foreshortening), and whether its vanishing point is on the
  page, off it, or missing because the edges lie parallel to the picture plane.
- **Top / side view.** A diagram of your eye, the picture plane and the shape,
  with a sight line from the eye parallel to each set of edges. Each vanishing
  point is where its sight line meets the picture plane, which is why turning
  the cube moves them. Everything is measured from the live 3D view.

The tour script lives in [`js/tour.js`](js/tour.js): a list of steps, each with
a caption and the poses to move through.

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
