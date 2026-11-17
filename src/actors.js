// NPC、妖兽与 Boss、灵草、剑气、剑雨、灵狐与仙鹤
import * as THREE from 'three';
import { hashi, mulberry32, clamp } from './noise.js';
import { K, forestDensity } from './height.js';
import { RUINS, ISLANDS, WATER_SURF, TOWN, VALLEY, VOLCANO, ARENA, LAIR, POND, riverZ } from './layout.js';
import { Character } from './human/character.js';
import { makeBeast, animateBeast, makeHerbGeos, makeShotGeo, makeSword } from './entities.js';
import { MOBS, NPCS, VILLAGER_LOOKS, HERBS, ITEMS } from './data.js';
import { ELITE_AFFIX, rollElite } from './loot.js';
import { moveBody, turnTo } from './player.js';

export function makeLabel(text, color = '#e8e8e8', size = 30, h = 0.3) {
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const font = `bold ${size}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 14;
  cv.width = w; cv.height = size + 14;
  ctx.font = font; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(8,8,16,0.9)'; ctx.strokeText(text, 7, cv.height / 2 + 1);
  ctx.fillStyle = color; ctx.fillText(text, 7, cv.height / 2 + 1);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set((h * w) / cv.height, h, 1);
  sp.renderOrder = 20;
  return sp;
}

const herbGeos = {};
const herbGeo = (kind) => herbGeos[kind] || (herbGeos[kind] = makeHerbGeos(HERBS[kind]));
export const DEMON_LOOK = { sex: 'm', hair: 'loose', outfit: 'robe', acc: 'none', glowEye: 1, stubble: 0, col: { skin: 0x9a92a8, hair: 0x0a0a12, robe: 0x241830, trim: 0xa040ff, sash: 0x50187a, inner: 0x1a1020, pants: 0x1a1020, boots: 0x0a080e, iris: 0xd060ff, lip: 0x4a3050 } };
const TOWN_NAMES = ['货郎', '书生', '茶客', '游方道士', '卖花女', '镖师', '小贩', '孩童'];

function disposeGroup(g) { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
const disposeModel = (m) => (m instanceof Character ? m.dispose() : disposeGroup(m.group));
let hammerParts = null;
function makeHammer() {
  if (!hammerParts) {
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.8 }), iron = new THREE.MeshStandardMaterial({ color: 0x4a4c52, roughness: 0.4, metalness: 0.8 });
    const hg = new THREE.CylinderGeometry(0.016, 0.019, 0.5, 8); hg.translate(0, 0.12, 0);
    const kg = new THREE.BoxGeometry(0.075, 0.075, 0.17); kg.translate(0, 0.35, 0);
    hammerParts = [[hg, wood], [kg, iron]];
  }
  const g = new THREE.Group();
  for (const [geo, mat] of hammerParts) { const o = new THREE.Mesh(geo, mat); o.castShadow = true; g.add(o); }
  return g;
}
const ckey = (cx, cz) => cx + ',' + cz;
const hyp = Math.hypot;

export class Actors {
  constructor({ scene, mats, world, pois, pN, pA, game, fx }) {
    Object.assign(this, { scene, mats, world, pois, pN, pA, game, fx });
    this.npcs = []; this.mobs = []; this.herbs = []; this.shots = []; this.cranes = []; this.rain = [];
    this.spawned = new Map(); this.respawn = new Map(); this.scanT = 0; this.time = 0; this.uid = 0; this.pet = null;
    this.onMobHit = () => {}; this.onMobKill = () => {}; this.onPlayerHit = () => {}; this.onImpact = () => {}; this.onBossEvent = () => {};
    const sp = pois.spots;
    for (const id of ['chief', 'elder', 'herbalist', 'smith', 'hunter', 'tianji', 'guard', 'merchant', 'tamer', 'storyteller', 'yanji']) if (sp[id]) this._npc(id, NPCS[id].name, NPCS[id].look, sp[id], false);
    sp.villagers.forEach((p, i) => this._npc('v' + i, ['村民', '樵夫', '村姑', '老翁', '孩童', '绣娘'][i], VILLAGER_LOOKS[i], p, true));
    (sp.townfolk || []).forEach((p, i) => { const o = this._npc('t' + i, TOWN_NAMES[i], VILLAGER_LOOKS[(i + 2) % VILLAGER_LOOKS.length], p, true); o.town = true; });
    sp.chickens.forEach((p) => this._spawnMob('chicken', p[0], p[2], 1, null, 'fix' + this.uid));
    this.shotGeo = makeShotGeo(); this.shotGeoE = makeShotGeo(0xd070ff);
    this.rainSword = makeSword(mats, 0.09, 'fly');
    for (let i = 0; i < 9; i++) {
      const m = makeBeast('crane', mats), isl = i < 4, twn = i >= 7;
      m.group.scale.setScalar(1.5);
      scene.add(m.group);
      this.cranes.push({ m, cx: isl ? ISLANDS[0].x : twn ? TOWN.x : 20, cz: isl ? ISLANDS[0].z : twn ? TOWN.z : -10, r: isl ? 46 + i * 9 : twn ? 50 + i * 6 : 70 + i * 12, y: isl ? 172 + i * 5 : twn ? 44 + i * 3 : 58 + i * 4, ph: i * 1.7, w: (isl ? 0.16 : 0.11) * (i % 2 ? 1 : -1) });
    }
  }
  _npc(id, name, look, p, wander) {
    const m = new Character(look, this.mats, { shadow: false });
    if (id === 'smith') { const h = makeHammer(); m.hand.add(h); m.weapons = [h]; }
    const y = this.world.standY(p[0], p[1] + 2.4, p[2]);
    const o = { id, name, m, wander, b: { x: p[0], y, z: p[2], vy: 0, hw: 0.25, hh: 1.6, onGround: true }, home: { x: p[0], z: p[2] }, yaw: Math.PI, dir: 0, t: Math.random() * 3, moving: false, speed: 0, talkT: 0, time: Math.random() * 10 };
    if (id === 'chief') o.yaw = 0;
    if (p[3] !== undefined) o.yaw = p[3];
    const lab = makeLabel(name, wander ? '#d8d8d0' : '#ffe9a0');
    lab.position.y = m.height + 0.42; m.group.add(lab); o.label = lab;
    if (!wander) {
      o.mk = { '!': makeLabel('！', '#ffd23a', 56, 0.62), '?': makeLabel('？', '#7ff0b0', 56, 0.62) };
      for (const k in o.mk) { o.mk[k].position.y = m.height + 0.95; o.mk[k].visible = false; m.group.add(o.mk[k]); }
      this.game.npcPos[id] = { x: p[0], z: p[2] };
    }
    m.group.position.set(o.b.x, o.b.y, o.b.z); m.group.rotation.y = o.yaw;
    this.scene.add(m.group);
    this.npcs.push(o);
    return o;
  }
  refreshMarkers() {
    for (const n of this.npcs) if (n.mk) { const k = this.game.npcMarker(n.id); n.mk['!'].visible = k === '!'; n.mk['?'].visible = k === '?'; }
    this.syncPet();
  }
  _spawnMob(kind, x, z, lvl, key, id, y0) {
    const def = MOBS[kind], w = this.world;
    let m;
    if (def.humanoid) { m = new Character(def.look || DEMON_LOOK, this.mats); m.radius = 0.5; m.humanoid = true; const sw = makeSword(this.mats, 0.052, def.sword || 'fly'); m.hand.add(sw); m.weapons = [sw]; }
    else m = makeBeast(def.model || kind, this.mats, def.pal);
    const y = y0 ?? Math.max(w.groundY(x, z), w.standY(x, 6, z) < 4 ? w.standY(x, 6, z) : -99);
    const hp = Math.round(def.hp * (1 + 0.45 * (lvl - 1)));
    const o = { kind, def, lvl, id, key, m, name: def.name + (lvl > 1 ? ` · ${lvl}阶` : ''), b: { x, y, z, vy: 0, hw: m.radius * 0.6 * (def.scale || 1), hh: m.height * (def.scale || 1), onGround: false }, home: { x, z }, yaw: Math.random() * 6.28, dir: 0,
      hp, maxHp: hp, atk: Math.round(def.atk * (1 + 0.35 * (lvl - 1))), xp: Math.round(def.xp * (1 + 0.5 * (lvl - 1))), state: 'idle', t: Math.random() * 3, cd: 0, attackT: -1, struck: false, kx: 0, kz: 0, flash: 0, hurtT: 0, dead: false, deathT: 0, speed: 0,
      spT: 4, sp2: 8, howl: 0, leap: null, rise: def.special === 'lava' ? 2.4 : 0, combo: 0 };
    const sc = def.scale || (lvl > 1 && !def.boss ? 1 + Math.min(0.5, (lvl - 1) * 0.07) : 1);
    m.group.scale.setScalar(sc);
    o.scale = sc; o.radius = m.radius * sc; o.height = m.height * sc;
    m.group.position.set(x, y, z);
    this.scene.add(m.group);
    this.mobs.push(o);
    return o;
  }
  // 精英：血量、体型提升，带词缀与名牌；必掉灵宝
  makeElite(o, affs) {
    o.elite = affs; o.hp = o.maxHp = Math.round(o.maxHp * 2.6); o.atk = Math.round(o.atk * 1.25); o.xp *= 3;
    o.scale *= 1.22; o.radius *= 1.22; o.height *= 1.22;
    for (const a of affs) {
      if (a === 'berserk') { o.atk = Math.round(o.atk * 1.4); o.cdMul = 0.7; }
      if (a === 'armored') o.armor = 0.55;
      if (a === 'swift') o.spdMul = 1.55;
    }
    o.name = '精英 · ' + o.def.name + (o.lvl > 1 ? ` · ${o.lvl}阶` : '');
    const lab = makeLabel(affs.map((a) => ELITE_AFFIX[a].name).join(' · '), '#ffcf60', 26, 0.3);
    lab.position.y = o.m.height + 0.5; o.m.group.add(lab); o.eliteLab = lab;
    return o;
  }
  spawnBoss(kind, x, z, y) { const o = this._spawnMob(kind, x, z, 1, 'boss_' + kind, 'boss_' + kind, y); o.state = 'chase'; o.home = { x, z }; o.leash = 1e9; return o; }
  _spawnHerb(kind, x, y, z, key, id) {
    const [g1, g2] = herbGeo(kind), g = new THREE.Group();
    const a = new THREE.Mesh(g1, this.mats.entity), b = new THREE.Mesh(g2, this.mats.glow);
    a.castShadow = true; g.add(a, b);
    g.position.set(x, y, z); g.rotation.y = (hashi(x | 0, z | 0, 5) & 7) * 0.785;
    g.scale.setScalar(kind === 'firefruit' ? 1.5 : 1.25);
    this.scene.add(g);
    this.herbs.push({ kind, x, y, z, key, id, g });
  }
  // 水畔太窄，普通区块随机点常会整片错过；沿实际岸线单独寻找凝露花落点。
  _spawnWaterHerbs(cx, cz) {
    const w = this.world, key = ckey(cx, cz);
    const place = (x, z, suffix) => {
      const y = w.groundY(x, z);
      if (y < 0.5 || y > 3 || w.standY(x, y + 4, z) > y + 0.01) return false;
      const kd = w.kindAt(x, z);
      if (kd !== K.GRASS && kd !== K.SAND) return false;
      const wet = w.groundY(x + 5, z) < WATER_SURF || w.groundY(x - 5, z) < WATER_SURF || w.groundY(x, z + 5) < WATER_SURF || w.groundY(x, z - 5) < WATER_SURF;
      if (!wet || !w.boxFree(x, y, z, 0.3, 0.6)) return false;
      if (Math.floor(x / 32) !== cx || Math.floor(z / 32) !== cz) return true;
      const id = key + 'dew' + suffix;
      if (this.respawn.get(id) > this.time || this.herbs.some((h) => h.id === id)) return true;
      this._spawnHerb('dewflower', x, y, z, key, id);
      return true;
    };
    for (let i = 0; i < 2; i++) {
      const x = cx * 32 + 8 + i * 16, rz = riverZ(x);
      if (rz + 16 < cz * 32 || rz - 16 >= (cz + 1) * 32) continue;
      for (const side of [-1, 1]) {
        for (let d = 16; d >= 7; d--) if (place(x, rz + side * d, 'r' + i + side)) break;
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = POND.r + 1;
      const x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
      if (Math.floor(x / 32) === cx && Math.floor(z / 32) === cz) place(x, z, 'p' + i);
    }
  }
  _spawnChunk(cx, cz) {
    const key = ckey(cx, cz), w = this.world, now = this.time;
    const rnd = mulberry32(hashi(cx, cz, 911));
    const mx = cx * 32 + 16, mz = cz * 32 + 16, dist = hyp(mx, mz);
    const dT = hyp(mx - TOWN.x, mz - TOWN.z), dVa = hyp(mx - VALLEY.x, mz - VALLEY.z), dVo = hyp(mx - VOLCANO.x, mz - VOLCANO.z);
    const ok = (id) => !(this.respawn.get(id) > now);
    const nH = dist < 70 ? (rnd() < 0.6 ? 1 : 0) : (rnd() < 0.8 ? 1 : 0) + (rnd() < 0.35 ? 1 : 0);
    for (let i = 0; i < nH; i++) {
      const x = cx * 32 + 2 + rnd() * 28, z = cz * 32 + 2 + rnd() * 28, r = rnd(), id = key + 'h' + i;
      const h = w.groundY(x, z);
      if (h < 0.5 || !ok(id) || w.standY(x, h + 4, z) > h + 0.01 || dT < 70) continue;
      const kd = w.kindAt(x, z);
      let kind = null;
      if (kd === K.SNOW) kind = 'icelotus';
      else if (kd === K.ROCK || kd === K.ASH) kind = r < 0.7 ? 'firefruit' : null;
      else if (kd === K.GRASS || kd === K.SAND) {
        const wet = h <= 3 && (w.groundY(x + 5, z) < 0 || w.groundY(x - 5, z) < 0 || w.groundY(x, z + 5) < 0 || w.groundY(x, z - 5) < 0);
        kind = wet ? (r < 0.75 ? 'dewflower' : 'lingcao') : kd === K.GRASS ? (h > 34 && r < 0.3 ? 'firefruit' : 'lingcao') : null;
      }
      if (kind && w.boxFree(x, h, z, 0.3, 0.6)) this._spawnHerb(kind, x, h, z, key, id);
    }
    this._spawnWaterHerbs(cx, cz);
    const lvl = clamp(1 + Math.floor((dist - 110) / 280), 1, 9);
    const place = (kind, i, n = 1, lv = lvl) => {
      for (let j = 0; j < n; j++) {
        const x = cx * 32 + 4 + rnd() * 24, z = cz * 32 + 4 + rnd() * 24, id = key + kind + i + j;
        const h = w.groundY(x, z);
        if (h < 0.5 || (h > 95 && kind !== 'firewisp') || !ok(id) || w.standY(x, h + 6, z) > h + 0.01 || !w.boxFree(x, h, z, 0.5, 1.2)) continue;
        if (hyp(x - LAIR.x, z - LAIR.z) < 16 || hyp(x - ARENA.x, z - ARENA.z) < 26) continue;
        const o = this._spawnMob(kind, x, z, kind === 'rabbit' ? 1 : lv, key, id);
        if (kind !== 'rabbit' && rnd() < 0.09 + lv * 0.012) this.makeElite(o, rollElite(rnd, 1 + (lv >= 3 ? 1 : 0) + (rnd() < 0.25 ? 1 : 0)));
      }
    };
    if (dT > 95) {
      if (dist > 62 && dVo > VOLCANO.R * 0.7 && rnd() < 0.28) place('rabbit', 0, 1 + ((rnd() * 2) | 0));
      if (dVa < 175) { if (rnd() < 0.42) place('bloodwolf', 5, 1 + (rnd() < 0.3 ? 1 : 0), 1 + (rnd() < 0.35 ? 1 : 0)); }
      else if (dVo < VOLCANO.R * 0.85) { if (rnd() < 0.45) place('firewisp', 6, 1, 1 + ((rnd() * 2) | 0)); }
      else if (dist > 104) {
        const fd = forestDensity(mx, mz), dr = hyp(mx - RUINS.x, mz - RUINS.z);
        if (dr < 120 && dr > 26) { if (rnd() < 0.6) place('wisp', 1); }
        else if (rnd() < (fd > 0.3 ? 0.4 : 0.15)) place('wolf', 2, 1 + (rnd() < 0.35 ? 1 : 0));
        else if (rnd() < (dT < 220 ? 0.45 : 0.2)) place('boar', 3);
        if (w.groundY(mx, mz) > 52 && rnd() < 0.35) place('wisp', 4);
      }
    }
    const inChunk = (p) => p && Math.floor(p[0] / 32) === cx && Math.floor(p[2] / 32) === cz;
    const sp = this.pois.spots;
    if (cx === Math.floor(RUINS.x / 32) && cz === Math.floor((RUINS.z + 7) / 32) && ok('boss')) this._spawnMob('golem', RUINS.x, RUINS.z + 7, 1, key, 'boss');
    if (inChunk(sp.wolfking) && ok('wolfking')) { const o = this._spawnMob('wolfking', sp.wolfking[0], sp.wolfking[2], 1, key, 'wolfking'); o.yaw = LAIR.rot; }
    if (inChunk(sp.lavagolem) && ok('lavagolem') && this.game.s.quests.lavalord) this._spawnMob('lavagolem', sp.lavagolem[0], sp.lavagolem[2], 1, key, 'lavagolem', sp.lavagolem[1] - 3.5);
    this.spawned.set(key, 1);
  }
  _scan(px, pz) {
    const pcx = Math.floor(px / 32), pcz = Math.floor(pz / 32), R = 3;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (!this.spawned.has(ckey(cx, cz)) && this.world.chunks.has((Math.floor(cx / 2) + 32768) * 65536 + (Math.floor(cz / 2) + 32768))) this._spawnChunk(cx, cz);
    }
    for (const key of this.spawned.keys()) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) <= R + 1) continue;
      this.spawned.delete(key);
      this.mobs = this.mobs.filter((o) => { if (o.key !== key) return true; this.scene.remove(o.m.group); disposeModel(o.m); return false; });
      this.herbs = this.herbs.filter((o) => { if (o.key !== key) return true; this.scene.remove(o.g); return false; });
    }
  }
  // 卸载某区块以便重新生成（如 Boss 封印解除）
  rescan(x, z) {
    const key = ckey(Math.floor(x / 32), Math.floor(z / 32));
    this.spawned.delete(key);
    this.mobs = this.mobs.filter((o) => { if (o.key !== key || o.dead) return true; this.scene.remove(o.m.group); disposeModel(o.m); return false; });
    this.herbs = this.herbs.filter((o) => { if (o.key !== key) return true; this.scene.remove(o.g); return false; });
  }

  // ---- 灵狐
  syncPet() {
    const want = this.game.flag('fox');
    if (want && !this.pet) {
      const m = makeBeast('fox', this.mats);
      const lab = makeLabel('灵狐 · 雪团', '#bfefff', 26, 0.22); lab.position.y = 1.0; m.group.add(lab);
      m.group.scale.setScalar(1.1);
      this.scene.add(m.group);
      this.pet = { m, b: { x: 0, y: -50, z: 0, vy: 0, hw: 0.2, hh: 0.6, onGround: false }, yaw: 0, speed: 0, cd: 0, healCd: 0, target: null, placed: false, t: 0 };
    } else if (!want && this.pet) { this.scene.remove(this.pet.m.group); disposeGroup(this.pet.m.group); this.pet = null; }
  }
  _petUpdate(dt, pl) {
    const p = this.pet, P = pl.b, b = p.b, w = this.world;
    p.t += dt; p.cd -= dt; p.healCd -= dt;
    const g = p.m.group;
    if (pl.flying) {
      // 坐在飞剑尾端
      const bx = P.x - Math.sin(pl.yaw) * 0.75, bz = P.z - Math.cos(pl.yaw) * 0.75;
      b.x = bx; b.y = P.y + 0.02; b.z = bz; p.yaw = pl.yaw; p.placed = false;
      g.position.set(b.x, b.y, b.z); g.rotation.y = p.yaw;
      animateBeast(p.m, dt, { speed: 0, time: this.time, attackT: -1 });
      return;
    }
    const d = hyp(P.x - b.x, P.z - b.z);
    if (!p.placed || d > 32 || Math.abs(P.y - b.y) > 12) { b.x = P.x - Math.sin(pl.yaw) * 1.6; b.z = P.z - Math.cos(pl.yaw) * 1.6; b.y = w.standY(b.x, P.y + 2, b.z); b.vy = 0; p.placed = true; for (let i = 0; i < 16; i++) this.pA.emit(b.x, b.y + 0.4, b.z, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, 0.7, 5, 0.7, 0.9, 1, { d: 2 }); }
    // 选择目标：玩家附近正在追击的妖兽
    if (!p.target || p.target.dead || hyp(p.target.b.x - P.x, p.target.b.z - P.z) > 14) {
      p.target = null;
      for (const o of this.mobs) if (!o.dead && o.def.atk && o.state === 'chase' && hyp(o.b.x - P.x, o.b.z - P.z) < 12) { p.target = o; break; }
    }
    let tx = P.x - Math.sin(pl.yaw + 0.6) * 1.7, tz = P.z - Math.cos(pl.yaw + 0.6) * 1.7, sp = 0;
    if (p.target) { tx = p.target.b.x; tz = p.target.b.z; }
    const dx = tx - b.x, dz = tz - b.z, dd = hyp(dx, dz), reach = p.target ? p.target.radius + 0.6 : 0.6;
    if (dd > reach) { sp = Math.min(p.target ? 11 : 10, dd * 2.6); p.yaw = turnTo(p.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10)); }
    else if (p.target) {
      p.yaw = turnTo(p.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      if (p.cd <= 0) {
        p.cd = 1.25; p.atkT = 0;
        const o = p.target;
        this.hitMob(o, this.game.atk * 0.4, dx / (dd || 1), dz / (dd || 1));
        for (let i = 0; i < 10; i++) this.pA.emit(o.b.x, o.b.y + o.height * 0.5, o.b.z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.5, 5, 0.6, 0.85, 1, { d: 3 });
      }
    }
    if (p.atkT !== undefined && p.atkT >= 0) { p.atkT += dt / 0.4; if (p.atkT > 1) p.atkT = -1; }
    b.vy = Math.max(-40, b.vy - 27 * dt);
    moveBody(w, b, Math.sin(p.yaw) * sp * dt, b.vy * dt, Math.cos(p.yaw) * sp * dt, 0.6);
    if (b.hitWall && b.onGround && sp > 0) b.vy = 7;
    // 灵息疗伤
    const s = this.game.s;
    if (this.game.flag('petheal') && p.healCd <= 0 && s.hp < this.game.maxHp * 0.35 && !pl.dead) {
      p.healCd = 25; s.hp = Math.min(this.game.maxHp, s.hp + this.game.maxHp * 0.4);
      this.onBossEvent('petheal');
      for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28; this.pA.emit(P.x + Math.cos(a) * 0.8, P.y + Math.random() * 1.8, P.z + Math.sin(a) * 0.8, 0, 1.2 + Math.random(), 0, 1.4, 6, 0.6, 1, 0.8, { a: 0.9 }); }
    }
    if (Math.random() < dt * 4) this.pA.emit(b.x + (Math.random() - 0.5) * 0.3, b.y + 0.5, b.z + (Math.random() - 0.5) * 0.3, 0, 0.4, 0, 1.2, 3, 0.7, 0.9, 1, { a: 0.6 });
    p.speed = sp;
    g.position.set(b.x, b.y, b.z); g.rotation.y = p.yaw;
    animateBeast(p.m, dt, { speed: sp, time: this.time, attackT: p.atkT ?? -1 });
  }

  // 最近的可交互对象
  nearest(P) {
    let best = null, bd = 1e9;
    const test = (d, max, o) => { if (d < max && d < bd) { bd = d; best = o; } };
    for (const n of this.npcs) test(hyp(n.b.x - P.x, n.b.z - P.z) + Math.abs(n.b.y - P.y) * 0.5, 3.2, { type: 'npc', npc: n, label: `对话 · ${n.name}` });
    for (const h of this.herbs) test(hyp(h.x - P.x, h.z - P.z, h.y - P.y), 2.4, { type: 'herb', herb: h, label: `采集 · ${ITEMS[h.kind].name}` });
    const g = this.game;
    for (const it of this.pois.interact) {
      if (it.type === 'chest' && g.s.chests[it.id]) continue;
      if (it.type === 'cage' && g.flag('fox')) continue;
      if (it.type === 'encounter' && it.done) continue;
      const label = it.type === 'chest' ? `开启 · ${it.label}` : it.type === 'alchemy' ? `炼丹 · ${it.label}` : it.type === 'forge' ? `炼器 · ${it.label}` : it.type === 'portal' ? (g.s.portals[it.id] ? `${it.label}（传送）` : `激活 · ${it.label}`) : it.label;
      test(hyp(it.x - P.x, it.z - P.z, it.y - P.y), it.r, { type: it.type, poi: it, label });
    }
    return best;
  }
  pick(h) {
    this.herbs = this.herbs.filter((x) => x !== h);
    this.scene.remove(h.g);
    this.respawn.set(h.id, this.time + 200);
    for (let i = 0; i < 14; i++) this.pA.emit(h.x, h.y + 0.3, h.z, (Math.random() - 0.5) * 1.6, 1 + Math.random() * 2.2, (Math.random() - 0.5) * 1.6, 0.9, 5, 0.5, 1, 0.8, { g: -0.5, d: 1.5 });
  }
  hitMob(o, dmg, kx, kz) {
    if (o.dead || o.def.ambient || o.rise > 0) return;
    dmg *= o.armor || 1;
    o.hp -= dmg; o.flash = 0.22; o.hurtT = 8;
    if (o.m.hit) o.m.hit(kx, kz, o.def.boss ? 0.6 : 1);
    const kb = o.def.boss ? 0.8 : 6;
    o.kx = kx * kb; o.kz = kz * kb;
    if (o.def.atk && o.state !== 'chase') o.state = 'chase';
    if (o.def.flee) { o.state = 'flee'; o.t = 2.5; o.dir = Math.atan2(kx, kz); }
    const b = o.b, stone = o.kind === 'golem' || o.kind === 'lavagolem';
    const [cr, cg, cb] = o.kind === 'lavagolem' ? [1, 0.45, 0.1] : stone ? [0.5, 0.5, 0.52] : o.kind === 'heartdemon' ? [0.6, 0.2, 0.9] : o.kind === 'firewisp' ? [1, 0.5, 0.1] : [0.75, 0.1, 0.1];
    for (let i = 0; i < 9; i++) (o.kind === 'lavagolem' || o.kind === 'heartdemon' ? this.pA : this.pN).emit(b.x, b.y + o.height * 0.6, b.z, (Math.random() - 0.5) * 5 + kx * 2, Math.random() * 4, (Math.random() - 0.5) * 5 + kz * 2, 0.5, 5, cr, cg, cb, { g: 14 });
    this.onMobHit(o, dmg);
    if (o.hp <= 0) {
      o.dead = true; o.deathT = 0; o.hp = 0;
      this.respawn.set(o.id, this.time + (o.def.boss ? 600 : 160));
      if (this.fx && o.def.boss) this.fx.tele.clear();
      if (o.stagLab) o.stagLab.visible = false;
      if (o.elite && o.elite.includes('volatile') && this.fx) {
        const x = b.x, y = b.y, z = b.z, atk = o.atk;
        this.fx.tele.add(x, y, z, 3.6, 1.1, 0xff8a20, () => {
          this.onPlayerHit(atk * 1.4, o, 'aoe', x, z, 3.6);
          for (let k = 0; k < 40; k++) { const q = Math.random() * 6.28; this.pA.emit(x, y + 0.4, z, Math.cos(q) * 7, 2 + Math.random() * 5, Math.sin(q) * 7, 0.8, 7, 1, 0.55, 0.1, { g: 9 }); }
          this.onImpact(x, y, z, 'ring');
        });
      }
      this.onMobKill(o);
    }
  }
  // 破绽：弹反或重创后短暂失衡，可被处决
  stagger(o, t) {
    if (o.dead) return;
    o.stagger = t; o.attackT = -1; o.leap = null; if (o.dashT) o.dashT = 0;
    if (!o.stagLab) { o.stagLab = makeLabel('破 绽', '#ff6a5a', 40, 0.42); o.m.group.add(o.stagLab); }
    o.stagLab.position.y = o.m.height + (o.elite ? 0.95 : 0.55); o.stagLab.visible = true;
  }
  // 处决目标：前方近处处于破绽的妖兽
  execTarget(P, yaw, range = 3.6) {
    let best = null, bd = 1e9;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const o of this.mobs) {
      if (o.dead || !(o.stagger > 0)) continue;
      const dx = o.b.x - P.x, dz = o.b.z - P.z, d = hyp(dx, dz) - o.radius;
      if (d > range || Math.abs(o.b.y - P.y) > 2.5) continue;
      const s = d - (dx * fx + dz * fz) / Math.max(0.1, hyp(dx, dz));
      if (s < bd) { bd = s; best = o; }
    }
    return best;
  }
  // 近战扇形判定；cos 为扇形半角余弦（-1 为全周）
  melee(P, yaw, range, dmg, cos = 0.3) {
    let n = 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const o of this.mobs) {
      if (o.dead || o.def.ambient) continue;
      const dx = o.b.x - P.x, dz = o.b.z - P.z, d = hyp(dx, dz);
      if (d > range + o.radius || Math.abs(o.b.y - P.y) > 2.6 + o.height * 0.3) continue;
      if (d > 0.8 && (dx * fx + dz * fz) / d < cos) continue;
      this.hitMob(o, dmg, d > 0.01 ? dx / d : fx, d > 0.01 ? dz / d : fz); n++;
    }
    return n;
  }
  // 自动瞄准：返回视线锥内最近的妖兽
  aimTarget(ox, oy, oz, dir, maxD, cos) {
    let best = null, bd = maxD;
    for (const o of this.mobs) {
      if (o.dead || o.def.ambient) continue;
      const dx = o.b.x - ox, dy = o.b.y + o.height * 0.5 - oy, dz = o.b.z - oz, d = hyp(dx, dy, dz);
      if (d < bd && d > 0.5 && (dx * dir.x + dy * dir.y + dz * dir.z) / d > cos) { bd = d; best = o; }
    }
    return best;
  }
  shoot(x, y, z, dx, dy, dz, dmg, enemy) {
    const mesh = new THREE.Mesh(enemy ? this.shotGeoE : this.shotGeo, this.mats.glow);
    mesh.position.set(x, y, z);
    mesh.rotation.order = 'YXZ'; mesh.rotation.y = Math.atan2(dx, dz); mesh.rotation.x = -Math.asin(dy);
    if (enemy) mesh.scale.setScalar(1.4);
    this.scene.add(mesh);
    this.shots.push({ mesh, x, y, z, dx, dy, dz, life: enemy ? 2.2 : 1.4, dmg, enemy, sp: enemy ? 24 : 36, src: enemy });
  }
  // 万剑归宗：在 (x,z) 周围 r 内降下剑雨
  // y：施法者高度，用于在浮岛、屋顶等高处找落点
  swordRain(x, z, r, dmg, n = 16, y) {
    const tg = this.mobs.filter((o) => !o.dead && !o.def.ambient && hyp(o.b.x - x, o.b.z - z) < r);
    for (let i = 0; i < n; i++) {
      let tx, tz, ty;
      if (tg.length) { const o = tg[i % tg.length]; tx = o.b.x + (Math.random() - 0.5) * 1.6; tz = o.b.z + (Math.random() - 0.5) * 1.6; ty = o.b.y; }
      else { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * r * 0.7; tx = x + Math.cos(a) * rr; tz = z + Math.sin(a) * rr; }
      if (ty === undefined) ty = y === undefined ? this.world.groundY(tx, tz) : this.world.standY(tx, y + 3, tz);
      const g = this.rainSword.clone(); g.rotation.set(Math.PI, 0, (Math.random() - 0.5) * 0.3); g.scale.setScalar(1.5);
      g.position.set(tx, ty + 30 + Math.random() * 6, tz); g.visible = false;
      this.scene.add(g);
      this.rain.push({ g, tx, ty, tz, delay: i * 0.075, v: 70, dmg });
    }
  }
  _burst(x, y, z, n, r, g, b) {
    for (let i = 0; i < n; i++) this.pA.emit(x, y, z, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, 0.45, 6, r, g, b, { d: 3 });
  }

  update(dt, pl, night) {
    this.time += dt;
    const P = pl.b, w = this.world;
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 0.6; this._scan(P.x, P.z); }
    // NPC
    for (const n of this.npcs) {
      const b = n.b, dx = P.x - b.x, dz = P.z - b.z, d = hyp(dx, dz);
      if (d > (n.wander ? 62 : 85)) { n.m.group.visible = false; continue; }
      n.m.group.visible = true;
      const shad = d < 32;
      if (shad !== n.shad) { n.shad = shad; n.m.setShadow(shad); }
      n.time += dt; n.t -= dt; n.talkT -= dt;
      let sp = 0;
      const near = d < 4.2 && Math.abs(P.y - b.y) < 3;
      if (near) n.yaw = turnTo(n.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 6));
      else if (n.wander) {
        if (n.t <= 0) {
          n.moving = !n.moving; n.t = n.moving ? 1.5 + Math.random() * 3 : 2 + Math.random() * 6;
          const hx = n.home.x - b.x, hz = n.home.z - b.z;
          n.dir = hyp(hx, hz) > (n.town ? 9 : 5) ? Math.atan2(hx, hz) : Math.random() * 6.28;
        }
        if (n.moving) { sp = 1.3; n.yaw = turnTo(n.yaw, n.dir, 1 - Math.exp(-dt * 5)); }
      }
      if (n.wander) {
        b.vy -= 27 * dt;
        moveBody(w, b, Math.sin(n.dir) * sp * dt, b.vy * dt, Math.cos(n.dir) * sp * dt, 0.5);
        if (b.hitWall || w.groundY(b.x + Math.sin(n.dir), b.z + Math.cos(n.dir)) < 0.4) { n.dir += Math.PI * (0.6 + Math.random() * 0.8); if (b.hitWall) n.t = Math.min(n.t, 0.6); }
      }
      n.m.group.position.set(b.x, b.y, b.z); n.m.group.rotation.y = n.yaw;
      const smithing = n.id === 'smith' && !near ? (n.time * 0.9) % 1 : -1;
      if (near) { n.m.lookTarget = n.lookP || (n.lookP = new THREE.Vector3()); n.lookP.set(P.x, P.y + 1.55, P.z); } else n.m.lookTarget = null;
      n.m.update(dt, { speed: sp, meditate: (n.id === 'elder' || n.id === 'tianji') && !near, work: smithing >= 0 ? 'hammer' : null, workT: smithing, time: n.time, idle: n.m.look.idle,
        talk: n.talkT > 0 || (n.id === 'storyteller' && d < 20) }, d);
      n.label.visible = d < 26;
    }
    // 妖兽
    for (const o of this.mobs) this._mob(o, dt, pl, night);
    if (this.mobs.some((o) => o.dead && o.deathT > 1.2)) {
      this.mobs = this.mobs.filter((o) => { if (!(o.dead && o.deathT > 1.2)) return true; this.scene.remove(o.m.group); disposeModel(o.m); return false; });
    }
    if (this.pet) this._petUpdate(dt, pl);
    // 灵草微光
    for (const h of this.herbs) {
      if (Math.random() < dt * 1.6 && Math.abs(h.x - P.x) < 45 && Math.abs(h.z - P.z) < 45) {
        const c = HERBS[h.kind].b;
        this.pA.emit(h.x + (Math.random() - 0.5) * 0.5, h.y + 0.3, h.z + (Math.random() - 0.5) * 0.5, 0, 0.5 + Math.random() * 0.5, 0, 1.6, 4, ((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, { a: 0.8 });
      }
    }
    // 剑气（玩家与敌方）
    for (const s of this.shots) {
      const step = s.sp * dt;
      s.life -= dt;
      let hit = s.life <= 0;
      for (let t = 0; t < step && !hit; t += 0.5) {
        const m = Math.min(0.5, step - t);
        s.x += s.dx * m; s.y += s.dy * m; s.z += s.dz * m;
        if (w.solidAt(s.x, s.y, s.z, true) || (s.y < WATER_SURF && w.groundY(s.x, s.z) < WATER_SURF)) hit = true;
        if (s.enemy) {
          if (!pl.dead && hyp(P.x - s.x, P.z - s.z) < 0.9 && s.y > P.y - 0.2 && s.y < P.y + 2) { if (this.onPlayerHit(s.dmg, s.src, 'shot') !== 'dodge') hit = true; }
          continue;
        }
        for (const o of this.mobs) {
          if (o.dead || o.def.ambient) continue;
          const dy = s.y - (o.b.y + o.height * 0.5);
          if (hyp(o.b.x - s.x, o.b.z - s.z) < o.radius + 0.6 && Math.abs(dy) < o.height * 0.5 + 0.6) { this.hitMob(o, s.dmg, s.dx, s.dz); hit = true; break; }
        }
      }
      s.mesh.position.set(s.x, s.y, s.z); s.mesh.rotation.z += dt * 14;
      if (s.enemy) this.pA.emit(s.x, s.y, s.z, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0.4, 6, 0.75, 0.3, 1, { d: 2 });
      else this.pA.emit(s.x, s.y, s.z, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0.35, 5, 0.45, 0.9, 1, { d: 2 });
      if (hit) { s.dead = true; this.scene.remove(s.mesh); if (s.enemy) this._burst(s.x, s.y, s.z, 16, 0.8, 0.3, 1); else this._burst(s.x, s.y, s.z, 16, 0.5, 0.95, 1); }
    }
    if (this.shots.some((s) => s.dead)) this.shots = this.shots.filter((s) => !s.dead);
    // 剑雨
    for (const r of this.rain) {
      if (r.delay > 0) { r.delay -= dt; if (r.delay <= 0) r.g.visible = true; continue; }
      r.g.position.y -= r.v * dt;
      this.pA.emit(r.g.position.x, r.g.position.y + 1.2, r.g.position.z, 0, 4, 0, 0.3, 7, 0.55, 0.9, 1, { d: 2 });
      if (r.g.position.y <= r.ty + 0.6) {
        r.done = true; this.scene.remove(r.g);
        for (const o of this.mobs) if (!o.dead && !o.def.ambient && hyp(o.b.x - r.tx, o.b.z - r.tz) < 2.4 + o.radius * 0.5) this.hitMob(o, r.dmg, 0, 0);
        for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28; this.pA.emit(r.tx, r.ty + 0.2, r.tz, Math.cos(a) * 6, 1 + Math.random() * 3, Math.sin(a) * 6, 0.45, 6, 0.6, 0.95, 1, { d: 3 }); }
        this.onImpact(r.tx, r.ty, r.tz, 'sword');
      }
    }
    if (this.rain.some((r) => r.done)) this.rain = this.rain.filter((r) => !r.done);
    // 仙鹤
    for (const c of this.cranes) {
      const a = c.ph + this.time * c.w, g = c.m.group;
      g.position.set(c.cx + Math.cos(a) * c.r, c.y + Math.sin(this.time * 0.3 + c.ph) * 4, c.cz + Math.sin(a) * c.r);
      g.rotation.y = Math.atan2(-Math.sin(a) * c.w, Math.cos(a) * c.w);
      animateBeast(c.m, dt, { time: this.time + c.ph });
    }
  }

  // ---- Boss 特殊招式
  _special(o, dt, pl, d) {
    const b = o.b, P = pl.b, tele = this.fx.tele, def = o.def;
    o.spT -= dt; o.sp2 -= dt;
    const hurt = (x, z, r, mul, kind) => {
      this.onImpact(x, this.world.groundY(x, z), z, kind);
      if (!pl.dead && hyp(P.x - x, P.z - z) < r && Math.abs(P.y - this.world.groundY(x, z)) < 3.5) this.onPlayerHit(o.atk * mul, o, 'aoe');
    };
    if (def.special === 'wolfking') {
      if ((o.hp < o.maxHp * 0.6 && o.howl < 1) || (o.hp < o.maxHp * 0.3 && o.howl < 2)) {
        o.howl++; o.attackT = -1;
        this.onBossEvent('howl', o);
        for (let i = 0; i < 3; i++) { const a = o.yaw + (i - 1) * 1.2 + Math.PI; const m = this._spawnMob('bloodwolf', b.x + Math.sin(a) * 5, b.z + Math.cos(a) * 5, 3, o.key, 'summon' + this.uid++); m.state = 'chase'; m.hurtT = 30; }
      }
      if (o.spT <= 0 && d > 4 && d < 22 && !o.leap) {
        o.spT = 6.5;
        const h = tele.add(P.x, P.y, P.z, 4.2, 1.15, 0xff3020, (hh) => {
          o.leap = null;
          b.x = hh.x; b.z = hh.z; b.y = this.world.groundY(hh.x, hh.z);
          hurt(hh.x, hh.z, 4.2, 1.5, 'slam');
          for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28; this.pN.emit(hh.x, b.y + 0.2, hh.z, Math.cos(a) * 8, 1 + Math.random() * 3, Math.sin(a) * 8, 0.9, 9, 0.55, 0.5, 0.45, { g: 8, d: 1 }); }
        }, () => P);
        o.leap = { h, x0: b.x, z0: b.z, y0: b.y };
      }
      if (o.leap) {
        const h = o.leap.h, t = h.t / h.delay;
        if (t > 0.45) { const u = (t - 0.45) / 0.55; b.x = o.leap.x0 + (h.x - o.leap.x0) * u; b.z = o.leap.z0 + (h.z - o.leap.z0) * u; b.y = o.leap.y0 + (h.y - o.leap.y0) * u + Math.sin(u * Math.PI) * 6; b.vy = 0; }
        return true;
      }
    } else if (def.special === 'lava') {
      if (o.spT <= 0) {
        o.spT = o.hp < o.maxHp * 0.5 ? 4.5 : 6.5;
        this.onBossEvent('meteor', o);
        const n = o.hp < o.maxHp * 0.5 ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.28, rr = i === 0 ? 0 : 3 + Math.random() * 9, x = P.x + Math.cos(a) * rr, z = P.z + Math.sin(a) * rr, y = this.world.groundY(x, z);
          const delay = 1.5 + i * 0.18;
          tele.add(x, y, z, 3.2, delay, 0xff5a10, () => {
            hurt(x, z, 3.2, 1.25, 'meteor');
            for (let k = 0; k < 30; k++) { const q = Math.random() * 6.28; this.pA.emit(x, y + 0.3, z, Math.cos(q) * 7, 2 + Math.random() * 6, Math.sin(q) * 7, 0.9, 7, 1, 0.45 + Math.random() * 0.3, 0.1, { g: 10 }); }
            for (let k = 0; k < 8; k++) this.pN.emit(x, y + 1, z, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, 2.5, 22, 0.25, 0.22, 0.2, { g: -1, a: 0.6 });
          });
          this.fx.meteors.push({ x, y, z, t: -delay, sx: x + 30, sy: y + 60, sz: z - 20 });
        }
      }
      if (o.sp2 <= 0 && d < 9) {
        o.sp2 = 10;
        this.onBossEvent('ring', o);
        tele.add(b.x, b.y, b.z, 8, 1.4, 0xff2a00, () => {
          hurt(b.x, b.z, 8, 1.1, 'ring');
          for (let k = 0; k < 60; k++) { const q = Math.random() * 6.28, r = Math.random() * 8; this.pA.emit(b.x + Math.cos(q) * r, b.y + 0.2, b.z + Math.sin(q) * r, 0, 4 + Math.random() * 6, 0, 0.8, 7, 1, 0.4, 0.08, { g: 6 }); }
        });
      }
    } else if (def.special === 'demon') {
      if (o.spT <= 0 && d > 3) {
        o.spT = 3.6; o.dashT = 0.32; o.dashDir = Math.atan2(P.x - b.x, P.z - b.z);
        this.onBossEvent('demondash', o);
      }
      if (o.dashT > 0) {
        o.dashT -= dt;
        const sp = 30;
        moveBody(this.world, b, Math.sin(o.dashDir) * sp * dt, 0, Math.cos(o.dashDir) * sp * dt, 0.9);
        if (Math.random() < 0.6) this.fx.ghosts.spawn(o.m, 0xa040ff, 0.4, 0.45);
        if (o.dashT <= 0) { o.attackT = 0; o.struck = false; o.cd = 0.4; }
        return true;
      }
      if (o.sp2 <= 0 && d > 4 && d < 30) {
        o.sp2 = 4.8; o.castT = 0;
        this.onBossEvent('demonqi', o);
        for (let i = -1; i <= 1; i++) {
          const a = Math.atan2(P.x - b.x, P.z - b.z) + i * 0.22, dy = (P.y + 1 - (b.y + 1.25)) / Math.max(1, d);
          const l = Math.hypot(1, dy);
          this.shoot(b.x + Math.sin(a) * 0.8, b.y + 1.25, b.z + Math.cos(a) * 0.8, Math.sin(a) / l, dy / l, Math.cos(a) / l, o.atk * 0.8, o);
        }
      }
    }
    return false;
  }

  _mob(o, dt, pl, night) {
    const b = o.b, def = o.def, P = pl.b, w = this.world, g = o.m.group;
    const dx = P.x - b.x, dz = P.z - b.z, dy = P.y - b.y, d = hyp(dx, dz);
    if (o.dead) {
      o.deathT += dt;
      if (o.m.humanoid) { o.m.update(dt, { dead: true, time: this.time }, d); if (Math.random() < 0.5) this.pA.emit(b.x + (Math.random() - 0.5), b.y + Math.random() * 1.8, b.z + (Math.random() - 0.5), 0, 2, 0, 1, 6, 0.6, 0.25, 1, { d: 1 }); }
      else g.rotation.z = Math.min(1.5, o.deathT * 5);
      g.scale.setScalar(o.scale * Math.max(0.01, 1 - Math.max(0, o.deathT - 0.6) * 1.7));
      return;
    }
    if (d > (def.boss ? 120 : 85)) return;
    // 魔君破封而出
    if (o.rise > 0) {
      o.rise -= dt;
      const ty = this.pois.spots.lavagolem[1];
      b.y = ty - Math.max(0, o.rise) * 1.45;
      if (Math.random() < 0.8) { const a = Math.random() * 6.28; this.pA.emit(b.x + Math.cos(a) * 2.5, ty + 0.2, b.z + Math.sin(a) * 2.5, 0, 3 + Math.random() * 4, 0, 1.2, 8, 1, 0.45, 0.1, { g: 2 }); }
      if (o.rise <= 0) { b.y = ty; o.state = 'chase'; this.onMobHit(o, 0); this.onImpact(b.x, b.y, b.z, 'ring'); }
      g.position.set(b.x, b.y, b.z); g.rotation.y = o.yaw = Math.atan2(dx, dz);
      animateBeast(o.m, dt, { speed: 0, time: this.time, attackT: -1 });
      return;
    }
    o.cd -= dt; o.t -= dt; o.hurtT -= dt;
    // 出手前的寒光提示（完美闪避 / 弹反的时机）
    if (o.attackT >= 0.26 && !o.glint && !def.ambient) { o.glint = true; const hy = b.y + o.height * 0.85; for (let i = 0; i < 6; i++) this.pA.emit(b.x, hy, b.z, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0.28, 10, 1, 0.9, 0.5, { a: 1 }); }
    if (o.attackT < 0) o.glint = false;
    if (o.elite && Math.random() < dt * 9) { const c = ELITE_AFFIX[o.elite[0]].color, a = Math.random() * 6.28; this.pA.emit(b.x + Math.cos(a) * o.radius, b.y + Math.random() * o.height, b.z + Math.sin(a) * o.radius, 0, 0.8, 0, 0.9, 4, c[0], c[1], c[2], { a: 0.6 }); }
    let sp = 0, face = o.dir;
    const wander = (mul) => {
      if (o.t <= 0) {
        if (o.state === 'idle') { o.state = 'wander'; o.t = 1 + Math.random() * 2.5; const hx = o.home.x - b.x, hz = o.home.z - b.z; o.dir = hyp(hx, hz) > 9 ? Math.atan2(hx, hz) : Math.random() * 6.28; }
        else { o.state = 'idle'; o.t = 1.5 + Math.random() * 4; }
      }
      return o.state === 'wander' ? def.speed * mul : 0;
    };
    let busy = false;
    if (def.ambient || def.flee) {
      if (def.flee && d < 6.5 && !pl.dead && o.state !== 'flee') { o.state = 'flee'; o.t = 1.6; o.dir = Math.atan2(-dx, -dz) + (Math.random() - 0.5); }
      if (o.state === 'flee') { sp = def.speed; if (o.t <= 0) { o.state = 'idle'; o.t = 1; } }
      else sp = wander(0.3);
    } else if (o.stagger > 0) {
      o.stagger -= dt; o.attackT = -1; face = o.yaw;
      if (o.stagger <= 0 && o.stagLab) o.stagLab.visible = false;
      if (o.m.hit && Math.random() < dt * 3) o.m.hit((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.4);
    } else {
      const hd = hyp(b.x - o.home.x, b.z - o.home.z), leash = o.leash || (def.boss ? 40 : 62);
      const safe = !def.boss && (hyp(P.x, P.z) < 84 || hyp(P.x - TOWN.x, P.z - TOWN.z) < 70);
      const canSee = !pl.dead && !safe && Math.abs(dy) < (def.boss ? 14 : 9) && hd < leash;
      if (o.state !== 'chase' && o.state !== 'return' && canSee && d < (o.hurtT > 0 ? 45 : def.aggro * (night > 0.5 ? 1.3 : 1))) { o.state = 'chase'; if (def.boss) this.onMobHit(o, 0); }
      if (o.state === 'chase') {
        face = Math.atan2(dx, dz);
        if (!canSee || d > (def.boss ? 60 : 48)) { o.state = 'return'; if (this.fx && def.boss) this.fx.tele.clear(); o.leap = null; }
        else if (def.special && this._special(o, dt, pl, d)) busy = true;
        else if (o.attackT >= 0) sp = 0;
        else if (d < def.range + (o.radius - o.m.radius)) { if (o.cd <= 0) { o.attackT = 0; o.struck = false; o.cd = def.cd * (o.cdMul || 1); o.combo = (o.combo + 1) % 3; } }
        else { o.dir = face; sp = def.speed * (o.spdMul || 1); }
      } else if (o.state === 'return') {
        o.dir = face = Math.atan2(o.home.x - b.x, o.home.z - b.z); sp = def.speed * 0.8;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.25 * dt);
        if (hd < 3) { o.state = 'idle'; o.t = 1; o.howl = 0; }
      } else { sp = wander(0.25); face = o.dir; }
    }
    if (o.attackT >= 0 && !busy) {
      o.attackT += dt / (def.boss ? (def.humanoid ? 0.5 : 1.15) : 0.62);
      if (!o.struck && o.attackT >= 0.5) {
        o.struck = true;
        if (def.boss && !def.humanoid) { const fx = b.x + Math.sin(o.yaw) * 2 * o.scale, fz = b.z + Math.cos(o.yaw) * 2 * o.scale; for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28; this.pN.emit(fx + Math.cos(a), b.y + 0.2, fz + Math.sin(a), Math.cos(a) * 5, 2 + Math.random() * 4, Math.sin(a) * 5, 0.8, 6, 0.5, 0.48, 0.42, { g: 12 }); } }
        if (d < def.range + (o.radius - o.m.radius) + 0.9 && Math.abs(dy) < 2.6 + o.height * 0.2 && !pl.dead) {
          if (this.onPlayerHit(o.atk, o, 'melee') === 'hit' && o.elite && o.elite.includes('vampire')) o.hp = Math.min(o.maxHp, o.hp + o.atk * 1.2);
        }
        else if (def.boss) this.onPlayerHit(0, o);
      }
      if (o.attackT >= 1) o.attackT = -1;
    }
    o.yaw = turnTo(o.yaw, face, 1 - Math.exp(-dt * 9));
    if (!busy) {
      let vx = Math.sin(o.dir) * sp, vz = Math.cos(o.dir) * sp;
      if (sp > 0 && !def.float && o.floorY == null && w.groundY(b.x + Math.sin(o.dir) * 1.3, b.z + Math.cos(o.dir) * 1.3) < 0.3) { vx = vz = 0; sp = 0; if (o.state === 'wander' || o.state === 'flee') { o.dir += 2.4; } }
      vx += o.kx; vz += o.kz;
      const kd = Math.exp(-dt * 7); o.kx *= kd; o.kz *= kd;
      if (def.float) {
        b.x += vx * dt; b.z += vz * dt;
        const ty = (o.floorY ?? Math.max(w.groundY(b.x, b.z), WATER_SURF)) + 0.3;
        b.y += (ty - b.y) * (1 - Math.exp(-dt * 5));
        const fire = o.kind === 'firewisp';
        if (Math.random() < dt * 8) this.pA.emit(b.x + (Math.random() - 0.5) * 0.4, b.y + 1 + Math.random() * 0.4, b.z + (Math.random() - 0.5) * 0.4, 0, 0.8, 0, 0.8, 5, fire ? 1 : 0.3, fire ? 0.5 : 1, fire ? 0.1 : 0.8, { a: 0.7 });
      } else {
        b.vy = Math.max(-50, b.vy - 27 * dt);
        moveBody(w, b, vx * dt, b.vy * dt, vz * dt, 0.6 * Math.max(1, o.scale * 0.7));
        if (b.hitWall && b.onGround && sp > 0) { if (o.state === 'chase' || o.state === 'return') b.vy = 8.5; else o.dir += 1.8; }
      }
    }
    if (o.kind === 'lavagolem' && Math.random() < dt * 14) { const a = Math.random() * 6.28; this.pA.emit(b.x + Math.cos(a) * 1.2, b.y + 1 + Math.random() * 3, b.z + Math.sin(a) * 1.2, 0, 1.5 + Math.random(), 0, 1, 4, 1, 0.5, 0.1, { g: -0.5 }); }
    if (o.kind === 'heartdemon' && Math.random() < dt * 20) this.pA.emit(b.x + (Math.random() - 0.5) * 0.8, b.y + Math.random() * 1.9, b.z + (Math.random() - 0.5) * 0.8, 0, 1, 0, 0.8, 5, 0.55, 0.2, 1, { a: 0.7 });
    if (o.kind === 'wolfking' && Math.random() < dt * 6) this.pN.emit(b.x + (Math.random() - 0.5) * 2, b.y + 1.5 + Math.random(), b.z + (Math.random() - 0.5) * 2, 0, 0.6, 0, 2, 9, 0.35, 0.1, 0.12, { a: 0.35 });
    // 不与玩家重叠
    const minD = o.radius * 0.85 + 0.35;
    if (!def.ambient && !o.leap && d < minD && Math.abs(dy) < 2) {
      const nx = d > 0.05 ? dx / d : Math.sin(o.yaw), nz = d > 0.05 ? dz / d : Math.cos(o.yaw), push = Math.min(minD - d, dt * 12);
      if (w.boxFree(b.x - nx * push, b.y, b.z - nz * push, b.hw, b.hh)) { b.x -= nx * push; b.z -= nz * push; }
    }
    o.speed = sp;
    if (o.flash > 0) o.flash -= dt;
    g.scale.setScalar(o.m.humanoid ? o.scale : o.scale * (1 + Math.max(0, o.flash) * (def.boss ? 0.15 : 0.7)));
    g.position.set(b.x, b.y, b.z); g.rotation.y = o.yaw;
    if (o.stagger > 0 && !o.m.humanoid) { g.rotation.z = Math.sin(this.time * 18) * 0.07; g.rotation.x = 0.12; } else if (!o.m.humanoid) { g.rotation.z = 0; g.rotation.x = 0; }
    if (o.m.humanoid) {
      if (o.castT >= 0) { o.castT += dt / 0.45; if (o.castT > 1) o.castT = -1; }
      if (!o.lookP) o.m.lookTarget = o.lookP = new THREE.Vector3();
      o.lookP.set(P.x, P.y + 1.4, P.z);
      o.m.update(dt, { speed: o.dashT > 0 ? 0 : sp, dash: o.dashT > 0, attackT: o.attackT, combo: o.combo, cast: o.castT ?? -1, block: o.blockT > 0, time: this.time, armed: true }, d);
    } else animateBeast(o.m, dt, { speed: sp, time: this.time, attackT: o.attackT });
  }
}
