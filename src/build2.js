// 新区域建筑：落霞镇、万妖谷、赤焰火山、雷劫台、传送阵、测灵石
import * as THREE from 'three';
import { GB, mat4 } from './geo.js';
import * as L from './layout.js';
import { rawHeight, ARENA_H, TRIB_H, LAVA_Y } from './height.js';
import { mulberry32 } from './noise.js';
import { runeDisc, lightBeam, lavaMaterial } from './fx.js';
import { taijiTexture } from './tex.js';

const gy = rawHeight, TAU = Math.PI * 2;
const WOOD_RED = 0x9a3324, WOOD_DARK = 0x54392a, WHITE = 0xf4f0e6, BEIGE = 0xe9dcc0, GOLD = 0xd9a83a, STONE = 0xd8d4c8;
const TILE_GRAY = 0x707a86, TILE_TEAL = 0x4f6f78, TILE_BLUE = 0x3e5a78, TILE_GREEN = 0x4a6a4a, TILE_BROWN = 0x7a6a5e;

export function buildRegions(k) {
  const { pois, mats, col, group } = k;
  let B = null;
  const begin = () => { k.begin(); B = k.B; };
  const flush = () => { k.flush(); B = null; };
  const X = k.X, sub = k.sub;
  const at = (m, fn) => { const prev = k.M; X(m); fn(); X(prev === k.I4 ? null : prev); };
  pois.portals = []; pois.lava = []; pois.fx = []; pois.cage = null;

  // ---- 传送阵
  const portal = (p, baseY) => {
    const y = baseY ?? gy(p.x, p.z);
    X(mat4(p.x, y, p.z));
    B.masonry.col(STONE).cyl(0, -2.2, 0, 4.3, 4.3, 2.45, 8, 0.5).col(0xe8e4d8).cyl(0, 0.25, 0, 3.75, 3.75, 0.3, 8);
    B.plain.col(0x2c3440).cyl(0, 0.55, 0, 3.2, 3.2, 0.012, 40);
    col.add({ cyl: 1, x: p.x, z: p.z, r: 4.3, y0: y - 2.2, y1: y + 0.25 }); col.add({ cyl: 1, x: p.x, z: p.z, r: 3.75, y0: y, y1: y + 0.55 });
    for (let i = 0; i < 4; i++) {
      const a = i * 1.5708 + 0.785, c = Math.cos(a) * 3.35, s = Math.sin(a) * 3.35;
      B.masonry.col(STONE).box(c - 0.3, 0.5, s - 0.3, c + 0.3, 0.75, s + 0.3).cyl(c, 0.75, s, 0.2, 0.16, 1.5, 8).cyl(c, 2.25, s, 0.28, 0.06, 0.25, 8);
      B.glow.col(0x7fe0ff, 1.8).lathe(c, 2.75, s, [[0.001, 0], [0.16, 0.25], [0.001, 0.7]], 6);
      k.pillar(c, s, 0.3, 0.5, 2.6, 1);
    }
    k.light(0, 1.3, 0, [0.45, 0.85, 1], 1.1, true);
    X(null);
    const disc = runeDisc(3.1, 0x5ad0ff); disc.position.set(p.x, y + 0.575, p.z); group.add(disc);
    const beam = lightBeam(2.7, 16, 0x7fd8ff, 0.3); beam.position.set(p.x, y + 0.56, p.z); group.add(beam);
    pois.portals.push({ id: p.id, name: p.name, x: p.x, y: y + 0.55, z: p.z, disc, beam });
    pois.interact.push({ type: 'portal', id: p.id, x: p.x, y: y + 0.55, z: p.z, r: 3.4, label: `传送阵 · ${p.name}` });
    pois.emitters.push({ type: 'portal', x: p.x, y: y + 0.6, z: p.z, r: 2.8, id: p.id });
  };
  // 多层楼阁：tiers = [[半宽 a, 半深 b, 层高 h], ...]
  const storied = (x, z, rot, o) => {
    const y0 = gy(x, z), T = o.tiers, [a0, b0] = T[0], wood = o.wood || WOOD_RED, tile = o.tile || TILE_GRAY;
    X(mat4(x, y0, z, rot));
    B.masonry.col(0xffffff).box(-a0 - 0.9, -1.2, -b0 - 0.9, a0 + 0.9, 0.55, b0 + 0.9);
    for (let i = 0; i < 3; i++) B.masonry.box(-1.8, -1.2, b0 + 0.9 + i * 0.35, 1.8, 0.55 - (i + 1) * 0.18, b0 + 0.9 + (i + 1) * 0.35);
    k.solid(-a0 - 0.9, -1.2, -b0 - 0.9, a0 + 0.9, 0.55, b0 + 0.9); k.solid(-1.8, -1.2, b0 + 0.9, 1.8, 0.3, b0 + 1.95);
    let y = 0.55;
    T.forEach(([a, b, h], i) => {
      const last = i === T.length - 1;
      B.plaster.col(o.wall || WHITE).box(-a, y, -b, a, y + h, b, 0.4, 8);
      if (i === 0) B.masonry.col(0xb9b5ab).box(-a - 0.04, y, -b - 0.04, a + 0.04, y + 0.85, b + 0.04, 0.5, 8);
      B.wood.col(wood, 1.5);
      const nx = Math.max(2, Math.round(a / 1.6));
      for (let j = 0; j <= nx; j++) for (const sz of [-1, 1]) B.wood.cyl(-a + (2 * a * j) / nx, y, sz * b, 0.17, 0.17, h, 8);
      for (const sx of [-1, 1]) B.wood.cyl(sx * a, y, 0, 0.17, 0.17, h, 8);
      B.wood.col(o.beam || 0x2f5a6a, 1.4).box(-a - 0.12, y + h - 0.38, -b - 0.12, a + 0.12, y + h, b + 0.12, 0.5, 8);
      for (let j = 0; j < nx; j++) {
        const cx = -a + (2 * a * (j + 0.5)) / nx;
        if (i === 0 && j === ((nx / 2) | 0) && nx % 2 === 1) k.opening('door', cx, y + 1.25, b, 1.8, 2.5, '+z', wood);
        else if (i === 0 && nx % 2 === 0 && Math.abs(cx) < a / nx + 0.01) k.opening('door', cx, y + 1.25, b, 1.6, 2.5, '+z', wood);
        else k.opening('win', cx, y + h * 0.55, b, Math.min(1.5, (a * 2) / nx - 0.6), 1.2, '+z', wood);
        k.opening('win', cx, y + h * 0.55, -b, Math.min(1.3, (a * 2) / nx - 0.7), 1.0, '-z', wood);
      }
      for (const s of [-1, 1]) k.opening('win', s * a, y + h * 0.55, 0, 1.1, 1.0, s > 0 ? '+x' : '-x', wood);
      if (!last) {
        k.hipRoof(a, b, y + h, 1.0, { over: 1.15, lift: 0.5, col: tile, orn: GOLD });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.lantern(sx * (a + 0.9), y + h - 0.1, sz * (b + 0.9), 0.75, o.lantern || 0xff4a22);
        y += h + 0.6;
      } else {
        k.hipRoof(a, b, y + h, Math.min(2.6, b * 0.65), { over: 1.35, lift: 0.75, col: tile, orn: GOLD, ra: o.spire ? 0 : undefined });
        y += h;
      }
    });
    if (o.sign) k.plaque(o.sign, 0, 0.55 + T[0][2] - 0.55, b0 + 0.13, 0.62, 0, o.signOpt || {});
    for (const s of [-1, 1]) k.lantern(s * 1.6, 0.55 + 2.55, b0 + 0.6, 1.0, o.lantern || 0xff4a22);
    k.solid(-a0 - 0.15, 0, -b0 - 0.15, a0 + 0.15, y + 3, b0 + 0.15);
    if (o.smoke) k.emit('smoke', a0 * 0.5, y + 2, 0);
    X(null);
    return y0 + y;
  };
  // 小牌楼
  const arch = (x, z, rot, w, h, text, bg) => {
    X(mat4(x, gy(x, z), z, rot));
    for (const s of [-1, 1]) {
      B.masonry.col(STONE).box(s * w / 2 - 0.45, -0.5, -0.5, s * w / 2 + 0.45, 0.6, 0.5);
      B.wood.col(WOOD_RED, 1.5).cyl(s * w / 2, 0.6, 0, 0.24, 0.22, h - 0.6, 10);
      k.pillar(s * w / 2, 0, 0.45, 0, h);
    }
    B.wood.col(0x2f5a6a, 1.4).box(-w / 2 - 0.4, h - 0.9, -0.15, w / 2 + 0.4, h - 0.45, 0.15).box(-w / 2, h - 1.8, -0.12, w / 2, h - 1.55, 0.12);
    k.gableRoof(w + 0.6, 0.9, h - 0.3, 0.7, { over: 0.7, og: 0.5, col: TILE_TEAL, lift: 0.32 });
    if (text) { k.plaque(text, 0, h - 1.2, 0.16, 0.6, 0, { bg: bg || '#14233c' }); k.plaque(text, 0, h - 1.2, -0.16, 0.6, Math.PI, { bg: bg || '#14233c' }); }
    for (const s of [-1, 1]) k.lantern(s * (w / 2 - 0.9), h - 2.3, 0, 0.9);
    X(null);
  };
  // 一串灯笼（悬索）
  const lanternString = (x0, z0, x1, z1, y, n, sag = 0.7) => {
    B.plain.col(0x2a2018);
    const P = (t) => [x0 + (x1 - x0) * t, y - sag * 4 * t * (1 - t), z0 + (z1 - z0) * t];
    for (let i = 0; i < 8; i++) { const a = P(i / 8), b = P((i + 1) / 8); B.plain.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.025, 0.025); }
    for (let i = 1; i <= n; i++) { const p = P(i / (n + 1)); k.lantern(p[0], p[1] - 0.65, p[2], 0.62, i % 2 ? 0xff4a22 : 0xffa030); }
  };

  // ================= 落霞镇 =================
  begin();
  {
    const T = L.TOWN, TY = T.h, H = T.half, WH = 7.5, WT = 2.6, WALL = 0xc9c2b2, GW = 3.6;
    // 城墙：沿 x 或 z 的段，out 为外侧方向
    const wall = (x0, z0, x1, z1, ox, oz) => {
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const bx0 = Math.min(x0, x1) - (alongX ? 0 : WT / 2), bx1 = Math.max(x0, x1) + (alongX ? 0 : WT / 2);
      const bz0 = Math.min(z0, z1) - (alongX ? WT / 2 : 0), bz1 = Math.max(z0, z1) + (alongX ? WT / 2 : 0);
      B.masonry.col(WALL).box(bx0, TY - 2, bz0, bx1, TY + WH, bz1, 0.4);
      B.masonry.col(0xa8a294).box(bx0 - Math.abs(ox) * 0.2, TY - 2, bz0 - Math.abs(oz) * 0.2, bx1 + Math.abs(ox) * 0.2, TY + 1.1, bz1 + Math.abs(oz) * 0.2, 0.4);
      const len = alongX ? bx1 - bx0 : bz1 - bz0, n = Math.floor(len / 2.6);
      B.masonry.col(WALL);
      for (let i = 0; i < n; i++) {
        const t0 = (alongX ? bx0 : bz0) + (len - n * 2.6) / 2 + i * 2.6 + 0.35, t1 = t0 + 1.5;
        if (alongX) { const ez = oz > 0 ? bz1 : bz0; B.masonry.box(t0, TY + WH, Math.min(ez, ez - oz * 0.55), t1, TY + WH + 1.2, Math.max(ez, ez - oz * 0.55)); }
        else { const ex = ox > 0 ? bx1 : bx0; B.masonry.box(Math.min(ex, ex - ox * 0.55), TY + WH, t0, Math.max(ex, ex - ox * 0.55), TY + WH + 1.2, t1); }
      }
      k.solid(bx0, TY - 2, bz0, bx1, TY + WH + 1.2, bz1);
    };
    const cx = T.x, cz = T.z;
    for (const [ox, oz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (oz) { const z = cz + oz * H; wall(cx - H, z, cx - GW - 3, z, 0, oz); wall(cx + GW + 3, z, cx + H, z, 0, oz); }
      else { const x = cx + ox * H; wall(x, cz - H, x, cz - GW - 3, ox, 0); wall(x, cz + GW + 3, x, cz + H, ox, 0); }
    }
    // 角楼
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = cx + sx * H, z = cz + sz * H;
      X(mat4(x, TY, z));
      B.masonry.col(WALL).box(-3.6, -2, -3.6, 3.6, WH + 1.4, 3.6, 0.4);
      k.solid(-3.6, -2, -3.6, 3.6, WH + 1.4, 3.6);
      B.wood.col(WOOD_RED, 1.5); for (const [px, pz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) B.wood.cyl(px, WH + 1.4, pz, 0.18, 0.18, 2.6, 8);
      k.hipRoof(2.2, 2.2, WH + 4.0, 1.8, { over: 1.2, lift: 0.7, col: TILE_GRAY, orn: GOLD });
      k.lantern(0, WH + 3.2, 0, 1.1);
      X(null);
    }
    // 城门楼：本地 +z 指向镇内，外侧为 -z
    const gate = (x, z, rot, name, sign) => {
      X(mat4(x, TY, z, rot));
      for (const s of [-1, 1]) { B.masonry.col(0xbab3a3).box(s * GW, -2, -WT / 2 - 0.6, s * (GW + 3.2), WH + 0.3, WT / 2 + 0.6, 0.4); k.solid(s * GW, -2, -WT / 2 - 0.6, s * (GW + 3.2), WH + 0.3, WT / 2 + 0.6); }
      B.masonry.col(0xbab3a3).box(-GW, 5.0, -WT / 2 - 0.6, GW, WH + 0.3, WT / 2 + 0.6, 0.4);
      // 券洞拱顶
      B.masonry.col(0x9a9486).surf(12, 1, (u, v, p) => { const a = u * Math.PI; p[0] = Math.cos(a) * GW; p[1] = 3.6 + Math.sin(a) * 1.4; p[2] = (v * 2 - 1) * (WT / 2 + 0.6); p[3] = u * 4; p[4] = v * 2; }, true);
      B.masonry.surf(12, 1, (u, v, p) => { const a = u * Math.PI, sg = v < 0.5 ? -1 : 1; p[0] = Math.cos(a) * GW * (v < 0.5 ? 1 : 1); p[1] = 3.6 + Math.sin(a) * 1.4 + (v % 1) * 0; p[2] = sg * (WT / 2 + 0.6); p[3] = u; p[4] = v; }, false);
      for (const sg of [-1, 1]) B.masonry.col(0xbab3a3).surf(12, 1, (u, v, p) => { const a = u * Math.PI, yy = 3.6 + Math.sin(a) * 1.4; p[0] = Math.cos(a) * GW; p[1] = yy + (5.0 - yy) * v; p[2] = sg * (WT / 2 + 0.6); p[3] = p[0] * 0.4; p[4] = p[1] * 0.4; }, sg < 0);
      // 敞开的城门
      for (const s of [-1, 1]) { at(sub(s * GW, 0, WT / 2 + 0.4, -s * 1.35), () => { B.wood.col(0x6a2a1c, 1.4).box(s > 0 ? -GW + 0.05 : 0, 0, -0.1, s > 0 ? 0 : GW - 0.05, 3.55, 0.1); B.plain.col(GOLD); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) B.plain.sphere((s > 0 ? -GW + 0.4 : 0.4) + c * 0.85, 0.5 + r * 0.8, 0.11, 0.05, 0.05, 0.03, 5, 3); }); }
      // 城楼
      const y1 = WH + 0.3, w = 7.0, d = 3.4;
      B.masonry.col(WALL).box(-GW - 3.2, y1, -WT / 2 - 0.6, GW + 3.2, y1 + 0.5, WT / 2 + 0.6);
      B.plaster.col(WHITE).box(-w, y1 + 0.5, -d / 2, w, y1 + 3.6, d / 2, 0.4, 8);
      B.wood.col(WOOD_RED, 1.5);
      for (let i = 0; i <= 6; i++) for (const sz of [-1, 1]) B.wood.cyl(-w + (2 * w * i) / 6, y1 + 0.5, sz * (d / 2 + 1.0), 0.2, 0.2, 3.1, 8);
      B.wood.col(0x2f5a6a, 1.4).box(-w - 0.15, y1 + 3.2, -d / 2 - 1.15, w + 0.15, y1 + 3.6, d / 2 + 1.15, 0.5, 8);
      for (let i = 0; i < 5; i++) { const ox = -w + 1.4 + i * 2.8; k.opening('win', ox, y1 + 2.0, -d / 2, 1.4, 1.2, '-z'); k.opening('win', ox, y1 + 2.0, d / 2, 1.4, 1.2, '+z'); }
      k.hipRoof(w, d / 2 + 1.0, y1 + 3.6, 1.2, { over: 1.3, lift: 0.6, col: TILE_TEAL, orn: GOLD });
      B.plaster.col(WHITE).box(-w + 1.6, y1 + 4.4, -d / 2 + 0.2, w - 1.6, y1 + 6.0, d / 2 - 0.2, 0.4, 8);
      k.hipRoof(w - 1.6, d / 2 - 0.2, y1 + 6.0, 2.0, { over: 1.4, lift: 0.85, col: TILE_TEAL, orn: GOLD });
      k.solid(-w - 0.2, y1, -d / 2 - 1.2, w + 0.2, y1 + 8.5, d / 2 + 1.2);
      k.plaque(name, 0, 5.75, -WT / 2 - 0.63, 0.85, Math.PI, { bg: '#2a1a14' });
      if (sign) k.plaque(sign, 0, y1 + 4.95, -d / 2 + 0.17, 0.7, Math.PI, { bg: '#14233c' });
      for (const s of [-1, 1]) { k.lantern(s * (GW + 1.6), 4.6, -WT / 2 - 1.0, 1.25); k.lantern(s * (GW + 1.6), 4.6, WT / 2 + 1.0, 1.0); }
      X(null);
    };
    gate(cx - H, cz, Math.PI / 2, '落霞镇', '西 门');
    gate(cx + H, cz, -Math.PI / 2, '落霞镇', '东 门');
    gate(cx, cz - H, 0, '望岳门', '北 门');
    gate(cx, cz + H, Math.PI, '迎薰门', '南 门');

    // 主要楼阁
    storied(cx - 32, cz - 14.5, 0, { tiers: [[7, 4.6, 4.2], [6.2, 4.0, 3.4]], sign: '万宝楼', signOpt: { bg: '#3a1410' }, tile: TILE_TEAL, lantern: 0xffb040 });
    storied(cx - 32, cz + 15, Math.PI, { tiers: [[7.2, 5, 4.2], [6.6, 4.5, 3.5], [5.8, 4, 3.2]], sign: '醉仙楼', signOpt: { bg: '#5a1a14' }, smoke: 1 });
    const tjTop = storied(cx + 30, cz - 36, 0, { tiers: [[4.8, 4.8, 4.4], [4.1, 4.1, 3.6], [3.5, 3.5, 3.3], [2.8, 2.8, 3.1]], sign: '天机阁', signOpt: { bg: '#14233c', fg: '#bfe6ff' }, tile: TILE_BLUE, spire: 1, lantern: 0x6ab8ff });
    B.plain.col(GOLD, 1.3).cyl(cx + 30, tjTop + 2.4, cz - 36, 0.07, 0.02, 2.4, 6);
    B.glow.col(0x9fe0ff, 2).sphere(cx + 30, tjTop + 3.0, cz - 36, 0.3, 0.3, 0.3, 10, 7);
    k.light(cx + 30, tjTop + 3, cz - 36, [0.5, 0.8, 1], 1.4, true);
    storied(cx + 32, cz + 36, Math.PI, { tiers: [[5.2, 3.8, 3.9], [4.4, 3.3, 3.0]], sign: '灵兽阁', signOpt: { bg: '#1c3a2a' }, tile: TILE_GREEN, wood: WOOD_DARK });
    arch(cx + 30, cz - 6.6, 0, 6, 6.2, '天机', '#14233c');
    for (const [lx, lz] of [[-3.3, -13], [3.3, -13], [-3.3, -22], [3.3, -22]]) k.stoneLamp(cx + 30 + lx, cz + lz);
    // 民居
    const H0 = { w: 9.5 }, sides = [
      [cx - 51, cz - 10, 0, { w: 9.5, sign: '镇守府', signOpt: { bg: '#3a1410' }, wood: WOOD_RED }],
      [cx - 16, cz - 10.5, 0, { w: 7, roof: 'thatch', wall: BEIGE }],
      [cx + 51, cz - 10, 0, { w: 9.5, tile: TILE_BROWN, smoke: 1 }],
      [cx - 51, cz + 10, Math.PI, { w: 9.5, sign: '杂货铺', signOpt: { bg: '#3a2a1a' } }],
      [cx - 16, cz + 10.5, Math.PI, { w: 7, sign: '茶', signOpt: { bg: '#1c3a2a' } }],
      [cx + 16, cz + 10.5, Math.PI, { w: 8, wall: BEIGE, smoke: 1 }],
      [cx + 30, cz + 10, Math.PI, { w: 9.5, sign: '当铺', signOpt: { bg: '#2a1a3a' }, tile: TILE_BROWN }],
      [cx + 48, cz + 10, Math.PI, { w: 9, roof: 'thatch' }],
      [cx + 16, cz - 10.5, 0, { w: 8, sign: '布庄', signOpt: { bg: '#3a2a5a' } }],
      [cx - 11, cz - 26, Math.PI / 2, { w: 8, d: 6 }], [cx - 11, cz - 40, Math.PI / 2, { w: 8, d: 6, wall: BEIGE }], [cx - 11, cz - 52, Math.PI / 2, { w: 7, d: 5.6, roof: 'thatch' }],
      [cx - 11, cz + 26, Math.PI / 2, { w: 8, d: 6, smoke: 1 }], [cx - 11, cz + 40, Math.PI / 2, { w: 8, d: 6 }], [cx - 11, cz + 52, Math.PI / 2, { w: 7, d: 5.6, wall: BEIGE }],
      [cx + 11, cz + 22, -Math.PI / 2, { w: 7.5, d: 6, tile: TILE_BROWN }], [cx + 11, cz + 50, -Math.PI / 2, { w: 8, d: 6 }],
      [cx + 11, cz - 26, -Math.PI / 2, { w: 8, d: 6 }], [cx + 11, cz - 48, -Math.PI / 2, { w: 8, d: 6, roof: 'thatch', wall: BEIGE }],
      [cx - 36, cz - 42, 0, { w: 10, d: 7 }], [cx - 36, cz + 44, Math.PI, { w: 10, d: 7, roof: 'thatch' }], [cx + 48, cz - 46, 0, { w: 9, smoke: 1 }],
    ];
    void H0;
    for (const [x, z, r, o] of sides) { k.house(x, z, r, o); X(null); }
    // 广场：传送阵、石灯、古树、摊位
    for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.785; k.stoneLamp(cx + Math.cos(a) * 12.5, cz + Math.sin(a) * 12.5); }
    k.stall(cx - 9, cz - 9.5, 0.8, 0xb83a2a, 0xb83a2a, 'fruit', TY); k.stall(cx + 9.5, cz + 9, -2.3, 0x2a5a9a, 0x7a3a8a, 'cloth', TY);
    k.stall(cx + 9.5, cz - 9.2, -0.8, 0x7a5a2a, 0, 'pot', TY); k.stall(cx - 9.2, cz + 9.6, 2.3, 0x3a7a4a, 0xc8a84a, 'cloth', TY);
    k.tree('ginkgo', cx - 20, cz - 20, 1.6); k.tree('willow', cx + 21, cz + 20, 1.3); k.tree('peach', cx + 42, cz - 22, 1.1); k.tree('maple', cx + 50, cz - 30, 1.2);
    k.tree('pine', cx - 50, cz - 48, 1.1); k.tree('willow', cx - 50, cz + 30, 1.2); k.tree('peach', cx + 50, cz + 26, 1.0);
    // 灵兽阁围栏
    k.fence(cx + 42, cz + 22, cx + 56, cz + 22); k.fence(cx + 56, cz + 22, cx + 56, cz + 32); k.fence(cx + 42, cz + 32, cx + 56, cz + 32);
    k.hay(cx + 53, TY, cz + 25); k.hay(cx + 54.5, TY, cz + 26.5, 0.8);
    // 街灯笼
    for (const x of [-52, -40, -21, 21, 40, 52]) lanternString(cx + x, cz - 4.6, cx + x, cz + 4.6, TY + 5.6, 3);
    for (const z of [-36, -22, 22, 36, 48]) lanternString(cx - 4.6, cz + z, cx + 4.6, cz + z, TY + 5.4, 3);
    for (const [x, z] of [[-24, -5], [24, 5], [-46, 5], [46, -5]]) { k.barrel(cx + x, TY, cz + z); k.crate(cx + x + 0.9, TY, cz + z + 0.2, 0.65, 0.3); }
    k.banner('茶', cx - 20.5, TY, cz + 5.8, 0, '#1c4a32'); k.banner('酒', cx - 24, TY, cz + 6.4, 0, '#7a1c14'); k.banner('当', cx + 25, TY, cz + 5.8, 0, '#2a1a3a');
    pois.spots.tianji = [cx + 30, TY + 0.55, cz - 28.6];
    pois.spots.guard = [cx - 51, TY, cz - 4];
    pois.spots.merchant = [cx - 32, TY + 0.55, cz - 7.8];
    pois.spots.tamer = [cx + 30, TY + 0.55, cz + 28.6];
    pois.spots.storyteller = [cx - 6, TY, cz + 6];
    pois.spots.townfolk = [[cx - 14, TY, cz + 2], [cx + 18, TY, cz - 2], [cx + 2, TY, cz + 30], [cx - 2, TY, cz - 32], [cx + 40, TY, cz + 1], [cx - 40, TY, cz - 1], [cx + 6, TY, cz - 18], [cx - 6, TY, cz + 44]];
  }
  portal(L.PORTALS[1]);
  flush();

  // ================= 万妖谷 =================
  begin();
  {
    const V = L.VALLEY, LR = L.LAIR, rnd = mulberry32(404);
    // 封妖碑（残）
    X(mat4(V.x, gy(V.x, V.z), V.z, 0.4));
    B.masonry.col(0x8a8478).box(-2.6, -1, -1.6, 2.6, 0.7, 1.6).box(-2.1, 0.7, -1.2, 2.1, 1.1, 1.2);
    B.rock.col(0x4c4650).box(-1.3, 1.1, -0.42, 1.3, 6.0, 0.42, 0.5);
    B.rock.surf(6, 1, (u, v, p) => { p[0] = (u * 2 - 1) * 1.3; p[1] = 6.0 + v * (0.9 * Math.abs(Math.sin(u * 7.3)) + 0.2); p[2] = (v * 2 - 1) * 0.42 * 0; p[3] = u; p[4] = v; });
    at(sub(2.6, 0.9, 1.6, 0.4), () => { B.rock.col(0x4c4650).xf(new THREE.Matrix4().multiplyMatrices(k.M, mat4(0, 0, 0, 0, 0, 1.38))); B.rock.box(-1.2, -0.4, -0.4, 1.2, 0.4, 0.4); B.rock.xf(k.M); });
    B.glow.col(0xff3020, 1.6);
    for (const [x0, y0, x1, y1] of [[-0.2, 1.6, 0.3, 3.0], [0.3, 3.0, -0.15, 4.3], [-0.15, 4.3, 0.4, 5.6], [0.3, 3.0, 0.9, 3.6], [-0.15, 4.3, -0.8, 4.9]]) B.glow.beam(x0, y0, 0.44, x1, y1, 0.44, 0.07, 0.03).beam(x0, y0, -0.44, x1, y1, -0.44, 0.07, 0.03);
    k.plaque('镇妖', 0, 5.0, 0.43, 0.9, 0, { vertical: true, bg: '#2a1414', fg: '#ff9a7a' });
    k.solid(-2.6, -1, -1.6, 2.6, 1.1, 1.6); k.solid(-1.3, 1.1, -0.42, 1.3, 6.6, 0.42);
    k.light(0, 3, 1.2, [1, 0.25, 0.15], 1.2, true);
    k.emit('miasma', 0, 0.5, 0, 6);
    X(null);
    // 妖王洞
    X(mat4(LR.x, gy(LR.x, LR.z), LR.z, LR.rot));
    for (const s of [-1, 1]) { k.rock(s * 7.5, -1, -15, 4.6, 6.5, 30 + s, 0x6a5a58); k.rock(s * 10.5, -1, -19, 5.2, 7.5, 34 + s, 0x5a4c4a); k.rock(s * 13, -1, -13, 3.4, 3.2, 38 + s, 0x6a5a58); }
    k.rock(0, 8.2, -16, 6.4, 2.8, 41, 0x5a4c4a); k.rock(-3, 10, -18, 4.4, 2.4, 42, 0x4a3e3c); k.rock(3.5, 9.6, -19, 4.8, 2.6, 43, 0x4a3e3c);
    B.plain.col(0x050304).box(-5.5, -0.5, -22, 5.5, 10, -19);
    // 骨堆、图腾、篝火
    const skull = (x, y, z, s = 1) => { B.plain.col(0xe8e0c8).sphere(x, y + 0.16 * s, z, 0.16 * s, 0.15 * s, 0.18 * s, 8, 6).box(x - 0.09 * s, y, z + 0.04 * s, x + 0.09 * s, y + 0.08 * s, z + 0.17 * s); B.plain.col(0x100808).sphere(x - 0.06 * s, y + 0.17 * s, z + 0.15 * s, 0.035 * s, 0.035 * s, 0.02 * s, 5, 3).sphere(x + 0.06 * s, y + 0.17 * s, z + 0.15 * s, 0.035 * s, 0.035 * s, 0.02 * s, 5, 3); };
    for (let i = 0; i < 26; i++) {
      const a = rnd() * TAU, r = 4 + rnd() * 12, x = Math.cos(a) * r, z = Math.sin(a) * r - 6;
      B.plain.col(0xd8d0b8);
      if (i % 3) B.plain.beam(x, 0.06, z, x + (rnd() - 0.5) * 0.9, 0.06, z + (rnd() - 0.5) * 0.9, 0.07, 0.07);
      else skull(x, 0, z, 0.9 + rnd() * 0.5);
    }
    for (const [tx, tz] of [[-6, -9], [6, -9], [-10, 1], [10, 1]]) {
      B.wood.col(0x3a2a1e, 1.2).cyl(tx, -0.3, tz, 0.17, 0.13, 4.2, 7);
      B.wood.beam(tx - 0.8, 3.2, tz, tx + 0.8, 3.2, tz, 0.12, 0.12);
      skull(tx, 3.9, tz + 0.05, 2.2);
      B.cloth.col(0x8a1a14).surf(3, 5, (u, v, p) => { p[0] = tx + (u * 2 - 1) * 0.7; p[1] = 3.15 - v * 2.0; p[2] = tz + 0.08 + Math.sin(v * 3 + u) * 0.08; p[3] = u; p[4] = v; p[5] = v > 0.85 && u % 0.67 > 0.3 ? 0.6 : 1; });
      k.pillar(tx, tz, 0.25, -0.3, 4);
    }
    B.wood.col(0x3a2418, 1.2); for (let i = 0; i < 5; i++) { const a = i * 1.2566; B.wood.beam(Math.cos(a) * 0.8, 0.1, 4 + Math.sin(a) * 0.8, -Math.cos(a) * 0.15, 0.5, 4 - Math.sin(a) * 0.15, 0.14, 0.14); }
    B.masonry.col(0x5a5450); for (let i = 0; i < 9; i++) { const a = i * 0.698; B.masonry.sphere(Math.cos(a) * 1.15, 0.1, 4 + Math.sin(a) * 1.15, 0.24, 0.18, 0.22, 6, 4); }
    k.emit('ember', 0, 0.6, 4); k.emit('smoke', 0, 1.4, 4, 0, [0.35, 0.3, 0.32]); k.emit('fire', 0, 0.3, 4, 0.5);
    k.light(0, 1.3, 4, [1, 0.45, 0.2], 1.6, true);
    // 囚笼（霜狐）
    const cg = [-10, 0, 8.5];
    B.wood.col(0x4a3220, 1.2).box(cg[0] - 0.95, 0, cg[2] - 0.8, cg[0] + 0.95, 0.15, cg[2] + 0.8).box(cg[0] - 0.95, 1.45, cg[2] - 0.8, cg[0] + 0.95, 1.6, cg[2] + 0.8);
    for (let i = 0; i <= 6; i++) { const t = -0.9 + i * 0.3; for (const s of [-1, 1]) { B.wood.cyl(cg[0] + t, 0.15, cg[2] + s * 0.76, 0.03, 0.03, 1.3, 5); } }
    for (let i = 1; i <= 4; i++) { const t = -0.8 + i * 0.32; for (const s of [-1, 1]) B.wood.cyl(cg[0] + s * 0.92, 0.15, cg[2] + t, 0.03, 0.03, 1.3, 5); }
    B.glow.col(0xff4030, 1.4).box(cg[0] - 0.2, 1.62, cg[2] - 0.2, cg[0] + 0.2, 1.64, cg[2] + 0.2);
    k.solid(cg[0] - 0.95, 0, cg[2] - 0.8, cg[0] + 0.95, 1.6, cg[2] + 0.8);
    { const p = k.wp(cg[0], 0, cg[2]); pois.cage = { x: p.x, y: p.y, z: p.z }; pois.interact.push({ type: 'cage', id: 'cage', x: p.x, y: p.y, z: p.z, r: 2.6, label: '解开囚笼' }); }
    { const p = k.wp(0, 0, -4); pois.spots.wolfking = [p.x, p.y, p.z]; }
    X(null);
    // 瘴气
    for (let i = 0; i < 7; i++) { const a = rnd() * TAU, r = 15 + rnd() * 50, x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r; pois.emitters.push({ type: 'miasma', x, y: gy(x, z) + 0.3, z, r: 9 }); }
    pois.spirit.push({ x: V.x, z: V.z, r: 14, mult: 2, name: '封妖碑' });
  }
  portal(L.PORTALS[2]);
  flush();

  // ================= 赤焰火山 =================
  begin();
  {
    const V = L.VOLCANO, A = L.ARENA, AY = ARENA_H, rnd = mulberry32(505);
    // 火山口岩浆湖
    const lavaMat = lavaMaterial(mats.shared);
    const lg = new THREE.CircleGeometry(V.rim - 5, 48); lg.rotateX(-Math.PI / 2);
    const lake = new THREE.Mesh(lg, lavaMat); lake.position.set(V.x, LAVA_Y, V.z); group.add(lake);
    pois.lava.push({ x: V.x, z: V.z, r: V.rim - 5, y: LAVA_Y });
    pois.emitters.push({ type: 'plume', x: V.x, y: LAVA_Y + 8, z: V.z, r: 16, range: 2200 });
    for (let i = 0; i < 6; i++) { const a = i * 1.047; pois.emitters.push({ type: 'ember', x: V.x + Math.cos(a) * 14, y: LAVA_Y + 0.3, z: V.z + Math.sin(a) * 14, r: 6 }); }
    for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.4; k.light(V.x + Math.cos(a) * 12, LAVA_Y + 2, V.z + Math.sin(a) * 12, [1, 0.4, 0.1], 2.2, true); }
    // 熔岩魔君台
    X(mat4(A.x, AY, A.z));
    B.paving.col(0x6a5a54).disc(0, 0.03, 0, 15, 40, 0.5);
    B.masonry.col(0x4a3e3a).cyl(0, -1.5, 0, 15.6, 15.8, 1.55, 40, 0.5, 0);
    const sd = runeDisc(9, 0xff5020, 'seal'); sd.position.set(A.x, AY + 0.09, A.z); sd.material.opacity = 0.7; group.add(sd);
    pois.fx.push({ mesh: sd, spin: 0.08 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.13, r = 18.5 + rnd() * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, hh = 3 + rnd() * 4.5;
      at(sub(x, gy(A.x + x, A.z + z) - AY - 0.5, z, rnd() * 3, 1), () => {
        const m = k.M.clone().multiply(mat4(0, 0, 0, 0, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4));
        X(m);
        B.rock.col(0x2a2224).lathe(0, 0, 0, [[0.9, 0], [0.75, hh * 0.4], [0.4, hh * 0.8], [0.02, hh]], 6, 0.5);
        B.glow.col(0xff5a20, 1.2).lathe(0, hh * 0.78, 0, [[0.43, 0], [0.24, hh * 0.12], [0.02, hh * 0.22]], 6);
      });
      k.pillar(x, z, 0.85, -1, hh);
    }
    for (const [px, pz] of [[-11, 4], [10.5, 6]]) {
      B.rock.col(0x2a2224); for (let i = 0; i < 10; i++) { const a = i * 0.628; k.rock(px + Math.cos(a) * 2.9, -0.2, pz + Math.sin(a) * 2.9, 0.6, 0.45, 60 + i, 0x5a4440); }
      const pm = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24).rotateX(-Math.PI / 2), lavaMat); pm.position.set(A.x + px, AY + 0.12, A.z + pz); group.add(pm);
      pois.lava.push({ x: A.x + px, z: A.z + pz, r: 2.4, y: AY + 0.12 });
      k.emit('ember', px, 0.2, pz, 2); k.light(px, 1, pz, [1, 0.45, 0.12], 1.4, true);
    }
    // 地火熔炉
    at(sub(0, 0, -11.5), () => {
      B.masonry.col(0x5a4c48).cyl(0, -0.5, 0, 3.6, 3.6, 1.1, 8).cyl(0, 0.6, 0, 3.0, 3.0, 0.3, 8);
      B.plain.col(0x3a3030, 1.1).lathe(0, 0.9, 0, [[0.6, 0], [1.6, 0.4], [1.95, 1.4], [1.75, 2.6], [1.2, 3.1], [1.35, 3.3], [1.0, 3.45], [0.55, 4.3], [0.3, 5.4], [0.42, 5.6], [0, 5.65]], 14);
      B.plain.col(GOLD, 1.0).cyl(0, 2.2, 0, 1.97, 1.97, 0.12, 14, 0.5, 0).cyl(0, 3.3, 0, 1.36, 1.36, 0.1, 14, 0.5, 0);
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + 1.57; B.plain.col(0x2a2224).cyl(Math.cos(a) * 1.3, 0.9, Math.sin(a) * 1.3, 0.25, 0.32, 0.6, 6); }
      B.lantern.col(0xff6a1a).box(-0.6, 1.4, 1.75, 0.6, 2.3, 1.95);
      B.plain.col(0x2a2626);
      for (const s of [-1, 1]) { B.plain.cyl(s * 2.6, 0.9, -0.5, 0.12, 0.12, 4.6, 6); B.plain.beam(s * 2.6, 5.4, -0.5, s * 0.5, 4.9, 0, 0.06, 0.06); }
      B.plain.col(0x34363c).box(2.6, 0.9, 1.2, 3.4, 1.4, 1.8).box(2.4, 1.4, 1.1, 3.6, 1.65, 1.9);
      k.pillar(0, 0, 2.0, 0.9, 5.6); k.solid(2.4, 0.9, 1.1, 3.6, 1.65, 1.9);
      k.emit('ember', 0, 2.2, 2.0); k.emit('smoke', 0, 5.8, 0, 0, [0.3, 0.28, 0.28]); k.light(0, 1.9, 2.4, [1, 0.5, 0.18], 1.6, true);
      const p = k.wp(0, 0.9, 2.2); pois.interact.push({ type: 'forge', x: p.x, y: p.y, z: p.z, r: 4.2, label: '地火熔炉' });
    });
    k.solid(-3.6, -0.5, -15.1, 3.6, 0.9, -7.9);
    pois.spots.yanji = [A.x + 4.5, AY + 0.05, A.z - 7.5];
    pois.spots.lavagolem = [A.x, AY, A.z + 2];
    X(null);
    pois.spirit.push({ x: A.x, z: A.z, r: 8, mult: 3, name: '地火灵脉' });
    // 山麓残门
    X(mat4(583, gy(583, -338), -338, 0.1));
    for (const s of [-1, 1]) { B.masonry.col(0x5a4c48).box(s * 3.4 - 0.55, -1, -0.55, s * 3.4 + 0.55, s > 0 ? 6.5 : 4.2, 0.55); k.solid(s * 3.4 - 0.55, -1, -0.55, s * 3.4 + 0.55, s > 0 ? 6.5 : 4.2, 0.55); }
    B.masonry.box(-0.5, 5.9, -0.5, 4.6, 6.8, 0.5);
    at(sub(-3.6, 0.3, 2.2, 0.5), () => { B.masonry.xf(k.M.clone().multiply(mat4(0, 0, 0, 0, 0, 0.12))); B.masonry.box(-2.6, 0, -0.45, 2.6, 0.9, 0.45); B.masonry.xf(k.M); });
    k.plaque('炎阳', 2.0, 6.35, 0.52, 0.55, 0, { bg: '#3a1410' });
    X(null);
    for (let i = 0; i < 16; i++) { const a = rnd() * TAU, r = 120 + rnd() * 120, x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r; if (Math.hypot(x - A.x, z - A.z) < 30) continue; k.X(null); k.rock(x, gy(x, z) - 0.3, z, 1.2 + rnd() * 2.4, 0.9 + rnd() * 1.4, 70 + i, 0x5a4a46); }
  }
  portal(L.PORTALS[3]);
  flush();

  // ================= 雷劫台 =================
  begin();
  {
    const T = L.TRIB, TY = TRIB_H;
    X(mat4(T.x, TY, T.z));
    B.masonry.col(0xd8d4cc).cyl(0, -3.5, 0, 13, 13, 3.9, 8, 0.5).col(0xe8e4dc).cyl(0, 0.4, 0, 11.6, 11.6, 0.4, 8, 0.5);
    col.add({ cyl: 1, x: T.x, z: T.z, r: 13, y0: TY - 3.5, y1: TY + 0.4 }); col.add({ cyl: 1, x: T.x, z: T.z, r: 11.6, y0: TY, y1: TY + 0.8 });
    B.masonry.col(STONE).cyl(0, 0.8, 0, 4.2, 4.2, 0.35, 24).cyl(0, 1.15, 0, 3.2, 3.2, 0.35, 24);
    col.add({ cyl: 1, x: T.x, z: T.z, r: 4.2, y0: TY, y1: TY + 1.15 }); col.add({ cyl: 1, x: T.x, z: T.z, r: 3.2, y0: TY, y1: TY + 1.5 });
    const dg = new GB(); dg.disc(0, 0, 0, 2.8, 40, -1);
    k.addMesh(dg.build(), mats.decal(taijiTexture()), k.sub(0, 1.51, 0), false);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, c = Math.cos(a) * 8.2, s = Math.sin(a) * 8.2;
      if (Math.abs(c) < 3 && s > 4) continue;
      at(sub(c, 0.8, s, -a + Math.PI / 2), () => {
        B.masonry.col(0x8a8a8e).box(-0.55, 0, -0.18, 0.55, 1.5, 0.18);
        B.glow.col(0x9fc8ff, 1.5);
        const t = [7, 3, 5, 1, 6, 2, 4, 0][i];
        for (let kk = 0; kk < 3; kk++) { const y = 0.5 + kk * 0.3; if ((t >> kk) & 1) B.glow.box(-0.35, y, 0.185, 0.35, y + 0.08, 0.2); else { B.glow.box(-0.35, y, 0.185, -0.06, y + 0.08, 0.2); B.glow.box(0.06, y, 0.185, 0.35, y + 0.08, 0.2); } }
      });
      k.pillar(c, s, 0.5, 0.8, 2.3);
    }
    for (let i = 0; i < 4; i++) {
      const a = i * 1.5708 + 0.785, c = Math.cos(a) * 10, s = Math.sin(a) * 10;
      B.masonry.col(0x6a5a4a).box(c - 0.75, 0.8, s - 0.75, c + 0.75, 1.4, s + 0.75);
      B.plain.col(0x8a6a3a, 1.2).cyl(c, 1.4, s, 0.42, 0.32, 12, 10);
      B.plain.col(GOLD, 1.3); for (const h of [2.2, 5.5, 9.2]) B.plain.cyl(c, 1.4 + h, s, 0.46, 0.44, 0.22, 10);
      B.plain.lathe(c, 13.4, s, [[0.45, 0], [0.65, 0.3], [0.2, 0.7], [0.06, 1.9]], 8);
      B.glow.col(0xbcd8ff, 2.2).sphere(c, 14.0, s, 0.42, 0.42, 0.42, 10, 6);
      k.pillar(c, s, 0.5, 0.8, 13.5); k.light(c, 14, s, [0.6, 0.75, 1], 1.0, true);
    }
    k.plaque('雷劫台', 0, 1.3, 4.22, 0.4, 0, { bg: '#1a2238', fg: '#cfe0ff' });
    k.emit('spark', 0, 1.6, 0, 9);
    X(null);
    pois.spirit.push({ x: T.x, z: T.z, r: 11, mult: 6, name: '雷劫台', minY: TY });
    pois.spots.trib = [T.x, TY + 1.5, T.z];
  }
  portal(L.PORTALS[4], TRIB_H + 0.25);
  flush();

  // ================= 青云村补充：传送阵、测灵石 =================
  begin();
  portal(L.PORTALS[0]);
  {
    const x = -6.5, z = -31.5, y = L.VILLAGE_H;
    X(mat4(x, y, z));
    B.masonry.col(STONE).cyl(0, -0.3, 0, 1.0, 1.1, 0.6, 8).cyl(0, 0.3, 0, 0.75, 0.8, 0.25, 8);
    B.glow.col(0xbff4ff, 1.5).lathe(0, 0.55, 0, [[0.18, 0], [0.42, 0.35], [0.36, 1.4], [0.22, 1.85], [0.001, 2.05]], 6);
    k.pillar(0, 0, 1.0, 0, 2.6); k.light(0, 1.6, 0, [0.6, 0.95, 1], 0.9, true);
    X(null);
    pois.spots.rootStone = [x, y + 1.6, z];
  }
  flush();
}
