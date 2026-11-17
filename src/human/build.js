// 人物网格装配：头（SDF 雕刻）、眼与眼睑、手（参数管）、衣身（SDF）、下摆与广袖（参数曲面）、裤靴、发型与饰物
// 所有部件合并为一个蒙皮几何体，靠 aPart 区分材质分区，颜色由材质 uniform 决定，因此同造型的角色可共享几何体。
import * as THREE from 'three';
import { GB } from '../geo.js';
import { smin, smax, ellipsoid, capsule, roundBox, superEllipse, surfaceNets, clamp01 } from './sdf.js';
import { rigSpec, HAND, handPoint, ARM_A, SKIRT_N } from './rig.js';

export const PART = { SKIN: 0, CLOTH: 1, PANTS: 2, BOOT: 3, HAIR: 4, EYE: 5, LID: 6, GOLD: 7, JADE: 8, INNER: 9, IRON: 10, STRAW: 11, DARK: 12, WOOD: 13 };
const FAR = 9, TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t, sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

class SkinGeo {
  constructor(spec) { this.spec = spec; this.P = []; this.N = []; this.SI = []; this.SW = []; this.PT = []; this.CL = []; this.UV = []; this.I = []; this.n = 0; }
  // m: { P, N, I }（类型化或普通数组）；wfn(x,y,z) -> [[骨骼序号, 权重], ...]；cfn -> [trim, u, sash, inner]
  add(m, part, wfn, cfn, uvfn, flip = false) {
    const base = this.n, nv = m.P.length / 3;
    for (let v = 0; v < nv; v++) {
      const x = m.P[v * 3], y = m.P[v * 3 + 1], z = m.P[v * 3 + 2];
      this.P.push(x, y, z); this.N.push(m.N[v * 3] * (flip ? -1 : 1), m.N[v * 3 + 1] * (flip ? -1 : 1), m.N[v * 3 + 2] * (flip ? -1 : 1));
      const w = normW(wfn(x, y, z, v));
      for (let k = 0; k < 4; k++) { this.SI.push(w[k] ? w[k][0] : 0); this.SW.push(w[k] ? w[k][1] : 0); }
      this.PT.push(typeof part === 'function' ? part(x, y, z, v) : part);
      const c = cfn ? cfn(x, y, z, v) : null;
      this.CL.push(c ? c[0] : FAR, c ? c[1] : 0, c ? c[2] : FAR, c ? c[3] : FAR);
      const t = uvfn ? uvfn(v) : null;
      this.UV.push(t ? t[0] : 0, t ? t[1] : 0);
    }
    for (let i = 0; i < m.I.length; i += 3) {
      if (flip) this.I.push(base + m.I[i], base + m.I[i + 2], base + m.I[i + 1]);
      else this.I.push(base + m.I[i], base + m.I[i + 1], base + m.I[i + 2]);
    }
    this.n += nv;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.PT, 1));
    g.setAttribute('aCloth', new THREE.Float32BufferAttribute(this.CL, 4));
    g.setIndex(this.I.length > 65535 * 3 || this.n > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.2, -0.6, -1.2), new THREE.Vector3(1.2, 2.4, 1.2));
    return g;
  }
}
function normW(ws) {
  ws.sort((a, b) => b[1] - a[1]);
  const top = ws.slice(0, 4);
  let s = 0; for (const w of top) s += w[1];
  if (s <= 0) return [[top.length ? top[0][0] : 0, 1]];
  for (const w of top) w[1] /= s;
  return top;
}
const fromGB = (gb) => ({ P: gb.P, N: gb.N, I: gb.I });

// ---- 权重
function segDist(x, y, z, a, b) {
  const px = x - a[0], py = y - a[1], pz = z - a[2], bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const L2 = bx * bx + by * by + bz * bz, h = L2 > 0 ? clamp01((px * bx + py * by + pz * bz) / L2) : 0;
  return Math.hypot(px - bx * h, py - by * h, pz - bz * h);
}
// cands: [[骨名, 影响半径], ...]
function wGen(spec, cands) {
  const L = cands.map(([n, R]) => { const b = spec.map.get(n); if (!b) throw new Error('bone ' + n); return [b, R]; });
  return (x, y, z) => L.map(([b, R]) => { const d = segDist(x, y, z, b.p, b.tail) / R; const d2 = d * d; return [b.i, 1 / (d2 * d2 + 1e-3)]; });
}
const wRigid = (spec, n) => { const i = spec.map.get(n).i; return () => [[i, 1]]; };
// 沿链的参数 s（0 起点，按段数计）分配到链上骨骼
function chainW(spec, pre, nSeg, s, root, rootW = 0) {
  const out = [];
  const j = Math.min(nSeg - 1, Math.max(0, Math.floor(s))), f = Math.min(1, Math.max(0, s - j));
  const bi = (k) => spec.map.get(pre + k).i;
  if (f > 0.5 && j < nSeg - 1) { out.push([bi(j), 1.5 - f], [bi(j + 1), f - 0.5]); }
  else if (f < 0.5 && j > 0) { out.push([bi(j - 1), 0.5 - f], [bi(j), 0.5 + f]); }
  else out.push([bi(j), 1]);
  if (rootW > 0 && root) { for (const o of out) o[1] *= 1 - rootW; out.push([spec.map.get(root).i, rootW]); }
  return out;
}

