// 地形高度函数、地表分类与植被分布
import { perlin2, fbm, ridged, smoothstep, lerp } from './noise.js';
import * as L from './layout.js';

const V = L.VOLCANO, VA = L.VALLEY;
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const RIM_H = V.peak * Math.pow(1 - V.rim / V.R, 1.7);

function baseHeight(x, z) {
  let h = 4.5 + fbm(x * 0.0035, z * 0.0035, 4, 11) * 13 + fbm(x * 0.021, z * 0.021, 3, 12) * 2.0;
  const d0 = Math.hypot(x, z);
  const dV = Math.hypot(x - V.x, z - V.z), dv = Math.hypot(x - VA.x, z - VA.z);
  const mm = smoothstep(0.0, 0.42, perlin2(x * 0.0011, z * 0.0011, 7)) * smoothstep(210, 480, d0) * smoothstep(V.R * 0.55, V.R * 1.2, dV) * smoothstep(60, 150, dv);
  if (mm > 0) {
    const r = ridged(x * 0.0042, z * 0.0042, 4, 13);
    h += mm * (r * r * 105 + 10);
  }
  const dq = Math.hypot(x - L.QINGYUN.x, z - L.QINGYUN.z);
  if (dq < 240) {
    const m = smoothstep(240, 30, dq);
    const r = ridged(x * 0.011, z * 0.011, 3, 14);
    h += Math.pow(m, 1.7) * (80 + r * 55);
  }
  // 赤焰火山：火山锥 + 放射状冲沟 + 火山口
  if (dV < V.R) {
    const t = 1 - dV / V.R, an = Math.atan2(z - V.z, x - V.x);
    let c = V.peak * Math.pow(t, 1.7) * (1 + 0.07 * perlin2(an * 6, dV * 0.02, 72) + 0.04 * perlin2(x * 0.03, z * 0.03, 73));
    c += 7 * Math.exp(-(((dV - V.rim) / 7) ** 2));
    if (dV < V.rim + 4) c = lerp(RIM_H - 30, c, smoothstep(V.rim - 13, V.rim + 4, dV));
    h += c;
  }
  // 万妖谷：环形峭壁，东北留出谷口
  if (dv < 300) {
    const ring = smoothstep(78, 132, dv) * smoothstep(300, 190, dv);
    if (ring > 0) {
      const gap = smoothstep(0.22, 0.62, Math.abs(angDiff(Math.atan2(z - VA.z, x - VA.x), VA.gap)));
      const r = ridged(x * 0.013, z * 0.013, 3, 15);
      h += ring * gap * (58 + r * r * 70);
    }
  }
  return h;
}
const zoneH = L.ZONES.map((zn) => (zn.h === null ? Math.round(baseHeight(zn.x, zn.z)) : zn.h));
export const RUINS_H = zoneH[2];
export const ARENA_H = zoneH[5];
export const TRIB_H = zoneH[6];

export function rawHeight(x, z) {
  let h = baseHeight(x, z);
  for (let i = 0; i < L.ZONES.length; i++) {
    const zn = L.ZONES[i];
    const dx = x - zn.x, dz = z - zn.z, d2 = dx * dx + dz * dz;
    if (d2 < zn.r1 * zn.r1) h = lerp(h, zoneH[i], smoothstep(zn.r1, zn.r0, Math.sqrt(d2)));
  }
  const rz = L.riverZ(x);
  if (Math.abs(z - rz) < 40) {
    const sl = (L.riverZ(x + 1) - L.riverZ(x - 1)) * 0.5;
    const dr = Math.abs(z - rz) / Math.sqrt(1 + sl * sl);
    if (dr < 16) h = Math.min(h, lerp(-2.6, h, smoothstep(3, 13 + perlin2(x * 0.05, z * 0.05, 61) * 1.5, dr)));
  }
  const pd = Math.hypot(x - L.POND.x, z - L.POND.z);
  if (pd < 14) h = Math.min(h, lerp(-1.7, h, smoothstep(4.5, L.POND.r + perlin2(x * 0.2, z * 0.2, 62) * 1.5, pd)));
  return h;
}
// 火山口岩浆湖液面
export const LAVA_Y = Math.round((rawHeight(V.x, V.z) + 1.6) * 10) / 10;

