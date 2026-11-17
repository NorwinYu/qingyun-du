// 游戏状态：境界修炼、灵根、装备、背包、任务、炼丹炼器、存档
import { QUALITY } from './loot.js';
import { REALMS, realmStats, ITEMS, RECIPES, FORGE, QUESTS, CHESTS, NPCS, SHOPS, SELL, MOBS, ROOTS, ROOT_GRADES, SKILLS, R_QI } from './data.js';

const KEY = 'qingyun_save_v1';
const QMAP = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

// 装备综合强度（用于自动替换）
export function gearPower(g) { const s = g.st || {}; return (s.atk || 0) * 1.2 + (s.def || 0) * 1.5 + (s.hp || 0) * 0.12 + (s.mp || 0) * 0.15 + ((s.crit || 0) + (s.leech || 0) + (s.spd || 0)) * 200 + ((s.critDmg || 0) + (s.qi || 0) + (s.regen || 0)) * 60; }

export class Game {
  constructor() { this.listeners = {}; this.npcPos = {}; this.locs = {}; this.run = null; this.reset(); }
  on(ev, fn) { (this.listeners[ev] || (this.listeners[ev] = [])).push(fn); }
  emit(ev, ...a) { const l = this.listeners[ev]; if (l) for (const fn of l) fn(...a); }
  reset() {
    this.s = { realm: 0, xp: 0, hp: 100, mp: 0, bonusHp: 0, inv: {}, weapon: null, equip: { armor: null, charm: null }, root: null, portals: { village: 1 },
      flags: {}, quests: {}, chests: {}, hour: 8.5, pos: null, kills: 0, time: 0, gear: [], gearEq: { weapon: null, armor: null, charm: null },
      day: 0, rep: 0, contrib: 0, bounty: null, farm: [], fishLog: {}, ringBest: 0 };
    this.accept('intro');
  }
  get realm() { return REALMS[this.s.realm]; }
  eq(k) {
    let v = 0;
    for (const sl of ['armor', 'charm']) { if (this.s.gearEq[sl]) continue; const id = this.s.equip[sl]; if (id && ITEMS[id].eq[k]) v += ITEMS[id].eq[k]; }
    for (const sl in this.s.gearEq) { const g = this.gearOf(sl); if (g && g.st[k]) v += g.st[k]; }
    if (this.run && this.run.buffs[k]) v += this.run.buffs[k];
    for (const id of this.passives) { const p = ITEMS[id].passive; if (p[k]) v += p[k]; }
    return v;
  }
  // 已参悟的被动功法（宗门宝库所得）
  get passives() {
    if (!this._pas || this._pasS !== this.s) { this._pasS = this.s; this._pas = Object.keys(this.s.flags).filter((k) => k.startsWith('pas_') && ITEMS[k.slice(4)]).map((k) => k.slice(4)); }
    return this._pas;
  }
  // ---- 灵宝（带品质与随机词条的装备实例）
  gearOf(slot) { const u = this.s.gearEq[slot]; return u ? this.s.gear.find((g) => g.uid === u) || null : null; }
  get weaponModel() { const g = this.gearOf('weapon'); return g ? g.model : this.s.weapon ? ITEMS[this.s.weapon].model : null; }
  slotPower(slot) {
    const g = this.gearOf(slot);
    if (g) return gearPower(g);
    if (slot === 'weapon') return this.s.weapon ? ITEMS[this.s.weapon].weapon * 1.2 : 0;
    const id = this.s.equip[slot];
    return id ? gearPower({ st: ITEMS[id].eq }) : 0;
  }
  addGear(g) {
    this.s.gear.push(g);
    this.emit('gear', g);
    if (gearPower(g) > this.slotPower(g.slot)) this.equipGear(g.uid, true);
    while (this.s.gear.length > 40) { const i = this.s.gear.findIndex((x) => !Object.values(this.s.gearEq).includes(x.uid)); if (i < 0) break; this.add('stone', QUALITY[this.s.gear[i].q].salvage, true); this.s.gear.splice(i, 1); }
    this.emit('inv');
  }
  equipGear(uid, quiet) {
    const g = this.s.gear.find((x) => x.uid === uid);
    if (!g) return false;
    this.s.gearEq[g.slot] = uid;
    this.s.hp = Math.min(this.s.hp, this.maxHp);
    if (g.slot === 'weapon') this.emit('weapon'); else this.emit('equip');
    if (!quiet) this.emit('toast', `装备了 ${QUALITY[g.q].name}·${g.name}`);
    this.emit('inv');
    return true;
  }
  unequipGear(slot) { this.s.gearEq[slot] = null; if (slot === 'weapon') this.emit('weapon'); this.s.hp = Math.min(this.s.hp, this.maxHp); this.emit('inv'); }
  salvage(uid) {
    const i = this.s.gear.findIndex((x) => x.uid === uid);
    if (i < 0) return false;
    const g = this.s.gear[i];
    if (this.s.gearEq[g.slot] === uid) this.unequipGear(g.slot);
    this.s.gear.splice(i, 1);
    this.add('stone', QUALITY[g.q].salvage);
    return true;
  }
  get rootEl() { return this.s.root ? this.s.root.el : null; }
  get maxHp() { return Math.round((realmStats(this.s.realm).hp + this.s.bonusHp + this.eq('hp')) * (this.rootEl === 'earth' ? 1.1 : 1)); }
  get maxMp() { const b = realmStats(this.s.realm).mp; return b ? Math.round((b + this.eq('mp')) * (this.rootEl === 'water' ? 1.25 : 1)) : 0; }
  get atk() { return Math.round((realmStats(this.s.realm).atk + (this.s.weapon && !this.s.gearEq.weapon ? ITEMS[this.s.weapon].weapon : 0) + this.eq('atk')) * (this.rootEl === 'metal' ? 1.15 : 1) * (1 + this.eq('atkMul'))); }
  // 秘境中的临时增益
  buff(k) { return (this.run && this.run.buffs[k]) || 0; }
  get def() { return this.eq('def') + (this.rootEl === 'earth' ? 8 : 0) + Math.floor(this.s.realm * 0.8); }
  get xpMult() { return this.s.root ? ROOT_GRADES[this.s.root.g].xp : 1; }
  get qiMult() { return (this.rootEl === 'fire' ? 1.3 : this.rootEl === 'thunder' ? 1.2 : 1) * (1 + this.eq('qi')); }
  get regenMult() { return this.rootEl === 'wood' ? 1.6 : 1; }
  // 受到伤害时按防御减免
  mitigate(d) { return d * (60 / (60 + this.def)) * (1 - Math.min(0.6, this.eq('dr'))); }
  flag(f) { return !!this.s.flags[f]; }
  // 技能是否已习得
  hasSkill(k) {
    const r = this.s.realm;
    if (k === 'qi') return r >= R_QI;
    if (k === 'dash') return r >= 2;
    return this.flag('skill_' + k);
  }
  count(id) { return this.s.inv[id] || 0; }
  add(id, n = 1, quiet) {
    this.s.inv[id] = this.count(id) + n;
    const it = ITEMS[id];
    if (it.weapon && (!this.s.weapon || ITEMS[this.s.weapon].weapon < it.weapon)) { this.s.weapon = id; this.emit('weapon'); }
    if (it.slot && !this.s.equip[it.slot]) { this.s.equip[it.slot] = id; this.emit('equip'); }
    if (!quiet) this.emit('item', id, n);
    this.emit('inv');
  }
  take(id, n = 1) {
    if (this.count(id) < n) return false;
    this.s.inv[id] -= n; if (this.s.inv[id] <= 0) delete this.s.inv[id];
    for (const sl of ['armor', 'charm']) if (this.s.equip[sl] === id && !this.count(id)) this.s.equip[sl] = null;
    this.emit('inv');
    return true;
  }
  useItem(id) {
    const it = ITEMS[id], s = this.s;
    if (!this.count(id)) return false;
    if (it.weapon) { s.weapon = id; this.emit('weapon'); this.emit('toast', `装备了 ${it.name}`); this.emit('inv'); return true; }
    if (it.slot) { s.equip[it.slot] = id; s.hp = Math.min(s.hp, this.maxHp); this.emit('equip'); this.emit('toast', `佩戴了 ${it.name}`); this.emit('inv'); return true; }
    if (!it.use) { this.emit('toast', '此物无法直接使用'); return false; }
    if (it.use === 'passive') {
      if (this.flag('pas_' + id)) { this.emit('toast', '此功法早已参悟'); return false; }
      s.flags['pas_' + id] = 1; this._pas = null;
      this.take(id, 1);
      s.hp = Math.min(s.hp, this.maxHp);
      this.emit('passive', id);
      return true;
    }
    if (it.use === 'food') { if (s.hp >= this.maxHp) { this.emit('toast', '气血充盈，不必进食'); return false; } s.hp = Math.min(this.maxHp, s.hp + this.maxHp * 0.3); }
    else if (it.use === 'hp') { if (s.hp >= this.maxHp) { this.emit('toast', '气血充盈，无需服药'); return false; } s.hp = Math.min(this.maxHp, s.hp + this.maxHp * 0.6 * (this.rootEl === 'wood' ? 1.3 : 1)); }
    else if (it.use === 'mp') { if (!this.maxMp || s.mp >= this.maxMp) { this.emit('toast', '灵力充盈，无需服药'); return false; } s.mp = this.maxMp; }
    else if (it.use === 'xp') { if (s.xp >= this.realm.need) { this.emit('toast', '修为已圆满，先突破境界'); return false; } this.gainXp(120); }
    else if (it.use === 'maxhp') { s.bonusHp += 20; s.hp += 20; }
    else if (it.use === 'learn') {
      if (this.flag('skill_' + it.skill)) { this.emit('toast', '此功法早已参悟'); return false; }
      s.flags['skill_' + it.skill] = 1;
      this.take(id, 1);
      this.emit('learn', it.skill);
      return true;
    }
    this.take(id, 1);
    this.emit('used', id);
    return true;
  }
  gainXp(n, raw) {
    const s = this.s, need = this.realm.need;
    if (need === Infinity) return;
    const was = s.xp >= need;
    s.xp = Math.min(need, s.xp + n * (raw ? 1 : this.xpMult));
    if (!was && s.xp >= need) this.emit('full');
  }
  // 测灵根：随机五行与品阶（极小概率雷灵根）
  testRoot() {
    if (this.s.root) return this.s.root;
    const R = Math.random();
    const el = R < 0.04 ? 'thunder' : ['metal', 'wood', 'water', 'fire', 'earth'][(Math.random() * 5) | 0];
    let g = 0, p = Math.random(), acc = 0;
    for (let i = 0; i < ROOT_GRADES.length; i++) { acc += ROOT_GRADES[i].p; if (p < acc) { g = i; break; } }
    if (el === 'thunder') g = Math.min(g, 1);
    this.s.root = { el, g };
    this.s.flags.root = 1;
    this.emit('quest');
    return this.s.root;
  }
  rootName() { const r = this.s.root; return r ? `${ROOTS[r.el].name}·${ROOT_GRADES[r.g].name}` : '未测'; }
  canBreak() { return this.s.xp >= this.realm.need; }
  // 返回 'trib-small' / 'trib-big' 时由主循环接管天劫流程，结束后调用 completeBreak
  breakthrough(atTrib) {
    const s = this.s, r = this.realm;
    if (r.need === Infinity) return false;
    if (s.xp < r.need) { this.emit('toast', '修为尚未圆满'); return false; }
    if (r.gate && !this.count(r.gate)) { this.emit('toast', `突破此境需要 ${ITEMS[r.gate].name}`); return false; }
    if (r.trib === 'big' && !atTrib) { this.emit('toast', '金丹雷劫非同小可——须往青云峰顶的雷劫台方可渡劫'); return false; }
    if (r.trib) { this.emit('tribulation', r.trib); return 'trib'; }
    this.completeBreak();
    return true;
  }
  completeBreak() {
    const s = this.s, r = this.realm;
    if (r.gate) this.take(r.gate, 1);
    s.realm++; s.xp = 0; s.hp = this.maxHp; s.mp = this.maxMp;
    this.emit('break', s.realm);
    this.emit('quest');
  }

