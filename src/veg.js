// 植被：叶片卡树木（7 个树种）、远景树冠、草叶、野花、岩石
import * as THREE from 'three';
import { GB, lin } from './geo.js';
import { cellUV } from './tex.js';
import { mulberry32 } from './noise.js';

const TAU = Math.PI * 2, KL = 1.8, KB = 4.2;
// 树冠参数（远景树冠与近景树共用）：cy 冠心高，rx 冠半径，ry 冠半高
export const SPECIES = {
  oak: { blob: 0x4b6f2a, cy: 6.3, rx: 3.5, ry: 2.8, th: 4.3, tr: 0.36, n: 46, size: 1.4, lo: 0x2b4717, hi: 0x6f9838, bark: 0x5a4632, cell: 0 },
  maple: { blob: 0xb85a28, cy: 5.8, rx: 3.2, ry: 2.5, th: 3.8, tr: 0.3, n: 42, size: 1.3, lo: 0x8a2c14, hi: 0xea8a2c, bark: 0x4e3a2c, cell: 0 },
  ginkgo: { blob: 0xc8a630, cy: 7.3, rx: 2.5, ry: 3.6, th: 4.8, tr: 0.27, n: 42, size: 1.25, lo: 0xa67a18, hi: 0xf4d548, bark: 0x7a7264, cell: 0 },
  peach: { blob: 0xe8a2ba, cy: 3.4, rx: 2.5, ry: 1.7, th: 1.9, tr: 0.19, n: 32, size: 1.05, lo: 0xd97a98, hi: 0xffdbe6, bark: 0x46322a, cell: 3 },
  willow: { blob: 0x7e9a42, cy: 4.6, rx: 3.4, ry: 2.9, bark: 0x5c4e38 },
  bamboo: { blob: 0x6c9240, cy: 5.2, rx: 1.9, ry: 3.8 },
  pine: { blob: 0x2c4c2e, cone: 1, cy: 2.2, rx: 2.6, ry: 8.6, bark: 0x6a4832 },
};

