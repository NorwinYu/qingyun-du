// 程序化贴图：地形分层、建筑材质、树叶图集、门窗、匾额、UI 图标
import * as THREE from 'three';
import { mulberry32, clamp } from './noise.js';

function tnoise(n, cx, cy, seed) {
  const rnd = mulberry32(seed), g = new Float32Array(cx * cy);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    const fy = (y / n) * cy, iy = Math.floor(fy), v0 = fy - iy, v = v0 * v0 * (3 - 2 * v0), y0 = (iy % cy) * cx, y1 = ((iy + 1) % cy) * cx;
    for (let x = 0; x < n; x++) {
      const fx = (x / n) * cx, ix = Math.floor(fx), u0 = fx - ix, u = u0 * u0 * (3 - 2 * u0), x0 = ix % cx, x1 = (ix + 1) % cx;
      const a = g[y0 + x0], b = g[y0 + x1], c = g[y1 + x0], d = g[y1 + x1], t = a + (b - a) * u;
      out[y * n + x] = t + (c + (d - c) * u - t) * v;
    }
  }
  return out;
}
function tfbm(n, cx, cy, oct, seed) {
  const out = new Float32Array(n * n);
  let amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) {
    const t = tnoise(n, Math.min(n, cx << o), Math.min(n, cy << o), seed + o * 17);
    for (let i = 0; i < out.length; i++) out[i] += t[i] * amp;
    tot += amp; amp *= 0.5;
  }
  let mn = 1e9, mx = -1e9;
  for (let i = 0; i < out.length; i++) { out[i] /= tot; if (out[i] < mn) mn = out[i]; if (out[i] > mx) mx = out[i]; }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn);
  return out;
}
const R = (h) => (h >> 16) & 255, G = (h) => (h >> 8) & 255, B = (h) => h & 255;
function ramp(c, a, b, d, t) {
  t = clamp(t, 0, 1);
  const p = t < 0.5 ? a : b, q = t < 0.5 ? b : d, k = t < 0.5 ? t * 2 : t * 2 - 2 + 1;
  c[0] = R(p) + (R(q) - R(p)) * k; c[1] = G(p) + (G(q) - G(p)) * k; c[2] = B(p) + (B(q) - B(p)) * k;
}
const mul = (c, k) => { c[0] *= k; c[1] *= k; c[2] *= k; };
const toward = (c, h, k) => { c[0] += (R(h) - c[0]) * k; c[1] += (G(h) - c[1]) * k; c[2] += (B(h) - c[2]) * k; };

