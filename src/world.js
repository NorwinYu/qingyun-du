// 开放世界：平滑地形分块、远景地形与树冠、树木/岩石实例、草地、碰撞查询
import * as THREE from 'three';
import { rawHeight, splat, grassTint, kindOf, treeChoice, roadDist, zoneW } from './height.js';
import { WATER_SURF, GROVES } from './layout.js';
import { hash2, hashi, smoothstep, perlin2, mulberry32 } from './noise.js';
import { SPECIES, makeTreeBuilders, makeBlobGeos, makeBladeGeo, makeFlowerGeo, makeRockGeos } from './veg.js';
import { lin } from './geo.js';

export const CS = 64;
const FS = 512, FSTEP = 16, GS = 16, TC = 6.4, TAU = Math.PI * 2;
const key = (i, j) => (i + 32768) * 65536 + (j + 32768);
const sp = [0, 0, 0], tt = [0, 0, 0];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const FLOWERS = [0xffffff, 0xffe066, 0xff9ec4, 0xb48cff, 0x8fd0ff, 0xff7a5a].map(lin);

// 植被格 (i, j) 上的树；与远景树冠共用，保证远近一致
export function treeAt(i, j) {
  const r = hash2(i, j, 101);
  if (r >= 0.8) return null;
  const x = (i + 0.15 + 0.7 * hash2(i, j, 103)) * TC, z = (j + 0.15 + 0.7 * hash2(i, j, 104)) * TC;
  if (r >= 0.44 && Math.hypot(x - GROVES.bamboo.x, z - GROVES.bamboo.z) > GROVES.bamboo.r) return null;
  const h = rawHeight(x, z), kind = treeChoice(x, z, h, r, hash2(i, j, 102));
  if (!kind) return null;
  if (Math.abs(rawHeight(x + 1.5, z) - h) + Math.abs(rawHeight(x, z + 1.5) - h) > 2.6) return null;
  return { x, z, h, kind, s: 0.8 + hash2(i, j, 105) * 0.5, rot: hash2(i, j, 106) * TAU, v: hashi(i, j, 107) & 1, tint: 0.8 + hash2(i, j, 108) * 0.32 };
}

// 规则网格地形（带裙边）；返回 { geo, H, w, lo, hi }
const zz = [0, 0];
function terrainGeo(x0, z0, size, step, skirt) {
  const n = size / step, n1 = n + 1, w = n + 3, H = new Float32Array(w * w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) H[j * w + i] = rawHeight(x0 + (i - 1) * step, z0 + (j - 1) * step);
  const nv = n1 * n1 + 4 * n1, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), spl = new Float32Array(nv * 3), tin = new Float32Array(nv * 3);
  let lo = 1e9, hi = -1e9, v = 0;
  for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++, v++) {
    const k = (j + 1) * w + i + 1, h = H[k], x = x0 + i * step, z = z0 + j * step;
    if (h < lo) lo = h; if (h > hi) hi = h;
    const nx = H[k - 1] - H[k + 1], nz = H[k - w] - H[k + w], l = 1 / Math.hypot(nx, 2 * step, nz);
    pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = z;
    nor[v * 3] = nx * l; nor[v * 3 + 1] = 2 * step * l; nor[v * 3 + 2] = nz * l;
    splat(x, z, sp); grassTint(x, z, h, tt);
    spl[v * 3] = sp[0]; spl[v * 3 + 1] = sp[1]; spl[v * 3 + 2] = sp[2];
    tin[v * 3] = tt[0]; tin[v * 3 + 1] = tt[1]; tin[v * 3 + 2] = tt[2];
  }
  const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(n * n * 6 + 4 * n * 12);
  let q = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  const edges = [(k) => k, (k) => n * n1 + k, (k) => k * n1, (k) => k * n1 + n];
  for (const ef of edges) {
    const s0 = v;
    for (let k = 0; k < n1; k++, v++) {
      const src = ef(k);
      for (let c = 0; c < 3; c++) { pos[v * 3 + c] = pos[src * 3 + c]; nor[v * 3 + c] = nor[src * 3 + c]; spl[v * 3 + c] = spl[src * 3 + c]; tin[v * 3 + c] = tin[src * 3 + c]; }
      pos[v * 3 + 1] -= skirt;
    }
    for (let k = 0; k < n; k++) {
      const a = ef(k), b = ef(k + 1), c = s0 + k, d = s0 + k + 1;
      idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = a; idx[q++] = d; idx[q++] = c;
      idx[q++] = a; idx[q++] = d; idx[q++] = b; idx[q++] = a; idx[q++] = c; idx[q++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('aSplat', new THREE.BufferAttribute(spl, 3));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tin, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + size / 2, (lo + hi) / 2 - skirt / 2, z0 + size / 2), Math.hypot(size * 0.7072, (hi - lo) / 2 + skirt));
  return { geo, H, w, lo, hi };
}