function trunk(g, rnd, h, r, lean, bark, seg = 7) {
  const U = cellUV(4), pts = [], ph = rnd() * TAU, n = 5;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push([Math.cos(ph) * lean * t * t * h + Math.sin(t * 3 + ph) * 0.1 * t, t * h - 0.3, Math.sin(ph) * lean * t * t * h + Math.cos(t * 2.3 + ph) * 0.1 * t, r * (k === 0 ? 1.6 : 1.08 - 0.45 * t)]);
  }
  g.col(bark, KB); g.tube(pts, seg, U);
  return pts[n];
}
function branch(g, a, b, r0, r1, sag = 0) {
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag, (a[2] + b[2]) / 2, (r0 + r1) / 2];
  g.tube([[a[0], a[1], a[2], r0], m, [b[0], b[1], b[2], r1]], 5, cellUV(4));
}
// 朝向法线 n 的随机滚转面片
function leafCard(g, rnd, cx, cy, cz, nx, ny, nz, size, U, sx, sy, sz, w) {
  let rx = -nz, rz = nx;
  const l = Math.hypot(rx, rz);
  if (l < 1e-3) { rx = 1; rz = 0; } else { rx /= l; rz /= l; }
  const ux = ny * rz, uy = nz * rx - nx * rz, uz = -ny * rx;
  const a = rnd() * TAU, c = Math.cos(a) * size, s = Math.sin(a) * size;
  g.card(cx, cy, cz, rx * c + ux * s, uy * s, rz * c + uz * s, -rx * s + ux * c, uy * c, -rz * s + uz * c, U[0], U[3], U[2], U[1], sx, sy, sz, w, w);
}
function crown(g, rnd, C, R, n, size, cell, lo, hi, yMin = -0.45) {
  const U = cellUV(cell), a0 = lin(lo), a1 = lin(hi);
  for (let i = 0; i < n; i++) {
    const y = yMin + (0.98 - yMin) * ((i + rnd()) / n), a = i * 2.39996 + rnd() * 0.6, rr = Math.sqrt(1 - y * y);
    const dx = Math.cos(a) * rr, dz = Math.sin(a) * rr, rad = 1 - 0.5 * rnd() * rnd();
    let nx = dx + (rnd() - 0.5) * 1.3, ny = y + (rnd() - 0.5) * 1.3, nz = dz + (rnd() - 0.5) * 1.3;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const sl = Math.hypot(dx, y + 0.45, dz), t = Math.min(1, (0.5 + 0.5 * y) * 0.65 + rad * 0.35), j = (0.82 + rnd() * 0.3) * KL;
    g.rgb((a0[0] + (a1[0] - a0[0]) * t) * j, (a0[1] + (a1[1] - a0[1]) * t) * j, (a0[2] + (a1[2] - a0[2]) * t) * j);
    leafCard(g, rnd, C[0] + dx * R[0] * rad, C[1] + y * R[1] * rad, C[2] + dz * R[0] * rad, nx, ny, nz, size * (0.8 + rnd() * 0.4), U, dx / sl, (y + 0.45) / sl, dz / sl, 0.45 + 0.55 * rad);
  }
}
function broadleaf(kind, seed) {
  const S = SPECIES[kind], rnd = mulberry32(seed), g = new GB();
  const top = trunk(g, rnd, S.th, S.tr, 0.02 + rnd() * 0.03, S.bark);
  const C = [top[0] * 0.6, S.cy, top[2] * 0.6], nb = 4;
  for (let b = 0; b < nb; b++) {
    const a = (b / nb) * TAU + rnd(), r = S.rx * (0.5 + rnd() * 0.25);
    branch(g, [top[0], top[1] - S.th * (0.1 + 0.2 * rnd()), top[2]], [C[0] + Math.cos(a) * r, S.cy + (rnd() - 0.3) * S.ry * 0.7, C[2] + Math.sin(a) * r], S.tr * 0.5, 0.04, 0.3);
  }
  branch(g, [top[0], top[1] - 0.2, top[2]], [C[0], S.cy + S.ry * 0.6, C[2]], S.tr * 0.6, 0.05);
  crown(g, rnd, C, [S.rx, S.ry], S.n, S.size, S.cell, S.lo, S.hi);
  if (kind === 'peach') crown(g, rnd, C, [S.rx * 0.8, S.ry * 0.8], 6, 0.8, 0, 0x3a5a22, 0x6a8a3a);
  return g;
}
function pine(seed) {
  const S = SPECIES.pine, rnd = mulberry32(seed), g = new GB(), H = 10 + rnd() * 2, U = cellUV(1), lo = lin(0x1c3a22), hi = lin(0x4a7a44), tiers = 7;
  trunk(g, rnd, H * 0.96, 0.3, 0.008, S.bark, 6);
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1), y = 2.4 + f * (H - 3.0), R = 3.0 - 2.3 * f, n = f > 0.6 ? 5 : 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + t * 0.7 + rnd() * 0.3, c = Math.cos(a), s = Math.sin(a), dr = 0.22 + 0.3 * (1 - f) + rnd() * 0.12, len = R * (0.85 + rnd() * 0.3), wid = len * 0.62;
      const ox = c * Math.cos(dr), oy = -Math.sin(dr), oz = s * Math.cos(dr), roll = (rnd() - 0.5) * 1.1, cr = Math.cos(roll), sr = Math.sin(roll);
      const px = oy * c, py = -oz * s - ox * c, pz = oy * s;
      const hx = (-s * cr + px * sr) * wid * 0.5, hy = py * sr * wid * 0.5, hz = (c * cr + pz * sr) * wid * 0.5, j = (0.8 + rnd() * 0.35) * KL, tt = 0.25 + 0.75 * f;
      g.rgb((lo[0] + (hi[0] - lo[0]) * tt) * j, (lo[1] + (hi[1] - lo[1]) * tt) * j, (lo[2] + (hi[2] - lo[2]) * tt) * j);
      g.card(c * 0.12 + ox * len * 0.5, y + oy * len * 0.5, s * 0.12 + oz * len * 0.5, hx, hy, hz, ox * len * 0.5, oy * len * 0.5, oz * len * 0.5, U[0], U[3], U[2], U[1], c * 0.45, 0.89, s * 0.45, 0.08, 0.55);
    }
  }
  g.rgb(hi[0] * KL, hi[1] * KL, hi[2] * KL);
  for (let k = 0; k < 2; k++) { const a = k * 1.57 + rnd(); g.card(0, H - 0.7, 0, Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85, 0, 1.25, 0, U[0], U[3], U[2], U[1], 0, 1, 0, 0.1, 0.6); }
  return g;
}
function willow(seed) {
  const S = SPECIES.willow, rnd = mulberry32(seed), g = new GB(), U = cellUV(2), lo = lin(0x5c7a2c), hi = lin(0xa8c25a);
  const top = trunk(g, rnd, 3.4, 0.38, 0.05 + rnd() * 0.04, S.bark);
  const ends = [];
  for (let b = 0; b < 6; b++) {
    const a = (b / 6) * TAU + rnd() * 0.5, r = 1.9 + rnd() * 1.3, e = [top[0] + Math.cos(a) * r, 5.3 + rnd() * 0.9, top[2] + Math.sin(a) * r];
    branch(g, [top[0], top[1] - 0.3, top[2]], e, 0.17, 0.04, 0.7);
    ends.push(e);
  }
  crown(g, rnd, [top[0], 5.7, top[2]], [2.9, 1.25], 16, 1.25, 0, 0x5c7a2c, 0x9cb850, -0.2);
  for (let i = 0; i < 18; i++) {
    const e = ends[i % 6], a = rnd() * TAU, r = i < 6 ? 0 : 0.5 + rnd() * 0.9, x = e[0] + Math.cos(a) * r, z = e[2] + Math.sin(a) * r;
    const hgt = 3.3 + rnd() * 1.3, yT = e[1] + 0.35 - r * 0.25, o = rnd() * TAU, wx = Math.cos(o) * 0.85, wz = Math.sin(o) * 0.85, j = (0.8 + rnd() * 0.35) * KL, t = rnd();
    const ol = Math.hypot(x - top[0], z - top[2]) || 1;
    g.rgb((lo[0] + (hi[0] - lo[0]) * t) * j, (lo[1] + (hi[1] - lo[1]) * t) * j, (lo[2] + (hi[2] - lo[2]) * t) * j);
    g.card(x, yT - hgt / 2, z, wx, 0, wz, 0, hgt / 2, 0, U[0], U[3], U[2], U[1], ((x - top[0]) / ol) * 0.6, 0.8, ((z - top[2]) / ol) * 0.6, 1, 0.1);
  }
  return g;
}
function bamboo(seed) {
  const rnd = mulberry32(seed), g = new GB(), U5 = cellUV(5), U2 = cellUV(2), lo = lin(0x4f7a2e), hi = lin(0x9cc058);
  const n = 6 + ((rnd() * 3) | 0);
  for (let c = 0; c < n; c++) {
    const a = rnd() * TAU, r0 = rnd() * 0.75, H = 7 + rnd() * 3.5, rad = 0.05 + rnd() * 0.025, la = a + (rnd() - 0.5), lean = 0.05 + rnd() * 0.12;
    const P = (y) => { const t = y / H; return [Math.cos(a) * r0 + Math.cos(la) * lean * t * t * H, y - 0.2, Math.sin(a) * r0 + Math.sin(la) * lean * t * t * H]; };
    const j0 = 0.85 + rnd() * 0.3;
    g.col(0x86a84c, 1.25 * j0);
    for (let y = 0; y < H; y += 1.1) { const p = P(y), q = P(Math.min(H, y + 1.1)), k = 1 - 0.5 * (y / H); g.tube([[p[0], p[1], p[2], rad * k], [q[0], q[1], q[2], rad * k * 0.94]], 4, U5); }
    for (let y = H * 0.42; y < H + 0.3; y += 0.75) {
      const p = P(Math.min(H, y)), o = rnd() * TAU, ox = Math.cos(o), oz = Math.sin(o), t = rnd(), j = (0.8 + rnd() * 0.35) * KL, sz = 0.75 + rnd() * 0.35;
      g.rgb((lo[0] + (hi[0] - lo[0]) * t) * j, (lo[1] + (hi[1] - lo[1]) * t) * j, (lo[2] + (hi[2] - lo[2]) * t) * j);
      g.card(p[0] + ox * 0.5, p[1] - 0.25, p[2] + oz * 0.5, -oz * sz, 0, ox * sz, ox * 0.45 * sz, 0.75 * sz, oz * 0.45 * sz, U2[0], U2[3], U2[2], U2[1], ox * 0.5, 0.86, oz * 0.5, 0.9, 0.5);
    }
  }
  return g;
}

