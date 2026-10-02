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

**Explain** plays a three-minute tour on the cube, aimed at drawing it rather
than at the theory. It turns the cube, moves your eye and changes the lens,
while captions and marks on the view show what to look for and check:

- **One face opens, the other narrows.** A face near square-on changes slowly
  and a face near edge-on changes fast, so the narrow face shows the turn.
  Compare the two face widths: 1 : 1 is a 45° turn, about 1 : 2 is 30°,
  about 1 : 4 is 15°.
- **Narrow face, steep edges.** The narrower a face looks, the harder its edges
  converge. The two VPs slide along the horizon together, 90° apart seen from
  your eye.
- **Near edge tallest.** Every vertical behind the near corner is shorter, and
  the panel says by how much.
- **Edges slope toward eye level.** Check angles against a level pencil.
- **Find the middle** of a face by crossing its diagonals. The near half looks
  bigger.
- **3-point:** verticals lean in slightly toward a third VP.
- **Close up or far away:** close VPs mean dramatic convergence and a big
  object; far ones mean nearly parallel edges and a small object.
- **Stay inside the cone of vision:** the angles at a box's near corner never
  look sharper than 90°. If they do, the box is too far from the horizon for
  how close its VPs are.

Drag the cube at any point and the tour pauses. The panel then measures your
own view instead, and play picks the tour back up. **Explain as I rotate**
(`E`) gives the same live readout without the tour. For the cube and box it's
a checklist to hold against your own drawing: face width ratio, far corners
compared with the near one, the angle at the near corner, how open the top is,
edge slopes, and how far the verticals lean.

Other things on screen while the explainer is open:

- **Edges colored by direction.** Each set of parallel edges, its vanishing
  point and its name in the captions share one color. A vanishing point that
  falls off the screen gets an arrow at the edge pointing to it.
- **Top / side view.** A diagram of your eye, the picture plane and the shape,
  with a sight line from the eye parallel to each set of edges. Each vanishing
  point is where its sight line meets the picture plane, and sight lines
  through the corners show where each face's width on the page comes from.

All the numbers are measured from the live 3D view. The advice follows what
perspective teachers commonly teach: Drawabox's box lessons (edges converge
as a set; VP distance sets how dramatic the foreshortening is), Marshall
Vandruff's perspective course (eye level, station point, cone of vision),
sighting with a pencil at arm's length, and the classic rule that a box's
front corner never looks sharper than 90°.

The tour script lives in [`js/tour.js`](js/tour.js) and the drawing checks in
[`js/drawing.js`](js/drawing.js).

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

After changing anything in `css/` or `js/`, run `tools/stamp.sh` before committing.
It stamps the file links in `index.html` with a version, so browsers pick up the
new files straight away instead of using their cached copies (GitHub Pages lets
them cache for 10 minutes). A new module under `js/` also needs an entry in the
import map in `index.html`.

## Dependencies

Everything loads from jsDelivr at runtime:
[three.js](https://threejs.org) (pinned in the import map in `index.html`), and
the Djaunt brand tokens, fonts and mark from
[`tory37/djaunt-branding`](https://github.com/tory37/djaunt-branding).
