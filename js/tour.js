/**
 * The guided tour of the cube: a list of steps, played in order. Each step
 * teaches one idea to carry in your head when you draw a box, and the motion
 * shows it happening.
 *
 *   title     the idea, short enough to remember
 *   text      what you're watching and why it happens. Fixed text: it never
 *             changes while the step plays. {X}, {Y} and {Z} become labels in
 *             that edge direction's color.
 *   remember  the rule of thumb to take away, shown under the text
 *   inset     which diagram to show: 'top' view, 'side' view, or 'auto'
 *   mode      optional: switch to 'solid' or 'wireframe' when the step starts
 *   marks     guide marks drawn over the cube (see drawMarks in drawing.js):
 *             'widths', 'heights', 'centre', 'corner', 'slopes', 'lean', 'ring'
 *   path      the motion, as a list of moves played one after another:
 *               { to: {...}, move: seconds, hold: seconds }
 *             eases from where the previous move ended to `to`, then holds
 *             before the next move.
 *               { curve: (u, from) => pose, move: seconds }
 *             follows a custom path, u running from 0 to 1.
 *             The step plays its path once, then waits for the reader to go
 *             on, so it needs no hold at the end. [] for a step that doesn't move.
 *
 * A pose is { yaw, pitch, roll } of the cube in degrees, plus the camera's
 * { elevation } in degrees, { level } (1 = level camera, 0 = tilted to look
 * at the cube), lens { focal } length in mm and the cube's { scale }. Anything
 * a move leaves out stays as it was.
 */

export const START = { yaw: 0, pitch: 0, roll: 0, elevation: 12, level: 1, focal: 35, scale: 1 };