// 返回 { kind: [GB, GB] }（未 build，便于静态合并）
export function makeTreeBuilders() {
  const out = {};
  for (const k of ['oak', 'maple', 'ginkgo', 'peach']) out[k] = [broadleaf(k, 11 + k.length), broadleaf(k, 57 + k.length * 3)];
  out.pine = [pine(5), pine(77)];
  out.willow = [willow(9), willow(31)];
  out.bamboo = [bamboo(3), bamboo(41)];
  return out;
}

const i7 = (rnd) => rnd();
export function makeBlobGeos() {
  const rnd = mulberry32(8);
  const r = new GB();
  r.surf(6, 3, (u, v, o) => {
    const ph = v * Math.PI, a = u * TAU, lump = Math.sin(a * 3 + v * 6) * 0.2 + Math.sin(a * 2 - v * 4 + 1.3) * 0.14, k = 0.86 + lump, sr = Math.sin(ph) * k;
    o[0] = Math.cos(a) * sr; o[1] = Math.cos(ph) * (v < 0.5 ? 0.95 + lump * 0.5 : 0.75); o[2] = Math.sin(a) * sr; o[3] = u; o[4] = v; o[5] = 1.2 - v * 0.8 + lump * 0.9 + (i7(rnd) - 0.5) * 0.12;
  }, false, true);
  const c = new GB();
  c.surf(5, 2, (u, v, o) => { const a = u * TAU, rr = (1 - v) * (1 + Math.sin(v * 9) * 0.12); o[0] = Math.cos(a) * rr; o[1] = v; o[2] = Math.sin(a) * rr; o[3] = u; o[4] = v; o[5] = 0.6 + v * 0.7; }, true, true);
  return { round: r.build(), cone: c.build() };
}

