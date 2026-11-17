// 灵宝品质与随机词条、精英妖兽词缀
export const QUALITY = [
  { name: '凡品', color: '#e4e4e4', mul: 1, aff: 0, salvage: 6 },
  { name: '良品', color: '#6ee87a', mul: 1.22, aff: 1, salvage: 15 },
  { name: '上品', color: '#5aa8ff', mul: 1.5, aff: 2, salvage: 40 },
  { name: '极品', color: '#c27aff', mul: 1.85, aff: 3, salvage: 110 },
  { name: '仙品', color: '#ffa63a', mul: 2.35, aff: 4, salvage: 300 },
];
// 词条：k 为属性键，r 为（按境界缩放前的）取值范围，pct 表示百分比显示
export const GEAR_AFFIX = [
  { k: 'atk', name: '攻击', r: [3, 7], scale: true },
  { k: 'hp', name: '气血', r: [20, 45], scale: true },
  { k: 'def', name: '防御', r: [2, 5], scale: true },
  { k: 'mp', name: '灵力', r: [12, 30], scale: true },
  { k: 'crit', name: '会心', r: [0.03, 0.07], pct: true },
  { k: 'critDmg', name: '会心伤害', r: [0.12, 0.3], pct: true },
  { k: 'leech', name: '吸血', r: [0.02, 0.05], pct: true },
  { k: 'regen', name: '回灵', r: [0.15, 0.4], pct: true },
  { k: 'spd', name: '身法', r: [0.03, 0.08], pct: true },
  { k: 'qi', name: '剑气', r: [0.08, 0.2], pct: true },
];
const BASES = {
  weapon: { names: ['长剑', '灵剑', '古剑', '寒锋', '名剑'], icons: ['sword_iron', 'sword_jade', 'sword_fly', 'sword_chixiao'], models: ['iron', 'jade', 'fly', 'chixiao'] },
  armor: { names: ['法衣', '道袍', '宝甲', '羽衣', '战袍'], icons: ['robe_cloud', 'armor_turtle'] },
  charm: { names: ['玉佩', '葫芦', '铜铃', '念珠', '符箓'], icons: ['jade_pendant', 'fire_gourd'] },
};
const PREFIX = ['青', '玄', '赤', '紫', '流云', '寒霜', '惊雷', '太乙', '九幽', '昆仑', '星河', '落霞'];
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
// 品质抽取：bias 越大越容易出高品质；minQ 为保底
export function rollQuality(r, bias = 0, minQ = 0) {
  const w = [60, 26, 10, 3.4, 0.6].map((x, i) => x * Math.pow(1 + bias, i));
  let s = w.reduce((a, b) => a + b, 0) * r(), q = 0;
  for (; q < 4; q++) { s -= w[q]; if (s <= 0) break; }
  return Math.max(minQ, q);
}
// tier：0~10，大致随境界与区域增长
export function rollGear(tier, q, r = Math.random, slot) {
  slot = slot || pick(['weapon', 'weapon', 'armor', 'charm'], r);
  const B = BASES[slot], Q = QUALITY[q], t = 1 + tier * 0.55;
  const g = { uid: Date.now().toString(36) + Math.floor(r() * 1e6).toString(36), slot, q, tier, st: {} };
  if (slot === 'weapon') { g.st.atk = Math.round((6 + tier * 6) * Q.mul); g.model = B.models[Math.min(B.models.length - 1, Math.floor(tier / 2.5 + (q >= 3 ? 1 : 0)))]; }
  else if (slot === 'armor') { g.st.def = Math.round((3 + tier * 2.2) * Q.mul); g.st.hp = Math.round((25 + tier * 22) * Q.mul); }
  else { g.st.mp = Math.round((15 + tier * 9) * Q.mul); g.st.atk = Math.round((2 + tier * 1.6) * Q.mul); }
  const pool = GEAR_AFFIX.slice();
  for (let i = 0; i < Q.aff && pool.length; i++) {
    const a = pool.splice(Math.floor(r() * pool.length), 1)[0];
    let v = a.r[0] + (a.r[1] - a.r[0]) * r();
    v = a.scale ? Math.round(v * t) : Math.round(v * 1000) / 1000;
    g.st[a.k] = (g.st[a.k] || 0) + v;
  }
  g.icon = B.icons[Math.min(B.icons.length - 1, Math.floor(tier / 3))];
  g.name = (q >= 2 ? pick(PREFIX, r) : '') + pick(B.names, r);
  return g;
}
export function gearLines(g) {
  const L = [];
  for (const k in g.st) {
    const a = GEAR_AFFIX.find((x) => x.k === k), v = g.st[k];
    L.push(`${a ? a.name : k} +${a && a.pct ? Math.round(v * 100) + '%' : v}`);
  }
  return L;
}
export const SLOT_NAME = { weapon: '佩剑', armor: '法衣', charm: '法宝' };

// 精英词缀
export const ELITE_AFFIX = {
  berserk: { name: '狂暴', color: [1, 0.3, 0.15] },
  armored: { name: '坚甲', color: [0.75, 0.75, 0.85] },
  swift: { name: '迅捷', color: [0.4, 1, 0.6] },
  vampire: { name: '嗜血', color: [0.85, 0.05, 0.2] },
  volatile: { name: '爆裂', color: [1, 0.65, 0.1] },
  frost: { name: '寒霜', color: [0.5, 0.85, 1] },
};
export function rollElite(r, n) {
  const keys = Object.keys(ELITE_AFFIX), out = [];
  while (out.length < n) { const k = pick(keys, r); if (!out.includes(k)) out.push(k); }
  return out;
}