// ---- 头部 SDF（头部坐标：原点为头心）
function headLocal(F) {
  const hw = F.hw || 1, inner = headLocal0(F);
  return (x, y, z) => inner(x / hw, y, z) * Math.min(1, hw);
}
function headLocal0(F) {
  const jw = F.jaw, bro = F.brow, ns = F.nose, lip = F.lip, ck = F.cheek;
  return (x, y, z) => {
    const ax = Math.abs(x);
    let d = ellipsoid(x, y - 0.02, z + 0.012, 0.074, 0.088, 0.093);
    d = smin(d, ellipsoid(x, y + 0.026, z - 0.028, 0.061 * jw, 0.074, 0.066), 0.03);
    d = smin(d, capsule(ax, y, z, 0.044 * jw, -0.042, 0.01, 0.0, -0.077, 0.06, 0.022, 0.017 * F.chin), 0.022);
    d = smin(d, ellipsoid(x, y + 0.081, z - 0.068, 0.019 * F.chin, 0.016, 0.016), 0.017);
    d = smin(d, ellipsoid(ax - 0.043, y + 0.004, z - 0.058, 0.02 * ck, 0.014 * ck, 0.019), 0.02);
    d = smin(d, capsule(ax, y, z, 0.0, 0.031, 0.082, 0.043, 0.03, 0.073, 0.0105 * bro, 0.008 * bro), 0.02);
    d = smax(d, -ellipsoid(ax - 0.031, y - 0.012 - (ax - 0.031) * F.tilt, z - 0.084, 0.0162, 0.0082, 0.0125), 0.0045);
    // 上下眼睑的厚度
    { const ex = ax - 0.031, ey = y - 0.012 - 0.0004 - ex * F.tilt;
      const er = Math.sqrt(sqr(ex / 0.0162) + sqr(ey / 0.0082)), e2 = (er - 1) * 0.0082;
      const zr = 0.0812 - ex * ex * 14 - (ey < 0 ? 0.001 : 0);
      const th = ey > 0 ? 0.0024 * F.lid : 0.0015;
      d = smin(d, Math.hypot(e2, z - zr) - th, 0.0022); }
    d = smin(d, capsule(x, y, z, 0, 0.024, 0.087, 0, -0.016 * ns, 0.087 + 0.018 * ns, 0.0062 * ns, 0.0088 * ns), 0.008);
    d = smin(d, ellipsoid(x, y + 0.02 * ns, z - (0.085 + 0.018 * ns), 0.0105 * ns, 0.0095 * ns, 0.0095 * ns), 0.006);
    d = smin(d, ellipsoid(ax - 0.0102 * ns, y + 0.025 * ns, z - (0.08 + 0.016 * ns), 0.0074 * ns, 0.0064 * ns, 0.007), 0.004);
    d = smax(d, -ellipsoid(ax - 0.006 * ns, y + 0.0298 * ns, z - (0.082 + 0.017 * ns), 0.0027, 0.0017, 0.003), 0.0018);
    d = smin(d, ellipsoid(x, y + 0.0435, z - 0.0848, 0.0158 * lip, 0.0046 * lip, 0.006), 0.008);
    d = smin(d, ellipsoid(x, y + 0.0536, z - 0.0835, 0.0142 * lip, 0.0054 * lip, 0.0062), 0.008);
    d = smax(d, -capsule(x, y, z, -0.018 * lip, -0.0487, 0.095, 0.018 * lip, -0.0487, 0.095, 0.001), 0.0012);
    d = smin(d, ellipsoid(ax - 0.0735, y, z + 0.008, 0.0085, 0.027, 0.016), 0.006);
    d = smax(d, -ellipsoid(ax - 0.079, y - 0.002, z + 0.006, 0.0038, 0.017, 0.009), 0.003);
    d = smin(d, capsule(x, y, z, 0, -0.05, -0.022, 0, -0.205, -0.016, 0.052 * F.neck, 0.06 * F.neck), 0.032);
    return d;
  };
}
export function faceParams(look) {
  const f = look.sex === 'f', child = look.age === 'child', old = look.age === 'old';
  return {
    hw: f ? 1.035 : child ? 1.04 : 1, lid: f ? 1.15 : 1, tilt: f ? 0.12 : 0.05,
    jaw: f ? 0.94 : child ? 0.92 : 1.04, brow: f ? 0.55 : child ? 0.4 : 1.1, nose: f ? 0.88 : child ? 0.75 : old ? 1.08 : 1, lip: f ? 0.97 : 0.95,
    cheek: child ? 1.35 : f ? 1.05 : 1, chin: f ? 0.85 : 1, neck: f ? 0.84 : child ? 0.8 : 1.05, hs: f ? 0.96 : child ? 1.16 : 1,
  };
}

// ---- 衣身轮廓表：y -> [半宽, 半深, z 中心]
function torsoProfile(kind, W, female) {
  const T = female
    ? [[0.9, 0.17, 0.125, 0], [1.02, 0.135, 0.105, 0], [1.13, 0.128, 0.1, 0.004], [1.22, 0.142, 0.106, 0.008], [1.32, 0.15, 0.104, 0.002], [1.42, 0.14, 0.09, -0.012]]
    : [[0.9, 0.165, 0.122, 0], [1.02, 0.155, 0.115, 0.004], [1.14, 0.158, 0.118, 0.008], [1.26, 0.17 * W, 0.122, 0.01], [1.35, 0.178 * W, 0.116, 0.002], [1.42, 0.17 * W, 0.1, -0.012]];
  const k = kind === 'stout' ? 1.18 : 1;
  return (y) => {
    if (y <= T[0][0]) return T[0];
    for (let i = 1; i < T.length; i++) if (y <= T[i][0]) {
      const a = T[i - 1], b = T[i], t = sstep(a[0], b[0], y);
      const belly = kind === 'stout' ? Math.exp(-sqr((y - 1.1) / 0.12)) * 0.05 : 0;
      return [y, lerp(a[1], b[1], t) * (k > 1 ? 1.06 : 1) + belly * 0.5, lerp(a[2], b[2], t) * k + belly, lerp(a[3], b[3], t) + belly * 0.6];
    }
    return T[T.length - 1];
  };
}
const sqr = (x) => x * x;

// 交领线（右衽：左襟压右襟，领缘自左颈斜向右腋下）：返回点到领缘中心线的有符号水平距离
function lapel(x, y) {
  // 中心线：(0.055, 1.46) -> (-0.12, 1.1)
  const ax = 0.052, ay = 1.47, bx = -0.125, by = 1.12;
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  return ((x - ax) * dy - (y - ay) * dx) / L; // >0 在领缘左上（内衬一侧）
}

