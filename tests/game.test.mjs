import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segCircleHit } from '../src/geom.js';
import { Blade } from '../src/blade.js';
import { World } from '../src/game.js';

test('segment / circle hits', () => {
  assert.ok(segCircleHit(0, 0, 10, 0, 5, 1, 2));
  assert.ok(!segCircleHit(0, 0, 10, 0, 5, 5, 2));
  assert.ok(segCircleHit(0, 0, 10, 0, 11, 0, 1.5));    // near the end
  assert.ok(!segCircleHit(0, 0, 10, 0, 14, 0, 1.5));
});

test('blade only cuts when fast, and counts swipes', () => {
  const b = new Blade('t', { minSpeed: 1000 });
  assert.equal(b.add(0, 0, 0), null);
  assert.equal(b.add(5, 0, 0.033), null);              // 150 px/s: hovering
  const s = b.add(100, 0, 0.066);                      // ~2900 px/s: cut
  assert.ok(s && s.ax === 5 && s.bx === 100);
  assert.equal(b.swipe, 1);
  assert.ok(b.add(150, 0, 0.1));                       // hysteresis keeps it on
  assert.equal(b.swipe, 1);
  b.add(151, 0, 0.3); b.add(152, 0, 0.45);             // slow → swipe ends
  assert.ok(b.swipeEnded(0.45));
  b.add(400, 0, 0.5);
  assert.equal(b.swipe, 2);
});

test('fruit flies, can be cut into two halves, and missing it costs a life', () => {
  const w = new World({ w: 1200, h: 800, seed: 1 });
  w.nextWave = Infinity;
  const f = w.launch({ kind: 'orange', x: 600, apex: 200 });
  let apexY = Infinity;
  for (let i = 0; i < 300 && w.fruits.includes(f); i++) { w.update(1 / 60); apexY = Math.min(apexY, f.y); }
  assert.ok(Math.abs(apexY - 200) < 15, `apex ${apexY}`);
  assert.equal(w.misses, 1);
  assert.equal(w.lives, 2);

  const g = w.launch({ kind: 'apple', x: 600, apex: 300 });
  for (let i = 0; i < 40; i++) w.update(1 / 60);
  const blade = new Blade('b');
  const n = w.slice({ ax: g.x - 200, ay: g.y, bx: g.x + 200, by: g.y + 10, blade });
  assert.equal(n, 1);
  assert.equal(w.halves.length, 2);
  assert.equal(w.score, 1);
  w.update(1 / 60);
  assert.ok(!w.fruits.includes(g));
});

test('three fruit in one swipe is a combo, bombs end classic', () => {
  const w = new World({ w: 1200, h: 800, seed: 2 });
  w.nextWave = Infinity;
  const fr = [300, 500, 700].map((x) => { const f = w.launch({ kind: 'kiwi', x }); f.y = 400; f.vy = 0; f.vx = 0; return f; });
  const b = new Blade('b', { minSpeed: 100 });
  b.add(100, 400, 0); const seg = b.add(900, 400, 0.05);
  assert.equal(w.slice(seg), 3);
  b.add(900, 400, 0.3); b.add(900, 400, 0.5);
  w.endSwipes([b], 0.5);
  assert.equal(w.score, 6);
  assert.ok(w.takeEvents().some((e) => e.type === 'combo' && e.n === 3));

  const bomb = w.launch({ kind: 'kiwi', bomb: true, x: 600 }); bomb.y = 300;
  w.slice({ ax: 500, ay: 300, bx: 700, by: 300, blade: b });
  assert.ok(w.over);
  assert.ok(fr.every((f) => f.cut));
});

test('eyes profile: bombs cost a life, dwell cuts', () => {
  const w = new World({ w: 1200, h: 800, profile: 'eyes', seed: 3 });
  w.nextWave = Infinity;
  const bomb = w.launch({ kind: 'kiwi', bomb: true, x: 600 }); bomb.y = 300;
  w.slice({ ax: 500, ay: 300, bx: 700, by: 300, blade: null });
  assert.ok(!w.over);
  assert.equal(w.lives, 2);
  const f = w.launch({ kind: 'plum', x: 300 }); f.y = 300; f.vy = 0;
  for (let i = 0; i < 20; i++) w.dwell(305, 300, 1 / 30);
  assert.ok(f.cut);
});

test('a classic game spawns waves and ends', () => {
  const w = new World({ w: 1200, h: 800, seed: 4 });
  let spawned = 0;
  for (let i = 0; i < 60 * 60 && !w.over; i++) { w.update(1 / 60); spawned += w.takeEvents().filter((e) => e.type === 'wave').length; }
  assert.ok(spawned >= 2, `waves ${spawned}`);
  assert.equal(w.misses, 3);
  assert.ok(w.over, 'nobody slices, so three misses must end it');
});
