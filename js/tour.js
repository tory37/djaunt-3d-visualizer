/**
 * The guided tour of the cube: a list of steps, played in order.
 *
 *   title    heading shown for the step
 *   text     caption: a string, or a function (analysis, say) => string for
 *            sentences that depend on the live view. {X}, {Y} and {Z} become
 *            labels in that edge direction's color.
 *   inset    which diagram to show: 'top' view, 'side' view, or 'auto'
 *   mode     optional: switch to 'solid' or 'wireframe' when the step starts
 *   path     the motion, as a list of moves played one after another:
 *              { to: {...}, move: seconds, hold: seconds }
 *            eases from where the previous move ended to `to`, then holds.
 *              { curve: (u, from) => pose, move: seconds }
 *            follows a custom path, u running from 0 to 1.
 *
 * A pose is { yaw, pitch, roll } of the cube in degrees, plus the camera's
 * { elevation } in degrees, { level } (1 = level camera, 0 = tilted to look
 * at the cube) and lens { focal } length in mm. Anything a move leaves out
 * stays as it was.
 */

export const START = { yaw: 0, pitch: 0, roll: 0, elevation: 12, level: 1, focal: 35 };

export const TOUR = [
  {
    title: '1-point perspective',
    inset: 'top',
    mode: 'wireframe',
    path: [{ hold: 10 }],
    text: 'The front face is square to your view, so it keeps its true shape. '
      + '{X} and {Y} edges lie flat to the picture plane, so they stay parallel. '
      + 'Only the {Z} edges run into the page, and they all meet at one point: VP {Z}.',
  },
  {
    title: 'Turning the cube',
    inset: 'top',
    path: [{ to: { yaw: 30 }, move: 7, hold: 2 }],
    text: 'As the cube turns, the {X} edges start to run into the page too. '
      + 'VP {X} arrives from far off the side of the page, while VP {Z} slides away the other way. '
      + 'The front face narrows as it turns; the side face widens.',
  },
  {
    title: '2-point perspective',
    inset: 'top',
    path: [{ to: { yaw: 45 }, move: 3, hold: 7 }],
    text: 'At 45° both sets of horizontal edges turn away equally: two vanishing points, '
      + 'evenly spaced on the horizon, and two side faces foreshortened by the same amount. '
      + 'The {Y} edges are still parallel to the page, so verticals stay vertical.',
  },
  {
    title: 'Why the VPs move together',
    inset: 'top',
    path: [
      { to: { yaw: 20 }, move: 4, hold: 1 },
      { to: { yaw: 68 }, move: 6, hold: 1 },
      { to: { yaw: 45 }, move: 3, hold: 1 },
    ],
    text: 'The top view shows why. Each VP is where a sight line from your eye, running parallel '
      + 'to those edges, meets the picture plane. The cube’s edges meet at 90°, so the two sight '
      + 'lines do too: when one VP swings in close, the other has to swing far out.',
  },
  {
    title: 'Back to 1-point',
    inset: 'top',
    path: [{ to: { yaw: 90 }, move: 6, hold: 4 }],
    text: 'Keep turning and the {Z} edges swing flat to the picture plane: VP {Z} runs off to '
      + 'infinity and you’re back in 1-point perspective, now facing the next side. '
      + 'The cycle repeats every quarter turn.',
  },
  {
    title: 'Eye level and the horizon',
    inset: 'side',
    mode: 'solid',
    path: [
      { to: { yaw: 120 }, move: 4, hold: 1 },
      { to: { elevation: 30 }, move: 3, hold: 2 },
      { to: { elevation: 0 }, move: 4, hold: 3 },
      { to: { elevation: -24 }, move: 4, hold: 2 },
      { to: { elevation: 12 }, move: 3, hold: 1 },
    ],
    text: (a, say) => 'Horizontal edges always vanish on the horizon, and the horizon is always '
      + `at your eye level. ${say.eye()}`,
  },
  {
    title: '3-point perspective',
    inset: 'side',
    mode: 'wireframe',
    path: [
      { to: { level: 0 }, move: 4, hold: 1 },
      { to: { elevation: 40 }, move: 5, hold: 5 },
    ],
    text: 'Now tilt your view down to look at the cube. The picture plane tilts with you, '
      + 'so the vertical {Y} edges run into the page as well and converge on a third '
      + 'vanishing point, far below.',
  },
  {
    title: 'Lens and distance',
    inset: 'top',
    path: [
      { to: { elevation: 12, level: 1 }, move: 3, hold: 1 },
      { to: { focal: 16 }, move: 4, hold: 2 },
      { to: { focal: 135 }, move: 5, hold: 2 },
      { to: { focal: 35 }, move: 3, hold: 1 },
    ],
    text: (a) => `Lens: ${Math.round(a.focal)} mm. Stand close (a wide lens) and the vanishing `
      + 'points crowd in: steep, dramatic convergence. Step back (a long lens) and they drift '
      + 'far off the page, so edges look almost parallel. A drawing that looks distorted usually '
      + 'has its VPs too close together.',
  },
  {
    title: 'Any direction',
    inset: 'auto',
    path: [{ curve: tumble, move: 18 }],
    text: (a, say) => 'However the cube turns, every set of parallel edges heads for its own '
      + `vanishing point, unless it lies flat to the picture plane. ${say.now()}`,
  },
  {
    title: 'Your turn',
    inset: 'auto',
    path: [{ hold: 4 }],
    text: 'Drag the cube any way you like: the tour pauses and this panel keeps explaining '
      + 'what you see. Press play to pick the tour back up.',
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