function torsoSDF(o, spec) {
  const W = spec.W, f = spec.female, prof = torsoProfile(o.build, W, f);
  const beltY = f ? 1.2 : 1.03, beltH = f ? 0.038 : 0.044;
  const pb = prof(beltY);
  const armor = o.outfit === 'armor';
  return (x, y, z) => {
    const ax = Math.abs(x), p = prof(y);
    let d = superEllipse(x, z - p[3], p[1], p[2], 2.5);
    d = smax(d, y - 1.43, 0.03);
    d = smax(d, 0.86 - y, 0.01);
    d = smin(d, capsule(ax, y, z, 0.035, 1.445, -0.014, 0.19 * W, 1.41, -0.016, 0.066, 0.06), 0.055);
    d = smin(d, capsule(ax, y, z, 0.03, 1.49, -0.03, 0.14 * W, 1.43, -0.025, 0.045, 0.04), 0.04);
    if (d > 0.05) return d;
    if (f) d = smin(d, ellipsoid(ax - 0.062, y - 1.29, z - 0.06, 0.064, 0.06, 0.05), 0.05);
    else d = smin(d, ellipsoid(ax - 0.07, y - 1.3, z - 0.085, 0.075, 0.06, 0.035), 0.04);
    // 领口与领缘
    d = smax(d, -capsule(x, y, z, 0, 1.4, -0.016, 0, 1.62, -0.012, 0.05, 0.05), 0.012);
    const nr = capsule(x, y, z, 0, 1.43, -0.016, 0, 1.515, -0.02, 0.07, 0.064);
    d = smin(d, smax(nr, -capsule(x, y, z, 0, 1.4, -0.016, 0, 1.62, -0.012, 0.05, 0.05), 0.004), 0.012);
    const lp = lapel(x, y);
    if (z > 0) d = smin(d, Math.hypot(lp, Math.max(0, superEllipse(x, z - p[3], p[1], p[2], 2.5))) - 0.0062, 0.005);
    // 腰带
    const bd = smax(superEllipse(x, z - pb[3], pb[1] + 0.013, pb[2] + 0.013, 2.5), Math.abs(y - beltY) - beltH, 0.006);
    d = smin(d, bd, 0.004);
    if (armor) {
      // 护心镜与胸甲
      const pc = prof(1.27);
      d = smin(d, smax(superEllipse(x, z - pc[3], pc[1] + 0.014, pc[2] + 0.02, 2.8), Math.abs(y - 1.26) - 0.12, 0.02), 0.01);
      d = smin(d, ellipsoid(x, y - 1.27, z - (pc[2] + pc[3] + 0.012), 0.05, 0.05, 0.014), 0.006);
    }
    // 衣褶
    d -= 0.0018 * Math.sin(Math.atan2(x, z) * 11 + y * 9) * sstep(1.12, 0.95, y);
    return d;
  };
}
function torsoLabel(o, spec) {
  const f = spec.female, beltY = f ? 1.2 : 1.03, beltH = f ? 0.04 : 0.046, prof = torsoProfile(o.build, spec.W, f);
  return (x, y, z) => {
    const p = prof(y);
    const lp = lapel(x, y);
    const front = z > p[3] + p[2] * 0.3;
    let trim = FAR, inner = FAR, sash = FAR;
    if (front) trim = Math.abs(lp);
    trim = Math.min(trim, Math.abs(Math.hypot(x, z + 0.016) - 0.06) + Math.max(0, 1.44 - y) * 3);
    if (front && y > 1.28) inner = Math.max(0.006 - lp, lp - 0.034);
    const by = Math.abs(y - beltY);
    sash = by - beltH;
    if (o.outfit === 'armor' && Math.abs(y - 1.26) < 0.12 && z > p[3]) sash = -2;
    return [trim, y * 3 + x, sash, inner];
  };
}

// ---- 下摆（参数曲面）
function skirtMesh(o, spec, outer) {
  const f = spec.female, Hp = spec.Hp;
  const yTop = f ? 1.2 : 0.99, yHem = o.outfit === 'tunic' || o.outfit === 'armor' ? 0.5 : o.age === 'child' ? 0.32 : f ? 0.04 : 0.1;
  const flare = o.outfit === 'daopao' ? 1.22 : f ? 1.25 : 1;
  const prof = torsoProfile(o.build, spec.W, f), pt = prof(yTop);
  const NU = 56, NV = 22, gb = new GB();
  const seam = -0.42;
  const fn = (u, v, p) => {
    const a = u * TAU, y = lerp(yTop, yHem, v), s = Math.pow(v, 1.15);
    let rx = lerp(pt[1] + 0.006, (0.235 + (f ? 0.02 : 0)) * Hp * flare, s), rz = lerp(pt[2] + 0.006, 0.19 * flare, s);
    if (o.outfit === 'tunic' || o.outfit === 'armor') { rx = lerp(pt[1] + 0.006, 0.2 * Hp, s); rz = lerp(pt[2] + 0.006, 0.16, s); }
    const fold = (0.5 + 0.5 * Math.sin(a * 9 + 1.3 * Math.sin(a * 3) + v * 2)) * 0.014 * s + 0.004 * Math.sin(a * 23) * s;
    let ds = angDiff(a, seam);
    const lap = ds > 0 && ds < 0.9 ? 0.005 : 0;
    const r = 1 + (fold + lap) / Math.max(rx, rz) - (outer ? 0 : 0.03);
    p[0] = Math.sin(a) * rx * r; p[1] = y - (outer ? 0 : 0.004); p[2] = Math.cos(a) * rz * r + pt[3] * (1 - v); p[3] = u; p[4] = v;
  };
  gb.surf(NU, NV, fn, outer, true);
  return { gb, yTop, yHem, seam };
}
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// ---- 广袖（参数曲面，沿手臂）
function sleeveMesh(o, spec, s, outer) {
  const S = s > 0 ? 'L' : 'R', arm = spec.map.get('arm' + S), fore = spec.map.get('fore' + S), hand = spec.map.get('hand' + S);
  const A = new THREE.Vector3(...arm.p), E = new THREE.Vector3(...fore.p), Wr = new THREE.Vector3(...hand.p);
  const dir = new THREE.Vector3().subVectors(Wr, E).normalize();
  const wide = o.outfit === 'robe' || o.outfit === 'dress' || o.outfit === 'daopao';
  const endT = wide ? 0.07 : 0.0, bagMax = wide ? (o.outfit === 'daopao' ? 0.2 : o.outfit === 'dress' ? 0.2 : 0.16) : 0;
  const L1 = A.distanceTo(E), L2 = E.distanceTo(Wr) + endT;
  const down = new THREE.Vector3(0, -1, 0), b1 = down.clone().addScaledVector(dir, -down.dot(dir)).normalize(), b2 = new THREE.Vector3().crossVectors(dir, b1).normalize();
  const NU = 26, NV = 24, gb = new GB(), meta = [];
  const start = A.clone().addScaledVector(new THREE.Vector3().subVectors(E, A).normalize(), -0.045);
  const c = new THREE.Vector3(), ax = new THREE.Vector3();
  const fn = (u, v, p) => {
    const t = v, ph = u * TAU;
    const len = L1 + 0.045 + L2, at = t * len;
    let r, bag = 0, tf = 0;
    if (at < L1 + 0.045) { const k = at / (L1 + 0.045); c.lerpVectors(start, E, k); ax.subVectors(E, start).normalize(); r = lerp(0.07, 0.074, k); }
    else { tf = (at - L1 - 0.045) / L2; c.copy(E).addScaledVector(dir, tf * L2); ax.copy(dir); r = wide ? lerp(0.074, 0.12, Math.pow(tf, 1.2)) : lerp(0.07, 0.052, tf); bag = bagMax * sstep(0.0, 1.0, tf) * (1 - 0.25 * sstep(0.85, 1, tf)); }
    // 截面：沿下垂方向拉长并下移，形成袖袋
    const cb = Math.cos(ph), sb = Math.sin(ph);
    const fold = 1 + 0.05 * Math.sin(ph * 6 + t * 9) * t + 0.02 * Math.sin(ph * 13) * t;
    const ry = (r + bag * 0.5) * fold, rx = r * fold * (wide ? 1.05 : 1);
    const inset = outer ? 0 : -0.007;
    const bx = b1.x, by = b1.y, bz = b1.z;
    const k1 = cb * (ry + inset) + bag * 0.5, k2 = sb * (rx + inset);
    p[0] = c.x + bx * k1 + b2.x * k2; p[1] = c.y + by * k1 + b2.y * k2; p[2] = c.z + bz * k1 + b2.z * k2;
    p[3] = u; p[4] = v;
  };
  // 只生成一次网格，同时记录每个顶点的 (t, 截面角, 袖袋量)
  gb.surf(NU, NV, fn, !outer ^ (s < 0), true);
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const t = j / NV, ph = (i / NU) * TAU, len = L1 + 0.045 + L2, at = t * len;
    const tf = at < L1 + 0.045 ? 0 : (at - L1 - 0.045) / L2;
    meta.push([t, ph, bagMax > 0 ? sstep(0.0, 1.0, tf) : 0, (1 - t) * len]);
  }
  return { gb, meta, wide, len: L1 + 0.045 + L2, NU, NV };
}