export function makeBladeGeo(lo) {
  const g = new THREE.BufferGeometry(), p = lo ? [-0.5, 0, 0, 0.5, 0, 0, -0.5, 0.5, 0, 0.5, 0.5, 0, 0, 1, 0] : [-0.5, 0, 0, 0.5, 0, 0, -0.5, 0.38, 0, 0.5, 0.38, 0, -0.5, 0.72, 0, 0.5, 0.72, 0, 0, 1, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(p.map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(lo ? [0, 1, 3, 0, 3, 2, 2, 3, 4] : [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6]);
  return g;
}
export function makeFlowerGeo() {
  const p = [0, 0, 0], idx = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU, r = 0.036;
    p.push(Math.cos(a - 0.5) * r, 0.02, Math.sin(a - 0.5) * r, Math.cos(a) * r * 1.5, 0.045, Math.sin(a) * r * 1.5, Math.cos(a + 0.5) * r, 0.02, Math.sin(a + 0.5) * r);
    const b = 1 + k * 3;
    idx.push(0, b, b + 1, 0, b + 1, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(p.map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}
// 不规则岩石（半径约 1）
export function rockBuilder(seed, g = new GB()) {
  const rnd = mulberry32(seed), ph = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6], fl = 0.75 + rnd() * 0.2;
  g.surf(10, 7, (u, v, o) => {
    const a = u * TAU, p = v * Math.PI, sy = Math.cos(p), sr = Math.sin(p);
    const k = 1 + 0.2 * Math.sin(a * 2 + ph[0]) * sr + 0.13 * Math.sin(a * 3 + ph[1] + sy * 3) + 0.1 * Math.sin(sy * 5 + ph[2]) + 0.07 * Math.sin(a * 5 + ph[3]) * sr;
    o[0] = Math.cos(a) * sr * k; o[1] = Math.max(-0.55, sy * fl * k); o[2] = Math.sin(a) * sr * k * 0.85; o[3] = u * 3; o[4] = v * 2; o[5] = 0.8 + 0.3 * (1 - v);
  }, false, true);
  return g;
}
export function makeRockGeos() { return [1, 2, 3].map((s) => rockBuilder(s * 13).build()); }