export class World {
  constructor({ scene, mats, colliders, waterMat }) {
    Object.assign(this, { scene, mats, col: colliders, waterMat });
    this.chunks = new Map(); this.far = new Map(); this.grass = new Map(); this.fields = [];
    this.group = new THREE.Group(); this.farGroup = new THREE.Group(); this.waterGroup = new THREE.Group(); this.grassGroup = new THREE.Group(); this.blobGroup = new THREE.Group();
    scene.add(this.group, this.farGroup, this.waterGroup, this.grassGroup, this.blobGroup);
    this.nearRect = new THREE.Vector4(1e9, 1e9, -1e9, -1e9);
    this.nearR = 3; this.farR = 3; this.grassR = 72; this.grassK = 1; this.busy = false;
    this.treeBuilders = makeTreeBuilders();
    this.trees = {};
    for (const k in this.treeBuilders) this.trees[k] = this.treeBuilders[k].map((g) => g.build());
    this.blobGeo = makeBlobGeos(); this.bladeGeo = makeBladeGeo(false); this.bladeLo = makeBladeGeo(true); this.flowerGeo = makeFlowerGeo(); this.rockGeos = makeRockGeos();
    this.grassCol = lin(0x58782c);
  }
  setQuality(q) {
    this.nearR = [2, 3, 3][q]; this.farR = [2, 3, 3][q]; this.grassR = [46, 62, 76][q]; this.grassK = [0.45, 0.75, 1][q];
  }

  // ---- 查询
  groundY(x, z) { return rawHeight(x, z); }
  grad(x, z) { return Math.hypot(rawHeight(x + 0.6, z) - rawHeight(x - 0.6, z), rawHeight(x, z + 0.6) - rawHeight(x, z - 0.6)) / 1.2; }
  kindAt(x, z) { return kindOf(x, z, rawHeight(x, z), this.grad(x, z)); }
  floorAt(x, z, hw, yMax) { const g = rawHeight(x, z), c = this.col.topAt(x, z, hw, yMax); return c > g ? c : g; }
  standY(x, y, z) { return this.floorAt(x, z, 0.2, y); }
  boxFree(x, y, z, hw, hh) { return rawHeight(x, z) <= y + 0.05 && !this.col.hit(x, y + 0.05, z, hw, hh - 0.05); }
  solidAt(x, y, z, skipThin) { return y < rawHeight(x, z) || this.col.hit(x, y, z, 0, 0.001, skipThin); }
  rayHit(ox, oy, oz, dx, dy, dz, max) {
    for (let t = 0.3; t < max; t += 0.3) if (this.solidAt(ox + dx * t, oy + dy * t, oz + dz * t, true)) return t - 0.3;
    return max;
  }