// ---- 手（掌用 SDF，指用圆管）
function handMesh(s) {
  const gb = new GB(), hp = HAND.palm;
  const palm = surfaceNets((x, y, z) => {
    const ty = clamp01((-y - 0.01) / 0.09);
    let d = roundBox(x - hp.c[0], y - hp.c[1], z - hp.c[2] + 0.002, hp.h[0] * (0.95 + 0.1 * ty), hp.h[1], hp.h[2] * (0.8 + 0.2 * ty), 0.011);
    d = smin(d, roundBox(x, y - 0.012, z, 0.016, 0.03, 0.024, 0.014), 0.012);
    d = smin(d, ellipsoid(x + 0.003, y + 0.03, z - 0.028, 0.012, 0.022, 0.012), 0.01);
    return d;
  }, [-0.03, -0.11, -0.055, 0.03, 0.05, 0.06], 0.005);
  const out = [{ m: palm, fg: null }];
  for (const fg of HAND.fingers) {
    const t = new GB();
    const b = fg.b, L = fg.len;
    t.tube([[b[0], b[1] + 0.006, b[2], fg.r0 * 1.05], [b[0], b[1] - L * 0.45, b[2], fg.r0 * 0.98], [b[0], b[1] - L * 0.75, b[2], (fg.r0 + fg.r1) / 2], [b[0], b[1] - L + fg.r1, b[2], fg.r1]], 7);
    t.sphere(b[0], b[1] - L + fg.r1, b[2], fg.r1, fg.r1 * 1.05, fg.r1, 7, 4);
    t.sphere(b[0] + 0.001, b[1] - L * 0.45, b[2], fg.r0, fg.r0 * 0.9, fg.r0, 7, 4);
    out.push({ m: fromGB(t), fg: fg.n });
  }
  const T = HAND.thumb, t = new GB();
  t.tube([[T.b[0], T.b[1], T.b[2], T.r0 * 1.1], [T.m[0], T.m[1], T.m[2], (T.r0 + T.r1) / 2], [T.t[0], T.t[1], T.t[2], T.r1]], 7);
  t.sphere(T.t[0], T.t[1], T.t[2], T.r1, T.r1, T.r1, 7, 4);
  out.push({ m: fromGB(t), fg: 'thb' });
  // 标准坐标 -> 模型坐标
  return out.map(({ m, fg }) => {
    const P = new Float32Array(m.P.length), N = new Float32Array(m.N.length), a = s * ARM_A, ca = Math.cos(a), sa = Math.sin(a);
    for (let v = 0; v < m.P.length; v += 3) {
      const x = m.P[v] * s, y = m.P[v + 1];
      P[v] = x * ca - y * sa; P[v + 1] = x * sa + y * ca; P[v + 2] = m.P[v + 2];
      const nx = m.N[v] * s, ny = m.N[v + 1];
      N[v] = nx * ca - ny * sa; N[v + 1] = nx * sa + ny * ca; N[v + 2] = m.N[v + 2];
    }
    const I = Array.from(m.I);
    if (s < 0) for (let i = 0; i < I.length; i += 3) { const k = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = k; }
    return { m: { P, N, I }, fg };
  });
}
function offsetMesh(m, o) { const P = new Float32Array(m.P.length); for (let i = 0; i < P.length; i += 3) { P[i] = m.P[i] + o[0]; P[i + 1] = m.P[i + 1] + o[1]; P[i + 2] = m.P[i + 2] + o[2]; } return { P, N: m.N, I: m.I }; }

// ---- 发丝面片：沿折线的弯曲条带
function hairStrip(pts, widths, curl = 0.35, nAcross = 4) {
  const gb = new GB(), n = pts.length, nv = n - 1;
  const P = [], N = [], I = [], UV = [];
  for (let j = 0; j < n; j++) {
    const p = pts[j], q = pts[Math.min(n - 1, j + 1)], r = pts[Math.max(0, j - 1)];
    const t = new THREE.Vector3(q[0] - r[0], q[1] - r[1], q[2] - r[2]).normalize();
    const side = new THREE.Vector3(...(p[3] || [1, 0, 0])).normalize();
    const nrm = new THREE.Vector3().crossVectors(side, t).normalize();
    side.crossVectors(t, nrm).normalize();
    for (let i = 0; i <= nAcross; i++) {
      const a = i / nAcross - 0.5, w = widths[j];
      const off = -Math.abs(a * 2) * Math.abs(a * 2) * curl * w * 0.5;
      P.push(p[0] + side.x * a * w + nrm.x * off, p[1] + side.y * a * w + nrm.y * off, p[2] + side.z * a * w + nrm.z * off);
      N.push(nrm.x, nrm.y, nrm.z);
      UV.push(i / nAcross, j / nv);
    }
  }
  const r = nAcross + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nAcross; i++) { const a = j * r + i; I.push(a, a + 1, a + r + 1, a, a + r + 1, a + r); }
  void gb;
  return { P, N, I, UV };
}