function paint(n, fn) {
  const alb = new Uint8Array(n * n * 4), hgt = new Float32Array(n * n), c = [0, 0, 0];
  for (let y = 0, i = 0; y < n; y++) for (let x = 0; x < n; x++, i++) {
    const h = clamp(fn(i, x, y, c), 0, 1);
    alb[i * 4] = c[0]; alb[i * 4 + 1] = c[1]; alb[i * 4 + 2] = c[2]; alb[i * 4 + 3] = h * 255; hgt[i] = h;
  }
  return { alb, hgt, n };
}
function normals(t, s) {
  const { hgt, n } = t, out = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = hgt[y * n + ((x + n - 1) % n)], r = hgt[y * n + ((x + 1) % n)], u = hgt[((y + n - 1) % n) * n + x], d = hgt[((y + 1) % n) * n + x];
    const nx = (l - r) * s, ny = (u - d) * s, k = 1 / Math.hypot(nx, ny, 1), o = (y * n + x) * 4;
    out[o] = (nx * k * 0.5 + 0.5) * 255; out[o + 1] = (ny * k * 0.5 + 0.5) * 255; out[o + 2] = (k * 0.5 + 0.5) * 255; out[o + 3] = 255;
  }
  return out;
}
function setup(t, srgb, clampEdge) {
  t.wrapS = t.wrapT = clampEdge ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
const dtex = (data, w, h, srgb, cl) => setup(new THREE.DataTexture(data, w, h, THREE.RGBAFormat), srgb, cl);
const pair = (t, s) => ({ map: dtex(t.alb, t.n, t.n, true), normalMap: dtex(normals(t, s), t.n, t.n, false) });

const N = 256, TAU = Math.PI * 2;
function slabs(seed, rowPx, blockPx, a, b, d, grout) {
  const rows = N / rowPx, cols = N / blockPx, rnd = mulberry32(seed), ids = [];
  for (let i = 0; i < rows * cols; i++) ids.push(rnd());
  const p1 = tfbm(N, 4, 4, 4, seed + 1), p2 = tnoise(N, 128, 128, seed + 2);
  return paint(N, (i, x, y, c) => {
    const row = (y / rowPx) | 0, xx = (x + (row & 1) * (blockPx >> 1)) % N, col = (xx / blockPx) | 0;
    const lx = xx % blockPx, ly = y % rowPx, e = Math.min(lx, blockPx - 1 - lx, ly, rowPx - 1 - ly);
    ramp(c, a, b, d, ids[row * cols + col] * 0.5 + p1[i] * 0.3 + p2[i] * 0.2);
    if (e < 3) { toward(c, grout, (1 - e / 3) * 0.85); return (e / 3) * 0.45; }
    return 0.65 + p1[i] * 0.2 + p2[i] * 0.15;
  });
}
function layers() {
  const L = [];
  { const a = tfbm(N, 4, 4, 5, 1), b = tnoise(N, 64, 64, 2), s = tnoise(N, 128, 32, 3);
    L.push(paint(N, (i, x, y, c) => { ramp(c, 0x2f4a1c, 0x4a6a27, 0x758a3a, a[i] * 0.55 + b[i] * 0.25 + s[i] * 0.2); if (b[i] > 0.86) toward(c, 0x9a9650, 0.3); return b[i] * 0.6 + s[i] * 0.4; })); }
  { const a = tfbm(N, 4, 4, 5, 11), p = tnoise(N, 48, 48, 12), f = tnoise(N, 128, 128, 13);
    L.push(paint(N, (i, x, y, c) => { ramp(c, 0x66553e, 0x857052, 0xa38e69, a[i] * 0.6 + f[i] * 0.4); const pb = Math.max(0, p[i] - 0.8) * 4.5; if (pb > 0) toward(c, 0x9a948a, Math.min(0.75, pb * 1.2)); return a[i] * 0.35 + f[i] * 0.2 + pb * 0.45; })); }
  { const a = tfbm(N, 3, 3, 6, 21), b = tfbm(N, 6, 6, 5, 22);
    L.push(paint(N, (i, x, y, c) => {
      const cr = Math.abs(b[i] - 0.5) * 2, st = 0.5 + 0.5 * Math.sin(((y / N) * 9 + a[i] * 4) * TAU), t = a[i] * 0.6 + st * 0.15 + b[i] * 0.25;
      ramp(c, 0x45423d, 0x716c64, 0x9d968a, t);
      if (cr < 0.07) mul(c, 0.5 + cr * 7);
      return t * 0.7 + Math.min(1, cr * 9) * 0.3;
    })); }
  { const a = tfbm(N, 4, 4, 4, 31), f = tnoise(N, 128, 128, 32);
    L.push(paint(N, (i, x, y, c) => { const rp = 0.5 + 0.5 * Math.sin(((y / N) * 24 + a[i] * 2.5) * TAU); ramp(c, 0xa8946a, 0xc6b485, 0xdccd9e, a[i] * 0.5 + f[i] * 0.3 + rp * 0.2); return rp * 0.5 + f[i] * 0.3; })); }
  { const a = tfbm(N, 4, 4, 5, 41), f = tnoise(N, 128, 128, 42);
    L.push(paint(N, (i, x, y, c) => { ramp(c, 0xc9d4e2, 0xe6edf5, 0xffffff, a[i] * 0.7 + f[i] * 0.3); return a[i] * 0.6 + f[i] * 0.15; })); }
  L.push(slabs(51, 64, 128, 0x6f6c66, 0x8d897f, 0xa8a396, 0x3a3833));
  return L;
}

export function buildTextures() {
  const T = {};
  const Ls = layers(), nl = Ls.length;
  const alb = new Uint8Array(N * N * 4 * nl), nrm = new Uint8Array(N * N * 4 * nl);
  Ls.forEach((l, i) => { alb.set(l.alb, i * N * N * 4); nrm.set(normals(l, i === 2 ? 5 : i === 5 ? 4 : 2.5), i * N * N * 4); });
  T.terrAlb = setup(new THREE.DataArrayTexture(alb, N, N, nl), true);
  T.terrNrm = setup(new THREE.DataArrayTexture(nrm, N, N, nl), false);
  T.grass = pair(Ls[0], 2.5); T.rock = pair(Ls[2], 5); T.paving = pair(Ls[5], 4);
  { const a = tfbm(N, 4, 4, 5, 91), b = tfbm(N, 16, 16, 4, 92), c = tfbm(N, 8, 8, 3, 93), d = tnoise(N, 64, 64, 94), m = new Uint8Array(N * N * 4);
    for (let i = 0; i < N * N; i++) { m[i * 4] = a[i] * 255; m[i * 4 + 1] = b[i] * 255; m[i * 4 + 2] = c[i] * 255; m[i * 4 + 3] = d[i] * 255; }
    T.macro = dtex(m, N, N, false); }
  { const a = tfbm(N, 3, 3, 5, 61), f = tnoise(N, 128, 128, 62), s = tnoise(N, 32, 2, 63);
    T.plaster = pair(paint(N, (i, x, y, c) => { ramp(c, 0xb9b09c, 0xd9d2c1, 0xefeade, a[i] * 0.5 + s[i] * 0.3 + f[i] * 0.2); return f[i] * 0.5 + a[i] * 0.3; }), 1.2); }
  { const g1 = tfbm(N, 32, 2, 3, 71), g2 = tnoise(N, 128, 8, 72), g3 = tfbm(N, 2, 2, 3, 73);
    T.wood = pair(paint(N, (i, x, y, c) => {
      const t = g1[i] * 0.55 + g2[i] * 0.25 + g3[i] * 0.2, l = 140 + t * 112, seam = (x & 63) < 2;
      c[0] = l; c[1] = l * 0.96; c[2] = l * 0.9;
      if (seam) mul(c, 0.4);
      return seam ? 0 : 0.4 + t * 0.6;
    }), 2.5); }
  T.masonry = pair(slabs(111, 32, 64, 0x77726a, 0x969186, 0xb1ab9d, 0x45423c), 4);
  { const rnd = mulberry32(121), ids = []; for (let i = 0; i < 32; i++) ids.push(rnd());
    const a = tfbm(N, 8, 8, 4, 122);
    T.tile = pair(paint(N, (i, x, y, c) => {
      const lx = (x & 31) / 32, ly = (y & 63) / 64, pr = lx < 0.72 ? Math.sin((Math.PI * lx) / 0.72) : 0;
      let l = 105 + pr * 80 + ids[((y >> 6) * 8 + (x >> 5)) & 31] * 38 + a[i] * 32;
      if (pr === 0) l *= 0.45;
      if (ly < 0.05) l *= 0.5;
      c[0] = c[1] = c[2] = Math.min(255, l);
      return pr * 0.65 + (1 - ly) * 0.35 * (pr > 0 ? 1 : 0.3);
    }), 6); }
  { const a = tfbm(N, 64, 4, 3, 81), b = tnoise(N, 128, 16, 82);
    T.thatch = pair(paint(N, (i, x, y, c) => { const ly = (y & 63) / 64; ramp(c, 0x6e5830, 0xa88c4c, 0xd4be7c, a[i] * 0.6 + b[i] * 0.4); if (ly < 0.08) mul(c, 0.6); return a[i] * 0.5 + (1 - ly) * 0.45; }), 4); }
  T.leaf = leafAtlas();
  Object.assign(T, detailAtlas());
  return T;
}

// 树叶图集 4x2（每格 256px）：0 阔叶 1 松枝 2 垂叶 3 花簇 4 树皮 5 竹竿
export function cellUV(k) {
  const e = 0.006;
  return [(k % 4) / 4 + e, ((k / 4) | 0) / 2 + e * 2, (k % 4 + 1) / 4 - e, (((k / 4) | 0) + 1) / 2 - e * 2];
}
function leafAtlas() {
  const W = 1024, H = 512, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), rnd = mulberry32(777);
  const cell = (k, fn) => { g.save(); g.beginPath(); g.rect((k % 4) * 256 + 5, ((k / 4) | 0) * 256 + 5, 246, 246); g.clip(); g.translate((k % 4) * 256, ((k / 4) | 0) * 256); fn(); g.restore(); };
  const leafCol = (l) => `rgb(${(l * 0.9) | 0},${l | 0},${(l * 0.8) | 0})`;
  const leaf = (x, y, a, len, wid, l) => {
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = leafCol(l); g.beginPath(); g.ellipse(0, 0, len / 2, wid / 2, 0, 0, TAU); g.fill();
    g.strokeStyle = leafCol(l * 0.72); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke();
    g.restore();
  };
  cell(0, () => {
    const ls = [];
    for (let i = 0; i < 95; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * 104; ls.push([128 + Math.cos(a) * r, 128 + Math.sin(a) * r, rnd() * TAU, 30 + rnd() * 16, 14 + rnd() * 8, 120 + rnd() * 135]); }
    ls.sort((p, q) => p[5] - q[5]).forEach((l) => leaf(...l));
  });
  cell(1, () => {
    g.lineCap = 'round';
    const twig = (x0, y0, x1, y1, w) => {
      g.strokeStyle = 'rgb(120,104,84)'; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      const n = Math.hypot(x1 - x0, y1 - y0) / 1.7, ang = Math.atan2(y1 - y0, x1 - x0);
      for (let i = 0; i < n; i++) {
        const t = i / n, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t, s = i % 2 ? 1 : -1, a = ang + s * (0.6 + rnd() * 0.5), len = 15 + rnd() * 12;
        g.strokeStyle = leafCol(110 + rnd() * 140); g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke();
      }
    };
    twig(128, 250, 128, 14, 5);
    for (let i = 0; i < 9; i++) { const y = 228 - i * 23, s = i % 2 ? 1 : -1, len = 96 - i * 8; twig(128, y, 128 + s * len, y - len * 0.42, 3); }
  });
  cell(2, () => {
    for (let s = 0; s < 9; s++) {
      let x = 20 + s * 26 + rnd() * 10, y = 4;
      const sw = (rnd() - 0.5) * 0.5;
      for (let i = 0; i < 17; i++) {
        const nx = x + Math.sin(i * 0.45 + s) * 3 + sw * 4, ny = y + 14.5;
        g.strokeStyle = 'rgb(150,160,110)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        const side = i % 2 ? 1 : -1;
        leaf(x + side * 9, y + 9, Math.PI / 2 - side * 0.7, 32 + rnd() * 10, 10 + rnd() * 3, 130 + rnd() * 125);
        x = nx; y = ny;
      }
    }
  });
  cell(3, () => {
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const a = rnd() * TAU; g.strokeStyle = 'rgb(96,74,66)'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(128, 128); g.quadraticCurveTo(128 + Math.cos(a + 0.5) * 60, 128 + Math.sin(a + 0.5) * 60, 128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); g.stroke(); }
    for (let i = 0; i < 115; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * 110, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r, s = 6.5 + rnd() * 5, l = 205 + rnd() * 50, a0 = rnd() * TAU;
      for (let p = 0; p < 5; p++) { const pa = a0 + (p / 5) * TAU; g.fillStyle = `rgb(${l | 0},${(l * 0.93) | 0},${(l * 0.96) | 0})`; g.beginPath(); g.ellipse(x + Math.cos(pa) * s * 0.6, y + Math.sin(pa) * s * 0.6, s * 0.6, s * 0.42, pa, 0, TAU); g.fill(); }
      g.fillStyle = 'rgb(225,150,150)'; g.beginPath(); g.arc(x, y, s * 0.22, 0, TAU); g.fill();
    }
  });
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let k = 0; k < 4; k++) {
    let sr = 0, sg = 0, sb = 0, n = 0;
    const x0 = k * 256;
    for (let y = 0; y < 256; y++) for (let x = x0; x < x0 + 256; x++) { const o = (y * W + x) * 4; if (d[o + 3] > 128) { sr += d[o]; sg += d[o + 1]; sb += d[o + 2]; n++; } }
    sr /= n; sg /= n; sb /= n;
    for (let y = 0; y < 256; y++) for (let x = x0; x < x0 + 256; x++) { const o = (y * W + x) * 4, a = d[o + 3] / 255; d[o] = d[o] * a + sr * (1 - a); d[o + 1] = d[o + 1] * a + sg * (1 - a); d[o + 2] = d[o + 2] * a + sb * (1 - a); }
  }
  const b1 = tfbm(256, 24, 3, 3, 101), b2 = tnoise(256, 96, 12, 102), b3 = tfbm(256, 3, 3, 3, 103);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = y * 256 + x, t = b1[i] * 0.6 + b2[i] * 0.25 + b3[i] * 0.15, l = 95 + t * 150;
    let o = ((y + 256) * W + x) * 4;
    d[o] = l; d[o + 1] = l * 0.93; d[o + 2] = l * 0.84; d[o + 3] = 255;
    const ring = Math.min(y, 255 - y) < 7 ? 0.55 : 1, l2 = (205 + b3[i] * 50) * ring;
    o = ((y + 256) * W + x + 256) * 4;
    d[o] = l2; d[o + 1] = l2; d[o + 2] = l2 * 0.92; d[o + 3] = 255;
  }
  const t = dtex(new Uint8Array(d.buffer), W, H, true, true);
  t.anisotropy = 4;
  return t;
}