export function forestDensity(x, z) {
  const f = perlin2(x * 0.0055, z * 0.0055, 21) * 0.9 + perlin2(x * 0.021, z * 0.021, 22) * 0.3;
  return smoothstep(-0.2, 0.45, f);
}
const RB = L.ROADS.map((r) => [Math.min(r[0], r[2]) - r[4] - 2, Math.min(r[1], r[3]) - r[4] - 2, Math.max(r[0], r[2]) + r[4] + 2, Math.max(r[1], r[3]) + r[4] + 2]);
export function roadDist(x, z) {
  let best = 99;
  for (let i = 0; i < L.ROADS.length; i++) {
    const b = RB[i];
    if (x < b[0] || z < b[1] || x > b[2] || z > b[3]) continue;
    const r = L.ROADS[i], ax = r[0], az = r[1], bx = r[2] - ax, bz = r[3] - az;
    let t = ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const w = r[4] * (1 + 0.12 * perlin2(x * 0.06, z * 0.06, 63));
    const d = Math.hypot(x - ax - bx * t, z - az - bz * t) - w * 0.5;
    if (d < best) best = d;
  }
  return best;
}
function paveDist(x, z) {
  let best = 99;
  for (const p of L.PAVES) {
    const d = p.rect ? Math.max(p.rect[0] - x, x - p.rect[2], p.rect[1] - z, z - p.rect[3]) : Math.hypot(x - p.x, z - p.z) - p.r;
    if (d < best) best = d;
  }
  return best;
}
function farmDist(x, z) {
  let best = 99;
  for (const r of L.FARMS) { const d = Math.max(r[0] - x, x - r[2], r[1] - z, z - r[3]); if (d < best) best = d; }
  return best;
}
// 人工地表权重：out = [路, 石板, 农田]
export function splat(x, z, out) {
  out[0] = smoothstep(0.7, -0.5, roadDist(x, z));
  out[1] = smoothstep(0.6, -0.6, paveDist(x, z));
  out[2] = x * x + z * z < 150 * 150 ? smoothstep(0.5, -0.5, farmDist(x, z)) : 0;
  return out;
}
// 区域权重：out = [火山灰, 万妖谷]
export function zoneW(x, z, out) {
  const dV = Math.hypot(x - V.x, z - V.z);
  out[0] = dV < V.R ? smoothstep(0.1, 0.42, 1 - dV / V.R + perlin2(x * 0.02, z * 0.02, 71) * 0.08) : 0;
  out[1] = smoothstep(175, 100, Math.hypot(x - VA.x, z - VA.z));
  return out;
}
const zw = [0, 0];
// 草色变化：out = [r, g, b] 乘数
export function grassTint(x, z, h, out) {
  const a = perlin2(x * 0.031, z * 0.031, 41) * 0.5 + 0.5;
  const b = perlin2(x * 0.007, z * 0.007, 42) * 0.5 + 0.5;
  let tr = lerp(0.82, 1.05, a), tg = lerp(0.9, 1.05, a), tb = lerp(0.8, 1.0, a);
  const dry = smoothstep(0.55, 0.85, b) * 0.6 + smoothstep(30, 60, h) * 0.4;
  tr = lerp(tr, 1.45, dry); tg = lerp(tg, 1.12, dry); tb = lerp(tb, 0.75, dry);
  const f = forestDensity(x, z);
  out[0] = tr * (1 - f * 0.22); out[1] = tg * (1 - f * 0.14); out[2] = tb * (1 - f * 0.2);
  zoneW(x, z, zw);
  if (zw[1] > 0) { const k = zw[1]; out[0] *= 1 + 0.32 * k; out[1] *= 1 - 0.2 * k; out[2] *= 1 - 0.1 * k; }
  if (zw[0] > 0) { const k = zw[0]; out[0] = lerp(out[0], 1.0, k); out[1] = lerp(out[1], 0.72, k); out[2] = lerp(out[2], 0.5, k); }
  return out;
}

