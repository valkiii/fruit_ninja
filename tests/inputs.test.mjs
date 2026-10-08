import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { HandInput, mapToScreen } from '../src/hands.js';
import { World } from '../src/game.js';
import { eyeFeatures, fitGaze } from '../src/gaze.js';
import { makeRng } from '../src/geom.js';

test('mirrored reach zone mapping', () => {
  const z = { x0: 0.1, x1: 0.9, y0: 0.1, y1: 0.9 };
  const near = (a, b) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6, `${a} vs ${b}`);
  near(mapToScreen(0.9, 0.1, z, 1000, 500), [0, 0]);     // camera right = screen left
  near(mapToScreen(0.5, 0.5, z, 1000, 500), [500, 250]);
});

// Real hand swipes recorded by Precog (x in [0, 16/9], y in [0, 1]).
const precog = new URL('../../gesture-control/gestures/', import.meta.url);
for (const name of ['swipe_left.json', 'swipe_right.json']) {
  test(`replaying a recorded ${name} slices a fruit on its path`, { skip: !existsSync(new URL(name, precog)) }, () => {
    const g = JSON.parse(readFileSync(new URL(name, precog)));
    let cutTotal = 0;
    for (const s of g.samples) {
      const W = 1440, H = 900, aspect = 16 / 9;
      const hands = new HandInput();
      const world = new World({ w: W, h: H, seed: 5 });
      world.nextWave = Infinity;
      // Put a fruit halfway along the fingertip path.
      const pts = s.lm.map((f) => mapToScreen(f[8][0] / aspect, f[8][1], hands.zone, W, H));
      const mid = pts[Math.floor(pts.length / 2)];
      const fr = world.launch({ kind: 'watermelon', x: mid[0] }); fr.y = mid[1]; fr.vy = 0; fr.vx = 0;
      let segs = 0;
      s.lm.forEach((f, i) => {
        const res = { landmarks: [f.map(([x, y, z]) => ({ x: x / aspect, y, z }))] };
        for (const seg of hands.process(res, s.t[i], W, H)) { segs++; world.slice(seg); }
      });
      assert.ok(segs > 0, 'a real swipe must be fast enough to cut');
      if (fr.cut) cutTotal++;
    }
    assert.ok(cutTotal >= g.samples.length - 1, `cut ${cutTotal}/${g.samples.length}`);
  });
}

test('holding a hand still does not cut', () => {
  const hands = new HandInput();
  const rng = makeRng(9);
  let segs = 0;
  for (let i = 0; i < 90; i++) {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5 + rng.range(-0.003, 0.003), y: 0.5 + rng.range(-0.003, 0.003), z: 0 }));
    segs += hands.process({ landmarks: [lm] }, i / 30, 1440, 900).length;
  }
  assert.equal(segs, 0);
});

// Synthetic face: eye corners fixed, irises shifted by the gaze.
function face(gx, gy, rng, head = 0) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (i, x, y) => { lm[i] = { x: x + head * 0.02, y: y + rng.range(-0.0008, 0.0008), z: 0 }; };
  set(33, 0.40, 0.45); set(133, 0.46, 0.45); set(159, 0.43, 0.44); set(145, 0.43, 0.46 + gy * 0.003);
  set(362, 0.54, 0.45); set(263, 0.60, 0.45); set(386, 0.57, 0.44); set(374, 0.57, 0.46 + gy * 0.003);
  set(468, 0.43 + gx * 0.012, 0.45 + gy * 0.006); set(473, 0.57 + gx * 0.012, 0.45 + gy * 0.006);
  set(1, 0.5 + head * 0.01, 0.52); set(234, 0.36, 0.5); set(454, 0.64, 0.5); set(10, 0.5, 0.3); set(152, 0.5, 0.75);
  return lm;
}

test('iris offset follows the gaze direction', () => {
  const rng = makeRng(1);
  const right = eyeFeatures(face(1, 0, rng), [], 16 / 9);
  const left = eyeFeatures(face(-1, 0, rng), [], 16 / 9);
  const down = eyeFeatures(face(0, 1, rng), [], 16 / 9);
  assert.ok(right.ix > left.ix + 0.1);
  assert.ok(down.iy > 0.02);
});

test('calibration fit recovers screen points from noisy features', () => {
  const rng = makeRng(2);
  const W = 1440, H = 900;
  const pts = [[0.5, 0.5], [0.07, 0.09], [0.5, 0.09], [0.93, 0.09], [0.93, 0.5], [0.93, 0.91], [0.5, 0.91], [0.07, 0.91], [0.07, 0.5],
    [0.28, 0.3], [0.72, 0.3], [0.72, 0.7], [0.28, 0.7]];
  const samples = [];
  pts.forEach(([u, v], g) => {
    for (let k = 0; k < 25; k++) {
      // mirrored camera: looking at screen-right moves the iris to the image left
      const f = eyeFeatures(face(-(u - 0.5) * 2, (v - 0.5) * 2, rng), [], 16 / 9);
      f.ix += rng.range(-0.01, 0.01); f.iy += rng.range(-0.005, 0.005);
      samples.push({ f, x: u * W, y: v * H, group: g });
    }
  });
  const fit = fitGaze(samples);
  assert.ok(fit.cv < 80, `cv error ${fit.cv}`);
  const [x, y] = fit.predict(eyeFeatures(face(0.5, -0.5, rng), [], 16 / 9));   // screen (0.25, 0.25)
  assert.ok(Math.hypot(x - 0.25 * W, y - 0.25 * H) < 90, `${x},${y}`);
});
