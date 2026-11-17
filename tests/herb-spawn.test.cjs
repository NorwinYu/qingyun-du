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
      export { POND, WATER_SURF, riverZ } from './src/layout.js';
      export { K } from './src/height.js';
    `,
    resolveDir: root,
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['three'], loader: { '.wjs': 'text' },
}).outputFiles[0].text;
const m = { exports: {} };
new Function('module', 'exports', 'require', bundle)(m, m.exports, require);
const { Actors, World, Colliders, POND, WATER_SURF, riverZ, K } = m.exports;

function fixture() {
  const world = Object.assign(Object.create(World.prototype), { col: new Colliders() });
  const actors = Object.assign(Object.create(Actors.prototype), {
    world, time: 0, respawn: new Map(), spawned: new Map(), herbs: [], mobs: [],
    pois: { spots: {} }, game: { s: { quests: {} } },
    scene: { remove() {} }, pA: { emit() {} },
    // Keep real placement, terrain, collision and harvesting; omit visual models.
    _spawnHerb(kind, x, y, z, key, id) { this.herbs.push({ kind, x, y, z, key, id, g: {} }); },
    _spawnMob() { return {}; }, makeElite() {},
  });
  return actors;
}

function scan(actors, reverse = false) {
  const chunks = [];
  for (let cz = -3; cz <= 3; cz++) for (let cx = -3; cx <= 3; cx++) chunks.push([cx, cz]);
  for (const [cx, cz] of reverse ? chunks.reverse() : chunks) actors._spawnChunk(cx, cz);
  return actors.herbs.filter((h) => h.kind === 'dewflower');
}

test('both riverbanks beside the starter bridge supply the two quest flowers', () => {
  const flowers = scan(fixture()).filter((h) => Math.abs(h.x) < 32 && h.z > 25);
  for (const bank of [-1, 1]) {
    assert.ok(flowers.filter((h) => Math.sign(h.z - riverZ(h.x)) === bank).length >= 2);
  }
});

test('the village pond also supplies at least two flowers', () => {
  assert.ok(scan(fixture()).filter((h) => Math.hypot(h.x - POND.x, h.z - POND.z) < 18).length >= 2);
});

test('flowers grow above water on clear, low grassy or sandy banks', () => {
  const actors = fixture(), flowers = scan(actors), w = actors.world;
  assert.ok(flowers.length > 0);
  for (const h of flowers) {
    assert.ok(h.y >= 0.5 && h.y <= 3);
    assert.ok([K.GRASS, K.SAND].includes(w.kindAt(h.x, h.z)));
    assert.equal(h.y, w.groundY(h.x, h.z));
    assert.ok(w.boxFree(h.x, h.y, h.z, 0.3, 0.6));
    assert.ok([[5, 0], [-5, 0], [0, 5], [0, -5]].some(([dx, dz]) => w.groundY(h.x + dx, h.z + dz) < WATER_SURF));
  }
});

test('chunk load order does not change flower locations or duplicate IDs', () => {
  const first = scan(fixture()), second = scan(fixture(), true);
  const positions = (a) => a.map((h) => `${h.id}:${h.x}:${h.z}`).sort();
  assert.deepEqual(positions(first), positions(second));
  assert.equal(new Set(first.map((h) => h.id)).size, first.length);
  const bankSpots = first.filter((h) => h.id.includes('dewr')).map((h) => `${h.x}:${Math.sign(h.z - riverZ(h.x))}`);
  assert.equal(new Set(bankSpots).size, bankSpots.length, 'neighboring chunks must not each add the same bank patch');
});

test('harvesting respects the existing 200-second respawn cooldown', () => {
  const actors = fixture(), flower = scan(actors)[0];
  assert.ok(flower, 'a flower must be available to harvest');
  const [cx, cz] = flower.key.split(',').map(Number);
  actors.pick(flower);
  actors.time = 199;
  actors.rescan(flower.x, flower.z);
  actors._spawnChunk(cx, cz);
  assert.ok(!actors.herbs.some((h) => h.id === flower.id));
  actors.time = 201;
  actors.rescan(flower.x, flower.z);
  actors._spawnChunk(cx, cz);
  assert.equal(actors.herbs.filter((h) => h.id === flower.id).length, 1);
});

test('buildings and raised surfaces cannot be used as flower beds', () => {
  const actors = fixture();
  actors.world.col.add({ x0: -128, x1: 128, z0: -128, z1: 128, y0: -5, y1: 4 });
  assert.equal(scan(actors).length, 0);
});
