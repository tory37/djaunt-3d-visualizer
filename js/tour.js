/**
 * The guided tour of the cube: a list of steps, played in order.
 *
 *   title    heading shown for the step
 *   text     caption: a string, or a function (analysis, say) => string for
 *            sentences that depend on the live view: say.faces(), heights(),
 *            corner(), open(), slopes(), lean(), centre() describe what the
 *            cube measures right now. {X}, {Y} and {Z} become labels in that
 *            edge direction's color.
 *   inset    which diagram to show: 'top' view, 'side' view, or 'auto'
 *   mode     optional: switch to 'solid' or 'wireframe' when the step starts
 *   marks    measuring marks drawn over the cube (see drawMarks in drawing.js):
 *            'widths', 'heights', 'centre', 'corner', 'slopes', 'lean'
 *   path     the motion, as a list of moves played one after another:
 *              { to: {...}, move: seconds, hold: seconds }
 *            eases from where the previous move ended to `to`, then holds.
 *              { curve: (u, from) => pose, move: seconds }
 *            follows a custom path, u running from 0 to 1.
 *
 * A pose is { yaw, pitch, roll } of the cube in degrees, plus the camera's
 * { elevation } in degrees, { level } (1 = level camera, 0 = tilted to look
 * at the cube), lens { focal } length in mm and the cube's { scale }. Anything
 * a move leaves out stays as it was.
 */

export const START = { yaw: 0, pitch: 0, roll: 0, elevation: 12, level: 1, focal: 35, scale: 1 };

