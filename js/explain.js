import * as THREE from 'three';
import { TOUR, START } from './tour.js';

/**
 * The explainer: a card that narrates what the perspective is doing.
 *
 * Every frame it measures the view (where each set of parallel edges vanishes,
 * how foreshortened it is, where your eye is) and shows that as a readout and a
 * top or side view of the setup. In live mode it also writes the caption from
 * those measurements; in tour mode it plays the steps in tour.js.
 */

const FAR_PAGES = 6;      // a VP further than this many half-pages from the centre is "far off"
const BLEND_MS = 700;     // easing back onto the tour after the user moved things

const STATUS = {
  parallel: 'parallel',
  on: 'on page',
  off: 'off page',
  far: 'far off',
};

const rad = THREE.MathUtils.degToRad;
const lerp = THREE.MathUtils.lerp;
const easeInOut = (u) => (1 - Math.cos(Math.PI * u)) / 2;

export function createExplainer(app) {
  const { state, model, camera } = app;
  const $ = (id) => document.getElementById(id);
  const el = {
    root: $('lesson'),
    eyebrow: $('lessonEyebrow'),
    title: $('lessonTitle'),
    text: $('lessonText'),
    rows: $('lessonRows'),
    inset: $('lessonInset'),
    prev: $('lessonPrev'),
    play: $('lessonPlay'),
    next: $('lessonNext'),
    progress: $('lessonProgress'),
    tourButton: $('lessonTour'),
    close: $('lessonClose'),
  };
  const insetCtx = el.inset.getContext('2d');

  const steps = buildTimeline(TOUR);
  const total = steps[steps.length - 1].end;

  let open = false;
  let kind = 'live';     // 'live' or 'tour'
  let playing = false;
  let driving = false;   // the user took over during the tour
  let time = 0;          // seconds into the tour
  let current = -1;      // step being shown
  let blend = null;      // { from, start } while easing back onto the tour
  let lastFrame = null;
  let frame = 0;
  const shown = {};      // last values written to the DOM

  // ---------- timeline ----------

  function buildTimeline(tour) {
    let at = 0;
    let pose = { ...START };
    return tour.map((step) => {
      const start = at;
      const moves = step.path.map((m) => {
        const from = pose;
        const move = m.move ?? 0;
        const hold = m.hold ?? 0;
        const to = m.curve ? m.curve(1, from) : { ...from, ...m.to };
        const entry = { t0: at, t1: at + move, end: at + move + hold, from, to, curve: m.curve };
        at = entry.end;
        pose = to;
        return entry;
      });
      return { ...step, start, end: at, moves, startPose: moves[0].from };
    });
  }

  function stepAt(t) {
    const i = steps.findIndex((s) => t < s.end);
    return i < 0 ? steps.length - 1 : i;
  }

  function poseAt(t) {
    const step = steps[stepAt(t)];
    const move = step.moves.find((m) => t < m.end) ?? step.moves[step.moves.length - 1];
    const u = move.t1 > move.t0 ? THREE.MathUtils.clamp((t - move.t0) / (move.t1 - move.t0), 0, 1) : 1;
    if (move.curve) return move.curve(u, move.from);
    return mix(move.from, move.to, easeInOut(u));
  }

  function mix(a, b, u) {
    return {
      yaw: lerp(a.yaw, b.yaw, u),
      pitch: lerp(a.pitch, b.pitch, u),
      roll: lerp(a.roll, b.roll, u),
      elevation: lerp(a.elevation, b.elevation, u),
      level: lerp(a.level, b.level, u),
      // Even steps in perceived zoom, not in millimetres.
      focal: Math.exp(lerp(Math.log(a.focal), Math.log(b.focal), u)),
    };
  }

  const euler = new THREE.Euler();
  const target = new THREE.Quaternion();

  function applyPose(pose, from = null, u = 1) {
    euler.set(rad(pose.pitch), rad(-pose.yaw), rad(pose.roll), 'XZY');
    target.setFromEuler(euler);
    let { elevation, focal, level } = pose;
    if (from) {
      model.quaternion.slerpQuaternions(from.quaternion, target, u);
      elevation = lerp(from.elevation, elevation, u);
      focal = Math.exp(lerp(Math.log(from.focal), Math.log(focal), u));
      level = lerp(from.level, level, u);
    } else {
      model.quaternion.copy(target);
    }
    state.elevation = Math.round(elevation * 10) / 10;
    state.focal = focal;
    state.level = level >= 0.5;
    app.setLevelMix(level);
  }

  function snapshot() {
    return {
      quaternion: model.quaternion.clone(),
      elevation: state.elevation,
      focal: state.focal,
      level: app.levelAmount(),
    };
  }

  // ---------- playback ----------

  function tick(now) {
    frame = 0;
    if (!open || kind !== 'tour' || driving) return;
    const dt = lastFrame === null ? 0 : Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;

    if (blend) {
      const u = Math.min(1, (now - blend.start) / BLEND_MS);
      applyPose(poseAt(time), blend.from, easeInOut(u));
      if (u >= 1) blend = null;
    } else {
      if (playing) time = Math.min(total, time + dt);
      applyPose(poseAt(time));
      if (time >= total) finish();
    }
    enterStep(stepAt(time));
    app.syncUI();
    app.requestRender();
    if (playing || blend) frame = requestAnimationFrame(tick);
  }

  function run() {
    if (frame) return;
    lastFrame = null;
    frame = requestAnimationFrame(tick);
  }

  function enterStep(i, force = false) {
    if (i === current && !force) return;
    current = i;
    const { mode } = steps[i];
    if (mode && state.mode !== mode) app.setMode(mode);
  }

  function finish() {
    playing = false;
    app.setLevelMix(null);
    refreshControls();
  }

  // Get the scene ready for the tour and ease onto it from wherever it is.
  function resume() {
    if (app.shape().id !== 'cube') app.selectShape('cube');
    state.scale = 1;
    state.hiddenEdges = true;
    app.applyMode();
    blend = { from: snapshot(), start: performance.now() };
    driving = false;
    playing = true;
    enterStep(stepAt(time), true);
    refreshControls();
    run();
  }

  function startTour() {
    show('tour');
    time = 0;
    current = -1;
    app.setPanelOpen(false);
    resume();
  }

  function togglePlay() {
    if (kind !== 'tour') return;
    if (playing) {
      playing = false;
      refreshControls();
      return;
    }
    if (time >= total) time = 0;
    else if (driving) time = steps[current].start;
    resume();
  }

  function step(by) {
    if (kind !== 'tour') return;
    const i = THREE.MathUtils.clamp((driving ? current : stepAt(time)) + by, 0, steps.length - 1);
    time = steps[i].start;
    resume();
  }

  function seek(i) {
    time = steps[i].start;
    resume();
  }

  // The user moved something: stop the tour and narrate their view instead.
  function takeOver() {
    if (!open || kind !== 'tour' || driving) return;
    playing = false;
    driving = true;
    blend = null;
    app.setLevelMix(null);
    refreshControls();
  }

  // ---------- open / close ----------

  function show(newKind) {
    kind = newKind;
    playing = false;
    driving = false;
    blend = null;
    if (!open) {
      open = true;
      el.root.hidden = false;
      document.body.classList.add('lesson-open');
      buildProgress();
      app.onOpenChange();
    }
    refreshControls();
    app.requestRender();
  }

  function close() {
    if (!open) return;
    open = false;
    playing = false;
    driving = false;
    blend = null;
    app.setLevelMix(null);
    el.root.hidden = true;
    document.body.classList.remove('lesson-open');
    app.onOpenChange();
    app.requestRender();
  }

  function toggleLive() {
    if (open) close();
    else show('live');
  }

  // ---------- measuring the view ----------

  const tmp = new THREE.Vector3();
  const sight = new THREE.Vector3();
  const camDir = new THREE.Vector3();

  function analyze() {
    const families = app.families();
    model.updateMatrixWorld();
    const center = new THREE.Vector3().setFromMatrixPosition(model.matrixWorld);
    sight.subVectors(center, camera.position).normalize();
    const { w, h } = app.viewSize();
    const halfPage = Math.min(w, h) / 2;

    const measured = families.map((f, index) => {
      const dir = f.dir.clone().transformDirection(model.matrixWorld);
      camDir.copy(dir).transformDirection(camera.matrixWorldInverse);
      // Point the camera-space direction into the page, away from the eye.
      const cam = camDir.z > 0 ? camDir.clone().negate() : camDir.clone();
      const angle = THREE.MathUtils.radToDeg(Math.asin(Math.min(1, Math.abs(cam.z))));
      const length = Math.sqrt(Math.max(0, 1 - dir.dot(sight) ** 2));
      const vp = app.vanishingPoint(dir); // null when parallel to the picture plane
      let status = 'parallel';
      if (vp) {
        const inside = vp.x >= 0 && vp.x <= w && vp.y >= 0 && vp.y <= h;
        const far = Math.hypot(vp.x - w / 2, vp.y - h / 2) > FAR_PAGES * halfPage;
        status = inside ? 'on' : far ? 'far' : 'off';
      }
      return {
        index,
        label: f.label,
        name: /^\d+$/.test(f.label) ? `#${f.label}` : f.label,
        color: app.palette.vp[f.color],
        cam,
        angle,
        length,
        status,
      };
    });

    const up = tmp.set(0, 1, 0).applyQuaternion(model.quaternion);
    const upright = up.y > 0.999;
    const eye = model.worldToLocal(camera.position.clone());
    const box = app.bounds();
    const eyeLevel = eye.y > box.max.y ? 'above' : eye.y < box.min.y ? 'below' : 'through';
    const forward = camera.getWorldDirection(tmp);
    return {
      families: measured,
      upright,
      eyeLevel,
      levelView: Math.abs(forward.y) < 1e-3,
      focal: state.focal,
    };
  }

  // ---------- narration ----------

  const chip = (f) => `<b class="chip" style="--chip:${f.color}">${f.name}</b>`;

  function list(fams) {
    const names = fams.map(chip);
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }

  // Replace {X} etc. in tour text with colored labels.
  function format(text, a) {
    return text.replace(/\{(\w+)\}/g, (match, label) => {
      const f = a.families.find((g) => g.label === label);
      return f ? chip(f) : label;
    });
  }

  function eyeSentence(a) {
    if (!a.upright) return '';
    return {
      above: 'Right now your eye is above the cube, so you look down onto its top.',
      through: 'Right now the horizon cuts through the cube: its top and bottom are edge-on, so you see neither.',
      below: 'Right now your eye is below the cube, so you see its underside.',
    }[a.eyeLevel].replace(/cube/g, app.shape().id === 'cube' ? 'cube' : 'shape');
  }

  function narrate(a) {
    // Curved shapes have no straight edges: their sets are construction lines.
    const edges = app.shape().curved ? 'lines' : 'edges';
    const converging = a.families.filter((f) => f.status !== 'parallel');
    const parallel = a.families.filter((f) => f.status === 'parallel');
    const n = converging.length;

    let title = 'No vanishing points';
    if (n > 3) title = `${n} vanishing points`;
    else if (n > 0) title = `${n}-point perspective`;

    let structure = '';
    if (parallel.length) {
      structure += `${list(parallel)} ${edges} lie flat to the picture plane, so they stay parallel. `;
    }
    if (n === 1) {
      structure += `${parallel.length ? 'Only the' : 'The'} ${chip(converging[0])} ${edges} run into the page; they meet at VP ${chip(converging[0])}.`;
    } else if (n > 1) {
      structure += `${list(converging)} ${edges} run into the page, each set toward its own vanishing point.`;
    }

    let tip = '';
    const far = converging.filter((f) => f.status === 'far');
    const off = converging.filter((f) => f.status === 'off');
    if (far.length) {
      tip = `${list(far)} ${edges} only just turn away, so ${far.length > 1 ? 'their VPs are' : 'that VP is'} far off the page: draw them nearly parallel.`;
    } else if (off.length) {
      tip = `VP ${list(off)} ${off.length > 1 ? 'are' : 'is'} off the page: mark ${off.length > 1 ? 'them' : 'it'} on scrap paper taped beside your drawing.`;
    }

    let foreshortening = '';
    const most = [...a.families].sort((p, q) => p.length - q.length)[0];
    if (most && most.length < 0.85) {
      foreshortening = `${chip(most)} ${edges} point most toward you, so they’re the most foreshortened: ${Math.round(most.length * 100)}% of their full length.`;
    }

    let view = '';
    const vertical = a.families.find((f) => f.label === 'Y');
    if (a.upright && !a.levelView && vertical && vertical.status !== 'parallel') {
      view = `Your view is tilted, so the page is too: vertical ${edges} converge as well.`;
    } else if (a.upright) {
      view = eyeSentence(a);
    }

    return {
      title,
      structure,
      text: [structure, tip, foreshortening, view].filter(Boolean).join(' '),
    };
  }

  // ---------- drawing the card ----------

  function write(key, node, html) {
    if (shown[key] === html) return;
    shown[key] = html;
    node.innerHTML = html;
  }

  function update() {
    if (!open) return;
    const a = analyze();
    const live = narrate(a);

    if (kind === 'live' || driving) {
      const eyebrow = !driving ? 'Live · drag to explore'
        : time >= total ? 'Your turn · drag to explore' : 'Tour paused · you’re driving';
      write('eyebrow', el.eyebrow, eyebrow);
      write('title', el.title, live.title);
      write('text', el.text, live.text || 'This shape has no parallel edges, so there are no vanishing points to track.');
    } else {
      const s = steps[current < 0 ? 0 : current];
      const say = {
        eye: () => eyeSentence(a),
        now: () => (live.structure ? `Right now: ${live.structure}` : ''),
      };
      const text = typeof s.text === 'function' ? s.text(a, say) : s.text;
      write('eyebrow', el.eyebrow, `Tour · ${current + 1} / ${steps.length}`);
      write('title', el.title, s.title);
      write('text', el.text, format(text, a));
    }

    drawRows(a);
    const wanted = kind === 'tour' && !driving ? steps[Math.max(0, current)].inset : 'auto';
    drawInset(a, wanted === 'auto' ? autoView(a) : wanted);
    drawProgress();
  }

  // Side view when a set of edges converges up or down (3-point), else top view.
  function autoView(a) {
    const vertical = a.families.some((f) => f.status !== 'parallel' && f.angle > 4 && Math.abs(f.cam.y) > 0.6);
    return vertical ? 'side' : 'top';
  }

  function drawRows(a) {
    const key = a.families.map((f) => f.label + f.color).join();
    if (shown.rowsKey !== key) {
      shown.rowsKey = key;
      el.rows.innerHTML = a.families.map((f) => `
        <li style="--chip:${f.color}">
          <b class="chip">${f.name}</b>
          <span class="bar"><i></i></span>
          <span class="pct"></span>
          <span class="status"></span>
        </li>`).join('') || '<li class="empty">No parallel edge sets</li>';
    }
    const items = el.rows.querySelectorAll('li:not(.empty)');
    a.families.forEach((f, i) => {
      const li = items[i];
      const pct = Math.round(f.length * 100);
      li.querySelector('i').style.width = `${pct}%`;
      li.querySelector('.pct').textContent = `${pct}%`;
      li.querySelector('.status').textContent = STATUS[f.status];
      li.dataset.status = f.status;
    });
  }

  function buildProgress() {
    el.progress.innerHTML = steps.map((s, i) => `<button type="button" style="flex-grow:${s.end - s.start}" `
      + `aria-label="Step ${i + 1}: ${s.title}" title="${s.title}"><i></i></button>`).join('');
    el.progress.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => seek(i)));
  }

  function drawProgress() {
    if (kind !== 'tour') return;
    el.progress.querySelectorAll('button').forEach((b, i) => {
      const s = steps[i];
      const u = THREE.MathUtils.clamp((time - s.start) / (s.end - s.start), 0, 1);
      b.firstChild.style.width = `${u * 100}%`;
      b.classList.toggle('current', i === current);
    });
  }

  function refreshControls() {
    const tour = kind === 'tour';
    el.prev.hidden = el.next.hidden = el.play.hidden = el.progress.hidden = !tour;
    el.tourButton.hidden = tour;
    const label = playing ? 'Pause (Space)' : time >= total ? 'Replay' : 'Play (Space)';
    el.play.setAttribute('aria-label', label);
    el.play.title = label;
    el.play.dataset.state = playing ? 'pause' : time >= total ? 'replay' : 'play';
  }

  // ---------- the top / side view ----------

  let tokens = null;
  let tokensFor = null;
  function readTokens() {
    if (tokensFor === state.paper) return tokens;
    const css = getComputedStyle(document.documentElement);
    tokens = {
      bg: css.getPropertyValue('--dj-bg').trim(),
      text: css.getPropertyValue('--dj-text').trim(),
      muted: css.getPropertyValue('--dj-text-muted').trim(),
      border: css.getPropertyValue('--dj-border').trim(),
      accent: css.getPropertyValue('--dj-accent').trim(),
      font: css.getPropertyValue('--dj-font-mono').trim(),
    };
    tokensFor = state.paper;
    return tokens;
  }

  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();

  // A plan (top) or elevation (side) of the eye, the picture plane, the shape
  // and one sight line per edge direction, all in the camera's own frame: the
  // picture plane is always straight across, and each VP lands where its sight
  // line crosses it, exactly as on screen.
  function drawInset(a, view) {
    const canvas = el.inset;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const c = insetCtx;
    const t = readTokens();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    const top = view === 'top';
    const view2 = camera.matrixWorldInverse;
    const P = camera.projectionMatrix.elements;
    // `across` runs along the picture plane (right in the top view, up in the
    // side view); `along` runs from the eye into the scene.
    const across = (v) => (top ? v.x : v.y);
    const centerCam = pa.setFromMatrixPosition(model.matrixWorld).applyMatrix4(view2);
    const radius = app.radius() * model.scale.x;
    // Stand the picture plane just in front of the shape, as in a textbook
    // diagram. Any depth gives the same picture, only scaled.
    const depth = Math.max(-centerCam.z - radius * 1.05, -centerCam.z * 0.35);
    const centerDepth = -centerCam.z;
    const centerAcross = across(centerCam);
    const pageLo = top ? ((-1 + P[8]) * depth) / P[0] : ((-1 + P[9]) * depth) / P[5];
    const pageHi = top ? ((1 + P[8]) * depth) / P[0] : ((1 + P[9]) * depth) / P[5];
    const pageMid = (pageLo + pageHi) / 2;
    const pageHalf = (pageHi - pageLo) / 2;

    // Sight lines for the edge sets that run (mostly) in this view's plane. The
    // side view leaves out the ones running across it: their VPs sit on the
    // horizon, which it already shows.
    const lines = [];
    for (const f of a.families) {
      const side = top ? f.cam.y : f.cam.x;
      if (Math.abs(side) > (top ? 0.75 : 0.45)) continue;
      const along = -f.cam.z;
      const dirAcross = across(f.cam);
      const parallel = f.status === 'parallel';
      lines.push({ f, parallel, dirAcross, along, vp: parallel ? null : (depth * dirAcross) / along });
    }

    // Fit the eye, the page, the shape and any nearby VPs.
    let lo = Math.min(0, pageLo, centerAcross - radius);
    let hi = Math.max(0, pageHi, centerAcross + radius);
    for (const l of lines) {
      if (l.vp === null) continue;
      const v = pageMid + THREE.MathUtils.clamp(l.vp - pageMid, -2.5 * pageHalf, 2.5 * pageHalf);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const alongMax = centerDepth + radius;
    const pad = 14;
    const label = 16;
    const acrossRoom = top ? W - 2 * pad : H - 2 * pad - label;
    const alongRoom = top ? H - 2 * pad - label : W - 2 * pad - 24;
    const k = Math.min(acrossRoom / (hi - lo), alongRoom / alongMax);
    const acrossOffset = (acrossRoom - k * (hi - lo)) / 2;
    const alongOffset = (alongRoom - k * alongMax) / 2;
    // Screen position of a point given as (across, along).
    const at = top
      ? (u, v) => [pad + acrossOffset + k * (u - lo), H - pad - alongOffset - k * v]
      : (u, v) => [pad + 12 + alongOffset + k * v, pad + label + acrossOffset + k * (hi - u)];

    c.lineCap = 'round';
    c.font = `500 10px ${t.font}`;
    c.textBaseline = 'middle';

    // View name.
    c.fillStyle = t.muted;
    c.textAlign = 'left';
    text(c, top ? 'TOP VIEW' : 'SIDE VIEW', pad - 4, pad, W);

    // The shape, seen from above or the side.
    c.lineWidth = 1.5;
    for (const e of app.edges()) {
      pa.copy(e.a).applyMatrix4(model.matrixWorld).applyMatrix4(view2);
      pb.copy(e.b).applyMatrix4(model.matrixWorld).applyMatrix4(view2);
      const fam = e.family >= 0 ? a.families[e.family] : null;
      c.strokeStyle = fam ? fam.color : t.text;
      c.globalAlpha = 0.9;
      const [ax, ay] = at(across(pa), -pa.z);
      const [bx, by] = at(across(pb), -pb.z);
      line(c, ax, ay, bx, by);
    }
    c.globalAlpha = 1;

    // Picture plane, with the part your screen shows (the page) drawn heavier.
    const [x0, y0] = at(top ? lo - 1e3 : hi + 1e3, depth);
    const [x1, y1] = at(top ? hi + 1e3 : lo - 1e3, depth);
    c.strokeStyle = t.muted;
    c.lineWidth = 1;
    c.globalAlpha = 0.6;
    line(c, x0, y0, x1, y1);
    c.globalAlpha = 1;
    const [p0x, p0y] = at(pageLo, depth);
    const [p1x, p1y] = at(pageHi, depth);
    c.strokeStyle = t.text;
    c.lineWidth = 3;
    line(c, p0x, p0y, p1x, p1y);
    c.fillStyle = t.muted;
    if (top) {
      c.textAlign = 'right';
      text(c, 'picture plane', W - pad + 4, p0y - 8, W);
      // Name the page too, where there's room beside that.
      const pageX = Math.max(pad - 4, p0x);
      if (pageX + c.measureText('page ').width < W - pad + 4 - c.measureText('picture plane').width) {
        c.textAlign = 'left';
        text(c, 'page', pageX, p0y - 8, W);
      }
    } else {
      c.textAlign = 'left';
      text(c, 'page', p0x + 5, Math.max(pad + label, p1y + 4), W);
      text(c, 'picture plane', p0x + 5, H - pad + 2, W);
    }

    // Eye level, in the side view: where the horizon sits on the page.
    const [ex, ey] = at(0, 0);
    let hz = null;
    if (!top) {
      const horizon = tmp.set(0, 0, -1).applyQuaternion(camera.quaternion);
      horizon.y = 0;
      if (horizon.lengthSq() > 1e-8) {
        horizon.normalize().transformDirection(view2);
        const hy = (depth * horizon.y) / -horizon.z;
        const [hx2, hy2] = at(hy, depth);
        c.strokeStyle = t.accent;
        c.lineWidth = 1;
        c.setLineDash([3, 3]);
        line(c, ex, ey, hx2, hy2);
        c.setLineDash([]);
        hz = { x: hx2, y: hy2, vps: [] };
      }
    }

    // Sight lines and the VPs they make.
    c.save();
    c.beginPath();
    c.rect(0, 0, W, H);
    c.clip();
    for (const l of lines) {
      c.strokeStyle = c.fillStyle = l.f.color;
      c.lineWidth = 1.25;
      if (l.parallel) {
        // Parallel to the picture plane: the sight line never reaches it.
        const [ax, ay] = at(-1e3, 0);
        const [bx, by] = at(1e3, 0);
        c.setLineDash([4, 4]);
        c.globalAlpha = 0.8;
        line(c, ax, ay, bx, by);
        c.setLineDash([]);
        c.globalAlpha = 1;
        c.textAlign = top ? 'right' : 'center';
        if (top) text(c, `${l.f.name}: no VP`, W - pad + 4, ey - 8, W);
        else text(c, `${l.f.name}: no VP`, ex + 26, pad + label - 4, W);
        continue;
      }
      const [vx, vy] = at(l.vp, depth);
      c.globalAlpha = 0.85;
      line(c, ex, ey, vx, vy);
      c.globalAlpha = 1;
      const inside = vx >= 4 && vx <= W - 4 && vy >= 4 && vy <= H - 4;
      if (inside && hz && Math.abs(vy - hz.y) < 8) {
        // A VP on the horizon: named in the horizon's label below.
        dot(c, vx, vy, 3.5);
        hz.vps.push(l.f.name);
      } else if (inside) {
        dot(c, vx, vy, 3.5);
        // Label on the eye's side of the picture plane, clear of the sight line.
        if (top) {
          c.textAlign = vx >= ex ? 'left' : 'right';
          text(c, `VP ${l.f.name}`, vx + (vx >= ex ? 6 : -6), vy + 10, W);
        } else {
          c.textAlign = 'right';
          text(c, `VP ${l.f.name}`, vx - 6, vy + (vy > ey ? 10 : -9), W);
        }
      } else {
        // Off the diagram: an arrow on the picture plane, pointing the way.
        const dir = Math.sign(l.vp - pageMid) || 1;
        const edgeU = top ? (dir > 0 ? W - pad : pad) : (dir > 0 ? pad + label : H - pad);
        const [ax, ay] = top ? [edgeU, vy] : [vx, edgeU];
        const ang = top ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        arrow(c, top ? ax : p0x, top ? p0y : ay, ang);
        c.textAlign = top ? (dir > 0 ? 'right' : 'left') : 'left';
        if (top) text(c, `VP ${l.f.name}`, ax + (dir > 0 ? -10 : 10), p0y + 10, W);
        else text(c, `VP ${l.f.name}`, p0x + 8, ay + (dir > 0 ? 6 : -6), W);
      }
    }
    c.restore();

    if (hz) {
      const name = hz.vps.length ? `horizon · VP ${hz.vps.join(' ')}` : 'horizon';
      c.fillStyle = t.accent;
      c.textAlign = 'right';
      text(c, name, hz.x - 5, hz.y + (hz.y > ey ? 9 : -8), W);
      // "eye level" by the eye, unless the picture plane is too close for both.
      if (ex + 8 + c.measureText(`eye level ${name}`).width + 8 < hz.x - 5) {
        c.textAlign = 'left';
        text(c, 'eye level', ex + 8, ey - 8, W);
      }
    }

    // The right angle between two sight lines (the cube's edges meet at 90°).
    const drawn = lines.filter((l) => !l.parallel);
    for (let i = 0; i < drawn.length; i++) {
      for (let j = i + 1; j < drawn.length; j++) {
        const p = drawn[i];
        const q = drawn[j];
        const lp = Math.hypot(p.dirAcross, p.along);
        const lq = Math.hypot(q.dirAcross, q.along);
        const cos = (p.dirAcross * q.dirAcross + p.along * q.along) / (lp * lq);
        if (Math.abs(cos) > 0.03) continue;
        const s = 9;
        const toScreen = (l) => {
          const [x, y] = at((l.dirAcross / Math.hypot(l.dirAcross, l.along)) * 1e3, (l.along / Math.hypot(l.dirAcross, l.along)) * 1e3);
          const d = Math.hypot(x - ex, y - ey);
          return [(x - ex) / d, (y - ey) / d];
        };
        const [ux, uy] = toScreen(p);
        const [vx, vy] = toScreen(q);
        c.strokeStyle = t.text;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(ex + ux * s, ey + uy * s);
        c.lineTo(ex + (ux + vx) * s, ey + (uy + vy) * s);
        c.lineTo(ex + vx * s, ey + vy * s);
        c.stroke();
        c.fillStyle = t.text;
        c.textAlign = 'left';
        text(c, '90°', ex + (ux + vx) * s + 3, ey + (uy + vy) * s - 5, W);
      }
    }

    // The eye.
    c.fillStyle = t.text;
    dot(c, ex, ey, 3.5);
    c.textAlign = top ? 'left' : 'center';
    if (top) text(c, 'eye', ex + 7, ey + 1, W);
    else text(c, 'eye', ex, ey + 11, W);
  }

  // A label, nudged sideways to stay inside the diagram, with a halo in the
  // background color so it stays legible where it crosses a line.
  function text(c, str, x, y, W) {
    const width = c.measureText(str).width;
    const left = c.textAlign === 'right' ? x - width : c.textAlign === 'center' ? x - width / 2 : x;
    const shift = Math.max(0, 3 - left) - Math.max(0, left + width - (W - 3));
    c.save();
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.strokeStyle = readTokens().bg;
    c.strokeText(str, x + shift, y);
    c.restore();
    c.fillText(str, x + shift, y);
  }

  function line(c, x0, y0, x1, y1) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }

  function dot(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  function arrow(c, x, y, angle) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.beginPath();
    c.moveTo(5, 0);
    c.lineTo(-5, -4.5);
    c.lineTo(-5, 4.5);
    c.closePath();
    c.fill();
    c.restore();
  }

  // ---------- wiring ----------

  el.close.addEventListener('click', close);
  el.play.addEventListener('click', togglePlay);
  el.prev.addEventListener('click', () => step(-1));
  el.next.addEventListener('click', () => step(1));
  el.tourButton.addEventListener('click', startTour);

  return {
    isOpen: () => open,
    isTour: () => open && kind === 'tour',
    startTour,
    toggleLive,
    togglePlay,
    step,
    close,
    takeOver,
    update,
  };
}
