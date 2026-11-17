// 秘境试炼：云端浮岛上的多层随机战斗，每层清场后三选一增益，末层首领
import * as THREE from 'three';
import { runeDisc, lightBeam } from './fx.js';
import { rollGear, rollQuality, rollElite } from './loot.js';

export const TRIAL_POS = { x: -1400, y: 520, z: 1400 };
export const TRIAL_GATE = { x: -28, z: 26 };
const R = 22, FLOORS = 5;
const THEMES = [0x7fe8ff, 0x9fff9a, 0xffc860, 0xd08aff, 0xff6a5a];
// 增益：k 对应 game.run.buffs 中的键（与装备词条同名的会直接叠加到属性上）
export const BOONS = [
  { k: 'atkMul', v: 0.25, name: '剑意凌霄', desc: '攻击提升 25%' },
  { k: 'dr', v: 0.18, name: '金身不坏', desc: '所受伤害降低 18%' },
  { k: 'crit', v: 0.15, name: '心如明镜', desc: '会心几率提升 15%' },
  { k: 'critDmg', v: 0.5, name: '一击必杀', desc: '会心伤害提升 50%' },
  { k: 'leech', v: 0.05, name: '血煞诀', desc: '造成伤害的 5% 转化为气血' },
  { k: 'spd', v: 0.15, name: '踏雪无痕', desc: '身法提升 15%' },
  { k: 'qi', v: 0.6, name: '剑气纵横', desc: '剑气伤害提升 60%' },
  { k: 'regen', v: 1, name: '灵泉涌动', desc: '灵力回复速度翻倍' },
  { k: 'heal', v: 0.35, name: '回春妙手', desc: '此后每清一层回复 35% 气血（立即生效一次）' },
  { k: 'exec', v: 0.6, name: '庖丁解牛', desc: '处决伤害提升 60%，弹反判定更宽' },
  { k: 'bt', v: 1, name: '光阴如梭', desc: '完美闪避的子弹时间延长 1 秒' },
];

// 村中的秘境之门：石牌坊 + 竖立的旋转法阵
export function buildGate(scene, colliders, world) {
  const { x, z } = TRIAL_GATE, y = world.groundY(x, z), g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x6a6c78, roughness: 0.9 }), red = new THREE.MeshStandardMaterial({ color: 0x8a2a22, roughness: 0.7 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.2, 0.7), stone); p.position.set(s * 2.1, 2.6, 0); p.castShadow = true; g.add(p);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), stone); b.position.set(s * 2.1, 0.3, 0); g.add(b);
    colliders.add({ cyl: 1, x: x + s * 2.1, z, r: 0.5, y0: y, y1: y + 5.2 });
  }
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.5, 0.9), red); l1.position.y = 5.3; l1.castShadow = true;
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.3, 1.3), stone); l2.position.y = 5.7;
  const disc = runeDisc(1.75, 0xb08aff, 'portal'); disc.rotation.x = Math.PI / 2; disc.position.y = 2.4;
  g.add(l1, l2, disc);
  g.position.set(x, y, z);
  scene.add(g);
  return { group: g, disc, y };
}

