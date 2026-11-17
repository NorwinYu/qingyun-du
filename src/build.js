// 建筑与地标：中式建筑建模套件、青云村、聚灵台、古修遗迹、浮空仙山
import * as THREE from 'three';
import { GB, mat4 } from './geo.js';
import { plaqueTexture, taijiTexture } from './tex.js';
import * as L from './layout.js';
import { rawHeight, RUINS_H } from './height.js';
import { rockBuilder } from './veg.js';
import { mulberry32 } from './noise.js';
import { buildRegions } from './build2.js';

const TAU = Math.PI * 2;
const MATK = ['plaster', 'wood', 'masonry', 'tile', 'thatch', 'rock', 'paving', 'turf', 'detail', 'plain', 'cloth', 'lantern', 'glow', 'foliage'];
const TILE_GRAY = 0x707a86, TILE_TEAL = 0x4f6f78, TILE_GOLD = 0xf0b030, WOOD_RED = 0x9a3324, WOOD_DARK = 0x54392a, WOOD_NAT = 0xa8845a, WHITE = 0xf4f0e6, BEIGE = 0xe9dcc0, GOLD = 0xd9a83a, STONE = 0xd8d4c8;
const FACE = { '+z': [1, 0, 0, 1], '-z': [-1, 0, 0, -1], '+x': [0, -1, 1, 0], '-x': [0, 1, -1, 0] }; // [hx, hz, nx, nz]
const gy = rawHeight;