export const TOUR = [
  {
    title: 'Start square-on',
    inset: 'top',
    mode: 'wireframe',
    marks: ['heights'],
    path: [{ hold: 11 }],
    text: (a, say) => 'Square-on, the front face keeps its true shape: a square, so measure it rather '
      + 'than guess. Every edge going back aims at one VP on your eye level, and they converge as a set, '
      + `never spreading apart. How far back the cube goes is judged by eye. ${say.heights()}`,
  },
  {
    title: 'One face opens, the other narrows',
    inset: 'top',
    marks: ['widths'],
    path: [{ to: { yaw: 30 }, move: 8, hold: 2 }],
    text: (a, say) => 'As the cube turns, the side face opens up fast while the front face hardly '
      + 'narrows at first. A face near square-on changes slowly; a face near edge-on changes quickly. '
      + `So the narrow face shows how far the cube has turned: get it right first. ${say.faces()}`,
  },
  {
    title: 'Equal faces at 45°',
    inset: 'top',
    marks: ['widths', 'heights'],
    path: [{ to: { yaw: 45 }, move: 3, hold: 8 }],
    text: (a, say) => 'At 45° the faces match, 1 : 1, and the cube is at its widest: about 1.4 times '
      + 'one face. The near corner is the tallest edge, and every vertical behind it is shorter. '
      + `${say.heights()} Draw the near edge first and size everything else against it.`,
  },
  {
    title: 'Reading the turn',
    inset: 'top',
    marks: ['widths'],
    path: [
      { to: { yaw: 30 }, move: 3, hold: 4 },
      { to: { yaw: 15 }, move: 3, hold: 4 },
      { to: { yaw: 45 }, move: 3, hold: 1 },
    ],
    text: (a, say) => 'Hold a pencil at arm’s length, one eye closed, and compare the two face widths. '
      + 'Roughly: 1 : 1 is a 45° turn, about 1 : 2 is 30°, about 1 : 4 is 15°. '
      + `${say.faces()}`,
  },
  {
    title: 'Narrow face, steep edges',
    inset: 'top',
    marks: ['slopes'],
    path: [
      { to: { yaw: 20 }, move: 4, hold: 1 },
      { to: { yaw: 68 }, move: 6, hold: 1 },
      { to: { yaw: 45 }, move: 3, hold: 1 },
    ],
    text: 'The narrower a face looks, the harder its edges converge: its VP is close. The wide '
      + 'face’s edges run nearly parallel, toward a VP far away. So as one face narrows and steepens, '
      + 'the other widens and flattens, and the two VPs slide along the horizon together. From your '
      + 'eye they always stay 90° apart, as the top view shows.',
  },
  {
    title: 'Back to square-on',
    inset: 'top',
    marks: ['widths'],
    path: [{ to: { yaw: 90 }, move: 6, hold: 3 }],
    text: 'Keep turning and the narrow face swings square-on: its edges flatten out until they’re '
      + 'parallel and its VP is gone. Every quarter turn repeats the cycle.',
  },
  {
    title: 'Edges slope toward eye level',
    inset: 'side',
    mode: 'solid',
    marks: ['slopes'],
    path: [
      { to: { yaw: 120 }, move: 4, hold: 1 },
      { to: { elevation: 30 }, move: 3, hold: 3 },
      { to: { elevation: 0 }, move: 4, hold: 3 },
      { to: { elevation: -24 }, move: 4, hold: 3 },
      { to: { elevation: 12 }, move: 3, hold: 1 },
    ],
    text: (a, say) => 'Hold your pencil level to check edge angles. Edges below your eye level slope '
      + 'up toward the VPs, edges above slope down, and the further an edge is from eye level, the '
      + `steeper it runs. ${say.open()}`,
  },
  {
    title: 'Find the middle',
    inset: 'top',
    mode: 'wireframe',
    marks: ['centre'],
    path: [{ hold: 9 }],
    text: (a, say) => 'To place anything on a face, like a door, a window or the next cube, cross '
      + 'its diagonals. They meet at the true centre, which sits toward the far edge: in perspective '
      + `the near half looks bigger. ${say.centre()}`,
  },
  {
    title: '3-point: verticals lean',
    inset: 'side',
    marks: ['lean'],
    path: [
      { to: { level: 0 }, move: 4, hold: 1 },
      { to: { elevation: 40 }, move: 5, hold: 5 },
    ],
    text: (a, say) => 'Look down on the cube and the verticals lean in toward a third VP far below, '
      + `so the cube narrows toward its base. Keep the lean subtle. ${say.lean()} Unless the view `
      + 'tilts steeply, verticals drawn straight up and down read fine.',
  },
  {
    title: 'Close up or far away',
    inset: 'top',
    marks: ['heights', 'slopes'],
    path: [
      { to: { elevation: 12, level: 1 }, move: 3, hold: 1 },
      { to: { focal: 16 }, move: 4, hold: 3 },
      { to: { focal: 135 }, move: 5, hold: 3 },
      { to: { focal: 35 }, move: 3, hold: 1 },
    ],
    text: (a, say) => `Lens now ${Math.round(a.focal)} mm. Stand close (a wide lens) and the VPs `
      + 'pull in: edges converge hard and the far corners shrink a lot. That reads as something big, '
      + 'seen up close. Step back (a long lens) and the VPs drift far off the page: edges run nearly '
      + `parallel and the cube reads small, like something you could pick up. ${say.heights()}`,
  },
  {
    title: 'Stay inside the cone',
    inset: 'side',
    marks: ['corner'],
    path: [
      { to: { yaw: 135 }, move: 3, hold: 1 },
      { to: { elevation: 30, scale: 0.8 }, move: 4, hold: 3 },
      { to: { elevation: 56, scale: 0.5 }, move: 5, hold: 4 },
      { to: { elevation: 12, scale: 1 }, move: 4, hold: 1 },
    ],
    text: (a, say) => 'In a natural view, the near corner of the top never looks sharper than 90°. '
      + 'Move a box far from the horizon while its VPs stay put (here, by raising your eye) and the '
      + 'corner goes sharp and the box stretches: it has left your cone of vision, the roughly 60° you '
      + 'take in at once. Keep boxes within a circle around the centre of view about half as wide as the '
      + `gap between the VPs, or spread the VPs further apart. ${say.corner()}`,
  },
  {
    title: 'Any angle, same checks',
    inset: 'auto',
    marks: ['corner'],
    path: [{ curve: tumble, move: 18 }],
    text: (a, say) => 'Tipped any way, the same checks hold. The three angles around the near corner '
      + 'each stay wider than 90° (together they make 360°). Near edges are longer than far ones. Each '
      + 'set of edges converges as a set toward its own VP: extend them to check, like the dashed lines. '
      + `${say.corner()}`,
  },
  {
    title: 'Your turn',
    inset: 'auto',
    path: [{ hold: 4 }],
    text: 'Drag the cube any way you like. The tour pauses and the panel keeps measuring what you '
      + 'see, so you can hold its numbers up against your own drawing. Press play to pick the tour '
      + 'back up.',
  },
];

// Half a turn while tipping forward, then back, with a little roll.
function tumble(u, from) {
  const s = Math.sin(Math.PI * u);
  const ease = (1 - Math.cos(Math.PI * u)) / 2;
  return {
    ...from,
    yaw: from.yaw + 180 * ease,
    pitch: 100 * s * s * Math.cos(Math.PI * u),
    roll: 30 * s * s,
  };
}