export const TOUR = [
  {
    title: 'Your eye level is the horizon',
    inset: 'side',
    mode: 'wireframe',
    path: [],
    text: 'The gold line is the height of your eye: the horizon. Square-on like this, the front face is '
      + 'just a square, so draw its true shape. Every edge running away from you meets at one point on '
      + 'the horizon, straight ahead.',
    remember: 'Flat edges running away meet on the horizon.',
  },
  {
    title: 'The faces trade width',
    inset: 'top',
    marks: ['widths'],
    path: [
      { to: { yaw: 45 }, move: 9, hold: 2 },
      { to: { yaw: 20 }, move: 4 },
    ],
    text: 'As the cube turns, the side face opens and the front face closes: whatever one gains, the '
      + 'other gives up, until they match at 45°. The thin face changes fastest, so it shows best how '
      + 'far the cube has turned.',
    remember: 'One face opens as the other closes. Get the thin face right first.',
  },
  {
    title: 'Thin face, steep edges',
    inset: 'top',
    marks: ['slopes'],
    path: [
      { to: { yaw: 70 }, move: 7, hold: 1 },
      { to: { yaw: 45 }, move: 4 },
    ],
    text: 'The thinner a face looks, the closer its vanishing point, so its edges tilt hard toward it. '
      + 'The wide face’s edges run almost flat, toward a vanishing point far away. Watch them swap as '
      + 'the cube turns.',
    remember: 'Thin face: steep edges, close VP. Wide face: flat edges, far VP.',
  },
  {
    title: 'The VPs slide as a pair',
    inset: 'top',
    path: [
      { to: { focal: 20 }, move: 3, hold: 1 },
      { to: { yaw: 25 }, move: 5, hold: 1 },
      { to: { yaw: 65 }, move: 7, hold: 1 },
      { to: { yaw: 45, focal: 35 }, move: 4 },
    ],
    text: 'Turning the cube slides both vanishing points along the horizon, the same way: as one moves '
      + 'in toward the cube, the other runs out. Seen from your eye they always stay 90° apart, as the '
      + 'top view shows. They’re closest together when the cube is at 45°.',
    remember: 'Turn the box, slide both VPs together.',
  },
  {
    title: 'Corners ride a circle',
    inset: 'top',
    marks: ['ring'],
    path: [{ to: { yaw: 225 }, move: 14 }],
    text: 'As the cube spins, every top corner travels around the same circle, which in perspective is '
      + 'an ellipse. The top face is a square sitting inside it, corners touching. The bottom corners '
      + 'ride a second ellipse below.',
    remember: 'To turn a box in your head, draw the ellipse first, then set the corners on it.',
  },
  {
    title: 'The near corner leads',
    inset: 'top',
    marks: ['heights'],
    path: [{ to: { yaw: 210 }, move: 3 }],
    text: 'The corner nearest you is the tallest edge of the cube. Every edge behind it is shorter, and '
      + 'the further back, the shorter it gets.',
    remember: 'Draw the near corner first and hang the rest off it.',
  },
  {
    title: 'Edges converge, never spread',
    inset: 'top',
    path: [{ to: { yaw: 240 }, move: 8 }],
    text: 'Edges that are parallel on the cube get closer together as they run back, each set aiming at '
      + 'its own vanishing point. If a set spreads apart as it goes back, the box looks warped, even if '
      + 'you can’t say why.',
    remember: 'Going back, always closer together, never wider.',
  },
  {
    title: 'Far from eye level, more you see',
    inset: 'side',
    mode: 'solid',
    marks: ['slopes'],
    path: [
      { to: { elevation: 32 }, move: 4, hold: 2 },
      { to: { elevation: 0 }, move: 4, hold: 2 },
      { to: { elevation: -24 }, move: 4, hold: 2 },
      { to: { elevation: 12 }, move: 3 },
    ],
    text: 'Raise your eye and the top opens up; bring it down to the top and the top flattens to a '
      + 'line; drop below and you see the base instead. Edges always tilt toward the horizon, steeper '
      + 'the further they are from it.',
    remember: 'Near the horizon, flat. Far from it, open.',
  },
  {
    title: 'Never sharper than 90°',
    inset: 'side',
    marks: ['corner'],
    path: [
      { to: { yaw: 225 }, move: 2, hold: 2 },
      { to: { elevation: 30, scale: 0.8 }, move: 4, hold: 2 },
      { to: { elevation: 56, scale: 0.5 }, move: 5, hold: 3 },
      { to: { elevation: 12, scale: 1 }, move: 4 },
    ],
    text: 'Watch the angle at the near corner of the top. As your eye rises above the cube, the top '
      + 'opens up and that corner closes. While it stays wider than 90°, the cube looks solid. Once it '
      + 'goes sharper (the number turns red), the cube stretches into a tall, pointy diamond, like '
      + 'things at the edge of a wide-angle photo. The box is too far from where you’re looking for '
      + 'VPs that close together.',
    remember: 'Near corner sharper than 90°? Spread your VPs further apart, or move the box closer to '
      + 'the horizon.',
  },
  {
    title: 'Close is dramatic, far is calm',
    inset: 'top',
    marks: ['heights'],
    path: [
      { to: { focal: 16 }, move: 4, hold: 3 },
      { to: { focal: 135 }, move: 5, hold: 3 },
      { to: { focal: 35 }, move: 3 },
    ],
    text: 'Up close, the vanishing points pull in: edges converge hard and the back of the cube shrinks '
      + 'a lot, so it feels big and near. From far away they drift off the page: edges run nearly '
      + 'parallel and the cube feels small, like something you could pick up.',
    remember: 'VPs close: big and near. VPs far apart: small or far away.',
  },
  {
    title: 'Look down, verticals pinch',
    inset: 'side',
    marks: ['lean'],
    path: [
      { to: { level: 0 }, move: 4, hold: 1 },
      { to: { elevation: 40 }, move: 5, hold: 4 },
      { to: { elevation: 12, level: 1 }, move: 4 },
    ],
    text: 'Tilt your view down onto the cube and its vertical edges lean in toward a third vanishing '
      + 'point far below. It’s usually subtle.',
    remember: 'Keep verticals straight unless you’re looking steeply up or down.',
  },
  {
    title: 'An X finds the middle',
    inset: 'top',
    mode: 'wireframe',
    marks: ['centre'],
    path: [],
    text: 'To put anything in the middle of a face, like a door, a window or the next box, cross its '
      + 'diagonals. In perspective the middle sits toward the back: the near half looks bigger.',
    remember: 'Don’t guess the middle. Draw the X.',
  },
  {
    title: 'Any angle, same rules',
    inset: 'auto',
    marks: ['corner'],
    path: [{ curve: tumble, move: 18 }],
    text: 'Tipped any way, the same rules hold. Three faces meet at the near corner and none of its '
      + 'angles goes sharper than 90°. Each set of edges converges toward its own vanishing point.',
    remember: 'Three sets of edges, three VPs, no sharp near corner.',
  },
  {
    title: 'Your turn',
    inset: 'auto',
    path: [],
    text: 'Drag the cube any way you like and the tour pauses. The rules are what to carry in your '
      + 'head; the measurements in the panel are there if you want to check a drawing against them.',
    remember: 'Press play to pick the tour back up.',
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
