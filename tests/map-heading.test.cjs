const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const nodes = {};
const bundle = buildSync({
  entryPoints: [path.join(__dirname, '../src/ui.js')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
}).outputFiles[0].text;
const moduleObject = { exports: {} };
vm.runInNewContext(bundle, {
  module: moduleObject,
  exports: moduleObject.exports,
  document: { querySelector: (selector) => nodes[selector] },
});
const { UI } = moduleObject.exports;

// Record transformed arrow tips from the real drawing methods.
function canvasRecorder() {
  let angle = 0;
  const stack = [], tips = [];
  const context = new Proxy({
    save() { stack.push(angle); },
    restore() { angle = stack.pop(); },
    rotate(value) { angle += value; },
    moveTo(x, y) {
      tips.push([
        x * Math.cos(angle) - y * Math.sin(angle),
        x * Math.sin(angle) + y * Math.cos(angle),
      ]);
    },
  }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
  });
  return { context, tips };
}

// World north is -Z. With camYaw = 0, W moves north; positive yaw turns west.
const headings = [
  ['north', 0, 0, -1],
  ['north-east', -Math.PI / 4, Math.SQRT1_2, -Math.SQRT1_2],
  ['east', -Math.PI / 2, 1, 0],
  ['south-east', -3 * Math.PI / 4, Math.SQRT1_2, Math.SQRT1_2],
  ['south', Math.PI, 0, 1],
  ['south-west', 3 * Math.PI / 4, -Math.SQRT1_2, Math.SQRT1_2],
  ['west', Math.PI / 2, -1, 0],
  ['north-west', Math.PI / 4, -Math.SQRT1_2, -Math.SQRT1_2],
  ['north after full turn', 2 * Math.PI, 0, -1],
  ['west after negative full turn', -3 * Math.PI / 2, -1, 0],
];

for (const map of ['minimap', 'world map']) {
  for (const [heading, yaw, dx, dz] of headings) {
    test(`${map} points ${heading}`, () => {
      const { context, tips } = canvasRecorder();
      nodes['#mm'] = { style: {} };
      nodes['#wmap'] = { getContext: () => context };
      nodes['#plist'] = { innerHTML: '', querySelectorAll: () => [] };
      const ui = Object.create(UI.prototype);
      Object.assign(ui, {
        mapC: { x: 12, z: 34 },
        mmo: context,
        wimg: {},
        world: {},
        game: { s: { portals: {} }, questTarget: () => ({ x: 20, z: 0 }) },
      });
      ui.updateMap(ui.world, 12, 34, yaw, [], { x: 20, z: 0 });
      if (map === 'world map') {
        tips.length = 0;
        ui.renderMap();
      }
      assert.equal(tips.length, 2, 'outline and white arrow must both be drawn');
      for (const [x, y] of tips) {
        const length = Math.hypot(x, y);
        assert.ok(
          Math.abs(x / length - dx) < 1e-12 && Math.abs(y / length - dz) < 1e-12,
          `expected direction (${dx}, ${dz}), got (${x / length}, ${y / length})`,
        );
      }
    });
  }
}