function detailAtlas() {
  const mk = () => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; return c; };
  const cv = mk(), ce = mk(), g = cv.getContext('2d'), e = ce.getContext('2d'), rnd = mulberry32(55);
  e.fillStyle = '#000'; e.fillRect(0, 0, 512, 256);
  g.fillStyle = '#3a2218'; g.fillRect(0, 0, 256, 256);
  for (const x0 of [10, 131]) {
    g.fillStyle = '#6a2a1c'; g.fillRect(x0, 10, 115, 246);
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.12})`; g.fillRect(x0 + i * 23, 10, 2, 246); g.fillStyle = `rgba(255,220,180,${rnd() * 0.06})`; g.fillRect(x0 + i * 23 + 2, 10, 21, 246); }
    g.fillStyle = '#c9a23c';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) { g.beginPath(); g.arc(x0 + 18 + c * 26, 34 + r * 46, 4.5, 0, TAU); g.fill(); }
    g.strokeStyle = '#d8b24a'; g.lineWidth = 4; g.beginPath(); g.arc(x0 === 10 ? 108 : 148, 140, 9, 0, TAU); g.stroke();
  }
  g.fillStyle = '#35201a'; g.fillRect(256, 0, 256, 256);
  g.fillStyle = '#e6d8b8'; g.fillRect(270, 14, 228, 228);
  const gr = e.createRadialGradient(384, 128, 10, 384, 128, 170);
  gr.addColorStop(0, '#ffc878'); gr.addColorStop(1, '#d87828');
  e.fillStyle = gr; e.fillRect(270, 14, 228, 228);
  for (const c of [g, e]) {
    c.strokeStyle = c === g ? '#3a241a' : '#000'; c.lineWidth = 7;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(270 + i * 57, 14); c.lineTo(270 + i * 57, 242); c.stroke(); c.beginPath(); c.moveTo(270, 14 + i * 57); c.lineTo(498, 14 + i * 57); c.stroke(); }
    c.lineWidth = 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) c.strokeRect(270 + i * 57 + 17, 14 + j * 57 + 17, 23, 23);
  }
  const ct = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { detail: ct(cv, true), detailEm: ct(ce, true) };
}

const FONT = '"Kaiti SC","STKaiti","KaiTi","Songti SC","PingFang SC","Microsoft YaHei",serif';
export function plaqueTexture(text, o = {}) {
  const vertical = !!o.vertical, n = text.length, u = 96;
  const cv = document.createElement('canvas');
  cv.width = vertical ? u + 40 : u * n + 56; cv.height = vertical ? u * n + 56 : u + 40;
  const g = cv.getContext('2d');
  g.fillStyle = o.border || '#c9a23c'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = o.bg || '#16233a'; g.fillRect(9, 9, cv.width - 18, cv.height - 18);
  g.fillStyle = o.fg || '#f0cf6a'; g.font = `bold ${u * 0.86}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < n; i++) g.fillText(text[i], vertical ? cv.width / 2 : 28 + u * (i + 0.5), vertical ? 28 + u * (i + 0.5) : cv.height / 2 + 4);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, aspect: cv.width / cv.height };
}
// 聚灵台太极八卦石刻
export function taijiTexture() {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), c = S / 2, rnd = mulberry32(9);
  g.fillStyle = '#9b968b'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * 0.07})`; g.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 10, 2 + rnd() * 10); }
  g.strokeStyle = '#5e5a52'; g.lineWidth = 3;
  for (let r = 60; r < 720; r += 46) { g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); }
  for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU; g.beginPath(); g.moveTo(c + Math.cos(a) * 290, c + Math.sin(a) * 290); g.lineTo(c + Math.cos(a) * 720, c + Math.sin(a) * 720); g.stroke(); }
  const R0 = 230;
  g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(c, c, R0, 0, TAU); g.fill();
  g.fillStyle = '#26262b'; g.beginPath(); g.arc(c, c, R0, -Math.PI / 2, Math.PI / 2); g.arc(c, c + R0 / 2, R0 / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(c, c - R0 / 2, R0 / 2, Math.PI / 2, -Math.PI / 2); g.fill();
  g.beginPath(); g.arc(c, c + R0 / 2, R0 / 7, 0, TAU); g.fill();
  g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(c, c - R0 / 2, R0 / 7, 0, TAU); g.fill();
  g.strokeStyle = '#3a8f84'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, R0 + 14, 0, TAU); g.stroke();
  const tri = [7, 3, 5, 1, 0, 4, 2, 6];
  for (let k = 0; k < 8; k++) {
    g.save(); g.translate(c, c); g.rotate((k / 8) * TAU); g.fillStyle = '#2f6f68';
    for (let l = 0; l < 3; l++) { const y = -R0 - 60 - l * 30, solid = (tri[k] >> l) & 1; if (solid) g.fillRect(-58, y, 116, 18); else { g.fillRect(-58, y, 50, 18); g.fillRect(8, y, 50, 18); } }
    g.restore();
  }
  g.strokeStyle = '#3a8f84'; g.lineWidth = 8; g.beginPath(); g.arc(c, c, R0 + 170, 0, TAU); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---- 像素图标（UI 用）
export function iconURL(rows, pal) {
  const n = rows.length;
  const cv = document.createElement('canvas'); cv.width = cv.height = n;
  const ctx = cv.getContext('2d');
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const col = pal[rows[y][x]];
    if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
  }
  return cv.toDataURL();
}
