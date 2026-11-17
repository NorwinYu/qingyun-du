// 支线玩法：悬赏榜与宗门声望、宗门宝库、码头垂钓、灵田种植、御剑灵环挑战
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ITEMS, HERBS, MOBS, R_QI, R_ZHUJI } from './data.js';
import { riverZ, WATER_SURF } from './layout.js';
import { makeHerbGeos } from './entities.js';
import { runeDisc, lightBeam, addMat } from './fx.js';
import { makeLabel } from './actors.js';
import { Character } from './human/character.js';
import { moveBody, turnTo } from './player.js';
import { rollGear, QUALITY } from './loot.js';
import { itemIcon } from './ui.js';

const hyp = Math.hypot, R = Math.random;
export const RANKS = [[0, '外门弟子'], [120, '内门弟子'], [350, '核心弟子'], [800, '真传弟子'], [1600, '客卿长老']];
export const BOARD = { x: 13, z: 33 };
const FIELD = { x: -47, z: 24 };
const PAD = { x: 27, z: -48 };
const DOCK = { x: -27, z: riverZ(-27) - 15.5 + 8.4, y: 0.5 };
const ROUTE = [[64, 2], [110, 3], [160, 6], [205, 1], [250, -4]];
const RING_WP = [[25, -72, 6], [0, -122, 12], [-50, -152, 18], [-105, -136, 16], [-145, -86, 14], [-150, -26, 12], [-118, 30, 12], [-70, 64, 9], [-10, 84, 10], [50, 72, 12], [108, 40, 14], [135, -20, 16], [105, -76, 18], [55, -66, 12]];
const RING_R = 3.6;

const SHOP = [
  { id: 'spore', n: 1, cost: 25, rank: 0 },
  { id: 'huichun', n: 2, cost: 20, rank: 0 },
  { id: 'juqi', n: 2, cost: 45, rank: 1 },
  { id: 'manual_cloud', n: 1, cost: 90, rank: 1, once: true },
  { id: 'bingpo', n: 1, cost: 70, rank: 2 },
  { id: 'manual_yuan', n: 1, cost: 160, rank: 2, once: true },
  { gear: 3, cost: 220, rank: 3 },
  { id: 'manual_taixu', n: 1, cost: 280, rank: 3, once: true },
  { gear: 4, cost: 520, rank: 4 },
];
const SEEDS = {
  lingcao: { dur: 100, out: 'lingcao', n: [3, 4] },
  dewflower: { dur: 140, out: 'dewflower', n: [2, 3] },
  firefruit: { dur: 180, out: 'firefruit', n: [2, 3] },
  icelotus: { dur: 240, out: 'icelotus', n: [2, 2] },
  spore: { dur: 480, out: 'lingzhi', n: [1, 1], herb: 'lingzhi' },
};
const FISH = [
  { id: 'fish_carp', w: 50, zone: 0.3, spd: 1.5, title: '有鱼咬钩！' },
  { id: 'fish_silver', w: 26, zone: 0.24, spd: 2.0, title: '有鱼咬钩！' },
  { id: 'pearl', w: 9, zone: 0.22, spd: 1.8, title: '水下似有异物……' },
  { id: 'fish_koi', w: 11, zone: 0.18, spd: 2.5, title: '灵气涌动——是灵鱼！' },
  { id: 'fish_dragon', w: 2.5, zone: 0.13, spd: 3.2, title: '水下传来一股巨力！！' },
];
const FISH_COL = { fish_carp: 0x6a9a8a, fish_silver: 0xc8d4e0, pearl: 0xf0eaff, fish_koi: 0xff8a3a, fish_dragon: 0xffc840 };
const MERCHANT_LOOK = { sex: 'm', hair: 'bun', beard: 'short', outfit: 'robe', hat: true, build: 'stout', col: { skin: 0xe8c098, hair: 0x2a1a14, robe: 0x7a5a3a, trim: 0x3a2a1a, sash: 0xa8402a, pants: 0x4a3a2a, boots: 0x2a1a10 } };