  // ---- 近景分块
  _chunk(cx, cz) {
    const x0 = cx * CS, z0 = cz * CS, step = Math.hypot(x0 + CS / 2, z0 + CS / 2) < 210 ? 1 : 2, { geo, H, w, lo } = terrainGeo(x0, z0, CS, step, 3);
    const c = { cx, cz, group: new THREE.Group(), cols: [], geos: [geo] };
    const mesh = new THREE.Mesh(geo, this.mats.terrain);
    mesh.receiveShadow = true;
    c.group.add(mesh);
    if (lo < WATER_SURF + 0.25) this._water(c, x0, z0, H, w, 2 / step);
    this._trees(c, cx, cz);
    this._rocks(c, x0, z0);
    c.group.visible = false;
    if (c.water) c.water.visible = false;
    this.group.add(c.group);
    return c;
  }
  _water(c, x0, z0, H, w, st) {
    const n = CS / 2, n1 = n + 1, map = new Int32Array(n1 * n1).fill(-1), pos = [], dep = [], idx = [];
    const D = (i, j) => WATER_SURF - H[(j * st + 1) * w + i * st + 1];
    const V = (i, j) => { const k = j * n1 + i; if (map[k] < 0) { map[k] = dep.length; pos.push(x0 + i * 2, WATER_SURF, z0 + j * 2); dep.push(D(i, j)); } return map[k]; };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (Math.max(D(i, j), D(i + 1, j), D(i, j + 1), D(i + 1, j + 1)) < -0.25) continue;
      const a = V(i, j), b = V(i + 1, j), cc = V(i, j + 1), d = V(i + 1, j + 1);
      idx.push(a, cc, b, b, cc, d);
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + CS / 2, WATER_SURF, z0 + CS / 2), CS * 0.72);
    c.water = new THREE.Mesh(g, this.waterMat);
    c.water.renderOrder = 5;
    c.geos.push(g);
    this.waterGroup.add(c.water);
  }
  _trees(c, cx, cz) {
    const groups = {};
    for (let j = cz * 10; j < cz * 10 + 10; j++) for (let i = cx * 10; i < cx * 10 + 10; i++) {
      const t = treeAt(i, j);
      if (!t) continue;
      (groups[t.kind + t.v] || (groups[t.kind + t.v] = [])).push(t);
      const r = t.kind === 'bamboo' ? 0.55 : t.kind === 'peach' ? 0.24 : 0.36 * t.s;
      c.cols.push(this.col.add({ cyl: 1, thin: 1, x: t.x, z: t.z, r, y0: t.h - 1, y1: t.h + 4.5 }));
    }
    for (const k in groups) {
      const list = groups[k], t0 = list[0], im = new THREE.InstancedMesh(this.trees[t0.kind][t0.v], this.mats.foliage, list.length);
      list.forEach((t, n) => {
        _m.compose(_p.set(t.x, t.h, t.z), _q.setFromEuler(_e.set(0, t.rot, 0)), _s.set(t.s, t.s * (0.92 + (t.tint - 0.8) * 0.6), t.s));
        im.setMatrixAt(n, _m);
        const hv = hash2(Math.round(t.x * 3), Math.round(t.z * 3), 7) - 0.5;
        im.setColorAt(n, _c.setRGB(t.tint * (1 + hv * 0.12), t.tint * (1 - hv * 0.3), t.tint * (1 - Math.abs(hv) * 0.2)));
      });
      im.castShadow = true; im.receiveShadow = true; im.customDepthMaterial = this.mats.foliageDepth;
      im.computeBoundingSphere();
      c.group.add(im);
    }
  }
  _rocks(c, x0, z0) {
    const lists = [[], [], []];
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const gi = Math.floor(x0 / 8) + i, gj = Math.floor(z0 / 8) + j, r = hash2(gi, gj, 201);
      const x = (gi + hash2(gi, gj, 202)) * 8, z = (gj + hash2(gi, gj, 203)) * 8;
      if (x * x + z * z < 92 * 92 || roadDist(x, z) < 3) continue;
      const h = rawHeight(x, z);
      if (h < -1.2) continue;
      const g = this.grad(x, z);
      const p = h < 0.7 ? 0.14 : 0.03 + smoothstep(0.35, 0.9, g) * 0.3 + smoothstep(40, 70, h) * 0.14;
      if (r > p) continue;
      const s = (0.35 + hash2(gi, gj, 204) * hash2(gi, gj, 205) * 2.3) * (h > 40 ? 1.5 : 1);
      const sy = s * (0.55 + hash2(gi, gj, 206) * 0.4);
      lists[hashi(gi, gj, 207) % 3].push({ x, z, h, s, sy, rot: hash2(gi, gj, 208) * TAU, t: 0.75 + hash2(gi, gj, 209) * 0.4 });
      if (s > 0.6) c.cols.push(this.col.add({ cyl: 1, x, z, r: s * 0.78, y0: h - 2, y1: h + sy * 0.62 }));
    }
    lists.forEach((list, v) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(this.rockGeos[v], this.mats.rock, list.length);
      list.forEach((o, n) => {
        _m.compose(_p.set(o.x, o.h - o.sy * 0.2, o.z), _q.setFromEuler(_e.set(0, o.rot, 0)), _s.set(o.s, o.sy, o.s));
        im.setMatrixAt(n, _m); im.setColorAt(n, _c.setRGB(o.t, o.t, o.t * 0.97));
      });
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      c.group.add(im);
    });
  }
  _dropChunk(c) {
    this.group.remove(c.group);
    if (c.water) this.waterGroup.remove(c.water);
    c.geos.forEach((g) => g.dispose());
    c.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    this.col.remove(c.cols);
  }

  // ---- 远景
  _far(tx, tz) {
    const { geo } = terrainGeo(tx * FS, tz * FS, FS, FSTEP, 14);
    const t = { tx, tz, group: new THREE.Group(), geo, blobs: false, bl: [] };
    const mesh = new THREE.Mesh(geo, this.mats.terrainFar);
    mesh.receiveShadow = true;
    t.group.add(mesh);
    this.farGroup.add(t.group);
    return t;
  }
  _blobs(t) {
    t.blobs = true;
    const A = [], B = [], n = FS / TC;
    for (let j = t.tz * n; j < (t.tz + 1) * n; j++) for (let i = t.tx * n; i < (t.tx + 1) * n; i++) { const tr = treeAt(i, j); if (tr) (SPECIES[tr.kind].cone ? B : A).push(tr); }
    [[A, this.blobGeo.round], [B, this.blobGeo.cone]].forEach(([list, geo]) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, this.mats.blob, list.length);
      list.forEach((tr, k) => {
        const S = SPECIES[tr.kind], c = lin(S.blob);
        _m.compose(_p.set(tr.x, tr.h + S.cy * tr.s, tr.z), _q.setFromEuler(_e.set(0, tr.rot, 0)), _s.set(S.rx * tr.s * 0.95, S.ry * tr.s * 0.95, S.rx * tr.s * 0.95));
        im.setMatrixAt(k, _m); im.setColorAt(k, _c.setRGB(c[0] * tr.tint, c[1] * tr.tint, c[2] * tr.tint));
      });
      im.computeBoundingSphere();
      this.blobGroup.add(im); t.bl.push(im);
    });
  }

  // ---- 草地
  _grass(gx, gz) {
    const x0 = gx * GS, z0 = gz * GS, n1 = GS + 1, Hh = new Float32Array(n1 * n1), Gw = new Float32Array(n1 * n1), Tn = new Float32Array(n1 * n1 * 3);
    let lo = 1e9, hi = -1e9, any = 0;
    for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
      const x = x0 + i, z = z0 + j, h = rawHeight(x, z), k = j * n1 + i;
      Hh[k] = h; if (h < lo) lo = h; if (h > hi) hi = h;
      splat(x, z, sp); grassTint(x, z, h, tt);
      Tn[k * 3] = tt[0]; Tn[k * 3 + 1] = tt[1]; Tn[k * 3 + 2] = tt[2];
      let g = 1 - Math.min(1, Math.max(sp[0] * 1.5, sp[1] * 2, sp[2] * 2));
      g *= smoothstep(0.45, 1.0, h) * smoothstep(66, 54, h) * (1 - zoneW(x, z, zz)[0]);
      Gw[k] = g; any += g;
    }
    const cell = { gx, gz, mesh: null, flowers: null, n: 0 };
    if (any < 0.5) return cell;
    for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
      const k = j * n1 + i, a = Hh[j * n1 + Math.min(GS, i + 1)] - Hh[j * n1 + Math.max(0, i - 1)], b = Hh[Math.min(GS, j + 1) * n1 + i] - Hh[Math.max(0, j - 1) * n1 + i];
      Gw[k] *= smoothstep(1.7, 1.1, Math.hypot(a, b));
    }
    const MAX = Math.round(GS * GS * 12 * this.grassK), rnd = mulberry32(hashi(gx, gz, 301));
    const aPos = new Float32Array(MAX * 4), aRot = new Float32Array(MAX * 4), col = new Float32Array(MAX * 3), gc = this.grassCol;
    const fP = [], fR = [], fC = [];
    const patch = perlin2(x0 * 0.02, z0 * 0.02, 51), fl = smoothstep(0.1, 0.5, perlin2(x0 * 0.013 + 9, z0 * 0.013, 52));
    let n = 0;
    for (let k = 0; k < MAX; k++) {
      const fx = rnd() * GS, fz = rnd() * GS, r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd();
      const i = Math.min(GS - 1, fx | 0), j = Math.min(GS - 1, fz | 0), u = fx - i, v = fz - j, q = j * n1 + i;
      const g = (Gw[q] * (1 - u) + Gw[q + 1] * u) * (1 - v) + (Gw[q + n1] * (1 - u) + Gw[q + n1 + 1] * u) * v;
      if (r1 > g) continue;
      const x = x0 + fx, z = z0 + fz, h = (Hh[q] * (1 - u) + Hh[q + 1] * u) * (1 - v) + (Hh[q + n1] * (1 - u) + Hh[q + n1 + 1] * u) * v;
      if (this.col.topAt(x, z, 0.05, 1e9) > h + 0.02) continue;
      const loc = perlin2(x * 0.11, z * 0.11, 53), hgt = (0.34 + r2 * 0.4) * (0.55 + 0.45 * g) * (1 + patch * 0.3 + loc * 0.35), a = r3 * TAU, jit = 0.82 + r4 * 0.36;
      aPos[n * 4] = x; aPos[n * 4 + 1] = h - 0.02; aPos[n * 4 + 2] = z; aPos[n * 4 + 3] = hgt;
      aRot[n * 4] = Math.cos(a); aRot[n * 4 + 1] = Math.sin(a); aRot[n * 4 + 2] = 0.12 + rnd() * 0.4; aRot[n * 4 + 3] = 0.75 + rnd() * 0.6;
      const t0 = Tn[q * 3], t1 = Tn[q * 3 + 1], t2 = Tn[q * 3 + 2];
      col[n * 3] = gc[0] * t0 * jit; col[n * 3 + 1] = gc[1] * t1 * jit; col[n * 3 + 2] = gc[2] * t2 * jit;
      n++;
      if (fl > 0 && g > 0.8 && rnd() < 0.012 * fl && fP.length < 400) {
        const c = FLOWERS[(rnd() * (loc > 0 ? 3 : 6)) | 0], b = rnd() * TAU;
        fP.push(x, h, z, hgt * (0.8 + rnd() * 0.5) + 0.08); fR.push(Math.cos(b), Math.sin(b), 0, 0.8 + rnd() * 0.7); fC.push(c[0], c[1], c[2]);
      }
    }
    if (!n) return cell;
    const bs = new THREE.Sphere(new THREE.Vector3(x0 + GS / 2, (lo + hi) / 2, z0 + GS / 2), GS * 0.72 + (hi - lo) / 2 + 1);
    const geo = (base, A) => {
      const g = new THREE.InstancedBufferGeometry();
      g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('normal', base.attributes.normal);
      g.setAttribute('aPos', A[0]); g.setAttribute('aRot', A[1]); g.setAttribute('color', A[2]);
      g.instanceCount = A[0].count; g.boundingSphere = bs;
      return g;
    };
    const mk = (base, P, R, C, mat) => {
      const A = [new THREE.InstancedBufferAttribute(P, 4), new THREE.InstancedBufferAttribute(R, 4), new THREE.InstancedBufferAttribute(C, 3)];
      const m = new THREE.Mesh(geo(base, A), mat);
      m.receiveShadow = true; m.userData.A = A;
      this.grassGroup.add(m);
      return m;
    };
    cell.mesh = mk(this.bladeGeo, aPos.slice(0, n * 4), aRot.slice(0, n * 4), col.slice(0, n * 3), this.mats.grass);
    cell.hi = cell.mesh.geometry; cell.lo = geo(this.bladeLo, cell.mesh.userData.A);
    cell.n = n;
    if (fC.length) cell.flowers = mk(this.flowerGeo, new Float32Array(fP), new Float32Array(fR), new Float32Array(fC), this.mats.flower);
    return cell;
  }
  _dropGrass(c) {
    for (const m of [c.mesh, c.flowers]) if (m) { this.grassGroup.remove(m); m.geometry.dispose(); }
    if (c.lo) { c.lo.dispose(); c.hi.dispose(); }
  }

  // ---- 常驻草/作物区：{x0,z0,x1,z1 | cx,cz,r, density, h0, h1, color, rows, width, flowers, yAt(x,z)}；首次靠近时生成
  addField(o) { this.fields.push({ o, mesh: null, flowers: null, built: false, cx: o.r === undefined ? (o.x0 + o.x1) / 2 : o.cx, cz: o.r === undefined ? (o.z0 + o.z1) / 2 : o.cz }); }
  _field(f) {
    f.built = true;
    const o = f.o, rect = o.r === undefined, x0 = rect ? o.x0 : o.cx - o.r, x1 = rect ? o.x1 : o.cx + o.r, z0 = rect ? o.z0 : o.cz - o.r, z1 = rect ? o.z1 : o.cz + o.r;
    const N = Math.round((x1 - x0) * (z1 - z0) * o.density), rnd = mulberry32(hashi(Math.round(x0), Math.round(z0), 401)), gc = lin(o.color), wd = o.width || 1;
    const P = new Float32Array(N * 4), R = new Float32Array(N * 4), C = new Float32Array(N * 3), fP = [], fR = [], fC = [];
    let n = 0, lo = 1e9, hi = -1e9;
    for (let k = 0; k < N; k++) {
      const x = x0 + rnd() * (x1 - x0);
      let z = z0 + rnd() * (z1 - z0);
      const r2 = rnd(), r3 = rnd(), r4 = rnd(), r5 = rnd(), r6 = rnd();
      if (!rect && Math.hypot(x - o.cx, z - o.cz) > o.r) continue;
      if (o.rows) z = Math.floor(z) + 0.25 + (r6 - 0.5) * 0.3;
      const h = o.yAt ? o.yAt(x, z) : rawHeight(x, z);
      if (h === null || this.col.topAt(x, z, 0.05, 1e9) > h + 0.02) continue;
      const a = r3 * TAU, jit = 0.8 + r4 * 0.4, hgt = o.h0 + (o.h1 - o.h0) * r2;
      P[n * 4] = x; P[n * 4 + 1] = h - 0.02; P[n * 4 + 2] = z; P[n * 4 + 3] = hgt;
      R[n * 4] = Math.cos(a); R[n * 4 + 1] = Math.sin(a); R[n * 4 + 2] = 0.1 + r5 * 0.35; R[n * 4 + 3] = (0.75 + r6 * 0.6) * wd;
      C[n * 3] = gc[0] * jit; C[n * 3 + 1] = gc[1] * jit; C[n * 3 + 2] = gc[2] * (0.85 + r5 * 0.3);
      if (h < lo) lo = h; if (h > hi) hi = h;
      n++;
      if (o.flowers && rnd() < 0.02) { const c = FLOWERS[(rnd() * 6) | 0], b = rnd() * TAU; fP.push(x, h, z, hgt + 0.08); fR.push(Math.cos(b), Math.sin(b), 0, 0.8 + rnd() * 0.7); fC.push(c[0], c[1], c[2]); }
    }
    if (!n) return;
    const bs = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, (lo + hi) / 2, (z0 + z1) / 2), Math.hypot(x1 - x0, z1 - z0) / 2 + 2);
    const mk = (base, p, r, c, mat) => {
      const g = new THREE.InstancedBufferGeometry();
      g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('normal', base.attributes.normal);
      g.setAttribute('aPos', new THREE.InstancedBufferAttribute(p, 4)); g.setAttribute('aRot', new THREE.InstancedBufferAttribute(r, 4)); g.setAttribute('color', new THREE.InstancedBufferAttribute(c, 3));
      g.instanceCount = p.length / 4; g.boundingSphere = bs;
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      this.grassGroup.add(m);
      return m;
    };
    f.mesh = mk(this.bladeGeo, P.slice(0, n * 4), R.slice(0, n * 4), C.slice(0, n * 3), this.mats.grass);
    f.n = n;
    if (fC.length) f.flowers = mk(this.flowerGeo, new Float32Array(fP), new Float32Array(fR), new Float32Array(fC), this.mats.flower);
  }

  // 按预算逐步加载；返回是否仍有待加载内容
  update(fx, fz, budget = 5) {
    const t0 = performance.now(), over = () => performance.now() - t0 > budget;
    let pending = false, stop = false;
    const pcx = Math.floor(fx / CS), pcz = Math.floor(fz / CS), R = this.nearR, L = R + 1;
    let full = -1, ok = true;
    for (let d = 0; d <= L; d++) {
      for (let dz = -d; dz <= d; dz++) for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
        const k = key(pcx + dx, pcz + dz);
        if (this.chunks.has(k)) continue;
        if (stop) { ok = false; pending = true; continue; }
        this.chunks.set(k, this._chunk(pcx + dx, pcz + dz));
        if (over()) stop = true;
      }
      if (ok) full = d;
    }
    const vis = Math.min(R, full);
    for (const [k, c] of this.chunks) {
      const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
      if (d > L + 1) { this._dropChunk(c); this.chunks.delete(k); continue; }
      const v = d <= vis;
      c.group.visible = v; if (c.water) c.water.visible = v;
    }
    if (vis >= 0) this.nearRect.set((pcx - vis) * CS, (pcz - vis) * CS, (pcx + vis + 1) * CS, (pcz + vis + 1) * CS);
    else this.nearRect.set(1e9, 1e9, -1e9, -1e9);

    const ptx = Math.floor(fx / FS), ptz = Math.floor(fz / FS), FR = this.farR;
    for (let d = 0; d <= FR; d++) for (let dz = -d; dz <= d; dz++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
      const k = key(ptx + dx, ptz + dz);
      let t = this.far.get(k);
      if (!t) { if (stop) { pending = true; continue; } t = this._far(ptx + dx, ptz + dz); this.far.set(k, t); if (over()) stop = true; }
      if (d <= 1 && !t.blobs) { if (stop) { pending = true; continue; } this._blobs(t); if (over()) stop = true; }
    }
    for (const [k, t] of this.far) {
      if (Math.max(Math.abs(t.tx - ptx), Math.abs(t.tz - ptz)) <= FR + 1) continue;
      this.farGroup.remove(t.group); t.geo.dispose();
      t.bl.forEach((o) => { this.blobGroup.remove(o); o.dispose(); });
      this.far.delete(k);
    }

    const GR = this.grassR, g0x = Math.floor((fx - GR) / GS), g1x = Math.floor((fx + GR) / GS), g0z = Math.floor((fz - GR) / GS), g1z = Math.floor((fz + GR) / GS);
    let built = 0;
    for (let gz = g0z; gz <= g1z; gz++) for (let gx = g0x; gx <= g1x; gx++) {
      const k = key(gx, gz);
      if (this.grass.has(k)) continue;
      const d = Math.hypot((gx + 0.5) * GS - fx, (gz + 0.5) * GS - fz);
      if (d > GR + 8) continue;
      if (stop && built > 0) { pending = true; continue; }
      if (stop && d > 30) { pending = true; continue; }
      this.grass.set(k, this._grass(gx, gz)); built++;
      if (over()) stop = true;
    }
    for (const [k, c] of this.grass) {
      const d = Math.hypot((c.gx + 0.5) * GS - fx, (c.gz + 0.5) * GS - fz);
      if (d > GR + 26) { this._dropGrass(c); this.grass.delete(k); continue; }
      if (!c.mesh) continue;
      const f = d < 24 ? 1 : d < 42 ? 0.45 : d < GR + 8 ? 0.2 : 0;
      c.mesh.visible = f > 0; c.mesh.geometry = d < 24 ? c.hi : c.lo; c.mesh.geometry.instanceCount = Math.floor(c.n * f);
      if (c.flowers) c.flowers.visible = d < 60;
    }
    for (const f of this.fields) {
      const d = Math.hypot(f.cx - fx, f.cz - fz);
      if (!f.built && d < 150) this._field(f);
      if (!f.mesh) continue;
      f.mesh.visible = d < 170; f.mesh.geometry.instanceCount = Math.floor(f.n * (d < 60 ? 1 : d < 110 ? 0.6 : 0.35));
      if (f.flowers) f.flowers.visible = d < 110;
    }
    this.busy = pending;
    return pending;
  }
  loadAll(x, z) { let n = 0; while (this.update(x, z, 1e9) && n++ < 50); }
}
