const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { buildSync } = require('esbuild');

const root = path.join(__dirname, '..');
const bundle = buildSync({
  stdin: {
    contents: `
      export { Actors } from './src/actors.js';
      export { World } from './src/world.js';
      export { Colliders } from './src/collide.js';
      export { Trial, TRIAL_POS } from './src/trial.js';
    `,
    resolveDir: root,
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['three'], loader: { '.wjs': 'text' },
}).outputFiles[0].text;
const m = { exports: {} };
new Function('module', 'exports', 'require', bundle)(m, m.exports, require);
const { Actors, World, Colliders, Trial, TRIAL_POS } = m.exports;
const THREE = require('three');

const R = 22, Y = TRIAL_POS.y;

function seeded(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function fixture() {
  const col = new Colliders();
  // Same floating platform and thin air walls the Trial constructor adds.
  col.add({ cyl: 1, x: TRIAL_POS.x, z: TRIAL_POS.z, r: R, y0: Y - 3, y1: Y });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, cx = TRIAL_POS.x + Math.cos(a) * (R + 0.9), cz = TRIAL_POS.z + Math.sin(a) * (R + 0.9);
    col.add({ x0: cx - 1.9, x1: cx + 1.9, z0: cz - 1.9, z1: cz + 1.9, y0: Y - 1, y1: Y + 9, thin: true });
  }
  const world = Object.assign(Object.create(World.prototype), { col });
  const mat = new THREE.MeshStandardMaterial();
  const actors = Object.assign(Object.create(Actors.prototype), {
    world, time: 0, uid: 0, respawn: new Map(), spawned: new Map(), herbs: [], mobs: [], shots: [], rain: [],
    mats: { entity: mat, entityFlat: mat, glow: mat }, pois: { spots: {} }, game: { s: { quests: {} } },
    scene: { add() {}, remove() {} }, pA: { emit() {} }, pN: { emit() {} },
    onMobHit() {}, onMobKill() {}, onPlayerHit() { return 'hit'; }, onImpact() {}, onBossEvent() {},
    makeElite(o) { return o; },
  });
  const player = { b: { x: TRIAL_POS.x, y: Y, z: TRIAL_POS.z + R * 0.6, vy: 0 }, dead: false, yaw: 0 };
  const log = { cleared: 0, boons: 0 };
  const stones = [];
  const trial = Object.assign(Object.create(Trial.prototype), {
    actors, player, active: true, state: 'idle', floor: 1, wave: 0, waves: 2, spawnT: 0, cols: [], pillars: [],
    game: { s: { realm: 2, flags: {}, hp: 100 }, maxHp: 100, run: { buffs: {}, boons: [], stones: 0 }, add(k, n) { if (k === 'stone') stones.push(n); }, flag() { return 0; } },
    ui: { trialHud() {}, toast() {}, banner() {}, boon() { log.boons++; } },
    audio: { sfx() {} }, burst() {}, disc: { rotation: { y: 0 } }, teleportPlayer() {}, save() {},
  });
  return { actors, world, player, trial, log, stones };
}

function step(f, seconds, dt = 1 / 30) {
  for (let t = 0; t < seconds; t += dt) {
    f.actors.time += dt;
    for (const o of f.actors.mobs) f.actors._mob(o, dt, f.player, 0);
    f.trial.update(dt);
  }
}

function spawnWaveWithWisp(f) {
  const orig = Math.random;
  for (let seed = 1; seed < 500; seed++) {
    Math.random = seeded(seed);
    try { f.trial._spawnWave(); } finally { Math.random = orig; }
    if (f.actors.mobs.some((o) => o.kind === 'wisp')) return;
    f.actors.mobs.length = 0; f.trial.wave = 0;
  }
  throw new Error('no seed produced a wisp');
}

test('every trial mob, including floating wisps, stays on the platform and reaches the player', () => {
  const f = fixture();
  spawnWaveWithWisp(f);
  assert.ok(f.actors.mobs.length >= 3);
  step(f, 10);
  for (const o of f.actors.mobs) {
    assert.ok(Math.abs(o.b.y - Y) < 1.5, `${o.kind} fell to y=${o.b.y.toFixed(1)}`);
    assert.ok(Math.hypot(o.b.x - f.player.b.x, o.b.z - f.player.b.z) < 4, `${o.kind} never closed in`);
  }
});

test('mobs knocked off the platform edge or below it are pulled back onto it', () => {
  const f = fixture();
  spawnWaveWithWisp(f);
  const [a, b] = f.actors.mobs;
  a.b.x = TRIAL_POS.x + 40; a.b.z = TRIAL_POS.z;
  b.b.y = 5; b.b.vy = -50;
  f.trial._keepOnPlatform();
  assert.ok(Math.hypot(a.b.x - TRIAL_POS.x, a.b.z - TRIAL_POS.z) < R);
  assert.ok(Math.abs(b.b.y - Y) < 0.1 && b.b.vy === 0);
});

test('killing a wave leads to the next wave, then the floor-clear reward', () => {
  const f = fixture();
  f.trial.state = 'fight'; f.trial.spawnT = 0.1;
  const killAll = () => { for (const o of f.actors.mobs) if (o.trial && !o.dead) f.actors.hitMob(o, 1e6, 0, 0); };
  step(f, 0.5);
  assert.equal(f.trial.wave, 1);
  assert.ok(f.trial.alive > 0);
  killAll(); step(f, 3);
  assert.equal(f.trial.wave, 2);
  assert.ok(f.trial.alive > 0);
  killAll(); step(f, 3);
  assert.equal(f.trial.state, 'boon');
  assert.equal(f.log.boons, 1);
  assert.equal(f.stones.length, 1);
});

test('sword rain lands at the targets on the platform, not on the terrain far below', () => {
  const f = fixture();
  spawnWaveWithWisp(f);
  f.actors.rainSword = new THREE.Group();
  const o = f.actors.mobs[0];
  f.actors.swordRain(o.b.x, o.b.z, 10, 10, 6, f.player.b.y);
  assert.ok(f.actors.rain.every((r) => Math.abs(r.ty - Y) < 1.5));
  f.actors.rain = []; f.actors.mobs = [];
  f.actors.swordRain(TRIAL_POS.x, TRIAL_POS.z, 10, 10, 6, f.player.b.y);
  assert.ok(f.actors.rain.every((r) => Math.abs(r.ty - Y) < 0.01));
});
