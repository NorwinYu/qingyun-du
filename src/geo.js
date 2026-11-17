// 程序化网格构建器：带顶点色、UV 的基础几何体
import * as THREE from 'three';

const TAU = Math.PI * 2, _c = new THREE.Color(), cache = new Map();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
export function lin(hex) {
  let c = cache.get(hex);
  if (!c) { _c.setHex(hex); c = [_c.r, _c.g, _c.b]; cache.set(hex, c); }
  return c;
}
export function mat4(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
}

export class GB {
  constructor() {
    this.P = []; this.N = []; this.U = []; this.C = []; this.W = []; this.I = [];
    this.n = 0; this.e = null; this.r = this.g = this.b = 1; this.w = 0; this.useWind = false;
  }
  col(hex, k = 1) { const c = lin(hex); this.r = c[0] * k; this.g = c[1] * k; this.b = c[2] * k; return this; }
  rgb(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  xf(m) { this.e = m ? m.elements : null; return this; }
  v(x, y, z, nx, ny, nz, u, v) {
    const e = this.e;
    if (e) {
      const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
      const NX = e[0] * nx + e[4] * ny + e[8] * nz, NY = e[1] * nx + e[5] * ny + e[9] * nz, NZ = e[2] * nx + e[6] * ny + e[10] * nz, l = Math.hypot(NX, NY, NZ) || 1;
      this.P.push(X, Y, Z); this.N.push(NX / l, NY / l, NZ / l);
    } else { this.P.push(x, y, z); this.N.push(nx, ny, nz); }
    this.U.push(u, v); this.C.push(this.r, this.g, this.b); this.W.push(this.w);
    return this.n++;
  }
  // skip 位掩码：1 +x, 2 -x, 4 +y, 8 -y, 16 +z, 32 -z
  box(x0, y0, z0, x1, y1, z1, s = 0.5, skip = 0) {
    const q = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, u0, v0, u1, v1) => {
      const a = this.v(ax, ay, az, nx, ny, nz, u0, v0), b = this.v(bx, by, bz, nx, ny, nz, u1, v0), c = this.v(cx, cy, cz, nx, ny, nz, u1, v1), d = this.v(dx, dy, dz, nx, ny, nz, u0, v1);
      this.I.push(a, b, c, a, c, d);
    };
    if (!(skip & 1)) q(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0, z1 * s, y0 * s, z0 * s, y1 * s);
    if (!(skip & 2)) q(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0, z0 * s, y0 * s, z1 * s, y1 * s);
    if (!(skip & 4)) q(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0, x0 * s, z1 * s, x1 * s, z0 * s);
    if (!(skip & 8)) q(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0, x0 * s, z0 * s, x1 * s, z1 * s);
    if (!(skip & 16)) q(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1, x0 * s, y0 * s, x1 * s, y1 * s);
    if (!(skip & 32)) q(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1, x1 * s, y0 * s, x0 * s, y1 * s);
    return this;
  }
  // 竖直圆台
  cyl(cx, y0, cz, r0, r1, h, seg = 10, s = 0.5, capT = 1, capB = 0) {
    const base = this.n, sl = (r0 - r1) / h, nl = 1 / Math.hypot(1, sl), cu = Math.max(1, Math.round(Math.PI * (r0 + r1) * s));
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU, c = Math.cos(a), sn = Math.sin(a);
      this.v(cx + c * r0, y0, cz + sn * r0, c * nl, sl * nl, sn * nl, (i / seg) * cu, y0 * s);
      this.v(cx + c * r1, y0 + h, cz + sn * r1, c * nl, sl * nl, sn * nl, (i / seg) * cu, (y0 + h) * s);
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; this.I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    if (capT && r1 > 0) this.disc(cx, y0 + h, cz, r1, seg, s);
    if (capB && r0 > 0) this.disc(cx, y0, cz, r0, seg, s, true);
    return this;
  }
  // 水平圆盘；s<0 时 UV 铺满 0..1（贴花）
  disc(cx, y, cz, r, seg = 12, s = 0.5, down = false) {
    const ny = down ? -1 : 1, uv = (x, z) => (s < 0 ? [0.5 + x / (2 * r), 0.5 + z / (2 * r)] : [(cx + x) * s, (cz + z) * s]);
    let t = uv(0, 0);
    const c = this.v(cx, y, cz, 0, ny, 0, t[0], t[1]), base = this.n;
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r; t = uv(x, z); this.v(cx + x, y, cz + z, 0, ny, 0, t[0], t[1]); }
    for (let i = 0; i < seg; i++) { if (down) this.I.push(c, base + i, base + i + 1); else this.I.push(c, base + i + 1, base + i); }
    return this;
  }
  sphere(cx, cy, cz, rx, ry = rx, rz = rx, seg = 10, rings = 6, s = 0.5) {
    const base = this.n, cu = Math.max(1, Math.round(Math.PI * (rx + rz) * s)), cv = Math.max(1, Math.round(Math.PI * ry * s));
    for (let j = 0; j <= rings; j++) {
      const ph = (j / rings) * Math.PI, sy = Math.cos(ph), sr = Math.sin(ph);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * TAU, x = Math.cos(a) * sr, z = Math.sin(a) * sr;
        let nx = x / rx, ny = sy / ry, nz = z / rz;
        const l = Math.hypot(nx, ny, nz) || 1;
        this.v(cx + x * rx, cy + sy * ry, cz + z * rz, nx / l, ny / l, nz / l, (i / seg) * cu, (1 - j / rings) * cv);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = base + j * (seg + 1) + i, b = a + seg + 1; this.I.push(b, a, a + 1, b, a + 1, b + 1); }
    return this;
  }
  // 旋转体：prof = [[r, y], ...] 自下而上；ez 为 z 向压扁系数
  lathe(cx, cy, cz, prof, seg = 12, s = 0.5, ez = 1) {
    const base = this.n, n = prof.length;
    let len = 0;
    for (let k = 0; k < n; k++) {
      const p = prof[k], a = prof[Math.max(0, k - 1)], b = prof[Math.min(n - 1, k + 1)];
      let tr = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tr, ty) || 1; tr /= tl; ty /= tl;
      if (k > 0) len += Math.hypot(p[0] - prof[k - 1][0], p[1] - prof[k - 1][1]);
      const cu = Math.max(1, Math.round(TAU * Math.max(p[0], 0.2) * s));
      for (let i = 0; i <= seg; i++) {
        const an = (i / seg) * TAU, c = Math.cos(an), sn = Math.sin(an);
        this.v(cx + c * p[0], cy + p[1], cz + sn * p[0] * ez, c * ty, -tr, sn * ty, (i / seg) * cu, len * s);
      }
    }
    for (let k = 0; k < n - 1; k++) for (let i = 0; i < seg; i++) { const a = base + k * (seg + 1) + i, b = a + seg + 1; this.I.push(a, b, b + 1, a, b + 1, a + 1); }
    return this;
  }
  // 两点之间的方木
  beam(ax, ay, az, bx, by, bz, w, h, s = 0.5) {
    let dx = bx - ax, dy = by - ay, dz = bz - az;
    const L = Math.hypot(dx, dy, dz) || 1e-6; dx /= L; dy /= L; dz /= L;
    let rx = -dz, rz = dx, ry = 0;
    const rl = Math.hypot(rx, rz);
    if (rl < 1e-4) { rx = 1; rz = 0; } else { rx /= rl; rz /= rl; }
    const ux = ry * dz - rz * dy, uy = rz * dx - rx * dz, uz = rx * dy - ry * dx;
    _m.set(rx, ux, -dx, ax, ry, uy, -dy, ay, rz, uz, -dz, az, 0, 0, 0, 1);
    const prev = this.e;
    if (prev) { _m2.fromArray(prev).multiply(_m); this.e = _m2.elements.slice(); } else this.e = _m.elements.slice();
    this.box(-w / 2, -h / 2, -L, w / 2, h / 2, 0, s);
    this.e = prev;
    return this;
  }
  // 沿折线的圆管：pts = [[x, y, z, r], ...]；uv = [u0, v0, u1, v1] 时映射到图集格内
  tube(pts, seg = 8, uv = null, s = 0.5) {
    const base = this.n, n = pts.length;
    let bx = 0, by = 0, bz = 0, len = 0, tot = 0;
    for (let k = 1; k < n; k++) tot += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]);
    for (let k = 0; k < n; k++) {
      const p = pts[k], a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      if (k === 0) { if (Math.abs(ty) < 0.9) { bx = -tz; by = 0; bz = tx; } else { bx = 1; by = 0; bz = 0; } }
      const d = bx * tx + by * ty + bz * tz;
      bx -= tx * d; by -= ty * d; bz -= tz * d;
      const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
      const cx = by * tz - bz * ty, cy = bz * tx - bx * tz, cz = bx * ty - by * tx;
      if (k > 0) len += Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1], p[2] - pts[k - 1][2]);
      for (let i = 0; i <= seg; i++) {
        const an = (i / seg) * TAU, c = Math.cos(an), sn = Math.sin(an);
        const nx = bx * c + cx * sn, ny = by * c + cy * sn, nz = bz * c + cz * sn;
        let u, v;
        if (uv) { const f = i / seg; u = uv[0] + (uv[2] - uv[0]) * (f < 0.5 ? f * 2 : 2 - f * 2); v = uv[3] + (uv[1] - uv[3]) * (tot > 0 ? len / tot : 0); }
        else { u = (i / seg) * Math.max(1, Math.round(TAU * p[3] * s)); v = len * s; }
        this.v(p[0] + nx * p[3], p[1] + ny * p[3], p[2] + nz * p[3], nx, ny, nz, u, v);
      }
    }
    for (let k = 0; k < n - 1; k++) for (let i = 0; i < seg; i++) { const a = base + k * (seg + 1) + i, b = a + seg + 1; this.I.push(a, b, b + 1, a, b + 1, a + 1); }
    return this;
  }
  // 参数曲面：fn(u, v, o) 写入 o = [x, y, z, tu, tv, 亮度]；法线为 ∂u × ∂v（flip 取反）
  surf(nu, nv, fn, flip = false, wrapU = false) {
    const n1 = nu + 1, m1 = nv + 1, P = new Float32Array(n1 * m1 * 3), T = new Float32Array(n1 * m1 * 3), o = [0, 0, 0, 0, 0, 1];
    for (let j = 0; j < m1; j++) for (let i = 0; i < n1; i++) {
      o[5] = 1; fn(i / nu, j / nv, o);
      const k = (j * n1 + i) * 3;
      P[k] = o[0]; P[k + 1] = o[1]; P[k + 2] = o[2]; T[k] = o[3]; T[k + 1] = o[4]; T[k + 2] = o[5];
    }
    const base = this.n, r0 = this.r, g0 = this.g, b0 = this.b, sg = flip ? -1 : 1;
    for (let j = 0; j < m1; j++) for (let i = 0; i < n1; i++) {
      let ia = i - 1, ib = i + 1;
      if (wrapU) { if (ia < 0) ia = nu - 1; if (ib > nu) ib = 1; } else { if (ia < 0) ia = 0; if (ib > nu) ib = nu; }
      const a = (j * n1 + ia) * 3, b = (j * n1 + ib) * 3, c = (Math.max(0, j - 1) * n1 + i) * 3, d = (Math.min(nv, j + 1) * n1 + i) * 3, k = (j * n1 + i) * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[d] - P[c], vy = P[d + 1] - P[c + 1], vz = P[d + 2] - P[c + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) { nx = 0; ny = sg; nz = 0; } else { nx *= sg / l; ny *= sg / l; nz *= sg / l; }
      this.r = r0 * T[k + 2]; this.g = g0 * T[k + 2]; this.b = b0 * T[k + 2];
      this.v(P[k], P[k + 1], P[k + 2], nx, ny, nz, T[k], T[k + 1]);
    }
    this.r = r0; this.g = g0; this.b = b0;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * n1 + i, b = a + 1, c = a + n1 + 1, d = a + n1;
      if (flip) this.I.push(a, c, b, a, d, c); else this.I.push(a, b, c, a, c, d);
    }
    return this;
  }
  // 面片：中心 c，半宽向量 h，半高向量 v；UV 底边 vb、顶边 vt；统一法线 n；风力底 w0 顶 w1
  card(cx, cy, cz, hx, hy, hz, vx, vy, vz, u0, vb, u1, vt, nx, ny, nz, w0 = 0, w1 = 0) {
    const w = this.w;
    this.w = w0;
    const a = this.v(cx - hx - vx, cy - hy - vy, cz - hz - vz, nx, ny, nz, u0, vb), b = this.v(cx + hx - vx, cy + hy - vy, cz + hz - vz, nx, ny, nz, u1, vb);
    this.w = w1;
    const c = this.v(cx + hx + vx, cy + hy + vy, cz + hz + vz, nx, ny, nz, u1, vt), d = this.v(cx - hx + vx, cy - hy + vy, cz - hz + vz, nx, ny, nz, u0, vt);
    this.w = w;
    if (w0 || w1) this.useWind = true;
    this.I.push(a, b, c, a, c, d);
    return this;
  }
  merge(o, m) {
    const e = m ? m.elements : null, base = this.n;
    for (let i = 0; i < o.n; i++) {
      const x = o.P[i * 3], y = o.P[i * 3 + 1], z = o.P[i * 3 + 2], nx = o.N[i * 3], ny = o.N[i * 3 + 1], nz = o.N[i * 3 + 2];
      if (e) {
        const NX = e[0] * nx + e[4] * ny + e[8] * nz, NY = e[1] * nx + e[5] * ny + e[9] * nz, NZ = e[2] * nx + e[6] * ny + e[10] * nz, l = Math.hypot(NX, NY, NZ) || 1;
        this.P.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        this.N.push(NX / l, NY / l, NZ / l);
      } else { this.P.push(x, y, z); this.N.push(nx, ny, nz); }
      this.U.push(o.U[i * 2], o.U[i * 2 + 1]); this.C.push(o.C[i * 3], o.C[i * 3 + 1], o.C[i * 3 + 2]); this.W.push(o.W[i]);
    }
    for (let i = 0; i < o.I.length; i++) this.I.push(o.I[i] + base);
    this.n += o.n;
    if (o.useWind) this.useWind = true;
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    if (this.useWind) g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.W, 1));
    g.setIndex(this.I);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