// ---- 缓存
const cache = new Map();
export function shapeKey(look) {
  return [look.sex || 'm', look.age || 'adult', look.outfit || 'robe', look.hair || 'bun', look.beard || '', look.hat ? 1 : 0, look.build || '', look.crown || '', look.acc || ''].join('|');
}
export function buildShape(look) {
  const key = shapeKey(look);
  if (cache.has(key)) return cache.get(key);
  const F = faceParams(look), spec = rigSpec({ sex: look.sex, hs: F.hs });
  const sg = new SkinGeo(spec), hg = new SkinGeo(spec);
  const o = { outfit: look.outfit || 'robe', build: look.build, age: look.age };
  const HC = spec.HC, hs = F.hs;
  // 头
  const hl = headLocal(F);
  const headSdf = (x, y, z) => hl((x - HC[0]) / hs, (y - HC[1]) / hs, (z - HC[2]) / hs) * hs;
  const head = surfaceNets(headSdf, [-0.105 * hs, HC[1] - 0.205 * hs, -0.115 * hs, 0.105 * hs, HC[1] + 0.12 * hs, 0.13 * hs], 0.0045 * hs);
  sg.add(head, PART.SKIN, wGen(spec, [['chest', 0.05], ['neck', 0.05], ['head', 0.1]]));
  // 眼与眼睑
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', ec = spec.map.get('eye' + S).p;
    const eg = new THREE.SphereGeometry(0.0125 * hs, 22, 16);
    eg.translate(ec[0], ec[1], ec[2]);
    sg.add({ P: eg.attributes.position.array, N: eg.attributes.normal.array, I: Array.from(eg.index.array) }, PART.EYE, wRigid(spec, 'eye' + S));
    // 上眼睑：闭合时覆盖眼球前上方，睁眼靠骨骼旋转
    const lid = new GB(), R = 0.0134 * hs, edge = -0.2;
    lid.surf(14, 8, (u, v, p) => {
      const al = (u - 0.5) * 2.6, be = lerp(1.45, edge, v);
      p[0] = ec[0] + Math.cos(be) * Math.sin(al) * R; p[1] = ec[1] + Math.sin(be) * R; p[2] = ec[2] + Math.cos(be) * Math.cos(al) * R; p[3] = u; p[4] = v;
    }, false);
    const lm = fromGB(lid);
    sg.add(lm, PART.LID, wRigid(spec, 'lid' + S), (x, y, z) => { const be = Math.asin(Math.max(-1, Math.min(1, (y - ec[1]) / R))); return [(be - edge) * R, 0, FAR, FAR]; });
  }
  // 手
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', hand = spec.map.get('hand' + S).p;
    for (const { m, fg } of handMesh(s)) {
      const mm = offsetMesh(m, hand);
      const c = fg ? [[fg + S + '0', 0.012], [fg + S + '1', 0.01], ['hand' + S, 0.02]] : [['hand' + S, 0.05], ['fore' + S, 0.025], ['thb' + S + '0', 0.012]];
      sg.add(mm, PART.SKIN, wGen(spec, c));
    }
  }
  // 衣身
  const tsdf = torsoSDF(o, spec), tl = torsoLabel(o, spec);
  const torso = surfaceNets(tsdf, [-0.29, 0.86, -0.19, 0.29, 1.56, 0.22], 0.0125);
  const tw = wGen(spec, [['hips', 0.12], ['spine', 0.16], ['chest', 0.2], ['neck', 0.05], ['clavL', 0.06], ['clavR', 0.06], ['armL', 0.045], ['armR', 0.045]]);
  sg.add(torso, (x, y, z) => { const c = tl(x, y, z); return c[2] === -2 ? PART.IRON : PART.CLOTH; }, tw, tl);
  // 下摆
  const skW = (spec) => (x, y, z, v, meta) => meta;
  void skW;
  for (const outer of [true, false]) {
    const sk = skirtMesh(o, spec, outer), m = fromGB(sk.gb), NU = 56;
    const hipI = spec.map.get('hips').i;
    sg.add(m, PART.CLOTH, (x, y, z, v) => {
      const i = v % (NU + 1), j = Math.floor(v / (NU + 1)), u = i / NU, vv = j / 22;
      const a = u * SKIRT_N, k0 = Math.floor(a) % SKIRT_N, k1 = (k0 + 1) % SKIRT_N, fa = a - Math.floor(a);
      const sChain = Math.max(0, (0.9 - y) / 0.27);
      const top = sstep(0.86, 0.98, y) + (spec.female ? sstep(1.0, 1.15, y) : 0);
      const ws = [];
      for (const [k, wk] of [[k0, 1 - fa], [k1, fa]]) for (const [b, w] of chainW(spec, 'sk' + k + '_', 3, sChain)) ws.push([b, w * wk * (1 - Math.min(1, top))]);
      if (top > 0) ws.push([hipI, Math.min(1, top)]);
      if (spec.female && y > 1.05) ws.push([spec.map.get('spine').i, sstep(1.05, 1.2, y)]);
      void vv;
      return mergeW(ws);
    }, (x, y, z, v) => {
      const i = v % (NU + 1), j = Math.floor(v / (NU + 1)), u = i / NU, a = u * TAU, vv = j / 22;
      const r = Math.hypot(x, z), hem = (1 - vv) * (sk.yTop - sk.yHem);
      const sd = Math.abs(angDiff(a, sk.seam)) * r;
      return [Math.min(hem - 0.008, sd), a * r + y, FAR, outer ? FAR : -1];
    }, null, false);
  }
  // 袖
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R';
    const gw = wGen(spec, [['chest', 0.09], ['clav' + S, 0.05], ['arm' + S, 0.07], ['fore' + S, 0.07], ['hand' + S, 0.03]]);
    for (const outer of [true, false]) {
      const sl = sleeveMesh(o, spec, s, outer);
      if (!outer && !sl.wide) continue;
      const m = fromGB(sl.gb);
      if (!outer) { // 内层只保留袖口一段
        const keep = []; for (let t = 0; t < m.I.length; t += 3) { const mt = sl.meta[m.I[t]]; if (mt[0] > 0.72) keep.push(m.I[t], m.I[t + 1], m.I[t + 2]); }
        m.I = keep;
      }
      const s0 = spec.map.get('slv' + S + '0').i, s1 = spec.map.get('slv' + S + '1').i;
      sg.add(m, PART.CLOTH, (x, y, z, v) => {
        const [t, ph, bag] = sl.meta[v];
        const below = Math.max(0, Math.cos(ph));
        const bw = bag * Math.pow(below, 1.4) * 0.95;
        const ws = gw(x, y, z).map(([b, w]) => [b, w]);
        let sum = 0; for (const w of ws) sum += w[1];
        for (const w of ws) w[1] = (w[1] / sum) * (1 - bw);
        if (bw > 0) { const deep = below * bag; ws.push([s0, bw * (1 - deep * 0.7)], [s1, bw * deep * 0.7]); }
        void t;
        return ws;
      }, (x, y, z, v) => { const mt = sl.meta[v]; return [mt[3] - 0.018, mt[1] * 0.1 + mt[0], FAR, outer ? FAR : -1]; }, null, false);
    }
  }
  // 腿：裤与靴
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', th = spec.map.get('thigh' + S), sh = spec.map.get('shin' + S), ft = spec.map.get('foot' + S), to = spec.map.get('toe' + S);
    const gl = wGen(spec, [['hips', 0.08], ['thigh' + S, 0.08], ['shin' + S, 0.07], ['foot' + S, 0.05], ['toe' + S, 0.03]]);
    const pants = new GB();
    pants.tube([[th.p[0] * 0.8, th.p[1] + 0.04, th.p[2], 0.085], [th.p[0], th.p[1] - 0.1, 0.004, 0.078], [sh.p[0], sh.p[1] + 0.02, sh.p[2], 0.06], [sh.p[0] * 1.02, sh.p[1] - 0.16, sh.p[2] - 0.01, 0.054]], 12);
    sg.add(fromGB(pants), PART.PANTS, gl);
    const boot = new GB(), ay = ft.p[1];
    boot.tube([[sh.p[0], sh.p[1] - 0.14, sh.p[2] - 0.01, 0.058], [sh.p[0], sh.p[1] - 0.17, sh.p[2] - 0.012, 0.06], [ft.p[0], ay + 0.12, ft.p[2] - 0.004, 0.05], [ft.p[0], ay + 0.02, ft.p[2], 0.05]], 12);
    boot.sphere(ft.p[0], ay - 0.03, ft.p[2] - 0.005, 0.047, 0.05, 0.055, 12, 7);
    boot.sphere((ft.p[0] + to.p[0]) / 2, ay - 0.045, (ft.p[2] + to.p[2]) / 2 + 0.01, 0.046, 0.037, 0.085, 12, 7);
    boot.sphere(to.p[0], to.p[1] - 0.001, to.p[2] + 0.02, 0.04, 0.025, 0.045, 10, 6);
    sg.add(fromGB(boot), PART.BOOT, gl, (x, y, z) => [Math.abs(y - (sh.p[1] - 0.15)) - 0.004, x + z, FAR, FAR]);
  }
  // 发型
  buildHair(look, spec, sg, hg, F);
  // 饰物
  buildAcc(look, spec, sg, F);
  const geo = sg.build(), hair = hg.n ? hg.build() : null;
  const res = { spec, geo, hair, F, key };
  cache.set(key, res);
  return res;
}
function mergeW(ws) { const m = new Map(); for (const [b, w] of ws) if (w > 0) m.set(b, (m.get(b) || 0) + w); return [...m.entries()]; }