export class Side {
  // ctx：{ scene, mats, colliders, world, pois, actors, game, player, ui, audio, input, burst, pA, pN, sky, weather, save }
  constructor(ctx) {
    Object.assign(this, ctx);
    this.fish = null; this.ring = null; this.esc = null; this.workT = 0; this.lastHour = 0; this.hudOn = false;
    this.wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2e, roughness: 0.85 });
    this.stoneM = new THREE.MeshStandardMaterial({ color: 0x7a7c84, roughness: 0.9 });
    this._buildBoard(); this._buildField(); this._buildPad(); this._buildRod();
    this.pois.interact.push({ type: 'fish', x: DOCK.x, y: DOCK.y, z: DOCK.z, r: 2.4, label: '垂钓 · 青云码头', onUse: () => this.startFish() });
  }
  get s() { return this.game.s; }
  // 垂钓、灵环期间屏蔽战斗与交互
  get busy() { return !!this.fish || (this.workT > 0); }
  get lock() { return !!this.fish || this.workT > 0; }

  // ======== 场景物件
  // 静态部件按材质合并为单个网格，减少绘制调用
  _bake(g) {
    g.updateMatrixWorld(true);
    const by = new Map();
    g.traverse((o) => { if (!o.isMesh) return; if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(o.geometry.clone().applyMatrix4(o.matrixWorld)); o.geometry.dispose(); });
    for (const [mat, list] of by) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = m.receiveShadow = true; this.scene.add(m); for (const x of list) x.dispose(); }
  }
  _box(g, w, h, d, x, y, z, m) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }
  _buildBoard() {
    const { x, z } = BOARD, y = this.world.groundY(x, z), g = new THREE.Group(), W = this.wood;
    const paper = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.95 }), roof = new THREE.MeshStandardMaterial({ color: 0x3a3436, roughness: 0.8 }), red = new THREE.MeshStandardMaterial({ color: 0x9a2a20, roughness: 0.7 });
    for (const s of [-1, 1]) { this._box(g, 0.16, 2.9, 0.16, s * 1.25, 1.45, 0, W); this.colliders.add({ cyl: 1, x: x + (s * 1.25) * 0, z: z + s * 1.25, r: 0.14, y0: y, y1: y + 2.9 }); }
    this._box(g, 2.6, 1.5, 0.08, 0, 1.75, 0, W);
    this._box(g, 2.9, 0.1, 0.5, 0, 2.62, 0.05, roof).rotation.x = -0.12;
    this._box(g, 2.7, 0.22, 0.12, 0, 2.48, 0.04, red);
    const notes = [[-0.85, 1.95, 0.5, 0.6], [-0.2, 1.75, 0.55, 0.7], [0.5, 1.95, 0.45, 0.55], [0.95, 1.55, 0.4, 0.5], [-0.75, 1.3, 0.45, 0.4], [0.25, 1.3, 0.5, 0.42]];
    notes.forEach(([nx, ny, w, h], i) => { const p = this._box(g, w, h, 0.01, nx, ny, 0.05, paper); p.rotation.z = ((i * 37) % 7 - 3) * 0.02; });
    g.position.set(x, y, z); g.rotation.y = -Math.PI / 2;
    this._bake(g);
    const lab = makeLabel('悬赏榜', '#ffe9a0', 34, 0.42); lab.position.set(x, y + 3.25, z); this.scene.add(lab);
    this.pois.interact.push({ type: 'board', x: x - 0.8, y, z, r: 3, label: '查看 · 悬赏榜 / 宗门宝库', onUse: () => this.openBoard() });
  }
  _buildField() {
    const gy = this.world.groundY(FIELD.x, FIELD.z), W = this.wood, g = new THREE.Group();
    const soil = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 1 }), ridge = new THREE.MeshStandardMaterial({ color: 0x5a3e2a, roughness: 1 });
    this.plots = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const px = FIELD.x + (c - 1) * 4.2, pz = FIELD.z + (r - 0.5) * 3.6;
      this._box(g, 3.4, 0.2, 2.8, px, gy + 0.08, pz, soil);
      for (const dz of [-0.8, 0, 0.8]) this._box(g, 3.1, 0.07, 0.34, px, gy + 0.2, pz + dz, ridge);
      for (const s of [-1, 1]) { this._box(g, 3.6, 0.26, 0.12, px, gy + 0.12, pz + s * 1.46, W); this._box(g, 0.12, 0.26, 2.8, px + s * 1.74, gy + 0.12, pz, W); }
      this.colliders.add({ x0: px - 1.8, x1: px + 1.8, z0: pz - 1.5, z1: pz + 1.5, y0: gy - 0.5, y1: gy + 0.22 });
      const crops = new THREE.Group(); crops.position.set(px, gy + 0.22, pz); this.scene.add(crops);
      const i = this.plots.length, it = { type: 'farm', x: px, y: gy + 0.4, z: pz, r: 2.3, label: '灵田 · 播种', onUse: () => this.usePlot(i) };
      this.pois.interact.push(it);
      this.plots.push({ x: px, z: pz, y: gy + 0.22, crops, kind: null, it });
    }
    // 木牌
    this._box(g, 0.12, 1.4, 0.12, FIELD.x - 6.6, gy + 0.7, FIELD.z - 2.4, W);
    this._box(g, 0.9, 0.5, 0.06, FIELD.x - 6.6, gy + 1.3, FIELD.z - 2.36, W);
    this._bake(g);
    const lab = makeLabel('灵田', '#bfffc8', 30, 0.36); lab.position.set(FIELD.x - 6.6, gy + 1.95, FIELD.z - 2.4); this.scene.add(lab);
    this.cropGeo = {};
  }
  _buildPad() {
    const { x, z } = PAD, y = this.world.groundY(x, z), g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.36, 32), this.stoneM); base.position.y = 0.18; base.receiveShadow = true; base.castShadow = true; g.add(base);
    this.padDisc = runeDisc(2.6, 0x7fe8ff, 'bagua'); this.padDisc.position.set(x, y + 0.38, z); this.scene.add(this.padDisc);
    this._box(g, 0.9, 2.4, 0.3, 0, 1.55, -2.5, this.stoneM);
    g.position.set(x, y, z); this._bake(g);
    this.colliders.add({ cyl: 1, x, z, r: 3.1, y0: y - 0.5, y1: y + 0.36 });
    this.colliders.add({ x0: x - 0.45, x1: x + 0.45, z0: z - 2.65, z1: z - 2.35, y0: y, y1: y + 2.75 });
    const lab = makeLabel('灵环台', '#9ff4ff', 30, 0.38); lab.position.set(x, y + 3.2, z - 2.5); this.scene.add(lab);
    this.pois.interact.push({ type: 'ring', x, y: y + 0.4, z, r: 3.2, label: '灵环台 · 御剑灵环挑战', onUse: () => this.startRing() });
    // 灵环（挑战时显示）
    this.ringGroup = new THREE.Group(); this.ringGroup.visible = false; this.scene.add(this.ringGroup);
    const tg = new THREE.TorusGeometry(RING_R, 0.2, 8, 48), dg = new THREE.CircleGeometry(RING_R - 0.15, 32);
    this.rings = RING_WP.map(([rx, rz, h]) => {
      let gm = -1e9;
      for (let k = 0; k < 9; k++) { const a = k * 0.785; gm = Math.max(gm, this.world.groundY(rx + Math.cos(a) * 9 * (k ? 1 : 0), rz + Math.sin(a) * 9 * (k ? 1 : 0))); }
      let ry = Math.max(gm, 0) + 10 + h;
      if (hyp(rx, rz) < 88) ry = Math.max(ry, 24);
      const m = new THREE.Mesh(tg, addMat(0x7fe8ff, null, 0.9)), d = new THREE.Mesh(dg, addMat(0x7fe8ff, null, 0.12));
      m.add(d); m.position.set(rx, ry, rz); this.ringGroup.add(m);
      return { m, d, c: new THREE.Vector3(rx, ry, rz), n: new THREE.Vector3() };
    });
    this.rings.forEach((r, i) => {
      const nx = this.rings[Math.min(i + 1, this.rings.length - 1)], pv = this.rings[Math.max(i - 1, 0)];
      if (i < this.rings.length - 1) r.n.subVectors(nx.c, r.c); else r.n.subVectors(r.c, pv.c);
      r.n.normalize(); r.m.lookAt(r.c.clone().add(r.n));
    });
    this.ringBeam = lightBeam(0.5, 40, 0xffd860, 0.25); this.ringBeam.visible = false; this.scene.add(this.ringBeam);
  }
  _buildRod() {
    const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.6 });
    const bam = new THREE.MeshStandardMaterial({ color: 0xb89a5a, roughness: 0.6 });
    const geo = new THREE.CylinderGeometry(0.006, 0.017, 2.7, 6); geo.translate(0, 1.0, 0);
    const rod = new THREE.Mesh(geo, bam); rod.castShadow = true; g.add(rod);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), dark); grip.position.y = -0.2; g.add(grip);
    for (const yy of [0.5, 1.1, 1.7]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6), dark); k.position.y = yy; g.add(k); }
    this.rodTip = new THREE.Object3D(); this.rodTip.position.y = 2.33; g.add(this.rodTip);
    g.rotation.x = 0.55; g.visible = false; this.rod = g;
    const N = 18;
    this.lineGeo = new THREE.BufferGeometry(); this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: 0xf0f0e8, transparent: true, opacity: 0.75 }));
    this.line.frustumCulled = false; this.line.visible = false; this.scene.add(this.line);
    const bob = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: 0xd8302a, roughness: 0.5, emissive: 0x401010 }), wh = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.5 });
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6, 0, 6.29, 0, Math.PI / 2), red), bot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6, 0, 6.29, Math.PI / 2, Math.PI / 2), wh);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), red); st.position.y = 0.1;
    bob.add(top, bot, st); bob.visible = false; this.bob = bob; this.scene.add(bob);
    this.fishMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.3 }));
    this.fishMesh.scale.set(0.45, 0.7, 1.4); this.fishMesh.visible = false; this.scene.add(this.fishMesh);
  }

  // ======== 宗门声望
  rankIdx(rep = this.s.rep) { let i = 0; for (let k = 0; k < RANKS.length; k++) if (rep >= RANKS[k][0]) i = k; return i; }
  rankName() { return RANKS[this.rankIdx()][1]; }
  award(rw, why) {
    const s = this.s, g = this.game, before = this.rankIdx();
    if (rw.stone) g.add('stone', rw.stone, true);
    s.rep += rw.rep || 0; s.contrib += rw.contrib || 0;
    const parts = [rw.stone ? `灵石 +${rw.stone}` : '', rw.rep ? `声望 +${rw.rep}` : '', rw.contrib ? `贡献 +${rw.contrib}` : ''].filter(Boolean).join(' · ');
    if (why) this.ui.toast(`${why}：${parts}`);
    const after = this.rankIdx();
    if (after > before) { setTimeout(() => this.ui.banner(RANKS[after][1], '宗 门 声 望 提 升 · 宝 库 解 锁 新 物', 3600), 1200); this.audio.sfx('break'); }
  }

  // ======== 悬赏
  _rw(mult) { const r = this.s.realm; return { stone: Math.round((24 + r * 7) * mult), rep: Math.round(18 * mult + r), contrib: Math.round(20 * mult + r * 1.5) }; }
  _gen() {
    const r = this.s.realm, pick = (a) => a[Math.floor(R() * a.length)];
    const kills = r < 4 ? ['wolf', 'boar'] : r < 8 ? ['wolf', 'boar', 'wisp', 'bloodwolf'] : ['bloodwolf', 'firewisp', 'wisp'];
    const gathers = [['lingcao', 5], ['dewflower', 3], ['fish', 3]];
    if (r >= 3) gathers.push(['firefruit', 3]);
    if (r >= 6) gathers.push(['icelotus', 2]);
    const k = pick(kills), [gk, gn] = pick(gathers);
    const list = [
      { t: 'kill', k, n: 4 + Math.floor(R() * 3), c: 0, st: 0, rw: this._rw(1) },
      { t: 'gather', k: gk, n: gn, c: 0, st: 0, rw: this._rw(0.8) },
      r >= R_QI ? (R() < 0.6 ? { t: 'escort', n: 1, c: 0, st: 0, rw: this._rw(1.8) } : { t: 'elite', n: 1, c: 0, st: 0, rw: this._rw(1.6) }) : { t: 'kill', k: k === 'wolf' ? 'boar' : 'wolf', n: 3, c: 0, st: 0, rw: this._rw(0.8) },
    ];
    return list;
  }
  ensureBounty(force) {
    const s = this.s;
    if (!force && s.bounty && s.bounty.day === s.day) return;
    const keep = s.bounty ? s.bounty.list.filter((b) => b.st === 1) : [];
    const fresh = this._gen().filter((b) => !keep.some((k) => k.t === b.t));
    s.bounty = { day: s.day, list: [...keep, ...fresh].slice(0, 3) };
  }
  bTitle(b) { return { kill: '剿灭妖患', gather: b.k === 'fish' ? '河鲜采办' : '采办灵材', escort: '护送行商', elite: '诛除精英' }[b.t]; }
  bText(b) {
    const p = `${Math.min(b.c, b.n)}/${b.n}`;
    if (b.t === 'kill') return `斩杀 ${MOBS[b.k].name} ${p}`;
    if (b.t === 'elite') return `斩杀任意精英妖兽 ${p}`;
    if (b.t === 'gather') return b.k === 'fish' ? `于码头钓获鱼获 ${p}` : `野外采集 ${ITEMS[b.k].name} ${p}`;
    if (b.t === 'escort') return this.esc ? `护送行商至官道驿亭 · 行商气血 ${Math.max(0, Math.round(this.esc.hp))}%` : '在村东口与行商会合，护送至官道驿亭';
    return '';
  }
  _progress(pred) {
    if (!this.s.bounty) return;
    let ch = false;
    for (const b of this.s.bounty.list) if (b.st === 1 && pred(b)) { b.c++; ch = true; if (b.c >= b.n) this._complete(b); }
    if (ch) this.ui.tracker();
  }
  _complete(b) {
    b.st = 2;
    this.ui.banner(this.bTitle(b), '悬 赏 完 成', 2600); this.audio.sfx('quest');
    this.award(b.rw, '悬赏赏格');
    this.ui.tracker(); this.save();
  }
  accept(b) {
    if (b.t === 'escort') { if (this.esc) return; this._spawnMerchant(); this.ui.toast('行商在村东口等候，靠近即可启程'); }
    b.st = 1; b.c = 0; this.ui.tracker(); this.audio.sfx('quest');
  }
  onKill(o) {
    if (o.kind === 'trialboss') this.award({ rep: 40, contrib: 40 }, '破秘境');
    else if (o.def.boss && o.kind !== 'heartdemon') this.award({ rep: 30, contrib: 25 }, '斩首领');
    this._progress((b) => (b.t === 'kill' && b.k === o.kind) || (b.t === 'elite' && !!o.elite));
  }
  onGather(kind) { this._progress((b) => b.t === 'gather' && (b.k === kind || (b.k === 'fish' && kind.startsWith('fish')))); }
  trackHtml() {
    if (!this.s.bounty) return '';
    return this.s.bounty.list.filter((b) => b.st === 1).map((b) => `<h4>◆ 悬赏 · ${this.bTitle(b)}</h4><div>${this.bText(b)}</div>`).join('');
  }

  openBoard(tab = this.tab || 'b') {
    this.ensureBounty();
    this.tab = tab;
    this.ui.board('宗门告示', (el) => this._renderBoard(el));
  }
  _renderBoard(el) {
    const s = this.s, ri = this.rankIdx(), nx = RANKS[ri + 1];
    const head = `<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin-bottom:8px"><span>宗门身份：<b style="color:#ffe9a0;font-size:15px">${RANKS[ri][1]}</b></span><span>声望 ${s.rep}${nx ? ` / ${nx[0]}` : ''} · 贡献 <b style="color:#8fe8a0">${s.contrib}</b> · 灵石 ${this.game.count('stone')}</span></div>
      <div class="bar" style="height:8px;margin:0 0 10px"><i style="background:#d8b060;width:${nx ? Math.min(100, ((s.rep - RANKS[ri][0]) / (nx[0] - RANKS[ri][0])) * 100) : 100}%"></i></div>
      <div id="bagtabs"><span class="btn${this.tab === 'b' ? ' sel' : ''}" data-t="b">悬赏榜</span><span class="btn${this.tab === 's' ? ' sel' : ''}" data-t="s">宗门宝库</span></div>`;
    let body = '';
    if (this.tab === 'b') {
      body = s.bounty.list.map((b, i) => {
        const btn = b.st === 0 ? `<span class="btn" data-a="acc" data-i="${i}">接取</span>` : b.st === 1 ? '<span style="color:#8fd8ff">进行中</span>' : '<span style="color:#8fe8a0">已完成</span>';
        return `<div class="bnt"><div class="n"><b>${this.bTitle(b)}</b><br>${this.bText(b)}<br><span class="rw">赏：灵石 ${b.rw.stone} · 声望 ${b.rw.rep} · 贡献 ${b.rw.contrib}</span></div>${btn}</div>`;
      }).join('') + `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;color:#a8a090"><span>悬赏每日（子时）刷新 · 完成后赏格即刻到账</span><span class="btn" data-a="ref" style="font-size:12px;padding:3px 10px">花 30 灵石刷新</span></div>`;
    } else {
      body = SHOP.map((it, i) => {
        const name = it.gear ? `<b style="color:${QUALITY[it.gear].color}">${QUALITY[it.gear].name}灵宝（随机）</b>` : `<b>${ITEMS[it.id].name}</b>${it.n > 1 ? ` × ${it.n}` : ''}`;
        const desc = it.gear ? '随机部位与词条' : ITEMS[it.id].desc;
        const owned = it.once && (this.game.flag('pas_' + it.id) || this.game.count(it.id));
        const act = owned ? '<span style="color:#8fe8a0">已参悟</span>' : ri < it.rank ? `<span class="lk">需 ${RANKS[it.rank][1]}</span>` : `<span class="btn" data-a="buy" data-i="${i}">${it.cost} 贡献</span>`;
        return `<div class="shopi"><div class="n">${name}<br><span style="font-size:12px;color:#a8a090">${desc}</span></div>${act}</div>`;
      }).join('');
    }
    el.innerHTML = head + body;
    for (const b of el.querySelectorAll('#bagtabs .btn')) b.onclick = () => { this.tab = b.dataset.t; this.audio.sfx('ui'); this._renderBoard(el); };
    for (const b of el.querySelectorAll('[data-a]')) b.onclick = () => {
      const a = b.dataset.a, i = +b.dataset.i;
      if (a === 'acc') this.accept(s.bounty.list[i]);
      else if (a === 'ref') {
        if (s.bounty.list.some((x) => x.st === 1 && x.t === 'escort' && this.esc)) { this.ui.toast('护送途中，无法刷新'); return; }
        if (!this.game.take('stone', 30)) { this.ui.toast('灵石不足'); return; }
        s.bounty.list = s.bounty.list.filter((x) => x.st === 1); this.ensureBounty(true); this.audio.sfx('coin');
      } else if (a === 'buy') this.buy(SHOP[i]);
      this._renderBoard(el);
    };
  }
  buy(it) {
    const s = this.s;
    if (s.contrib < it.cost) { this.ui.toast('宗门贡献不足——完成悬赏可得贡献'); this.audio.sfx('ui'); return; }
    s.contrib -= it.cost; this.audio.sfx('coin');
    if (it.gear) { this.game.addGear(rollGear(Math.min(10, s.realm * 0.7 + 1.5), it.gear)); return; }
    this.game.add(it.id, it.n);
    if (it.once) this.game.useItem(it.id);
    this.save();
  }

  // ======== 护送
  _spawnMerchant() {
    const [x, z] = ROUTE[0], w = this.world, m = new Character(MERCHANT_LOOK, this.mats);
    const lab = makeLabel('行商 · 周掌柜', '#ffe9a0'); lab.position.y = m.height + 0.42; m.group.add(lab);
    const y = w.standY(x, 6, z);
    m.group.position.set(x, y, z); this.scene.add(m.group);
    this.esc = { m, b: { x, y, z, vy: 0, hw: 0.25, hh: 1.6, onGround: true }, seg: 1, hp: 100, yaw: -Math.PI / 2, started: false, far: 0, walked: 0, amb: 0, mobs: [], t: 0, sp: 0, say: 0 };
    const [ex, ez] = ROUTE[ROUTE.length - 1];
    this.escBeam = this.escBeam || lightBeam(1, 80, 0xffd860, 0.3);
    this.escBeam.position.set(ex, w.groundY(ex, ez), ez); this.escBeam.visible = true; this.scene.add(this.escBeam);
  }
  _endEscort(ok) {
    const E = this.esc; if (!E) return;
    for (const o of E.mobs) if (!o.dead) { o.dead = true; o.deathT = 1; }
    const b = this.s.bounty && this.s.bounty.list.find((x) => x.t === 'escort' && x.st === 1);
    if (ok && b) { b.c = 1; this._complete(b); }
    else if (b) { b.st = 0; this.ui.banner('护送失败', E.hp <= 0 ? '行商重伤，货物尽失' : '你与行商走散了', 2800); this.ui.tracker(); }
    this.escBeam.visible = false;
    const m = E.m; this.esc = null;
    setTimeout(() => { this.scene.remove(m.group); m.dispose(); }, ok ? 4000 : 200);
    if (ok) this.ui.toast('周掌柜：多谢道友一路护持！此恩记下了。');
  }
  _escUpdate(dt) {
    const E = this.esc, b = E.b, P = this.player.b, w = this.world;
    const dP = hyp(P.x - b.x, P.z - b.z);
    E.t += dt; E.say -= dt;
    const threat = E.mobs.filter((o) => !o.dead);
    let sp = 0;
    if (!E.started) { if (dP < 6) { E.started = true; this.ui.toast('周掌柜：有劳道友，咱们这就动身！'); } }
    else if (threat.length) {
      for (const o of threat) if (hyp(o.b.x - b.x, o.b.z - b.z) < 9) E.hp -= 1.5 * dt;
      if (E.say <= 0) { E.say = 6; this.ui.toast('周掌柜：妖、妖兽！道友救命！'); }
    } else if (dP < 20) {
      const [tx, tz] = ROUTE[E.seg], dx = tx - b.x, dz = tz - b.z, d = hyp(dx, dz);
      if (d < 1.5) { E.seg++; if (E.seg >= ROUTE.length) { this._endEscort(true); return; } }
      else { sp = 3.3; E.yaw = turnTo(E.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 5)); E.walked += sp * dt; }
    } else if (E.say <= 0) { E.say = 8; this.ui.toast('周掌柜：道友慢些，等等我！'); }
    // 伏击
    if (E.amb < 2 && E.walked > [55, 125][E.amb]) {
      E.amb++;
      const r = this.s.realm, kinds = r < 4 ? ['wolf'] : r < 8 ? ['bloodwolf', 'wolf'] : ['bloodwolf', 'firewisp'], lvl = Math.max(1, Math.floor(r * 0.5));
      const n = 3 + E.amb + (r >= 6 ? 1 : 0), A = this.actors;
      for (let i = 0; i < n; i++) {
        const a = E.yaw + (i / n - 0.5) * 2.4, x = b.x + Math.sin(a) * (13 + R() * 4), z = b.z + Math.cos(a) * (13 + R() * 4);
        const o = A._spawnMob(kinds[i % kinds.length], x, z, lvl, 'escort', 'esc' + A.uid++, w.standY(x, w.groundY(x, z) + 4, z));
        o.state = 'chase'; o.leash = 1e9; o.home = { x: b.x, z: b.z };
        E.mobs.push(o);
        this.burst(x, o.b.y + 1, z, 30, 4, 0.6, 0.3, 0.3);
      }
      this.ui.banner('伏 击', '妖兽拦路 · 保护行商', 2000); this.audio.sfx('howl');
    }
    if (dP > 75) E.far += dt; else E.far = 0;
    if (E.hp <= 0 || E.far > 20) { this._endEscort(false); return; }
    E.sp = sp;
    if (Math.ceil(E.hp / 10) !== E.hp10) { E.hp10 = Math.ceil(E.hp / 10); this.ui.tracker(); }
    b.vy = Math.max(-40, b.vy - 27 * dt);
    moveBody(w, b, Math.sin(E.yaw) * sp * dt, b.vy * dt, Math.cos(E.yaw) * sp * dt, 0.6);
    if (b.hitWall && b.onGround && sp > 0) b.vy = 6;
    const m = E.m; m.group.position.set(b.x, b.y, b.z); m.group.rotation.y = E.yaw;
    m.update(dt, { speed: sp, time: E.t, talk: threat.length > 0 }, dP);
  }

  // ======== 灵田
  _crop(kind) {
    const hk = SEEDS[kind].herb || kind;
    return this.cropGeo[hk] || (this.cropGeo[hk] = makeHerbGeos(HERBS[hk]));
  }
  _setCrop(p, kind) {
    for (const c of p.crops.children) c.geometry.dispose();
    p.crops.clear(); p.kind = kind; p.glows = [];
    if (!kind) return;
    const [g1, g2] = this._crop(kind), n = kind === 'spore' ? 3 : 9, L = [], G = [], mt = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const cx = ((i % 3) - 1) * 1.0, cz = n === 3 ? (i - 1) * 0.3 : (Math.floor(i / 3) - 1) * 0.82;
      mt.makeRotationY(i * 1.7).setPosition(cx, 0, cz);
      L.push(g1.clone().applyMatrix4(mt)); G.push(g2.clone().applyMatrix4(mt));
    }
    const a = new THREE.Mesh(mergeGeometries(L), this.mats.entity), b = new THREE.Mesh(mergeGeometries(G), this.mats.glow);
    a.castShadow = true; p.crops.add(a, b); p.glows.push(b);
    for (const x of [...L, ...G]) x.dispose();
  }
  _syncFarm() {
    const f = this.s.farm;
    this.plots.forEach((p, i) => { const k = f[i] ? f[i].k : null; if (k !== p.kind) this._setCrop(p, k); });
  }
  usePlot(i) {
    const p = this.plots[i], f = this.s.farm, cur = f[i];
    if (cur && cur.g >= 1) { this.harvest(i); return; }
    if (cur) { this.ui.toast(`${ITEMS[SEEDS[cur.k].out].name}生长中（${Math.floor(cur.g * 100)}%）· 雨天长得更快`); return; }
    this.ui.board('灵田 · 播种', (el) => {
      el.innerHTML = '<div style="font-size:12px;color:#a8a090;margin-bottom:6px">将灵材种入灵田，静待成熟后收获。灵芝孢子可在宗门宝库兑换。</div>' + Object.keys(SEEDS).map((k) => {
        const S = SEEDS[k], c = this.game.count(k);
        return `<div class="shopi"><img src="" data-ic="${k}" style="width:28px;height:28px"><div class="n"><b>${ITEMS[k].name}</b>（持有 ${c}）<br><span style="font-size:12px;color:#a8a090">约 ${Math.round(S.dur / 60 * 10) / 10} 分钟成熟 · 收获 ${ITEMS[S.out].name} ×${S.n[0]}${S.n[1] > S.n[0] ? '~' + S.n[1] : ''}</span></div>${c ? `<span class="btn" data-k="${k}">种下</span>` : '<span class="lk">无种</span>'}</div>`;
      }).join('');
      for (const im of el.querySelectorAll('[data-ic]')) im.src = itemIcon(im.dataset.ic);
      for (const b of el.querySelectorAll('[data-k]')) b.onclick = () => { this.plant(i, b.dataset.k); this.ui.close(true); };
    });
  }
  plant(i, k) {
    if (!this.game.take(k, 1)) return;
    this.s.farm[i] = { k, g: 0 };
    this._syncFarm(); this._work(i);
    this.audio.sfx('pick');
    const p = this.plots[i]; this.burst(p.x, p.y + 0.3, p.z, 24, 2, 0.55, 0.4, 0.25, { g: 4, d: 1 });
    this.ui.toast(`种下了 ${ITEMS[k].name}`);
  }
  harvest(i) {
    const cur = this.s.farm[i], S = SEEDS[cur.k], n = S.n[0] + Math.floor(R() * (S.n[1] - S.n[0] + 1));
    this.s.farm[i] = null; this._syncFarm(); this._work(i);
    this.game.add(S.out, n);
    if (cur.k === 'spore' && R() < 0.35) this.game.add('spore', 1);
    this.audio.sfx('chest');
    const p = this.plots[i]; this.burst(p.x, p.y + 0.5, p.z, 60, 4, 0.5, 1, 0.7);
    this.save();
  }
  _work(i) {
    const p = this.plots[i], P = this.player.b, pl = this.player;
    pl.yaw = Math.atan2(p.x - P.x, p.z - P.z); pl.work = 'plant'; pl.meditating = false; this.workT = 1.3;
  }
  _farmUpdate(dt) {
    const f = this.s.farm, rain = this.weather.k > 0.3 ? 1.6 : 1, P = this.player.b;
    this.plots.forEach((p, i) => {
      const c = f[i];
      if (c && c.g < 1) { c.g = Math.min(1, c.g + (dt / SEEDS[c.k].dur) * rain); if (c.g >= 1 && hyp(P.x - p.x, P.z - p.z) < 40) this.ui.toast(`灵田中的${ITEMS[SEEDS[c.k].out].name}成熟了`); }
      const g = c ? c.g : 0, ripe = g >= 1;
      if (c) { const sc = (c.k === 'spore' ? 0.3 + g * 1.9 : 0.3 + g * 1.3) * (ripe ? 1 + Math.sin(this.player.time * 3 + i) * 0.03 : 1); p.crops.scale.setScalar(sc); for (const gl of p.glows) gl.visible = ripe; }
      p.it.label = !c ? '灵田 · 播种' : ripe ? `收获 · ${ITEMS[SEEDS[c.k].out].name}` : `灵田 · ${ITEMS[SEEDS[c.k].out].name} ${Math.floor(g * 100)}%`;
      if (ripe && R() < dt * 3) this.pA.emit(p.x + (R() - 0.5) * 3, p.y + 0.3 + R() * 0.6, p.z + (R() - 0.5) * 2.4, 0, 0.6 + R() * 0.6, 0, 1.6, 3.5, 0.5, 1, 0.75, { a: 0.8 });
    });
  }

  // ======== 垂钓
  startFish() {
    const pl = this.player;
    if (pl.flying || this.ring) { this.ui.toast('先落地再垂钓'); return; }
    const h = pl.model.hand; h.add(this.rod); this.rod.visible = true;
    pl.teleport(DOCK.x, DOCK.y + 0.02, DOCK.z); pl.yaw = 0; pl.camYaw = Math.PI + 0.55; pl.camPitch = 0.28; pl.meditating = false; pl.attackT = -1;
    pl.work = 'fish'; pl.workT = 0;
    this.fish = { st: 'idle', t: 0, bx: 0, bz: 0, by: WATER_SURF };
    this.ui.toast('垂钓：空格 / 左键 抛竿 · WASD 或 E 收竿离开');
  }
  stopFish() {
    if (!this.fish) return;
    this.fish = null; this.player.work = null; this.player.workT = 0;
    if (this.rod.parent) this.rod.parent.remove(this.rod);
    this.rod.visible = this.bob.visible = this.line.visible = this.fishMesh.visible = false;
    this.ui.fishBar(null);
  }
  _rollFish() {
    const night = this.sky ? this.sky.night : 0, rain = this.weather.k > 0.4;
    const ws = FISH.map((f) => f.w * (f.id === 'fish_koi' && night > 0.5 ? 2 : 1) * (f.id === 'fish_dragon' ? (rain ? 2.5 : 1) * (night > 0.5 ? 1.5 : 1) : 1));
    let r = R() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < FISH.length; i++) { r -= ws[i]; if (r <= 0) return FISH[i]; }
    return FISH[0];
  }
  _fishUpdate(dt) {
    const F = this.fish, pl = this.player, inp = this.input, P = pl.b;
    const press = inp.hit('Space') || inp.clicked[0];
    F.age = (F.age || 0) + dt;
    if ((F.age > 0.3 && (inp.down('KeyW') || inp.down('KeyA') || inp.down('KeyS') || inp.down('KeyD') || inp.hit('KeyE'))) || pl.dead) { this.stopFish(); return; }
    F.t += dt;
    const tip = this.rodTip.getWorldPosition(this._tip || (this._tip = new THREE.Vector3()));
    let title = '';
    if (F.st === 'idle') { pl.workT = 0; if (press) { F.st = 'cast'; F.t = 0; } title = '空格 / 左键 抛竿'; }
    else if (F.st === 'cast') {
      pl.workT = F.t < 0.4 ? -F.t / 0.4 : -1 + Math.min(1, (F.t - 0.4) / 0.15);
      if (F.t >= 0.45 && !F.thrown) { F.thrown = true; F.sx = tip.x; F.sy = tip.y; F.sz = tip.z; const d = 6 + R() * 2.5, a = (R() - 0.5) * 0.5; F.bx = P.x + Math.sin(a) * d; F.bz = P.z + Math.cos(a) * d; this.audio.sfx('dash'); }
      if (F.thrown) {
        const u = Math.min(1, (F.t - 0.45) / 0.5);
        this.bob.position.set(F.sx + (F.bx - F.sx) * u, F.sy + (WATER_SURF - F.sy) * u + Math.sin(u * Math.PI) * 2, F.sz + (F.bz - F.sz) * u);
        if (u >= 1) { F.st = 'wait'; F.t = 0; F.thrown = false; F.wait = 3 + R() * 6; F.fishT = this._rollFish(); this.audio.sfx('splash'); this._splash(F.bx, F.bz, 10); }
      }
    } else if (F.st === 'wait') {
      pl.workT = 0;
      const nib = F.t > F.wait - 1.5 && Math.sin(F.t * 9) > 0.7 ? 0.04 : 0;
      this.bob.position.set(F.bx, WATER_SURF + Math.sin(F.t * 2) * 0.02 - nib, F.bz);
      if (F.t >= F.wait) { F.st = 'bite'; F.t = 0; this.audio.sfx('splash'); this._splash(F.bx, F.bz, 16); this.ui.callout('咬 钩', '#8fe8ff'); }
      if (press) { F.st = 'idle'; this.ui.toast('提早了，鱼儿还没上钩'); }
      title = '静待鱼儿咬钩……';
    } else if (F.st === 'bite') {
      pl.workT = 0.12;
      this.bob.position.set(F.bx, WATER_SURF - 0.12 - Math.abs(Math.sin(F.t * 14)) * 0.06, F.bz);
      if (press) { const f = F.fishT; F.st = 'reel'; F.t = 0; F.prog = 0.3; F.z0 = R() * (1 - f.zone); F.ph = R() * 6; this.audio.sfx('pick'); }
      else if (F.t > 1.1) { F.st = 'idle'; this.ui.toast('鱼儿脱钩跑了'); }
      title = '咬钩了！快按 空格 提竿！';
    } else if (F.st === 'reel') {
      const f = F.fishT, p = 0.5 + 0.47 * Math.sin(F.t * f.spd * 1.8 + F.ph) + (f.id === 'fish_dragon' ? Math.sin(F.t * 7.3) * 0.04 : 0);
      F.prog -= dt * 0.05;
      if (press) {
        if (p >= F.z0 && p <= F.z0 + f.zone) { F.prog += f.id === 'fish_dragon' ? 0.15 : 0.22; F.z0 = R() * (1 - f.zone); F.pulse = 1; this.audio.sfx('coin'); this._splash(F.bx, F.bz, 6); }
        else { F.prog -= 0.16; this.audio.sfx('ui'); }
      }
      F.pulse = Math.max(0, (F.pulse || 0) - dt * 4);
      pl.workT = 0.35 + Math.sin(F.t * 9) * 0.08 + F.pulse * 0.3;
      F.bx += (P.x - F.bx) * dt * 0.04 * (1 + F.prog); F.bz += (P.z - F.bz) * dt * 0.04 * (1 + F.prog);
      this.bob.position.set(F.bx + Math.sin(F.t * 5) * 0.2, WATER_SURF - 0.08, F.bz + Math.cos(F.t * 4) * 0.2);
      if (R() < dt * 8) this._splash(this.bob.position.x, this.bob.position.z, 2);
      this.ui.fishBar({ title: f.title, z0: F.z0, w: f.zone, p: Math.max(0, Math.min(1, p)), prog: F.prog });
      if (F.prog >= 1) this._catch(f);
      else if (F.prog <= 0 || F.t > 16) { F.st = 'idle'; this.ui.fishBar(null); this.ui.toast(f.id === 'fish_dragon' ? '鱼线崩断——那究竟是什么？' : '鱼儿挣脱了'); this.audio.sfx('ui'); }
    } else if (F.st === 'catch') {
      pl.workT = Math.max(0, 1 - F.t * 0.8);
      const u = Math.min(1, F.t / 0.7), fm = this.fishMesh;
      fm.position.set(F.bx + (P.x - F.bx) * u, WATER_SURF + (P.y + 1.4 - WATER_SURF) * u + Math.sin(u * Math.PI) * 2.2, F.bz + (P.z - F.bz) * u);
      fm.rotation.set(F.t * 9, 0, Math.sin(F.t * 20) * 0.5);
      this.bob.position.copy(fm.position);
      if (F.t > 0.75) { fm.visible = false; F.st = 'idle'; this.bob.visible = false; }
      title = '';
    }
    this.bob.visible = F.st !== 'idle' && (F.st !== 'cast' || F.thrown);
    if (F.st !== 'reel') this.ui.fishBar(null);
    this._hud = title ? `垂钓 · ${title} · WASD 收竿` : null;
    // 鱼线：竿梢到浮漂的下垂曲线
    this.line.visible = this.bob.visible;
    if (this.line.visible) {
      const a = this.lineGeo.attributes.position, n = a.count, bp = this.bob.position, sag = F.st === 'reel' || F.st === 'bite' ? 0.15 : 0.9;
      for (let i = 0; i < n; i++) { const u = i / (n - 1); a.setXYZ(i, tip.x + (bp.x - tip.x) * u, tip.y + (bp.y + 0.1 - tip.y) * u - sag * 4 * u * (1 - u), tip.z + (bp.z - tip.z) * u); }
      a.needsUpdate = true;
    }
  }
  _splash(x, z, n) { for (let i = 0; i < n; i++) { const a = R() * 6.28; this.pN.emit(x, WATER_SURF + 0.05, z, Math.cos(a) * 1.2, 1 + R() * 2, Math.sin(a) * 1.2, 0.5, 9, 0.85, 0.93, 1, { g: 9, a: 0.7 }); } }
  _catch(f) {
    const F = this.fish, s = this.s;
    F.st = 'catch'; F.t = 0; this.ui.fishBar(null);
    this.fishMesh.material.color.setHex(FISH_COL[f.id]); this.fishMesh.visible = true;
    this.fishMesh.scale.set(0.45, 0.7, 1.4).multiplyScalar(f.id === 'fish_dragon' ? 2 : f.id === 'pearl' ? 0.5 : 1);
    if (f.id === 'pearl') this.fishMesh.scale.set(0.5, 0.5, 0.5);
    const first = !s.fishLog[f.id];
    s.fishLog[f.id] = (s.fishLog[f.id] || 0) + 1;
    this.game.add(f.id, 1);
    this.onGather(f.id.startsWith('fish') ? f.id : 'fish_pearl');
    this.audio.sfx(f.id === 'fish_dragon' || f.id === 'fish_koi' ? 'chest' : 'pick');
    this._splash(F.bx, F.bz, 30);
    if (f.id === 'fish_dragon') { this.ui.banner('金鳞龙鱼', '百 年 难 遇 · 鱼 跃 龙 门', 3600); this.award({ rep: 30, contrib: 30 }, '奇闻传遍宗门'); }
    else if (first) this.ui.callout('新 鱼 获 · ' + ITEMS[f.id].name, '#8fe8ff');
  }

  // ======== 御剑灵环
  startRing() {
    const g = this.game, pl = this.player;
    if (!(g.flag('fly') && g.s.realm >= R_ZHUJI)) { this.ui.toast('需筑基并习得御剑之后，方可挑战灵环'); return; }
    if (this.ring) return;
    this.ring = { st: 'count', t: 0, i: 0, ground: 0, prev: new THREE.Vector3(pl.b.x, pl.b.y + 1, pl.b.z) };
    pl.flying = true; pl.meditating = false; pl.b.vy = 8; this.audio.sfx('fly');
    this.ringGroup.visible = true; this._ringColors();
    this.ui.toast(`穿过 ${this.rings.length} 道灵环 · 金色为下一道${g.s.ringBest ? ` · 最佳 ${g.s.ringBest.toFixed(1)} 秒` : ''}`);
  }
  _ringColors() {
    const R0 = this.ring ? this.ring.i : 0;
    this.rings.forEach((r, i) => {
      r.m.visible = i >= R0;
      const next = i === R0, c = next ? 0xffd860 : i === R0 + 1 ? 0x9ff4ff : 0x5ab8e8;
      r.m.material.color.setHex(c); r.d.material.color.setHex(c);
      r.m.material.opacity = next ? 1 : i === R0 + 1 ? 0.7 : 0.35; r.d.material.opacity = next ? 0.18 : 0.05;
    });
    const n = this.rings[R0];
    if (n) { this.ringBeam.visible = true; this.ringBeam.position.set(n.c.x, n.c.y - 40, n.c.z); }
  }
  endRing(ok) {
    const Rg = this.ring; if (!Rg) return;
    this.ring = null; this.ringGroup.visible = false; this.ringBeam.visible = false;
    if (!ok) { this.ui.toast('灵环挑战中断'); return; }
    const s = this.s, t = Rg.t, best = s.ringBest, first = !best;
    const grade = t < 75 ? '甲' : t < 100 ? '乙' : '丙';
    if (!best || t < best) s.ringBest = t;
    this.ui.banner(`灵环 · ${grade}等`, `用时 ${t.toFixed(1)} 秒${!best || t < best ? ' · 新纪录！' : ` · 最佳 ${best.toFixed(1)} 秒`}`, 4000);
    this.audio.sfx('quest');
    const rw = first ? { stone: 200, rep: 50, contrib: 50 } : { stone: 40 + (grade === '甲' ? 40 : 0), rep: 10, contrib: 15 + (t < best ? 20 : 0) };
    this.award(rw, '灵环挑战');
    this.save();
  }
  _ringUpdate(dt) {
    const Rg = this.ring, pl = this.player, P = pl.b;
    const pc = this._pc || (this._pc = new THREE.Vector3()); pc.set(P.x, P.y + 1, P.z);
    Rg.t += dt;
    if (Rg.st === 'count') {
      const k = 3 - Math.floor(Rg.t);
      if (k !== Rg.k && k > 0) { Rg.k = k; this.ui.callout(String(k), '#ffe9a0'); this.audio.sfx('ui'); }
      if (Rg.t >= 3) { Rg.st = 'go'; Rg.t = 0; this.ui.callout('起 ！', '#7fe8ff'); this.audio.sfx('dash'); }
      this._hud = `灵环挑战 · 准备`;
    } else {
      const r = this.rings[Rg.i], d0 = this._v0 || (this._v0 = new THREE.Vector3());
      const a = d0.subVectors(Rg.prev, r.c).dot(r.n), b = d0.subVectors(pc, r.c).dot(r.n);
      let hit = pc.distanceTo(r.c) < 2.2;
      if (!hit && a < 0 !== b < 0 && Math.abs(a - b) > 1e-4) {
        const u = a / (a - b), ix = Rg.prev.x + (pc.x - Rg.prev.x) * u, iy = Rg.prev.y + (pc.y - Rg.prev.y) * u, iz = Rg.prev.z + (pc.z - Rg.prev.z) * u;
        hit = hyp(ix - r.c.x, iy - r.c.y, iz - r.c.z) < RING_R + 0.5;
      }
      if (hit) {
        Rg.i++; this.audio.sfx('coin');
        this.burst(r.c.x, r.c.y, r.c.z, 50, 6, 1, 0.85, 0.4);
        if (Rg.i >= this.rings.length) { this.endRing(true); return; }
        this._ringColors();
      }
      this._hud = `灵环 ${Rg.i}/${this.rings.length} · ${Rg.t.toFixed(1)} 秒${this.s.ringBest ? ` · 最佳 ${this.s.ringBest.toFixed(1)}` : ''}`;
      Rg.ground = pl.flying ? 0 : Rg.ground + dt;
      if (Rg.ground > 2.5 || pl.dead || Rg.t > 240) { this.endRing(false); return; }
    }
    const n = this.rings[Rg.i];
    if (n) { const sc = 1 + Math.sin(Rg.t * 5) * 0.05; n.m.scale.setScalar(sc); }
    Rg.prev.copy(pc);
  }

  // ======== 主循环
  start() {
    const s = this.s;
    if (!Array.isArray(s.farm)) s.farm = [];
    if (!s.fishLog) s.fishLog = {};
    this.lastHour = s.hour;
    this.cancel();
    if (this.esc) this._endEscort(false);
    if (s.bounty) for (const b of s.bounty.list) if (b.t === 'escort' && b.st === 1) b.st = 0;
    this.ensureBounty();
    this._syncFarm();
  }
  cancel() { this.stopFish(); if (this.ring) this.endRing(false); this.workT = 0; this.player.work = null; }
  onDeath() { this.cancel(); if (this.esc) this._endEscort(false); }
  update(dt) {
    const s = this.s;
    if (s.hour < this.lastHour - 12) { s.day++; this.ensureBounty(); this.ui.toast('新的一天 · 宗门悬赏榜已刷新'); }
    this.lastHour = s.hour;
    this._hud = null;
    if (this.workT > 0) { this.workT -= dt; if (this.workT <= 0) this.player.work = null; }
    this._farmUpdate(dt);
    if (this.fish) this._fishUpdate(dt);
    if (this.ring) this._ringUpdate(dt);
    if (this.esc) this._escUpdate(dt);
    if (this.esc && !this._hud) this._hud = `护送行商 · 气血 ${Math.max(0, Math.round(this.esc.hp))}% · 距驿亭 ${Math.round(this._escLeft())} 米`;
    this.padDisc.rotation.y += dt * 0.4;
    if (this._hud) { this.ui.trialHud(this._hud); this.hudOn = true; } else if (this.hudOn) { this.ui.trialHud(null); this.hudOn = false; }
  }
  _escLeft() {
    const E = this.esc; let d = hyp(ROUTE[E.seg][0] - E.b.x, ROUTE[E.seg][1] - E.b.z);
    for (let i = E.seg; i < ROUTE.length - 1; i++) d += hyp(ROUTE[i + 1][0] - ROUTE[i][0], ROUTE[i + 1][1] - ROUTE[i][1]);
    return d;
  }
  target() {
    if (this.esc) { const E = this.esc; return E.started ? { x: ROUTE[ROUTE.length - 1][0], z: ROUTE[ROUTE.length - 1][1] } : { x: E.b.x, z: E.b.z }; }
    return null;
  }
  marks(out) {
    if (this.esc) out.push({ x: this.esc.b.x, z: this.esc.b.z, c: '#ffd23a', s: 2 });
    for (const o of this.esc ? this.esc.mobs : []) if (!o.dead) out.push({ x: o.b.x, z: o.b.z, c: '#ff5040', s: 1.5 });
  }
}