  // ---- 任务
  accept(id) {
    const q = QMAP[id];
    this.s.quests[id] = { s: 1, c: q.obj.map(() => 0) };
    if (q.ch && id !== 'intro') this.emit('chapter', q.ch);
    this.emit('quest');
  }
  objDone(q, st, i) {
    const o = q.obj[i];
    if (o.t === 'kill') return st.c[i] >= o.n;
    if (o.t === 'have') return this.count(o.item) >= o.n;
    if (o.t === 'realm') return this.s.realm >= o.n;
    if (o.t === 'chest') return !!this.s.chests[o.id];
    if (o.t === 'flag') return this.flag(o.flag);
    if (o.t === 'craft') return !!st.c[i] || this.flag('crafted_' + o.item) || this.count(o.item) > 0;
    return !!st.c[i];
  }
  objText(q, st, i) {
    const o = q.obj[i];
    if (o.t === 'kill') return `击败${MOBS[o.kind].name} ${Math.min(st.c[i], o.n)}/${o.n}`;
    if (o.t === 'have') return `${ITEMS[o.item].name} ${Math.min(this.count(o.item), o.n)}/${o.n}`;
    return o.text;
  }
  ready(q, st) { return q.obj.every((o, i) => (o.t === 'talk' && o.npc === q.turnIn) || this.objDone(q, st, i)); }
  active() { return QUESTS.filter((q) => this.s.quests[q.id] && this.s.quests[q.id].s === 1); }
  done(id) { return !!(this.s.quests[id] && this.s.quests[id].s === 2); }
  available(npc) {
    return QUESTS.filter((q) => !this.s.quests[q.id] && !q.auto && q.giver === npc && (q.pre || []).every((p) => this.done(p)) && this.s.realm >= (q.realm || 0));
  }
  npcMarker(npc) {
    for (const q of this.active()) if (q.turnIn === npc && this.ready(q, this.s.quests[q.id])) return '?';
    return this.available(npc).length ? '!' : '';
  }
  finish(q) {
    const st = this.s.quests[q.id], r = q.reward || {};
    if (q.take) q.obj.forEach((o) => { if (o.t === 'have') this.take(o.item, o.n); });
    st.s = 2;
    for (const f of r.flags || []) this.s.flags[f] = 1;
    for (const id in r.items || {}) this.add(id, r.items[id]);
    if (r.xp) this.gainXp(r.xp, true);
    this.emit('questDone', q);
    this.emit('quest');
  }
  onKill(kind) {
    this.s.kills++;
    this.emit('kill', kind);
    for (const q of this.active()) { const st = this.s.quests[q.id]; q.obj.forEach((o, i) => { if (o.t === 'kill' && o.kind === kind && st.c[i] < o.n) st.c[i]++; }); }
    this.emit('quest');
  }
  openChest(id) {
    if (this.s.chests[id]) return false;
    this.s.chests[id] = 1;
    const c = CHESTS[id];
    for (const k in c.items) this.add(k, c.items[k]);
    this.emit('quest');
    return true;
  }
  craft(i, forge) {
    const r = (forge ? FORGE : RECIPES)[i];
    for (const k in r.need) if (this.count(k) < r.need[k]) return false;
    for (const k in r.need) this.take(k, r.need[k]);
    this.s.flags['crafted_' + r.out] = 1;
    this.add(r.out, r.n);
    this.emit('quest');
    return true;
  }
  // 与 NPC 对话：推进任务并返回对话内容
  talk(npc) {
    const pages = [], N = NPCS[npc];
    let acted = false;
    for (const q of this.active()) {
      if (q.turnIn === npc && this.ready(q, this.s.quests[q.id])) { pages.push(q.done); this.finish(q); acted = true; break; }
    }
    const av = this.available(npc);
    if (av.length) { pages.push(av[0].offer); this.accept(av[0].id); this.emit('questNew', av[0]); acted = true; }
    if (!acted) {
      const q = this.active().find((x) => x.giver === npc || x.turnIn === npc);
      if (q && q.progress && q.giver === npc) pages.push(q.progress);
      else pages.push(N.idle[(Math.random() * N.idle.length) | 0]);
    }
    const choices = [];
    if (N.shop) {
      for (const [id, price] of SHOPS[N.shop]) choices.push({ label: `买 ${ITEMS[id].name}（${price} 灵石）`, fn: () => { if (this.take('stone', price)) { this.add(id, 1); return true; } this.emit('toast', '灵石不足'); return false; } });
      choices.push({ label: '出售妖兽材料', fn: () => {
        let sum = 0;
        for (const id in SELL) { const keep = id === 'fang' && !this.done('sword') ? 4 : id === 'core' ? 6 : 0; const n = Math.max(0, this.count(id) - keep); if (n) { this.take(id, n); sum += n * SELL[id]; } }
        if (sum) this.add('stone', sum); else this.emit('toast', '没有可出售的多余材料');
        return !!sum;
      } });
    }
    return { name: N.name, pages, choices };
  }
  // 当前任务目标位置（地图标记）
  questTarget() {
    const q = this.active()[0];
    if (!q) return null;
    const st = this.s.quests[q.id];
    for (let i = 0; i < q.obj.length; i++) {
      if (this.objDone(q, st, i)) continue;
      const o = q.obj[i];
      if (o.t === 'talk') return this.npcPos[o.npc];
      if (o.at) return this.locs[o.at] || null;
      if (o.t === 'kill') return this.locs[o.kind] || null;
      return null;
    }
    return this.npcPos[q.turnIn];
  }

  // ---- 存档
  save(pos) {
    if (pos) this.s.pos = pos;
    try { localStorage.setItem(KEY, JSON.stringify(this.s)); return true; } catch (e) { return false; }
  }
  static hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (!d || typeof d.realm !== 'number') return false;
      this.reset();
      Object.assign(this.s, d);
      this.s.equip = Object.assign({ armor: null, charm: null }, d.equip || {});
      this.s.portals = Object.assign({ village: 1 }, d.portals || {});
      this.s.gear = d.gear || []; this.s.gearEq = Object.assign({ weapon: null, armor: null, charm: null }, d.gearEq || {});
      for (const id in this.s.quests) if (!QMAP[id]) delete this.s.quests[id];
      for (const id in this.s.inv) if (!ITEMS[id]) delete this.s.inv[id];
      this._pas = null;
      this.emit('quest'); this.emit('inv'); this.emit('weapon');
      return true;
    } catch (e) { return false; }
  }
  static wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ } }
}
export { SKILLS };