export class Trial {
  // ctx：{ scene, colliders, actors, game, player, ui, audio, burst, setFlash, loadAround, teleportPlayer, save }
  constructor(ctx) {
    Object.assign(this, ctx);
    this.active = false; this.state = 'idle'; this.floor = 0; this.wave = 0; this.waves = 0; this.spawnT = 0; this.cols = []; this.pillars = [];
    const Y = TRIAL_POS.y, g = (this.group = new THREE.Group());
    g.position.set(TRIAL_POS.x, 0, TRIAL_POS.z);
    const stone = new THREE.MeshStandardMaterial({ color: 0x5c6274, roughness: 0.92 }), dark = new THREE.MeshStandardMaterial({ color: 0x3a3c48, roughness: 1 });
    this.stone = stone;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.96, 3, 64), stone); top.position.y = Y - 1.5; top.receiveShadow = true;
    const rock = new THREE.Mesh(new THREE.ConeGeometry(R * 0.95, 26, 24, 4), dark); rock.rotation.x = Math.PI; rock.position.y = Y - 16;
    const pos = rock.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < 12.9) { const k = 1 + (Math.sin(i * 12.9898) * 43758.5 % 1) * 0.25; pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); } }
    rock.geometry.computeVertexNormals();
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.15, R + 0.15, 1.1, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a8678, roughness: 0.8, side: THREE.DoubleSide }));
    rail.position.y = Y + 0.55;
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), stone); p.position.set(Math.cos(a) * (R + 0.1), Y + 0.8, Math.sin(a) * (R + 0.1)); p.castShadow = true; g.add(p); }
    this.disc = runeDisc(R * 0.82, THEMES[0], 'bagua'); this.disc.position.y = Y + 0.04;
    this.portal = runeDisc(2.2, 0xffffff, 'portal'); this.portal.position.y = Y + 0.08;
    this.beam = lightBeam(1.6, 40, 0xffffff, 0.35); this.beam.position.y = Y;
    g.add(top, rock, rail, this.disc, this.portal, this.beam);
    g.visible = false;
    this.scene.add(g);
    this.portal.visible = this.beam.visible = false;
    // 平台与外围空气墙（thin：不挡镜头与剑气）
    const C = this.colliders, X = TRIAL_POS.x, Z = TRIAL_POS.z;
    C.add({ cyl: 1, x: X, z: Z, r: R, y0: Y - 3, y1: Y });
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2, cx = X + Math.cos(a) * (R + 0.9), cz = Z + Math.sin(a) * (R + 0.9); C.add({ x0: cx - 1.9, x1: cx + 1.9, z0: cz - 1.9, z1: cz + 1.9, y0: Y - 1, y1: Y + 9, thin: true }); }
    this.pillarGeo = new THREE.CylinderGeometry(0.9, 1.1, 7, 12);
    this.capGeo = new THREE.BoxGeometry(2.6, 0.5, 2.6);
  }
  get lvl() { return Math.max(1, Math.min(12, 1 + Math.floor(this.game.s.realm * 0.55) + Math.floor((this.floor - 1) / 2))); }
  enter() {
    if (this.active) return;
    const g = this.game;
    this.active = true; this.floor = 0;
    g.run = { buffs: {}, boons: [], stones: 0 };
    this.group.visible = true;
    this.teleportPlayer(TRIAL_POS.x, TRIAL_POS.y + 0.1, TRIAL_POS.z + R * 0.6, () => this.nextFloor());
  }
  nextFloor() {
    this.floor++;
    this.portal.visible = this.beam.visible = false;
    this._layout();
    const boss = this.floor === FLOORS;
    this.ui.banner(`秘境 · 第 ${this.floor} 层`, boss ? '镜 中 剑 魔 现 身' : `共 ${FLOORS} 层 · 清剿妖邪`, 2600);
    this.wave = 0; this.waves = boss ? 1 : this.floor >= 3 ? 3 : 2;
    this.state = 'fight'; this.spawnT = 2.2;
  }
  _layout() {
    for (const p of this.pillars) this.group.remove(p);
    this.colliders.remove(this.cols);
    this.pillars = []; this.cols = [];
    const f = this.floor, Y = TRIAL_POS.y, rnd = Math.random, pts = [];
    const kind = f === FLOORS ? 'ring' : ['ring', 'grove', 'cross'][Math.floor(rnd() * 3)];
    if (kind === 'ring') for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + rnd() * 0.3; pts.push([Math.cos(a) * 13, Math.sin(a) * 13]); }
    else if (kind === 'cross') for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; pts.push([Math.cos(a) * 9, Math.sin(a) * 9], [Math.cos(a) * 17, Math.sin(a) * 17]); }
    else for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2, r = 6 + rnd() * 12; if (pts.every((p) => Math.hypot(p[0] - Math.cos(a) * r, p[1] - Math.sin(a) * r) > 5)) pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const col = THEMES[(f - 1) % THEMES.length];
    for (const [x, z] of pts) {
      const h = 4 + rnd() * 3, m = new THREE.Mesh(this.pillarGeo, this.stone);
      m.scale.y = h / 7; m.position.set(x, Y + h / 2, z); m.castShadow = true;
      const cap = new THREE.Mesh(this.capGeo, this.stone); cap.position.set(x, Y + h + 0.25, z); cap.castShadow = true;
      const glow = runeDisc(1.6, col, 'portal'); glow.position.set(x, Y + 0.06, z);
      this.group.add(m, cap, glow); this.pillars.push(m, cap, glow);
      this.cols.push(this.colliders.add({ cyl: 1, x: TRIAL_POS.x + x, z: TRIAL_POS.z + z, r: 1.05, y0: Y, y1: Y + h + 0.5 }));
    }
    this.disc.material.color.set(col);
  }
  _spawnWave() {
    const f = this.floor, A = this.actors, rnd = Math.random, realm = this.game.s.realm, Y = TRIAL_POS.y;
    const pool = realm < 4 ? ['wolf', 'boar', 'wisp'] : realm < 8 ? ['wolf', 'bloodwolf', 'boar', 'wisp'] : ['bloodwolf', 'firewisp', 'wisp', 'boar'];
    const add = (kind, a, r, lvl) => {
      const x = TRIAL_POS.x + Math.cos(a) * r, z = TRIAL_POS.z + Math.sin(a) * r;
      const o = A._spawnMob(kind, x, z, lvl, 'trial', 'trial' + A.uid++, Y + 0.05);
      // floorY：浮岛远高于下方地形，移动与悬浮须以平台为地面
      o.state = 'chase'; o.leash = 1e9; o.home = { x: TRIAL_POS.x, z: TRIAL_POS.z }; o.trial = true; o.floorY = Y;
      this.burst(x, Y + 1, z, 50, 5, 0.8, 0.5, 1);
      return o;
    };
    if (f === FLOORS) {
      const o = add('trialboss', Math.PI * 1.5, 12, this.lvl + 1);
      o.name = '镜中剑魔 · 秘境之主';
      for (let i = 0; i < 3; i++) add(pool[i % pool.length], i * 2.1, 16, this.lvl);
      this.boss = o;
    } else {
      const n = Math.min(8, 2 + f + this.wave);
      for (let i = 0; i < n; i++) {
        const o = add(pool[Math.floor(rnd() * pool.length)], rnd() * Math.PI * 2, 12 + rnd() * 7, this.lvl);
        if (rnd() < 0.08 + f * 0.07) A.makeElite(o, rollElite(rnd, 1 + (f >= 3 ? 1 : 0) + (rnd() < 0.2 ? 1 : 0)));
      }
    }
    this.wave++;
    this.audio.sfx('portal');
  }
  // 被击退或冲出平台的妖物拉回台面，否则会落到下方地形、永远清不了场
  _keepOnPlatform() {
    const Y = TRIAL_POS.y;
    for (const o of this.actors.mobs) {
      if (!o.trial || o.dead) continue;
      const b = o.b, dx = b.x - TRIAL_POS.x, dz = b.z - TRIAL_POS.z, d = Math.hypot(dx, dz), max = R - 1 - (o.radius || 0.5);
      if (d > max) { const k = max / d; b.x = TRIAL_POS.x + dx * k; b.z = TRIAL_POS.z + dz * k; }
      if (b.y < Y - 2 || b.y > Y + 30) { b.y = Y + 0.05; b.vy = 0; o.leap = null; }
    }
  }
  get alive() { return this.actors.mobs.filter((o) => o.trial && !o.dead).length; }
  update(dt) {
    if (!this.active) return;
    const P = this.player.b, Y = TRIAL_POS.y;
    this.disc.rotation.y += dt * 0.05;
    if (P.y < Y - 12 && !this.player.dead) this.teleportPlayer(TRIAL_POS.x, Y + 0.1, TRIAL_POS.z, null, true);
    this._keepOnPlatform();
    if (this.state === 'fight') {
      if (this.spawnT > 0) { this.spawnT -= dt; if (this.spawnT <= 0) this._spawnWave(); }
      else if (this.alive === 0) {
        if (this.wave < this.waves) this.spawnT = 1.6;
        else this._cleared();
      }
      this.ui.trialHud(`秘境 第 ${this.floor}/${FLOORS} 层 · 第 ${Math.max(1, this.wave)}/${this.waves} 波 · 余敌 ${this.spawnT > 0 ? '—' : this.alive}`);
    } else if (this.state === 'portal') {
      this.portal.rotation.y += dt * 0.8;
      this.ui.trialHud(this.floor === FLOORS ? '秘境已破 · 踏入中央光阵返回人间' : `第 ${this.floor} 层已清 · 踏入中央光阵前往下一层`);
      if (Math.hypot(P.x - TRIAL_POS.x, P.z - TRIAL_POS.z) < 1.8 && Math.abs(P.y - Y) < 2) {
        this.state = 'wait';
        if (this.floor === FLOORS) this.leave(true);
        else this.teleportPlayer(TRIAL_POS.x, Y + 0.1, TRIAL_POS.z + R * 0.6, () => this.nextFloor());
      }
    }
  }
  _cleared() {
    const g = this.game, f = this.floor, s = g.s;
    const st = Math.round((15 + 10 * f) * (1 + s.realm * 0.25));
    g.add('stone', st, true); g.run.stones += st;
    if (g.run.buffs.heal) s.hp = Math.min(g.maxHp, s.hp + g.maxHp * g.run.buffs.heal);
    s.trialBest = Math.max(s.trialBest || 0, f);
    this.audio.sfx('quest');
    if (f === FLOORS) {
      const tier = Math.min(10, s.realm * 0.7 + 1.5);
      g.addGear(rollGear(tier, rollQuality(Math.random, 2.5, 3)));
      g.addGear(rollGear(tier, rollQuality(Math.random, 1, 2)));
      g.add('juqi', 2); g.add('core', 3);
      if (!g.flag('trialClear')) { s.flags.trialClear = 1; g.add('stone', 300); }
      this.ui.banner('秘 境 已 破', `获得灵石 ${g.run.stones} · 灵宝两件`, 4200);
      this.setFlash(0.5);
      this._portal();
      this.save();
      return;
    }
    this.ui.toast(`第 ${f} 层清剿完毕 · 灵石 +${st}`);
    this.state = 'boon';
    this.ui.boon(this._boonChoices(), (b) => {
      const B = g.run.buffs;
      B[b.k] = (B[b.k] || 0) + b.v; g.run.boons.push(b.name);
      if (b.k === 'heal') s.hp = Math.min(g.maxHp, s.hp + g.maxHp * b.v);
      this.audio.sfx('break'); this.setFlash(0.3);
      const P = this.player.b; this.burst(P.x, P.y + 1, P.z, 90, 6, 1, 0.85, 0.4);
      this._portal();
    });
  }
  _boonChoices() {
    const pool = BOONS.slice(), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  _portal() {
    this.state = 'portal';
    this.portal.visible = this.beam.visible = true;
    const c = this.floor === FLOORS ? 0xffd860 : THEMES[this.floor % THEMES.length];
    this.portal.material.color.set(c); this.beam.material.color.set(c);
  }
  // 返回人间（胜利或放弃）；dead 为真时由复活流程负责传送
  leave(win, dead) {
    if (!this.active) return;
    this.active = false; this.state = 'idle';
    for (const o of this.actors.mobs) if (o.trial) { o.dead = true; o.deathT = 2; }
    this.ui.trialHud(null);
    if (this.ui.modal === 'boon') this.ui.close(true);
    const stones = this.game.run ? this.game.run.stones : 0;
    this.game.run = null;
    const done = () => { this.group.visible = false; this.colliders.remove(this.cols); for (const p of this.pillars) this.group.remove(p); this.pillars = []; this.cols = []; };
    if (dead) { done(); this.ui.toast(`秘境试炼失败，止步第 ${this.floor} 层（灵石 ${stones} 已入囊）`); return; }
    this.teleportPlayer(TRIAL_GATE.x + 2.5, null, TRIAL_GATE.z + 2.5, () => { done(); if (!win) this.ui.toast('你退出了秘境'); });
  }
}