export function buildStructures({ scene, mats, col, water, treeBuilders, world }) {
  const pois = { lights: [], emitters: [], interact: [], spirit: [], spots: {} };
  const group = new THREE.Group();
  scene.add(group);
  const I4 = new THREE.Matrix4();
  let B = null, curM = I4;
  const X = (m) => { curM = m || I4; for (const k in B) B[k].xf(m || null); };
  const begin = () => { B = {}; for (const k of MATK) B[k] = new GB(); curM = I4; };
  const flush = () => {
    for (const k in B) {
      if (!B[k].n) continue;
      const m = new THREE.Mesh(B[k].build(), mats[k]);
      m.castShadow = k !== 'glow' && k !== 'detail'; m.receiveShadow = k !== 'glow';
      if (k === 'foliage') m.customDepthMaterial = mats.foliageDepth;
      group.add(m);
    }
    B = null;
  };
  const wp = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(curM);
  const solid = (x0, y0, z0, x1, y1, z1, extra) => {
    const b = new THREE.Box3();
    for (let i = 0; i < 8; i++) b.expandByPoint(wp(i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0));
    return col.add({ x0: b.min.x, y0: b.min.y, z0: b.min.z, x1: b.max.x, y1: b.max.y, z1: b.max.z, ...extra });
  };
  const pillar = (x, z, r, y0, y1, thin) => { const a = wp(x, y0, z), b = wp(x, y1, z); col.add({ cyl: 1, x: a.x, z: a.z, r, y0: a.y, y1: b.y, thin }); };
  const light = (x, y, z, c, i, always) => { const p = wp(x, y, z); pois.lights.push({ p: [p.x, p.y, p.z], c, i, always }); };
  const emit = (type, x, y, z, r, tint) => { const p = wp(x, y, z); pois.emitters.push({ type, x: p.x, y: p.y, z: p.z, r, tint }); };
  const sub = (x, y, z, ry = 0, s = 1) => curM.clone().multiply(mat4(x, y, z, ry, 0, 0, s));
  const addMesh = (geo, mat, m, shadow = true) => { const o = new THREE.Mesh(geo, mat); o.applyMatrix4(m); o.receiveShadow = true; o.castShadow = shadow; group.add(o); return o; };
  const plaque = (text, x, y, z, h, ry = 0, o = {}) => {
    const { tex, aspect } = plaqueTexture(text, o);
    addMesh(new THREE.PlaneGeometry(o.vertical ? h * aspect : h * aspect, h), mats.plaque(tex), sub(x, y, z, ry), false);
  };
  const tree = (kind, x, z, s = 1, y = null, v = 0) => {
    const p = wp(x, y === null ? 0 : y, z), yy = y === null ? gy(p.x, p.z) : p.y;
    B.foliage.merge(treeBuilders[kind][v & 1], mat4(p.x, yy, p.z, (x * 7.3 + z * 3.1) % TAU, 0, 0, s));
    col.add({ cyl: 1, thin: 1, x: p.x, z: p.z, r: (kind === 'bamboo' ? 0.55 : kind === 'peach' ? 0.24 : 0.36) * s, y0: yy - 1, y1: yy + 4.5 * s });
  };
  const rock = (x, y, z, sx, sy = sx * 0.7, seed = 1, c = 0xffffff) => {
    const g = rockBuilder(seed * 17 + 3), m = sub(x, y, z, seed * 1.7).multiply(new THREE.Matrix4().makeScale(sx, sy, sx));
    const base = B.rock.n; B.rock.merge(g, m);
    if (c !== 0xffffff) { const k = new THREE.Color(c); for (let i = base; i < B.rock.n; i++) { B.rock.C[i * 3] *= k.r; B.rock.C[i * 3 + 1] *= k.g; B.rock.C[i * 3 + 2] *= k.b; } }
    if (sx > 0.6) pillar(x, z, sx * 0.78, y - 2, y + sy * 0.62);
  };

  // ---- 构件
  const opening = (kind, cx, cy, cz, w, h, face, frame = WOOD_DARK) => {
    const F = FACE[face], u0 = kind === 'door' ? 0 : 0.5;
    B.detail.card(cx + F[2] * 0.03, cy, cz + F[3] * 0.03, (F[0] * w) / 2, 0, (F[1] * w) / 2, 0, h / 2, 0, u0 + 0.004, 0, u0 + 0.496, 1, F[2], 0, F[3]);
    const fx = F[0] * (w / 2 + 0.06), fz = F[1] * (w / 2 + 0.06), px = cx + F[2] * 0.05, pz = cz + F[3] * 0.05;
    B.wood.col(frame, 1.4);
    B.wood.beam(px - fx, cy + h / 2 + 0.06, pz - fz, px + fx, cy + h / 2 + 0.06, pz + fz, 0.12, 0.13);
    if (kind !== 'door') B.wood.beam(px - fx, cy - h / 2 - 0.06, pz - fz, px + fx, cy - h / 2 - 0.06, pz + fz, 0.14, 0.1);
    for (const s of [-1, 1]) B.wood.beam(px + fx * s, cy - h / 2, pz + fz * s, px + fx * s, cy + h / 2 + 0.1, pz + fz * s, 0.12, 0.12);
  };
  const prof = (t) => 0.35 * t + 0.65 * t * t;
  // 悬山顶：屋脊沿 x；返回屋面高度函数 Y(x, z)
  const gableRoof = (w, d, y0, rise, o = {}) => {
    const over = o.over ?? 0.8, og = o.og ?? 0.55, mat = o.mat || 'tile', tc = o.col || TILE_GRAY, k = o.k || 1.7, lift = o.lift ?? 0.2;
    const S = d / 2 + over, hx = w / 2 + og, R = rise / (1 - prof(over / S)), yE = y0 + rise - R, sl = Math.hypot(S, R);
    const Y = (u, t) => yE + R * prof(t) + lift * Math.pow(Math.abs(u * 2 - 1), 4) * (1 - t);
    for (const sg of [1, -1]) {
      B[mat].col(tc, k).surf(10, 6, (u, t, p) => { p[0] = (u * 2 - 1) * hx; p[1] = Y(u, t); p[2] = sg * S * (1 - t); p[3] = p[0] / 2; p[4] = (t * sl) / 2; }, sg < 0);
      B.wood.col(WOOD_DARK, 1.2).surf(6, 3, (u, t, p) => { p[0] = (u * 2 - 1) * hx; p[1] = Y(u, t) - 0.14; p[2] = sg * S * (1 - t); p[3] = p[0] / 2; p[4] = (t * sl) / 2; }, sg > 0);
      for (let i = 0; i < 4; i++) { const u0 = i / 4, u1 = (i + 1) / 4; B.wood.beam((u0 * 2 - 1) * hx, Y(u0, 0) - 0.07, sg * S, (u1 * 2 - 1) * hx, Y(u1, 0) - 0.07, sg * S, 0.1, 0.17); }
      for (const ex of [0, 1]) for (let i = 0; i < 5; i++) { const t0 = i / 5, t1 = (i + 1) / 5, x = (ex * 2 - 1) * hx; B.wood.beam(x, Y(ex, t0) - 0.13, sg * S * (1 - t0), x, Y(ex, t1) - 0.13, sg * S * (1 - t1), 0.08, 0.3); }
    }
    const yR = y0 + rise;
    B.plain.col(o.ridge || 0x3c4046).box(-hx - 0.05, yR - 0.06, -0.17, hx + 0.05, yR + 0.26, 0.17);
    for (const ex of [-1, 1]) B.plain.beam(ex * hx, yR + 0.16, 0, ex * (hx + 0.45), yR + 0.7, 0, 0.3, 0.16);
    // 山墙三角
    for (const ex of [-1, 1]) B.plaster.col(o.wall || WHITE).surf(8, 1, (u, v, p) => {
      const z = (u * 2 - 1) * (d / 2), top = Y((ex * (w / 2) + hx) / (2 * hx), 1 - Math.abs(z) / S) - 0.14;
      p[0] = ex * (w / 2); p[1] = y0 + (top - y0) * v; p[2] = z; p[3] = z * 0.4; p[4] = p[1] * 0.4;
    }, ex > 0);
  };
  // 庑殿 / 攒尖顶：a、b 为墙体半宽半深
  const hipRoof = (a, b, y0, rise, o = {}) => {
    const over = o.over ?? 1.0, lift = o.lift ?? 0.55, mat = o.mat || 'tile', tc = o.col || TILE_GRAY, k = o.k || 1.7;
    const A = a + over, Bz = b + over, ra = o.ra ?? Math.max(0, A - Bz), R = rise / (1 - prof(over / Bz)), yE = y0 + rise - R, sl = Math.hypot(Bz, R);
    const Y = (u, t) => yE + R * prof(t) + lift * Math.pow(Math.abs(u), 3) * (1 - t) * (1 - t);
    const both = (fn, flipTop) => {
      B[mat].col(tc, k).surf(12, 6, fn, flipTop);
      B.wood.col(o.under || WOOD_DARK, 1.2).surf(8, 3, (u, t, p) => { fn(u, t, p); p[1] -= 0.14; }, !flipTop);
    };
    for (const sg of [1, -1]) {
      both((uu, t, p) => { const u = uu * 2 - 1; p[0] = (A + (ra - A) * t) * u; p[1] = Y(u, t); p[2] = sg * Bz * (1 - t); p[3] = p[0] / 2; p[4] = (t * sl) / 2; }, sg < 0);
      both((uu, t, p) => { const u = uu * 2 - 1; p[0] = sg * (A - (A - ra) * t); p[1] = Y(u, t); p[2] = u * Bz * (1 - t); p[3] = p[2] / 2; p[4] = (t * sl) / 2; }, sg > 0);
      B.wood.col(o.under || WOOD_DARK, 1.3);
      for (let i = 0; i < 8; i++) {
        const u0 = (i / 8) * 2 - 1, u1 = ((i + 1) / 8) * 2 - 1;
        B.wood.beam(u0 * A, Y(u0, 0) - 0.07, sg * Bz, u1 * A, Y(u1, 0) - 0.07, sg * Bz, 0.1, 0.17);
        B.wood.beam(sg * A, Y(u0, 0) - 0.07, u0 * Bz, sg * A, Y(u1, 0) - 0.07, u1 * Bz, 0.1, 0.17);
      }
    }
    B.plain.col(o.ridge || 0x3c4046);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pts = [[sx * (A + 0.4), Y(1, 0) + 0.5, sz * (Bz + 0.4), 0.05], [sx * (A + 0.12), Y(1, 0) + 0.2, sz * (Bz + 0.12), 0.09]];
      for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([sx * (A + (ra - A) * t), Y(1, t) + 0.07, sz * Bz * (1 - t), 0.1]); }
      B.plain.tube(pts, 6);
    }
    const yR = y0 + rise;
    if (ra > 0.3) {
      B.plain.box(-ra - 0.1, yR - 0.05, -0.18, ra + 0.1, yR + 0.3, 0.18);
      for (const ex of [-1, 1]) B.plain.col(o.orn || o.ridge || 0x3c4046).beam(ex * ra, yR + 0.2, 0, ex * (ra + 0.5), yR + 0.85, 0, 0.32, 0.18);
    } else {
      B.plain.col(o.orn || GOLD, 1.2).lathe(0, yR - 0.1, 0, [[0.3, 0], [0.34, 0.15], [0.16, 0.32], [0.3, 0.55], [0.26, 0.75], [0.08, 0.95], [0.12, 1.1], [0.02, 1.5]], 8);
    }
    return Y;
  };
  const lantern = (x, y, z, s = 1, c = 0xff4a22) => {
    B.plain.col(0x2a2018).box(x - 0.012, y + 0.2 * s, z - 0.012, x + 0.012, y + 0.62 * s, z + 0.012);
    B.lantern.col(c).lathe(x, y, z, [[0.07 * s, -0.24 * s], [0.2 * s, -0.15 * s], [0.26 * s, 0], [0.2 * s, 0.15 * s], [0.07 * s, 0.24 * s]], 8);
    B.plain.col(GOLD).cyl(x, y + 0.22 * s, z, 0.09 * s, 0.09 * s, 0.05 * s, 8).cyl(x, y - 0.27 * s, z, 0.09 * s, 0.09 * s, 0.05 * s, 8, 0.5, 1, 1);
    B.lantern.col(c, 0.6).box(x - 0.015, y - 0.55 * s, z - 0.015, x + 0.015, y - 0.27 * s, z + 0.015);
    light(x, y, z, [1, 0.52, 0.24], 1);
  };
  const stoneLamp = (x, z, y = null) => {
    const b = y === null ? gy(wp(x, 0, z).x, wp(x, 0, z).z) - curM.elements[13] : y;
    B.masonry.col(STONE).box(x - 0.3, b - 0.3, z - 0.3, x + 0.3, b + 0.18, z + 0.3).cyl(x, b + 0.18, z, 0.13, 0.11, 0.85, 8).box(x - 0.27, b + 1.03, z - 0.27, x + 0.27, b + 1.12, z + 0.27);
    B.lantern.col(0xffc468).box(x - 0.17, b + 1.12, z - 0.17, x + 0.17, b + 1.45, z + 0.17, 0.5, 12);
    B.masonry.col(STONE);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.masonry.box(x + sx * 0.19 - 0.03, b + 1.12, z + sz * 0.19 - 0.03, x + sx * 0.19 + 0.03, b + 1.45, z + sz * 0.19 + 0.03);
    { const m = curM; X(sub(x, b + 1.45, z, Math.PI / 4)); B.masonry.cyl(0, 0, 0, 0.44, 0.06, 0.32, 4).sphere(0, 0.35, 0, 0.07, 0.07, 0.07, 6, 4); X(m === I4 ? null : m); }
    pillar(x, z, 0.3, b - 1, b + 1.7, 1);
    light(x, b + 1.3, z, [1, 0.72, 0.4], 0.9);
  };
  const crate = (x, y, z, s = 0.7, ry = 0) => { const m = curM; X(sub(x, y, z, ry)); B.wood.col(WOOD_NAT, 1.25).box(-s / 2, 0, -s / 2, s / 2, s, s / 2, 1); B.wood.col(WOOD_DARK, 1.2); for (const e of [-1, 1]) B.wood.box(e * s / 2 - 0.03, 0, -s / 2 - 0.02, e * s / 2 + 0.03, s + 0.02, s / 2 + 0.02); X(m === I4 ? null : m); };
  const barrel = (x, y, z, s = 1) => {
    B.wood.col(0x8a6238, 1.3).lathe(x, y, z, [[0.26 * s, 0], [0.33 * s, 0.25 * s], [0.34 * s, 0.5 * s], [0.31 * s, 0.75 * s], [0.25 * s, 0.9 * s], [0, 0.9 * s]], 10);
    B.plain.col(0x3a3630); for (const h of [0.18, 0.7]) B.plain.cyl(x, y + h * s, z, 0.335 * s, 0.335 * s, 0.05 * s, 10, 0.5, 0);
  };
  const pot = (x, y, z, s = 1, c = 0x8a5236) => B.plain.col(c).lathe(x, y, z, [[0.12 * s, 0], [0.24 * s, 0.14 * s], [0.27 * s, 0.32 * s], [0.18 * s, 0.5 * s], [0.13 * s, 0.56 * s], [0.17 * s, 0.62 * s], [0.12 * s, 0.6 * s]], 10);
  const hay = (x, y, z, s = 1) => B.thatch.col(0xffffff).cyl(x, y, z, 0.55 * s, 0.5 * s, 0.7 * s, 10, 0.5, 1);
  const bench = (x, y, z, len = 1.6, ry = 0) => { const m = curM; X(sub(x, y, z, ry)); B.wood.col(WOOD_NAT, 1.2).box(-len / 2, 0.4, -0.18, len / 2, 0.47, 0.18, 1); for (const e of [-1, 1]) B.wood.box(e * (len / 2 - 0.15) - 0.04, 0, -0.15, e * (len / 2 - 0.15) + 0.04, 0.4, 0.15, 1); X(m === I4 ? null : m); };
  const table = (x, y, z, w = 1.3, d = 0.8) => { B.wood.col(WOOD_DARK, 1.5).box(x - w / 2, y + 0.68, z - d / 2, x + w / 2, y + 0.75, z + d / 2, 1); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.wood.box(x + sx * (w / 2 - 0.08) - 0.04, y, z + sz * (d / 2 - 0.08) - 0.04, x + sx * (w / 2 - 0.08) + 0.04, y + 0.68, z + sz * (d / 2 - 0.08) + 0.04, 1); };
  const banner = (text, x, y, z, ry, bg) => {
    B.wood.col(WOOD_DARK, 1.3).cyl(x, y, z, 0.05, 0.04, 3.4, 6);
    const m = curM; X(sub(x, y, z, ry));
    B.wood.beam(0, 3.2, 0, 0.75, 3.2, 0, 0.04, 0.05);
    plaque(text, 0.42, 2.45, 0.02, 1.35, 0, { vertical: true, bg, fg: '#fff3d0', border: '#3a2a1a' });
    plaque(text, 0.42, 2.45, -0.02, 1.35, Math.PI, { vertical: true, bg, fg: '#fff3d0', border: '#3a2a1a' });
    X(m === I4 ? null : m);
    pillar(x, z, 0.1, y, y + 3.4, 1);
  };
  const fence = (x0, z0, x1, z1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 2));
    B.wood.col(WOOD_NAT, 1.15);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = gy(x, z);
      B.wood.cyl(x, y - 0.2, z, 0.06, 0.05, 1.2, 5);
      if (i < n) { const t2 = (i + 1) / n, xb = x0 + (x1 - x0) * t2, zb = z0 + (z1 - z0) * t2, yb = gy(xb, zb); for (const h of [0.42, 0.82]) B.wood.beam(x, y + h, z, xb, yb + h, zb, 0.04, 0.09); }
    }
    const y = gy((x0 + x1) / 2, (z0 + z1) / 2);
    col.add({ x0: Math.min(x0, x1) - 0.08, x1: Math.max(x0, x1) + 0.08, z0: Math.min(z0, z1) - 0.08, z1: Math.max(z0, z1) + 0.08, y0: y - 1, y1: y + 1.0, thin: 1 });
  };
  const chest = (x, y, z, ry = 0) => {
    const m = curM; X(sub(x, y, z, ry));
    B.wood.col(0x6a3a22, 1.4).box(-0.5, 0, -0.32, 0.5, 0.42, 0.32, 1);
    B.wood.col(0x7a4428, 1.4).surf(1, 6, (u, v, p) => { const a = v * Math.PI; p[0] = u - 0.5; p[1] = 0.42 + Math.sin(a) * 0.22; p[2] = Math.cos(a) * 0.32; p[3] = u; p[4] = v; });
    B.plain.col(GOLD, 1.3);
    for (const e of [-0.5, 0.5]) B.plain.surf(1, 6, (u, v, p) => { const a = v * Math.PI; p[0] = e; p[1] = 0.42 + Math.sin(a) * 0.22 * u; p[2] = Math.cos(a) * 0.32; p[3] = u; p[4] = v; }, e > 0);
    for (const e of [-0.36, 0, 0.36]) B.plain.box(e - 0.045, -0.005, -0.335, e + 0.045, 0.43, 0.335);
    B.plain.box(-0.08, 0.3, 0.32, 0.08, 0.46, 0.37);
    X(m === I4 ? null : m);
    pillar(x, z, 0.5, y - 0.5, y + 0.6);
    light(x, y + 0.8, z, [1, 0.8, 0.35], 0.5, 1);
  };

  // ---- 民居
  const house = (x, z, rot, o = {}) => {
    const w = o.w || 9, d = o.d || 6.4, h = o.h || 3.1, hb = 0.4, y = gy(x, z), thatch = o.roof === 'thatch', wall = o.wall || WHITE;
    X(mat4(x, y, z, rot));
    B.masonry.col(0xffffff).box(-w / 2 - 0.6, -1, -d / 2 - 0.6, w / 2 + 0.6, hb, d / 2 + 0.6).box(-1.1, -1, d / 2 + 0.6, 1.1, hb * 0.5, d / 2 + 1.05);
    B.plaster.col(wall).box(-w / 2, hb, -d / 2, w / 2, hb + h, d / 2, 0.4, 8);
    B.masonry.col(0xb9b5ab).box(-w / 2 - 0.04, hb, -d / 2 - 0.04, w / 2 + 0.04, hb + 0.8, d / 2 + 0.04, 0.5, 8);
    const wc = o.wood || WOOD_DARK;
    B.wood.col(wc, 1.4);
    const nb = Math.max(2, Math.round(w / 3));
    for (let i = 0; i <= nb; i++) for (const sz of [-1, 1]) B.wood.cyl(-w / 2 + (w * i) / nb, hb, (sz * d) / 2, 0.15, 0.15, h, 8);
    B.wood.box(-w / 2 - 0.1, hb + h - 0.3, -d / 2 - 0.1, w / 2 + 0.1, hb + h, d / 2 + 0.1, 0.5, 8);
    opening('door', 0, hb + 1.1, d / 2, 1.5, 2.2, '+z', wc);
    const wx = w / 2 - w / nb / 2;
    for (const s of [-1, 1]) { opening('win', s * wx, hb + 1.8, d / 2, 1.15, 1.15, '+z', wc); opening('win', s * wx, hb + 1.8, -d / 2, 1.0, 1.0, '-z', wc); opening('win', (s * w) / 2, hb + 1.8, 0, 1.0, 1.0, s > 0 ? '+x' : '-x', wc); }
    if (thatch) hipRoof(w / 2, d / 2, hb + h, d * 0.42, { mat: 'thatch', col: 0xffffff, k: 1, lift: 0.05, over: 0.75, ridge: 0x6a5430, under: 0x6a5430, orn: 0x6a5430 });
    else gableRoof(w, d, hb + h, d * 0.36, { col: o.tile || TILE_GRAY, wall });
    if (o.lantern !== false) for (const s of [-1, 1]) lantern(s * 1.25, hb + 2.35, d / 2 + 0.55, 0.9);
    if (o.sign) plaque(o.sign, 0, hb + 2.72, d / 2 + 0.12, 0.5, 0, o.signOpt);
    if (o.smoke) emit('smoke', w / 4, hb + h + d * 0.36 + 0.4, 0);
    solid(-w / 2 - 0.12, 0, -d / 2 - 0.12, w / 2 + 0.12, hb + h + 2.4, d / 2 + 0.12);
    solid(-w / 2 - 0.6, -1, -d / 2 - 0.6, w / 2 + 0.6, hb, d / 2 + 0.6); solid(-1.1, -1, d / 2 + 0.6, 1.1, hb * 0.5, d / 2 + 1.05);
    return { w, d, hb, h };
  };

  // ================= 青云村 =================
  begin();
  const VY = L.VILLAGE_H;
  // 北排（朝南）与南排（朝北）
  house(-54, -10.5, 0, { w: 9, roof: 'thatch', wall: BEIGE, smoke: 1 });
  house(-24, -10.5, 0, { w: 10 });
  house(-11.5, -11.5, 0, { w: 7.5, d: 6, wall: BEIGE, tile: 0x7a6a5e });
  house(13, -11, 0, { w: 9, smoke: 1 });
  house(26, -10.5, 0, { w: 8.5, roof: 'thatch', wall: BEIGE });
  house(53, -10.5, 0, { w: 9.5, tile: 0x7a6a5e });
  house(-54, 10.5, Math.PI, { w: 10, d: 7, sign: '百炼铺', smoke: 1, tile: 0x5c5a5a });
  house(-39, 10.5, Math.PI, { w: 8, roof: 'thatch', wall: BEIGE });
  house(-22.5, 11, Math.PI, { w: 12, d: 7.5, h: 3.5, sign: '悦来客栈', wood: WOOD_RED, signOpt: { bg: '#5a1a14' } });
  house(22.5, 10.5, Math.PI, { w: 9.5, sign: '回春堂', signOpt: { bg: '#1c3a2a' } });
  house(44, 10.5, Math.PI, { w: 8.5, wall: BEIGE, smoke: 1 });
  house(58, 10.5, Math.PI, { w: 8, roof: 'thatch' });
  X(null);
  // 铁匠铺：炉、砧、兵器架
  X(mat4(-47, VY, 5.2));
  B.masonry.col(0xa8a49a).box(-0.8, 0, -0.7, 0.8, 1.0, 0.7).box(-0.45, 1.0, -0.45, 0.45, 2.3, 0.45);
  B.lantern.col(0xff7a2a).box(-0.5, 0.45, 0.66, 0.5, 0.85, 0.72);
  solid(-0.8, 0, -0.7, 0.8, 2.3, 0.7); emit('ember', 0, 1.05, 0.5); emit('smoke', 0, 2.5, 0, 0, [0.4, 0.4, 0.42]); light(0, 1, 1.0, [1, 0.5, 0.2], 1.2, 1);
  B.plain.col(0x34363c).box(-2.3, 0, -0.25, -1.7, 0.5, 0.25).box(-2.5, 0.5, -0.2, -1.5, 0.72, 0.2).box(-2.75, 0.58, -0.1, -2.5, 0.7, 0.1);
  pillar(-2, 0, 0.45, 0, 0.7);
  B.wood.col(WOOD_DARK, 1.3).box(1.6, 0, -0.5, 1.7, 1.5, -0.4).box(3.0, 0, -0.5, 3.1, 1.5, -0.4).box(1.6, 1.4, -0.52, 3.1, 1.5, -0.38).box(1.6, 0.5, -0.5, 3.1, 0.58, -0.4);
  B.plain.col(0xc8ccd4); for (let i = 0; i < 4; i++) B.plain.box(1.85 + i * 0.33, 0.2, -0.47, 1.9 + i * 0.33, 1.45, -0.44);
  solid(1.6, 0, -0.55, 3.1, 1.5, -0.35);
  barrel(-3.6, 0, 0.6); crate(4.2, 0, 0.2, 0.7, 0.3);
  X(null);
  banner('铁', -60.5, VY, 5.6, 0, '#3a2a22'); banner('药', 28.6, VY, 5.6, 0, '#1c4a32'); banner('酒', -15, VY, 6, 0, '#7a1c14');
  // 客栈外桌椅
  X(mat4(-28, VY, 4.9)); table(0, 0, 0); bench(0, 0, 0.75); bench(0, 0, -0.75); pot(0.3, 0.75, 0.1, 0.45, 0x3a5a6a); pillar(0, 0, 0.75, 0, 0.75);
  X(mat4(-19, VY, 4.9)); table(0, 0, 0); bench(0, 0, 0.75); bench(0, 0, -0.75); pillar(0, 0, 0.75, 0, 0.75); barrel(2.3, 0, 0.4); barrel(3.0, 0, 0.1, 0.85);
  // 药铺晒架
  X(mat4(17.2, VY, 5.3));
  B.wood.col(WOOD_NAT, 1.2); for (const e of [-1, 1]) { B.wood.box(e * 0.9 - 0.04, 0, -0.04, e * 0.9 + 0.04, 1.3, 0.04, 1); }
  for (let i = 0; i < 3; i++) { B.wood.box(-0.95, 0.4 + i * 0.4, -0.3, 0.95, 0.44 + i * 0.4, 0.3, 1); B.plain.col([0x5a8a3a, 0xc8a84a, 0x9a5a3a][i]).cyl(-0.4, 0.44 + i * 0.4, 0, 0.26, 0.26, 0.04, 10).cyl(0.4, 0.44 + i * 0.4, 0, 0.26, 0.26, 0.04, 10); B.wood.col(WOOD_NAT, 1.2); }
  pillar(0, 0, 0.8, 0, 1.3); pot(1.5, 0, 0.2, 1, 0x7a4a32); pot(2.0, 0, -0.1, 0.8);
  X(null);

  // 村长大殿「青云堂」
  {
    const hx = 0, hz = -45;
    X(mat4(hx, VY, hz));
    B.masonry.col(0xffffff).box(-11, -1, -7.5, 11, 0.5, 7.5).box(-9.6, 0.5, -6.3, 9.6, 1.0, 6.3);
    solid(-11, -1, -7.5, 11, 0.5, 7.5); solid(-9.6, 0.5, -6.3, 9.6, 1.0, 6.3);
    for (let i = 0; i < 5; i++) B.masonry.box(-2.6, -1, 7.5 + i * 0.36, 2.6, 1.0 - (i + 1) * 0.2, 7.5 + (i + 1) * 0.36);
    solid(-2.6, 0, 6.3, 2.6, 1.0, 9.3, { ramp: { ax: 'z', ya: VY + 1.0, yb: VY + 0.02 } });
    for (const e of [-1, 1]) { B.masonry.col(STONE).box(e * 2.9 - 0.25, 0, 7.5, e * 2.9 + 0.25, 1.25, 9.4); solid(e * 2.9 - 0.25, 0, 7.5, e * 2.9 + 0.25, 1.25, 9.4); }
    const y1 = 1.0, w = 15, d = 8, h = 4.3;
    B.plaster.col(WHITE).box(-w / 2, y1, -d / 2, w / 2, y1 + h, d / 2, 0.4, 8);
    B.masonry.col(0xb9b5ab).box(-w / 2 - 0.04, y1, -d / 2 - 0.04, w / 2 + 0.04, y1 + 0.9, d / 2 + 0.04, 0.5, 8);
    B.wood.col(WOOD_RED, 1.5);
    for (let i = 0; i <= 6; i++) { const cx = -w / 2 + (w * i) / 6; B.wood.cyl(cx, y1, d / 2, 0.2, 0.2, h, 10).cyl(cx, y1, -d / 2, 0.2, 0.2, h, 10); }
    for (let i = 0; i <= 6; i++) { const cx = -8.4 + 2.8 * i; B.wood.cyl(cx, y1, d / 2 + 1.7, 0.22, 0.2, h, 10); B.masonry.col(STONE).cyl(cx, y1, d / 2 + 1.7, 0.32, 0.27, 0.22, 10); B.wood.col(WOOD_RED, 1.5); pillar(cx, d / 2 + 1.7, 0.24, y1, y1 + h, 1); }
    B.wood.col(0x2f5a6a, 1.4).box(-w / 2 - 0.15, y1 + h - 0.45, -d / 2 - 0.15, w / 2 + 0.15, y1 + h, d / 2 + 0.15, 0.5, 8).box(-8.6, y1 + h - 0.4, d / 2 + 1.55, 8.6, y1 + h - 0.05, d / 2 + 1.85, 0.5);
    for (const cx of [-5, -2.5, 0, 2.5, 5]) { if (Math.abs(cx) < 3) opening('door', cx, y1 + 1.35, d / 2, 1.9, 2.7, '+z', WOOD_RED); else opening('win', cx, y1 + 2.0, d / 2, 1.6, 1.6, '+z', WOOD_RED); }
    for (const s of [-1, 1]) { opening('win', (s * w) / 2, y1 + 2.0, 0, 1.6, 1.6, s > 0 ? '+x' : '-x', WOOD_RED); opening('win', s * 3.5, y1 + 2.0, -d / 2, 1.6, 1.6, '-z', WOOD_RED); }
    hipRoof(w / 2, d / 2 + 0.9, y1 + h, 1.7, { over: 1.5, lift: 0.75, col: TILE_TEAL, ra: 6.2, orn: GOLD });
    B.plaster.col(WHITE).box(-6, y1 + h + 0.6, -3, 6, y1 + h + 2.6, 3, 0.4, 8);
    B.wood.col(WOOD_RED, 1.5); for (let i = 0; i <= 4; i++) for (const sz of [-1, 1]) B.wood.cyl(-6 + 3 * i, y1 + h + 0.6, sz * 3, 0.17, 0.17, 2.0, 8);
    for (const cx of [-3, 0, 3]) opening('win', cx, y1 + h + 1.75, 3, 1.5, 0.9, '+z', WOOD_RED);
    B.wood.col(0x2f5a6a, 1.4).box(-6.1, y1 + h + 2.3, -3.1, 6.1, y1 + h + 2.6, 3.1, 0.5, 8);
    hipRoof(6, 3, y1 + h + 2.6, 2.7, { over: 1.5, lift: 0.85, col: TILE_TEAL, orn: GOLD });
    plaque('青云堂', 0, y1 + h + 1.15, d / 2 + 2.6, 1.0, 0, { bg: '#14233c' });
    for (const s of [-1, 1]) { lantern(s * 4.2, y1 + 3.0, d / 2 + 1.7, 1.5); stoneLamp(s * 5.2, 10.6, 0); }
    solid(-w / 2 - 0.15, y1, -d / 2 - 0.15, w / 2 + 0.15, y1 + h + 6, d / 2 + 0.15);
    emit('smoke', 4, y1 + h + 5.6, 0);
    X(null);
  }
  pois.spots.chief = [1.5, VY, -32.5];

  // 藏经塔
  {
    X(mat4(42, VY, -46));
    B.masonry.col(0xffffff).box(-4.6, -1, -4.6, 4.6, 0.6, 4.6).box(-1.4, -1, 4.6, 1.4, 0.3, 5.1);
    solid(-4.6, -1, -4.6, 4.6, 0.6, 4.6); solid(-1.4, -1, 4.6, 1.4, 0.3, 5.1);
    let y = 0.6;
    const S = [3.0, 2.65, 2.3, 1.95, 1.6];
    S.forEach((s, i) => {
      B.plaster.col(WHITE).box(-s, y, -s, s, y + 3.1, s, 0.4, 8);
      B.wood.col(WOOD_RED, 1.5);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.wood.cyl(sx * s, y, sz * s, 0.17, 0.17, 3.1, 8);
      B.wood.box(-s - 0.1, y + 2.8, -s - 0.1, s + 0.1, y + 3.1, s + 0.1, 0.5, 8);
      for (const f of ['+z', '-z', '+x', '-x']) { const F = FACE[f]; opening(i === 0 && f === '+z' ? 'door' : 'win', F[2] * s, i === 0 && f === '+z' ? y + 1.1 : y + 1.7, F[3] * s, i === 0 && f === '+z' ? 1.4 : 1.0, i === 0 && f === '+z' ? 2.2 : 1.0, f, WOOD_RED); }
      hipRoof(s, s, y + 3.1, i === 4 ? 2.3 : 1.0, { over: 1.15, lift: 0.5, col: 0x5a6a7a, orn: GOLD });
      y += 3.65;
    });
    B.plain.col(GOLD, 1.3).cyl(0, y + 1.75, 0, 0.05, 0.02, 1.6, 6);
    for (const s of [-1, 1]) lantern(s * 1.3, 0.6 + 2.2, 3.55, 0.9);
    solid(-3.1, 0, -3.1, 3.1, y + 2, 3.1);
    plaque('藏经塔', 0, 0.6 + 2.62, 3.1, 0.42, 0);
    X(null);
  }

  // 牌坊与石桥
  {
    X(mat4(0, VY, 33));
    for (const [cx, hh] of [[-5.6, 4.2], [-2.7, 5.6], [2.7, 5.6], [5.6, 4.2]]) {
      B.masonry.col(STONE).box(cx - 0.5, -0.5, -0.6, cx + 0.5, 0.7, 0.6);
      B.wood.col(WOOD_RED, 1.5).cyl(cx, 0.7, 0, 0.26, 0.24, hh - 0.7, 10);
      pillar(cx, 0, 0.5, 0, hh);
    }
    B.wood.col(0x2f5a6a, 1.4).box(-2.9, 4.5, -0.16, 2.9, 4.95, 0.16).box(-2.9, 3.6, -0.13, 2.9, 3.85, 0.13);
    for (const s of [-1, 1]) B.wood.box(s * 4.15 - 1.6, 3.3, -0.14, s * 4.15 + 1.6, 3.7, 0.14).box(s * 4.15 - 1.6, 2.7, -0.11, s * 4.15 + 1.6, 2.9, 0.11);
    gableRoof(6.4, 0.9, 5.6, 0.75, { over: 0.75, og: 0.5, col: TILE_TEAL, lift: 0.35 });
    for (const s of [-1, 1]) { const m = curM; X(sub(s * 4.3, 0, 0)); gableRoof(3.4, 0.8, 4.2, 0.6, { over: 0.65, og: 0.4, col: TILE_TEAL, lift: 0.3 }); X(m); }
    plaque('青云村', 0, 4.22, 0.18, 0.72, 0); plaque('青云村', 0, 4.22, -0.18, 0.72, Math.PI);
    for (const s of [-1, 1]) lantern(s * 1.6, 3.2, 0, 1.2);
    X(null);
    stoneLamp(-3.4, 28); stoneLamp(3.4, 28);
  }
  {
    const z0 = 37, z1 = 67.5, hw = 2.4, n = 14, yA = gy(0, z0) - 0.05, yB = gy(0, z1) - 0.05, rise = 2.9;
    const Yd = (t) => yA + (yB - yA) * t + rise * Math.sin(Math.PI * t);
    const Yu = (t) => { const q = (t - 0.5) / 0.37; return Math.abs(q) < 1 ? -3.2 + (Yd(0.5) - 0.55 + 3.2) * Math.sqrt(1 - q * q) : -3.2; };
    B.paving.col(0xffffff).surf(n * 2, 1, (u, v, p) => { p[0] = (v * 2 - 1) * hw; p[1] = Yd(u); p[2] = z0 + (z1 - z0) * u; p[3] = p[0] * 0.5; p[4] = p[2] * 0.5; });
    for (const sx of [-1, 1]) B.masonry.col(0xe2ded2).surf(n * 3, 1, (u, v, p) => { p[0] = sx * hw; p[1] = Yu(u) + (Yd(u) + 0.02 - Yu(u)) * v; p[2] = z0 + (z1 - z0) * u; p[3] = p[2] * 0.5; p[4] = p[1] * 0.5; }, sx > 0);
    B.masonry.col(0xb0aca2).surf(n * 3, 1, (u, v, p) => { p[0] = (v * 2 - 1) * hw; p[1] = Yu(u); p[2] = z0 + (z1 - z0) * u; p[3] = p[0] * 0.5; p[4] = p[2] * 0.5; }, true);
    for (const sx of [-1, 1]) {
      B.masonry.col(STONE);
      for (let i = 0; i <= n; i++) {
        const t = i / n, z = z0 + (z1 - z0) * t, x = sx * (hw - 0.14);
        B.masonry.box(x - 0.13, Yd(t) - 0.1, z - 0.13, x + 0.13, Yd(t) + 1.0, z + 0.13).sphere(x, Yd(t) + 1.1, z, 0.15, 0.15, 0.15, 6, 4);
        if (i < n) { const t2 = (i + 1) / n, zb = z0 + (z1 - z0) * t2; B.masonry.beam(x, Yd(t) + 0.82, z, x, Yd(t2) + 0.82, zb, 0.12, 0.14).beam(x, Yd(t) + 0.4, z, x, Yd(t2) + 0.4, zb, 0.07, 0.5); }
      }
    }
    for (let i = 0; i < n; i++) {
      const ya = Yd(i / n), yb = Yd((i + 1) / n), za = z0 + ((z1 - z0) * i) / n, zb = z0 + ((z1 - z0) * (i + 1)) / n;
      col.add({ x0: -hw, x1: hw, z0: za, z1: zb, y0: Math.min(ya, yb) - 0.6, y1: Math.max(ya, yb), ramp: { ax: 'z', ya, yb } });
      for (const sx of [-1, 1]) col.add({ x0: sx > 0 ? hw - 0.28 : -hw, x1: sx > 0 ? hw : -hw + 0.28, z0: za, z1: zb, y0: Math.min(ya, yb) - 0.6, y1: Math.max(ya, yb) + 1, ramp: { ax: 'z', ya: ya + 1, yb: yb + 1 } });
    }
    stoneLamp(-3.2, 70.5); stoneLamp(3.2, 70.5);
  }

  // 广场：古树、石坛、水井、丹炉、摊位
  tree('ginkgo', 0, 0, 2.1, null, 1);
  X(mat4(0, VY, 0));
  B.masonry.col(STONE).lathe(0, -0.3, 0, [[2.5, 0], [2.6, 0.75], [2.45, 0.85], [2.1, 0.85], [2.1, 0.6]], 20);
  B.turf.col(0xb8c890).disc(0, 0.6, 0, 2.1, 20, 0.4);
  col.add({ cyl: 1, x: 0, z: 0, r: 2.6, y0: 0, y1: VY + 0.55 });
  emit('leaf', 0, 9, 0, 6);
  for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.785; stoneLamp(Math.cos(a) * 9.6, Math.sin(a) * 9.6, 0); }
  bench(3.6, 0, 0.8, 1.7, 1.2); bench(-3.5, 0, -1.2, 1.7, -1.9);
  X(mat4(8.5, VY, 8.5));
  B.masonry.col(STONE).lathe(0, -0.3, 0, [[0.95, 0], [1.0, 1.0], [0.92, 1.08], [0.68, 1.08], [0.68, 0.5]], 14);
  B.plain.col(0x1a3038).disc(0, 0.25, 0, 0.68, 14);
  B.wood.col(WOOD_DARK, 1.3); for (const e of [-1, 1]) B.wood.box(e * 1.05 - 0.07, 0, -0.07, e * 1.05 + 0.07, 2.3, 0.07, 1);
  B.wood.beam(-1.15, 1.8, 0, 1.15, 1.8, 0, 0.12, 0.12);
  B.plain.col(0x8a7a5a).box(-0.012, 1.0, -0.012, 0.012, 1.8, 0.012); barrel(0, 0.82, 0, 0.42);
  { const m = curM; X(sub(0, 0, 0)); gableRoof(2.6, 1.3, 2.3, 0.55, { over: 0.4, og: 0.3, lift: 0.1 }); X(m); }
  pillar(0, 0, 1.05, 0, 1.1);
  X(mat4(14.5, VY, 10));
  B.masonry.col(STONE).cyl(0, -0.3, 0, 2.3, 2.2, 0.55, 20);
  col.add({ cyl: 1, x: 14.5, z: 10, r: 2.25, y0: 0, y1: VY + 0.25 });
  B.plain.col(0x7a5a34, 1.2);
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; B.plain.cyl(Math.cos(a) * 0.55, 0.25, Math.sin(a) * 0.55, 0.1, 0.14, 0.5, 6); }
  B.plain.lathe(0, 0.7, 0, [[0.3, 0], [0.75, 0.25], [0.88, 0.7], [0.78, 1.15], [0.55, 1.35], [0.62, 1.45], [0.5, 1.5], [0.3, 1.75], [0.12, 1.9], [0.2, 2.05], [0, 2.12]], 14);
  B.plain.col(GOLD, 1.2).cyl(0, 1.3, 0, 0.8, 0.8, 0.07, 14, 0.5, 0);
  for (const s of [-1, 1]) B.plain.lathe(s * 0.92, 1.5, 0, [[0.03, 0], [0.1, 0.1], [0.1, 0.25], [0.03, 0.35]], 6);
  B.lantern.col(0xff6a22).box(-0.28, 0.95, 0.76, 0.28, 1.25, 0.86);
  pillar(0, 0, 0.9, 0, 2.6); emit('ember', 0, 2.9, 0); emit('smoke', 0, 3.0, 0, 0, [0.75, 0.9, 0.85]); light(0, 1.4, 1.2, [1, 0.55, 0.22], 1.3, 1);
  pois.interact.push({ type: 'alchemy', x: 14.5, y: VY, z: 10, r: 3.6, label: '炼丹炉' });
  X(null);
  const stall = (x, z, ry, c1, c2, goods, sy = VY) => {
    X(mat4(x, sy, z, ry));
    B.wood.col(WOOD_NAT, 1.2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.wood.cyl(sx * 1.4, 0, sz * 0.8, 0.06, 0.05, sz > 0 ? 2.1 : 2.5, 6);
    B.wood.box(-1.45, 0.75, -0.75, 1.45, 0.85, 0.75, 1).box(-1.45, 0, -0.7, 1.45, 0.75, -0.62, 1);
    B.cloth.surf(8, 4, (u, v, p) => { p[0] = (u * 2 - 1) * 1.65; p[2] = (v * 2 - 1) * 1.05; p[1] = 2.32 - v * 0.42 - Math.sin(u * Math.PI) * 0.1; p[3] = u; p[4] = v; p[5] = ((u * 8) | 0) % 2 ? 1 : 0.55; }, true);
    const cc = new THREE.Color(c1);
    for (let i = B.cloth.n - 45; i < B.cloth.n; i++) { const s = B.cloth.C[i * 3]; B.cloth.C[i * 3] = s < 0.8 ? 0.85 : cc.r; B.cloth.C[i * 3 + 1] = s < 0.8 ? 0.82 : cc.g; B.cloth.C[i * 3 + 2] = s < 0.8 ? 0.74 : cc.b; }
    const rnd = mulberry32(x * 13 + z);
    for (let i = 0; i < 14; i++) {
      const gx = -1.2 + (i % 7) * 0.4, gz = i < 7 ? -0.3 : 0.25;
      if (goods === 'fruit') B.plain.col([0xd84a2a, 0xe8a030, 0x7ab040][i % 3]).sphere(gx, 0.95, gz, 0.11, 0.1, 0.11, 7, 5);
      else if (goods === 'pot') pot(gx, 0.85, gz, 0.4 + rnd() * 0.25, [0x8a5236, 0x3a5a6a, 0xd8d0c0][i % 3]);
      else B.cloth.col([c2, 0xd8c8a0, 0x4a6a9a][i % 3]).box(gx - 0.15, 0.85, gz - 0.2, gx + 0.15, 0.93 + (i % 3) * 0.04, gz + 0.2);
    }
    solid(-1.5, 0, -0.85, 1.5, 0.85, 0.85);
    X(null);
  };
  stall(-8.6, 6.8, 2.3, 0xb83a2a, 0xb83a2a, 'fruit'); stall(8.2, -7.4, -0.85, 0x2a5a9a, 0x7a3a8a, 'cloth'); stall(-8.4, -7.2, 0.8, 0x3a7a4a, 0, 'pot');
  X(mat4(-6.4, VY, 9.4)); crate(0, 0, 0); crate(0.8, 0, 0.2, 0.6, 0.5); crate(0.3, 0.7, 0.1, 0.55, 0.2); hay(-1.4, 0, 0.5); X(null);

  // 凉亭与池塘
  {
    X(mat4(-33, VY, -29));
    B.masonry.col(0xffffff).cyl(0, -1, 0, 3.6, 3.6, 1.35, 6);
    col.add({ cyl: 1, x: -33, z: -29, r: 3.3, y0: 0, y1: VY + 0.35 });
    B.wood.col(WOOD_RED, 1.5);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.0472, c = Math.cos(a) * 2.7, s = Math.sin(a) * 2.7, a2 = (i + 1) * 1.0472, c2 = Math.cos(a2) * 2.7, s2 = Math.sin(a2) * 2.7;
      B.wood.cyl(c, 0.35, s, 0.16, 0.15, 3.0, 8); pillar(c, s, 0.18, 0, 3.4, 1);
      B.wood.beam(c, 3.2, s, c2, 3.2, s2, 0.14, 0.24);
      if (i !== 1) { B.wood.col(WOOD_NAT, 1.2).beam(c, 0.82, s, c2, 0.82, s2, 0.3, 0.07).beam(c, 1.2, s, c2, 1.2, s2, 0.06, 0.08); B.wood.col(WOOD_RED, 1.5); }
    }
    { const m = curM; X(sub(0, 0, 0, 0.5236)); hipRoof(2.35, 2.35, 3.35, 1.9, { over: 1.0, lift: 0.7, col: TILE_TEAL, orn: GOLD }); X(m); }
    table(0, 0.35, 0, 1.0, 1.0); lantern(0, 2.75, 0, 1.0);
    X(null);
    stoneLamp(-39, -27); bench(-41.5, VY, -24.5, 1.7, 0.7);
  }
  // 农田：篱笆、稻草人、庄稼
  {
    const [f1, f2] = L.FARMS;
    fence(f1[0], f1[1] - 0.6, 29.4, f1[1] - 0.6); fence(32.6, f1[1] - 0.6, f2[2] + 0.6, f1[1] - 0.6);
    fence(f1[0] - 0.6, f1[1] - 0.6, f1[0] - 0.6, f1[3] + 0.6); fence(f2[2] + 0.6, f2[1] - 0.6, f2[2] + 0.6, f2[3] + 0.6); fence(f1[0] - 0.6, f1[3] + 0.6, f2[2] + 0.6, f1[3] + 0.6);
    world.addField({ x0: f1[0] + 0.5, z0: f1[1] + 0.5, x1: f1[2] - 0.5, z1: f1[3] - 0.5, density: 9, h0: 0.45, h1: 0.7, color: 0x6a9a34, rows: 1, width: 1.5 });
    world.addField({ x0: f2[0] + 0.5, z0: f2[1] + 0.5, x1: f2[2] - 0.5, z1: f2[3] - 0.5, density: 16, h0: 0.75, h1: 1.05, color: 0xc9a544, rows: 0, width: 1.0 });
    X(mat4(50, VY, 28, 0.5));
    B.wood.col(WOOD_NAT, 1.1).cyl(0, 0, 0, 0.05, 0.04, 2.0, 5).beam(-0.8, 1.45, 0, 0.8, 1.45, 0, 0.05, 0.05);
    B.cloth.col(0x8a6a4a).box(-0.6, 1.25, -0.06, 0.6, 1.6, 0.06).box(-0.25, 0.75, -0.08, 0.25, 1.3, 0.08);
    B.thatch.col(0xffffff).sphere(0, 1.85, 0, 0.2, 0.22, 0.2, 8, 6).cyl(0, 1.98, 0, 0.5, 0.05, 0.3, 10);
    X(null);
    hay(40.5, VY, 13.8, 1.1); hay(41.8, VY, 14.3, 0.9); X(mat4(20, VY, 15)); crate(0, 0, 0); barrel(1, 0, 0.3); X(null);
  }
  // 码头与小舟
  {
    const dx = -27, zb = L.riverZ(dx) - 15.5;
    B.wood.col(WOOD_NAT, 1.15);
    for (let i = 0; i < 9; i++) B.wood.box(dx - 1.3, 0.42, zb + i * 1.0, dx + 1.3, 0.5, zb + i * 1.0 + 0.92, 1);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) B.wood.cyl(dx + s * 1.2, -3, zb + i * 2.1 + 0.3, 0.1, 0.1, i === 4 ? 4.4 : 3.5, 6);
    col.add({ x0: dx - 1.3, x1: dx + 1.3, z0: zb, z1: zb + 9, y0: 0.2, y1: 0.5 });
    X(mat4(dx + 3.2, L.WATER_SURF - 0.12, zb + 7.2, 0.35));
    B.wood.col(0x6a4a30, 1.3).surf(12, 6, (u, v, p) => {
      const t = u * 2 - 1, wv = Math.pow(1 - Math.abs(t) ** 2.4, 0.55) * 0.85, a = (v - 0.5) * Math.PI;
      p[0] = Math.sin(a) * wv; p[1] = (1 - Math.cos(a)) * 0.55 + Math.abs(t) ** 3 * 0.35 - 0.05 + (Math.abs(v - 0.5) > 0.49 ? 0 : 0); p[2] = t * 2.6; p[3] = u * 3; p[4] = v;
    }, true);
    B.wood.col(WOOD_NAT, 1.1).box(-0.6, 0.3, -0.5, 0.6, 0.35, -0.2, 1).box(-0.6, 0.3, 0.7, 0.6, 0.35, 1.0, 1);
    X(null);
    stoneLamp(dx - 2.2, zb - 1.5);
  }
  // 沿路石灯与杂物
  for (const [x, z] of [[-3.3, 17], [3.3, 17], [-3.3, -19], [3.3, -19], [-20, 3], [20, -3], [-44, -3], [44, 3], [62, -3], [70, -30], [75, -52], [31, 14.5], [-38, -14], [41, -24]]) stoneLamp(x, z);
  X(mat4(48, VY, -6.2)); barrel(0, 0, 0); barrel(0.75, 0, 0.1, 0.9); crate(-1, 0, 0, 0.65, 0.2); X(mat4(-48, VY, -6.4)); hay(0, 0, 0); hay(1.2, 0, 0.2, 0.85); pot(-1.2, 0, 0, 1.1);
  X(mat4(8, VY, -6.9)); pot(0, 0, 0, 1.2, 0x3a5a6a); pot(0.7, 0, 0.1, 0.9); X(mat4(31, VY, -6.6)); crate(0, 0, 0, 0.8); crate(0.1, 0.8, 0, 0.6, 0.4); barrel(1.1, 0, 0.1);
  X(null);
  for (const [x, z, k] of L.VILLAGE_TREES) tree(k, x, z, 0.95 + (((x * 13 + z * 7) % 10) + 10) % 10 * 0.035, null, (x + z) & 1);
  for (const [x, z, s, sd] of [[-52, -28, 1.3, 1], [-40, -43, 1.0, 2], [-53, -44, 0.8, 3], [-36, -36.5, 0.6, 4], [66, 30, 1.2, 5], [-70, 4, 1.0, 6], [20, 46, 0.9, 7], [-12, 44, 0.7, 8], [60, -40, 1.1, 9]]) rock(x, gy(x, z) - 0.15 * s, z, s, s * 0.7, sd);
  pois.spots.spawn = [0, VY, 30];
  pois.spots.herbalist = [20, VY, 5.4]; pois.spots.smith = [-51, VY, 5.2]; pois.spots.hunter = [5.5, VY, 30.5];
  pois.spots.villagers = [[5, VY, 5], [-7, VY, 3], [11, VY, -4], [-13, VY, -4], [4, VY, -14], [-4, VY, 15]];
  pois.spots.chickens = [[34, VY, 13], [36.5, VY, 12.5], [-44.5, VY, 15], [-42, VY, 16.5]];
  flush();

  // ================= 聚灵台 =================
  begin();
  {
    const { x, z, h } = L.PLATFORM;
    X(mat4(x, h, z));
    [[11.5, 0.4], [10, 0.8], [8.5, 1.2]].forEach(([r, t]) => { B.masonry.col(0xf0ece2).cyl(0, -2.5, 0, r, r, t + 2.5, 48); col.add({ cyl: 1, x, z, r, y0: h - 2.5, y1: h + t }); });
    const dg = new GB(); dg.disc(0, 0, 0, 6.6, 48, -1);
    addMesh(dg.build(), mats.decal(taijiTexture()), sub(0, 1.215, 0), false);
    for (let i = 0; i < 8; i++) {
      const a = i * 0.7854 + 0.3927, c = Math.cos(a) * 9.25, s = Math.sin(a) * 9.25;
      B.masonry.col(STONE).box(c - 0.5, 0.8, s - 0.5, c + 0.5, 1.15, s + 0.5).cyl(c, 1.15, s, 0.34, 0.28, 3.6, 10).box(c - 0.42, 4.75, s - 0.42, c + 0.42, 4.95, s + 0.42);
      B.glow.col(0x7ff0e0, 1.6).lathe(c, 5.05, s, [[0, 0], [0.24, 0.35], [0, 0.95]], 5);
      pillar(c, s, 0.45, 0.8, 5); light(c, 5.5, s, [0.4, 1, 0.9], 0.9, 1);
    }
    B.plain.col(0x7a5a34, 1.2).lathe(0, 1.2, -6.9, [[0.25, 0], [0.5, 0.2], [0.55, 0.55], [0.35, 0.75], [0.45, 0.85]], 10);
    pillar(0, -6.9, 0.55, 1.2, 2.1); emit('smoke', 0, 2.2, -6.9, 0, [0.85, 0.85, 0.9]);
    emit('qi', 0, 1.3, 0, 7);
    for (const [lx, lz] of [[-5, 12.6], [-9, 9.6]]) stoneLamp(lx, lz, gy(x + lx, z + lz) - h);
    X(null);
    pois.spirit.push({ x, z, r: 8.6, mult: 4, name: '聚灵台' });
    pois.spots.elder = [x, h + 1.2, z - 4.5];
    plaque('聚灵台', x - 7.6, h + 2.4, z + 10.4, 0.8, 0.3, { bg: '#2a3a3a', border: '#8a9a9a', fg: '#bff5ea' });
    X(mat4(x - 7.6, h, z + 10.4, 0.3)); B.masonry.col(STONE).box(-1.4, -1, -0.22, 1.4, 3.0, -0.04).box(-1.7, -1, -0.4, 1.7, 0.5, 0.15); solid(-1.5, -1, -0.4, 1.5, 3, 0.15); X(null);
  }
  flush();

  // ================= 古修遗迹 =================
  begin();
  {
    const { x, z } = L.RUINS, h = RUINS_H, rnd = mulberry32(77), MOSS = 0xb9c2a8;
    X(mat4(x, h, z));
    B.paving.col(0xc8ccb8).disc(0, 0.04, 0, 13.5, 40, 0.5);
    B.masonry.col(MOSS).cyl(0, -2, 0, 14, 14.4, 2.0, 40, 0.5, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.26, c = Math.cos(a) * 12, s = Math.sin(a) * 12, hh = i % 4 === 1 ? 1.2 + rnd() * 1.2 : 4.6 + rnd() * 1.6;
      B.masonry.col(MOSS).box(c - 0.85, -0.5, s - 0.85, c + 0.85, 0.45, s + 0.85).cyl(c, 0.45, s, 0.6, 0.52, hh, 12);
      pillar(c, s, 0.75, -0.5, hh + 0.45);
      if (i % 4 === 1) { B.masonry.beam(c * 1.12 - s * 0.2, 0.5, s * 1.12 + c * 0.2, c * 1.12 + s * 0.22, 0.6, s * 1.12 - c * 0.22, 1.0, 1.0); }
      else if (i % 4 !== 0) { const a2 = ((i + 1) / 12) * TAU + 0.26; if ((i + 1) % 4 !== 1) B.masonry.beam(c, 5.3, s, Math.cos(a2) * 12, 5.3, Math.sin(a2) * 12, 0.9, 0.7); }
    }
    B.masonry.col(MOSS).box(-3.6, -0.5, -8.4, 3.6, 0.45, -1.2).box(-2.5, 0.45, -7.3, 2.5, 0.9, -2.3);
    solid(-3.6, -0.5, -8.4, 3.6, 0.45, -1.2); solid(-2.5, 0.45, -7.3, 2.5, 0.9, -2.3);
    chest(0, 0.9, -4.6);
    { const p = wp(0, 0.9, -4.6); pois.interact.push({ type: 'chest', id: 'ruins', x: p.x, y: p.y, z: p.z, r: 2.6, label: '遗迹宝匣' }); }
    B.masonry.col(0x9aa090).box(-0.9, 0.9, -7.1, 0.9, 4.6, -6.6);
    B.glow.col(0x5ff0d0, 1.2);
    for (let i = 0; i < 5; i++) B.glow.box(-0.45 + (i % 2) * 0.25, 1.5 + i * 0.55, -6.6, 0.2 + (i % 2) * 0.25, 1.62 + i * 0.55, -6.58);
    solid(-0.9, 0.9, -7.1, 0.9, 4.6, -6.6); light(0, 3, -6, [0.35, 1, 0.85], 1.2, 1);
    for (let i = 0; i < 9; i++) { const a = rnd() * TAU, r = 6 + rnd() * 11; if (Math.abs(Math.cos(a) * r) < 3 && Math.sin(a) * r > 2) continue; rock(Math.cos(a) * r, gy(x + Math.cos(a) * r, z + Math.sin(a) * r) - h - 0.1, Math.sin(a) * r, 0.5 + rnd() * 0.9, 0.4 + rnd() * 0.5, i + 20, 0xb8c4a8); }
    emit('qi', 0, 0.3, 0, 11);
    X(null);
    pois.spirit.push({ x, z, r: 10, mult: 3, name: '古修遗迹' });
  }
  flush();

  // ================= 浮空仙山 =================
  L.ISLANDS.forEach((isl, idx) => {
    begin();
    const { x, y, z, r } = isl, rnd = mulberry32(idx * 31 + 5);
    X(mat4(x, y, z));
    const edge = (a) => r * (1 + 0.07 * Math.sin(3 * a + idx) + 0.045 * Math.sin(7 * a + idx * 2));
    B.turf.col(0xaac878).surf(36, 5, (u, v, p) => { const a = u * TAU, rr = edge(a) * v; p[0] = Math.cos(a) * rr; p[1] = -0.9 * Math.pow(v, 8); p[2] = Math.sin(a) * rr; p[3] = p[0] * 0.25; p[4] = p[2] * 0.25; p[5] = 1 - 0.35 * Math.pow(v, 6); }, false, true);
    const dep = r * 1.55;
    B.rock.col(0xc8c0b4).surf(36, 9, (u, v, p) => {
      const a = u * TAU, k = Math.pow(1 - v, 0.62) * (1 + 0.16 * Math.sin(a * 5 + v * 9 + idx) + 0.1 * Math.sin(a * 9 - v * 14)) + 0.02, rr = edge(a) * k;
      p[0] = Math.cos(a) * rr; p[1] = -0.9 - dep * Math.pow(v, 1.25) * (1 + 0.12 * Math.sin(a * 3 + idx)); p[2] = Math.sin(a) * rr; p[3] = u * 10; p[4] = v * 6; p[5] = 1.05 - 0.5 * v;
    }, false, true);
    col.add({ cyl: 1, x, z, r: r * 0.95, y0: y - 3, y1: y });
    world.addField({ cx: x, cz: z, r: r * 1.12, density: 9, h0: 0.3, h1: 0.6, color: 0x62882e, flowers: 1, yAt: (wx, wz) => { const dx = wx - x, dz = wz - z, v = Math.hypot(dx, dz) / edge(Math.atan2(dz, dx)); return v > 0.96 ? null : y - 0.9 * Math.pow(v, 8); } });
    const nt = isl.main ? 9 : 2 + ((r / 4) | 0);
    for (let i = 0; i < nt; i++) {
      const a = (i / nt) * TAU + rnd(), rr = r * (0.5 + rnd() * 0.36), tx = Math.cos(a) * rr, tz = Math.sin(a) * rr;
      if (isl.main && Math.hypot(tx, tz - 2) < 9) continue;
      tree(['peach', 'pine', 'ginkgo', 'peach', 'maple'][i % 5], tx, tz, 0.85 + rnd() * 0.4, 0, i);
    }
    for (let i = 0; i < 4; i++) { const a = rnd() * TAU, rr = r * (0.6 + rnd() * 0.33); rock(Math.cos(a) * rr, -0.1, Math.sin(a) * rr, 0.4 + rnd() * 0.8, 0.4 + rnd() * 0.5, i + idx * 5); }
    if (isl.main) {
      // 金顶仙亭与宝匣
      B.masonry.col(0xffffff).cyl(0, -0.6, 0, 6.2, 6.2, 1.0, 8).cyl(0, 0.4, 0, 5.2, 5.2, 0.4, 8);
      col.add({ cyl: 1, x, z, r: 5.9, y0: y - 0.6, y1: y + 0.4 }); col.add({ cyl: 1, x, z, r: 5.0, y0: y, y1: y + 0.8 });
      B.wood.col(WOOD_RED, 1.5);
      for (let i = 0; i < 8; i++) {
        const a = i * 0.7854 + 0.3927, c = Math.cos(a) * 4.2, s = Math.sin(a) * 4.2, a2 = a + 0.7854;
        B.wood.cyl(c, 0.8, s, 0.2, 0.18, 3.8, 10); pillar(c, s, 0.22, 0.8, 4.6, 1);
        B.wood.beam(c, 4.4, s, Math.cos(a2) * 4.2, 4.4, Math.sin(a2) * 4.2, 0.16, 0.3);
      }
      { const m = curM; X(sub(0, 0, 0, 0.7854)); hipRoof(3.4, 3.4, 4.6, 2.2, { over: 1.5, lift: 0.9, col: TILE_GOLD, k: 2.2, ridge: 0x8a5a1a, orn: GOLD }); X(m); }
      B.plaster.col(WHITE).cyl(0, 6.2, 0, 2.2, 2.2, 1.3, 8, 0.4, 0);
      { const m = curM; X(sub(0, 0, 0, 0.7854)); hipRoof(1.7, 1.7, 7.5, 2.4, { over: 1.2, lift: 0.8, col: TILE_GOLD, k: 2.2, ridge: 0x8a5a1a, orn: GOLD }); X(m); }
      chest(0, 0.8, 0);
      pois.interact.push({ type: 'chest', id: 'island', x, y: y + 0.8, z, r: 2.8, label: '仙山宝匣' });
      for (let i = 0; i < 4; i++) lantern(Math.cos(i * 1.5708) * 3.0, 3.7, Math.sin(i * 1.5708) * 3.0, 1.2, 0xffb040);
      plaque('青云仙宗', 0, 5.0, 5.25, 0.8, 0, { bg: '#3a1410' });
      for (const s of [-1, 1]) stoneLamp(s * 2.6, 8.5, 0);
      for (let i = 0; i < 6; i++) B.paving.col(0xe8e4d8).box(-1.2, -0.3, 6.6 + i * 1.5, 1.2, 0.03, 7.8 + i * 1.5);
      // 灵池与飞瀑
      const pa = 2.5, px = Math.cos(pa) * 12, pz = Math.sin(pa) * 12;
      B.masonry.col(STONE).lathe(px, -0.2, pz, [[4.3, 0], [4.4, 0.45], [4.1, 0.5], [3.9, 0.3], [3.9, 0]], 20);
      water.addPool(x + px, y + 0.22, z + pz, 3.95, 1.4);
      const ex = Math.cos(pa) * edge(pa) * 0.985, ez = Math.sin(pa) * edge(pa) * 0.985;
      B.paving.col(0x6aa8b8).beam(px + Math.cos(pa) * 4.2, 0.04, pz + Math.sin(pa) * 4.2, ex, 0.02, ez, 1.6, 0.06);
      const gyb = gy(x + ex, z + ez), fh = y - gyb - 0.5;
      water.addFall(x + ex, y - 0.3, z + ez, 2.4, fh, Math.PI / 2 - pa);
      emit('mist', ex, -fh + 1.5, ez, 4); emit('mist', ex, -1, ez, 1.5);
      emit('qi', 0, 0.5, 0, 14); emit('leaf', 0, 7, 0, 16);
      pois.spirit.push({ x, z, r: r * 0.95, mult: 8, name: '浮空仙山', minY: y - 2 });
    } else {
      stoneLamp(0, 0, 0);
      emit('qi', 0, 0.5, 0, r * 0.6);
    }
    X(null);
    flush();
  });

  // ================= 新区域（落霞镇、万妖谷、赤焰火山、雷劫台、传送阵） =================
  buildRegions({
    pois, group, mats, col, water, world, I4, begin, flush, X, sub, wp, solid, pillar, light, emit, addMesh, plaque, tree, rock,
    opening, gableRoof, hipRoof, lantern, stoneLamp, crate, barrel, pot, hay, bench, table, banner, fence, chest, house, stall,
    get B() { return B; }, get M() { return curM; },
  });
  return pois;
}