// 发型：发包（SDF，含后背长发、马尾、胡须，蒙皮到发链）+ 少量发丝面片（鬓发）
const ax_ = Math.abs;
const plin = (T, y) => { if (y >= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (y >= T[i][0]) { const a = T[i - 1], b = T[i], t = (y - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; } return T[T.length - 1][1]; };
function buildHair(look, spec, sg, hg, F) {
  const HC = spec.HC, hs = F.hs, style = look.hair || 'bun', H = (x, y, z) => [HC[0] + x * hs, HC[1] + y * hs, HC[2] + z * hs];
  const hi = spec.map.get('head').i;
  const local = (x, y, z) => [(x - HC[0]) / hs, (y - HC[1]) / hs, (z - HC[2]) / hs];
  const backLen = style === 'long' || style === 'loose' ? -0.5 : style === 'elder' ? -0.3 : 0;
  const ZC = [[0.02, -0.088], [-0.06, -0.099], [-0.13, -0.102], [-0.2, -0.122], [-0.32, -0.152], [-0.55, -0.168]];
  const WD = [[0.02, 0.079], [-0.1, 0.072], [-0.25, 0.078], [-0.55, 0.062]];
  // 马尾沿 rib 链
  const rib = style === 'pony' ? [0, 1, 2].map((i) => spec.map.get('rib' + i)).map((b) => [local(...b.p), local(...b.tail)]) : null;
  const beard = look.beard === 'long' || look.beard === 'short' ? look.beard : null;
  const sdf = (x, y, z) => {
    const [lx, ly, lz] = local(x, y, z), ax = Math.abs(lx);
    let d = 1;
    if (style !== 'none') {
      d = ellipsoid(lx, ly - 0.024, lz + 0.012, 0.08, 0.094, 0.1);
      const face = (lz - 0.035) * 0.75 - (ly - 0.05 + 0.012 * Math.cos(lx * 30)) * 0.66;
      d = smax(d, face, 0.012);
      d = smax(d, -ellipsoid(ax - 0.075, ly + 0.012, lz - 0.01, 0.03, 0.04, 0.035), 0.01);
      if (style === 'crop') d = smax(d, -(ly + 0.02), 0.02);
      d = smax(d, -(ly + 0.075 - Math.max(0, -lz) * 0.4), 0.02);
      if (style === 'twin') d = smin(d, ellipsoid(ax - 0.06, ly - 0.095, lz + 0.01, 0.034, 0.032, 0.034), 0.012);
      else if (style === 'long' || style === 'loose') { d = smin(d, ellipsoid(lx, ly - 0.07, lz + 0.075, 0.042, 0.036, 0.03), 0.02); if (style === 'long') d = smin(d, ellipsoid(ax - 0.045, ly - 0.085, lz + 0.03, 0.026, 0.026, 0.028), 0.012); }
      else if (style === 'pony') d = smin(d, ellipsoid(lx, ly - 0.095, lz + 0.055, 0.03, 0.028, 0.03), 0.015);
      else if (style === 'bun' || style === 'elder') { d = smin(d, ellipsoid(lx, ly - 0.118, lz + 0.012, 0.032, 0.03, 0.034), 0.014); d = smin(d, ellipsoid(lx, ly - 0.143, lz + 0.012, 0.02, 0.016, 0.022), 0.01); }
      // 中分发缝
      if (style === 'long' || style === 'loose' || style === 'twin') d += 0.0025 * Math.exp(-sqr(lx / 0.005)) * sstep(0.0, 0.05, lz);
      if (backLen < 0 && ly < 0.05) {
        const zc = plin(ZC, ly), w = plin(WD, ly), th = 0.021 + 0.004 * sstep(-0.05, -0.2, ly);
        const ex = ax / w, ez = Math.abs(lz - zc) / th;
        let b = (Math.pow(ex * ex * ex * ex + ez * ez * ez * ez, 0.25) - 1) * th;
        b = smax(b, ly - 0.03, 0.02);
        b = smax(b, backLen + 0.035 * Math.abs(Math.sin(lx * 70)) + 0.02 * (ax / w) * (ax / w) - ly, 0.008);
        b += 0.0016 * Math.abs(Math.sin(lx * 210));
        d = smin(d, b, 0.025);
      }
      if (rib) for (let i = 0; i < 3; i++) {
        const [a, c] = rib[i];
        d = smin(d, capsule(lx, ly, lz, a[0], a[1], a[2], c[0], c[1], c[2], lerp(0.03, 0.014, i / 3), lerp(0.03, 0.014, (i + 1) / 3) * (i === 2 ? 0.4 : 1)) + 0.0012 * Math.abs(Math.sin(Math.atan2(lx, lz - a[2]) * 9)), 0.012);
      }
      const ang = Math.atan2(lx, lz + 0.01);
      d -= 0.0008 * Math.sin(ang * 42 + (style === 'bun' || style === 'elder' || style === 'pony' ? 0 : ly * 30));
      if (style !== 'crop') {
        const L = style === 'elder' ? 0.8 : 1, xx = (ax - 0.066) / 0.45 + 0.066;
        const LL = (look.sex === 'f' ? 1 : 0.72) * L;
        let lk = capsule(xx, ly, lz, 0.062, 0.07, 0.056, 0.07, -0.02, 0.05, 0.013, 0.009) * 0.45;
        lk = smin(lk, capsule(xx, ly, lz, 0.07, -0.02, 0.05, 0.067, -0.13 * LL, 0.04, 0.009, 0.0025) * 0.45, 0.008);
        d = smin(d, lk + 0.0008 * Math.abs(Math.sin(ly * 300)), 0.006);
      }
    }
    if (beard) {
      const L = beard === 'long';
      const sz = (zz) => (zz - 0.06) / 0.6 + 0.06;
      let bd = capsule(lx, ly, sz(lz), 0, -0.07, 0.075, 0, L ? -0.19 : -0.115, 0.066, 0.03, L ? 0.018 : 0.02) * 0.7;
      if (L) bd = smin(bd, capsule(lx, ly, sz(lz), 0, -0.19, 0.066, 0, -0.29, 0.05, 0.018, 0.004) * 0.7, 0.01);
      bd = smin(bd, capsule(ax, ly, lz, 0.006, -0.04, 0.094, 0.03, -0.062, 0.083, 0.0045, 0.0028), 0.004);
      bd = smax(bd, -(lz - 0.05), 0.01);
      bd += 0.0012 * Math.abs(Math.sin(lx * 260));
      d = Math.min(d, bd);
    }
    return d * hs;
  };
  if (style !== 'none' || beard) {
    const yb = Math.min(-0.1, backLen - 0.04, beard === 'long' ? -0.31 : beard ? -0.14 : 0, rib ? -0.17 : 0);
    const cap = surfaceNets(sdf, [-0.1 * hs, HC[1] + yb * hs, (rib || backLen < 0 ? -0.2 : -0.13) * hs, 0.1 * hs, HC[1] + 0.18 * hs, 0.13 * hs], 0.0062 * hs);
    const hb0 = spec.map.get('hb0').p[1];
    sg.add(cap, PART.HAIR, (x, y, z) => {
      const [lx, ly, lz] = local(x, y, z);
      if (backLen < 0 && lz < -0.06 && ly < 0.0) {
        const s = Math.max(0, (hb0 - y) / 0.1);
        return chainW(spec, 'hb', 4, Math.min(3.99, s), 'head', s < 0.7 ? (0.7 - s) / 0.7 : 0);
      }
      if (rib && lz < -0.04 && ly < 0.09) {
        let best = 0, bd = 9;
        for (let i = 0; i < 3; i++) { const b = spec.map.get('rib' + i), dd = segDist(x, y, z, b.p, b.tail); if (dd < bd) { bd = dd; const L2 = sqr(b.tail[0] - b.p[0]) + sqr(b.tail[1] - b.p[1]) + sqr(b.tail[2] - b.p[2]); best = i + clamp01(((x - b.p[0]) * (b.tail[0] - b.p[0]) + (y - b.p[1]) * (b.tail[1] - b.p[1]) + (z - b.p[2]) * (b.tail[2] - b.p[2])) / L2); } }
        return chainW(spec, 'rib', 3, Math.min(2.99, best), 'head', best < 0.5 ? (0.5 - best) * 2 : 0);
      }
      if (style !== 'crop' && ax_(lx) > 0.05 && lz > 0.02 && ly < -0.01) {
        const S = lx > 0 ? 'L' : 'R', s0 = spec.map.get('lock' + S + '0').p[1], s = Math.max(0, (s0 - y) / 0.062);
        return chainW(spec, 'lock' + S, 3, Math.min(2.99, s), 'head', s < 0.6 ? (0.6 - s) / 0.6 : 0);
      }
      return [[hi, 1]];
    });
  }
  // 鬓发面片
  const strip = (pts, widths, chain, nSeg, rootLen, curl) => {
    const st = hairStrip(pts, widths, curl);
    const nA = 5, n = pts.length;
    hg.add({ P: st.P, N: st.N, I: st.I }, PART.HAIR, (x, y, z, v) => {
      const j = Math.floor(v / nA), s = (j / (n - 1)) * (nSeg + rootLen) - rootLen;
      if (!chain || s < 0) return [[hi, 1]];
      return chainW(spec, chain, nSeg, s, 'head', s < 0.4 ? (0.4 - s) * 1.5 : 0);
    }, null, (v) => [st.UV[v * 2], st.UV[v * 2 + 1]]);
  };
  const chainPts = (pre, nSeg, from, k = 6) => {
    const pts = [from];
    for (let i = 0; i < nSeg; i++) { const b = spec.map.get(pre + i); for (let q = 1; q <= k; q++) { const t = q / k; pts.push([lerp(b.p[0], b.tail[0], t), lerp(b.p[1], b.tail[1], t), lerp(b.p[2], b.tail[2], t)]); } }
    return pts;
  };
  if (style === 'loose') {
    for (const s of [1, -1]) {
      const S = s > 0 ? 'L' : 'R', from = H(s * 0.05, 0.06, 0.062);
      const pts = chainPts('lock' + S, 3, from, 5).map((p) => [p[0], p[1], p[2], [0, 0, 1]]);
      const w0 = style === 'elder' ? 0.02 : 0.026;
      strip(pts, pts.map((_, i) => w0 * (1 - (i / pts.length) * 0.65) * hs), 'lock' + S, 3, 1 / 5, 0.7);
    }
    if (style === 'loose') for (const ox of [-0.025, 0.02]) {
      const pts = [H(ox * 0.5, 0.1, 0.06), H(ox, 0.07, 0.088), H(ox * 1.4, 0.04, 0.095), H(ox * 1.7, 0.02, 0.093)].map((p) => [...p, [1, 0, 0]]);
      strip(pts, [0.04, 0.035, 0.022, 0.01].map((w) => w * hs), null, 0, 0, 0.5);
    }
  }
}

function buildAcc(look, spec, sg, F) {
  const HC = spec.HC, hs = F.hs, H = (x, y, z) => [HC[0] + x * hs, HC[1] + y * hs, HC[2] + z * hs];
  const rh = wRigid(spec, 'head'), style = look.hair || 'bun';
  const g = new GB();
  // 发冠与发簪
  if (look.crown === 'gold' || look.crown === 'jade' || (style === 'bun' && !look.hat) || style === 'elder') {
    const [cx, cy, cz] = H(0, 0.117, -0.012);
    g.lathe(cx, cy - 0.022 * hs, cz, [[0.026, 0], [0.03, 0.012], [0.028, 0.028], [0.018, 0.036]].map(([r, y]) => [r * hs, y * hs]), 14);
    sg.add(fromGB(g), look.crown === 'jade' ? PART.JADE : PART.GOLD, rh);
    const pin = new GB();
    pin.tube([[cx - 0.075 * hs, cy + 0.004, cz, 0.0028], [cx + 0.075 * hs, cy + 0.004, cz, 0.0028]], 6);
    pin.sphere(cx + 0.075 * hs, cy + 0.004, cz, 0.006, 0.006, 0.006, 8, 5);
    sg.add(fromGB(pin), PART.JADE, rh);
  }
  if (style === 'long' || style === 'pony' || style === 'twin') {
    const p = H(0.045, 0.095, -0.03), fl = new GB();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; fl.sphere(p[0] + Math.cos(a) * 0.009, p[1] + Math.sin(a) * 0.009, p[2] + 0.004, 0.007, 0.007, 0.003, 7, 4); }
    fl.sphere(p[0], p[1], p[2] + 0.006, 0.004, 0.004, 0.004, 6, 4);
    sg.add(fromGB(fl), PART.JADE, rh);
    const tas = new GB(), t0 = spec.map.get('tas0'), t1 = spec.map.get('tas1');
    tas.tube([[t0.p[0], t0.p[1], t0.p[2], 0.0012], [t1.p[0], t1.p[1], t1.p[2], 0.0012], [t1.tail[0], t1.tail[1], t1.tail[2], 0.0012]], 4);
    tas.sphere(t1.tail[0], t1.tail[1], t1.tail[2], 0.005, 0.007, 0.005, 6, 4);
    sg.add(fromGB(tas), PART.GOLD, (x, y, z) => chainW(spec, 'tas', 2, Math.max(0, (t0.p[1] - y) / 0.045)));
  }
  if (look.hat) {
    const h = new GB(), [cx, cy, cz] = H(0, 0.075, -0.005);
    h.lathe(cx, cy, cz, [[0.3, 0], [0.24, 0.03], [0.13, 0.07], [0.05, 0.13], [0.001, 0.15]], 22);
    h.lathe(cx, cy - 0.004, cz, [[0.001, 0.0], [0.3, 0.0]], 22);
    sg.add(fromGB(h), PART.STRAW, rh);
  }
  // 腰间玉佩
  if (look.acc !== 'none') {
    const p0 = spec.map.get('pend0'), p1 = spec.map.get('pend1'), pd = new GB();
    pd.tube([[p0.p[0], p0.p[1], p0.p[2] + 0.004, 0.0018], [p1.p[0], p1.p[1], p1.p[2] + 0.004, 0.0018]], 4);
    pd.xf(null).sphere(p1.tail[0], p1.tail[1] + 0.012, p1.tail[2] + 0.004, 0.018, 0.022, 0.006, 12, 6);
    sg.add(fromGB(pd), PART.JADE, (x, y, z) => chainW(spec, 'pend', 2, Math.max(0, (p0.p[1] - y) / 0.07)));
    const ts = new GB();
    ts.tube([[p1.tail[0], p1.tail[1] - 0.01, p1.tail[2] + 0.004, 0.004], [p1.tail[0], p1.tail[1] - 0.07, p1.tail[2] + 0.004, 0.0055]], 6);
    sg.add(fromGB(ts), PART.INNER, () => [[spec.map.get('pend1').i, 1]], () => [FAR, 0, -1, FAR]);
  }
  // 腰带垂绦
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', pts = [];
    for (let i = 0; i < 3; i++) { const b = spec.map.get('sash' + S + i); pts.push(b.p); if (i === 2) pts.push(b.tail); }
    const st = new GB();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], w = 0.036 - i * 0.004;
      st.box(-w / 2, 0, -0.0025, w / 2, 1, 0.0025);
    }
    const rib = { P: [], N: [], I: [] };
    const nSeg = 12;
    for (let j = 0; j <= nSeg; j++) {
      const t = j / nSeg, k = Math.min(2, Math.floor(t * 3)), f = t * 3 - k, a = pts[k], b = pts[k + 1];
      const x = lerp(a[0], b[0], f), y = lerp(a[1], b[1], f), z = lerp(a[2], b[2], f), w = (0.034 - t * 0.012) / 2;
      for (const [ox, oz, nz] of [[-w, 0.0025, 1], [w, 0.0025, 1], [w, -0.0025, -1], [-w, -0.0025, -1]]) { rib.P.push(x + ox, y, z + oz); rib.N.push(0, 0, nz); }
    }
    for (let j = 0; j < nSeg; j++) { const a = j * 4; rib.I.push(a, a + 4, a + 5, a, a + 5, a + 1, a + 2, a + 6, a + 7, a + 2, a + 7, a + 3); }
    const r0 = spec.map.get('sash' + S + '0').p[1];
    sg.add(rib, PART.CLOTH, (x, y) => chainW(spec, 'sash' + S, 3, Math.max(0, (r0 - y) / 0.125), 'spine', y > r0 - 0.03 ? 0.6 : 0), () => [FAR, 0, -1, FAR]);
    void st;
  }
}