export const K = { GRASS: 0, SAND: 1, ROCK: 2, SNOW: 3, PATH: 4, PAVE: 5, FARM: 6, BED: 7, ASH: 8 };
const sp = [0, 0, 0];
// grad: 坡度（高差/米）
export function kindOf(x, z, h, grad) {
  if (h < L.WATER_SURF) return K.BED;
  splat(x, z, sp);
  if (sp[1] > 0.5) return K.PAVE;
  if (sp[2] > 0.5) return K.FARM;
  if (sp[0] > 0.5) return K.PATH;
  zoneW(x, z, zw);
  if (zw[0] > 0.5) return K.ASH;
  if (h <= 0.45) return K.SAND;
  const n = perlin2(x * 0.05, z * 0.05, 43);
  if (h > 76 + n * 5 && grad < 0.75) return K.SNOW;
  if (grad > 0.95 || (h > 52 + n * 8 && grad > 0.45)) return K.ROCK;
  return K.GRASS;
}

// 给定植被格，返回树种或 null
export function treeChoice(x, z, h, r, r2) {
  if (x * x + z * z < 76 * 76) return null;
  if (h < 0.6 || h > 80) return null;
  if (Math.hypot(x - L.TOWN.x, z - L.TOWN.z) < 82) return null;
  const dV = Math.hypot(x - V.x, z - V.z);
  if (dV < V.R * 0.82) return dV > V.R * 0.62 && r < 0.05 ? 'pine' : null;
  if (Math.hypot(x - L.ARENA.x, z - L.ARENA.z) < 30 || Math.hypot(x - L.TRIB.x, z - L.TRIB.z) < 22) return null;
  for (const p of L.PORTALS) if (Math.abs(x - p.x) < 7 && Math.abs(z - p.z) < 7) return null;
  const g = L.GROVES;
  const dp = Math.hypot(x - g.peach.x, z - g.peach.z);
  if (dp < g.peach.r) {
    if (dp < 17) return null;
    if (roadDist(x, z) < 2.5) return null;
    return r < 0.4 * smoothstep(g.peach.r, g.peach.r * 0.7, dp) ? 'peach' : null;
  }
  if (Math.hypot(x - L.RUINS.x, z - L.RUINS.z) < 19) return null;
  if (roadDist(x, z) < 2.5) return null;
  const db = Math.hypot(x - g.bamboo.x, z - g.bamboo.z);
  if (db < g.bamboo.r && r < 0.8 * smoothstep(g.bamboo.r, g.bamboo.r * 0.7, db)) return 'bamboo';
  // 万妖谷：血色枫林
  const dv = Math.hypot(x - VA.x, z - VA.z);
  if (dv < 150) {
    if (Math.hypot(x - L.LAIR.x, z - L.LAIR.z) < 24) return null;
    return r < 0.3 * smoothstep(150, 110, dv) + 0.02 ? (r2 < 0.82 ? 'maple' : 'pine') : null;
  }
  const f = forestDensity(x, z);
  if (r >= f * 0.42 + 0.012) return null;
  if (h > 42 + r2 * 8) return 'pine';
  const s = perlin2(x * 0.0045, z * 0.0045, 31);
  if (s > 0.28) return r2 < 0.85 ? 'maple' : 'ginkgo';
  if (s < -0.32) return r2 < 0.6 ? 'ginkgo' : r2 < 0.8 ? 'bamboo' : 'oak';
  return r2 < 0.8 ? 'oak' : r2 < 0.9 ? 'pine' : 'maple';
}
