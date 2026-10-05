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
 *   checks    optional: show the "Check your drawing" list on phones too (the
 *             tour leaves it out there, to give the ideas room)
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
    text: 'The gold line is your eye level: the horizon. Facing the cube square-on, the front '
      + 'face is a plain square, so draw it at its true shape. The edges running away from you '
      + 'all meet at one point on the horizon, straight ahead.',
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
    text: 'Watch the two width bars under the cube. As it turns, one face widens and the other '
      + 'narrows, until they match at 45°. The thin face changes fastest, so it’s your best '
      + 'clue to how far the cube has turned.',
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
    text: 'Watch the top edges of each face. The thin face’s edges tilt steeply, toward a '
      + 'vanishing point close by. The wide face’s edges run almost flat, toward a vanishing '
      + 'point far away. As the cube turns, they swap.',
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
    text: 'Watch the two vanishing points on the horizon. As the cube turns, they slide the same '
      + 'way together: one comes in toward the cube while the other runs out. They’re closest '
      + 'together at 45°. In the top view, the lines from your eye to them always meet at a '
      + 'right angle.',
    remember: 'Turn the box, slide both VPs together.',
  },
  {
    title: 'Corners ride a circle',
    inset: 'top',
    marks: ['ring'],
    path: [{ to: { yaw: 225 }, move: 14 }],
    text: 'Watch the top corners. As the cube spins, they all travel around the same ellipse: a '
      + 'circle seen in perspective, with the top face sitting inside it, corners touching. The '
      + 'bottom corners ride a second ellipse below.',
    remember: 'To turn a box in your head, draw the ellipse first, then set the corners on it.',
  },
  {
    title: 'The near corner leads',
    inset: 'top',
    marks: ['heights'],
    path: [{ to: { yaw: 210 }, move: 3 }],
    text: 'Compare the heights of the vertical edges. The one nearest you is the tallest; every '
      + 'edge behind it is shorter, and the further back, the shorter. Draw a back edge as tall '
      + 'as the front one and the box loses its depth.',
    remember: 'Draw the near corner first and hang the rest off it.',
  },
  {
    title: 'Edges converge, never spread',
    inset: 'top',
    path: [{ to: { yaw: 240 }, move: 8 }],
    text: 'Watch the edges as they run back. Edges that are parallel on the cube get closer '
      + 'together the further back they go, each set aiming at its own vanishing point. If you '
      + 'draw a set spreading apart as it goes back, it’s wrong: the box looks warped, even if '
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
    text: 'Watch the top as your eye moves. Raise your eye and the top opens up. Level with the '
      + 'middle of the cube, you see neither top nor base, just the sides. Drop below and the '
      + 'base comes into view instead. Edges tilt toward the horizon, steeper the further they '
      + 'are from it.',
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
    text: 'Watch the angle at the near corner of the top. Your eye rises but keeps looking '
      + 'straight ahead, so the cube sinks further below your view (it shrinks only to stay on '
      + 'screen). At first the corner is wider than 90° and the cube looks right. Keep rising '
      + 'and it keeps closing. Once it’s sharper than 90° (the number turns red), it’s clearly '
      + 'wrong: the cube stretches into a tall, pointy diamond.',
    remember: 'A near corner sharper than 90° is always wrong. Spread your VPs further apart, or move '
      + 'the box closer to the horizon.',
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
    text: 'Watch the vanishing points and the back of the cube. Up close, the VPs pull in: edges '
      + 'converge hard and the back shrinks a lot, so the cube feels big and near. From far '
      + 'away, the VPs drift off the page: edges run nearly parallel and the cube feels small, '
      + 'like something you could pick up.',
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
    text: 'Watch the vertical edges as your view tilts down onto the cube. They stop being '
      + 'parallel and lean in toward a third vanishing point far below. It’s subtle. Unless '
      + 'you’re looking steeply up or down, leaning verticals just look like a mistake.',
    remember: 'Keep verticals straight unless you’re looking steeply up or down.',
  },
  {
    title: 'An X finds the middle',
    inset: 'top',
    mode: 'wireframe',
    marks: ['centre'],
    path: [],
    text: 'To find the middle of a face, cross its diagonals: they meet in the middle. In '
      + 'perspective that’s behind the halfway point you’d guess by eye, because the near half '
      + 'looks bigger. Use it to place a door, a window or the next box.',
    remember: 'Don’t guess the middle. Draw the X.',
  },
  {
    title: 'Any angle, same rules',
    inset: 'auto',
    marks: ['corner'],
    path: [{ curve: tumble, move: 18 }],
    text: 'Tipped any way, the same rules hold: three faces meet at the near corner, none of its '
      + 'angles goes sharper than 90°, and each set of edges converges toward its own vanishing '
      + 'point.',
    remember: 'Three sets of edges, three VPs, no sharp near corner.',
  },
  {
    title: 'Your turn',
    inset: 'auto',
    checks: true,
    path: [],
    text: 'Drag the cube any way you like and the tour pauses. Carry the rules in your head, and '
      + 'when you want to check a drawing, hold it against the “Check your drawing” list below: '
      + 'it measures whatever view is on screen.',
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
