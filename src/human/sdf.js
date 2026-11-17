// 有符号距离场造型 + Surface Nets 网格化（窄带细化），用于角色头部、手、衣物、发髻
const sq = (x) => x * x;
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
// 平滑并集 / 差集 / 交集（多项式 smin）
export function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = clamp01(0.5 + (0.5 * (b - a)) / k); return b + (a - b) * h - k * h * (1 - h); }
export function smax(a, b, k) { return -smin(-a, -b, k); }
// 近似椭球距离（IQ 的 bound 版本）
export function ellipsoid(x, y, z, rx, ry, rz) {
  const k0 = Math.sqrt(sq(x / rx) + sq(y / ry) + sq(z / rz));
  const k1 = Math.sqrt(sq(x / (rx * rx)) + sq(y / (ry * ry)) + sq(z / (rz * rz)));
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
// 两端半径不同的圆锥胶囊
export function capsule(x, y, z, ax, ay, az, bx, by, bz, ra, rb = ra) {
  const px = x - ax, py = y - ay, pz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const L2 = bax * bax + bay * bay + baz * baz;
  const h = L2 > 0 ? clamp01((px * bax + py * bay + pz * baz) / L2) : 0;
  return Math.hypot(px - bax * h, py - bay * h, pz - baz * h) - (ra + (rb - ra) * h);
}
export function roundBox(x, y, z, hx, hy, hz, r) {
  const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r, qz = Math.abs(z) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
// 竖直方向的超椭圆柱截面，用于衣身：在高度 y 处半宽 w、半深 d，指数 n
export function superEllipse(x, z, w, d, n = 2.6) {
  const ax = Math.abs(x) / w, az = Math.abs(z) / d;
  // n=2.5 是衣身常用值，避免三次 pow
  const r = n === 2.5 ? Math.pow(ax * ax * Math.sqrt(ax) + az * az * Math.sqrt(az), 0.4) : Math.pow(Math.pow(ax, n) + Math.pow(az, n), 1 / n);
  return (r - 1) * Math.min(w, d);
}

// sdf(x,y,z) -> 距离；bounds [x0,y0,z0,x1,y1,z1]；h 为体素边长
export function surfaceNets(sdf, bounds, h, opts = {}) {
  const [x0, y0, z0, x1, y1, z1] = bounds;
  const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
  const N = nx * ny * nz, F = new Float32Array(N);
  const idx = (i, j, k) => i + nx * (j + ny * k);
  // 粗网格先采样，再只对表面附近的细网格点精确求值
  const S = 4, cx = Math.ceil((nx - 1) / S) + 1, cy = Math.ceil((ny - 1) / S) + 1, cz = Math.ceil((nz - 1) / S) + 1;
  const C = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) C[i + cx * (j + cy * k)] = sdf(x0 + i * S * h, y0 + j * S * h, z0 + k * S * h);
  const band = S * h * 1.9;
  for (let k = 0; k < nz; k++) {
    const kc = Math.min(cz - 2, Math.floor(k / S)), fz = k / S - kc;
    for (let j = 0; j < ny; j++) {
      const jc = Math.min(cy - 2, Math.floor(j / S)), fy = j / S - jc;
      for (let i = 0; i < nx; i++) {
        const ic = Math.min(cx - 2, Math.floor(i / S)), fx = i / S - ic;
        const c00 = C[ic + cx * (jc + cy * kc)], c10 = C[ic + 1 + cx * (jc + cy * kc)], c01 = C[ic + cx * (jc + 1 + cy * kc)], c11 = C[ic + 1 + cx * (jc + 1 + cy * kc)];
        const d00 = C[ic + cx * (jc + cy * (kc + 1))], d10 = C[ic + 1 + cx * (jc + cy * (kc + 1))], d01 = C[ic + cx * (jc + 1 + cy * (kc + 1))], d11 = C[ic + 1 + cx * (jc + 1 + cy * (kc + 1))];
        const a = (c00 + (c10 - c00) * fx) + ((c01 + (c11 - c01) * fx) - (c00 + (c10 - c00) * fx)) * fy;
        const b = (d00 + (d10 - d00) * fx) + ((d01 + (d11 - d01) * fx) - (d00 + (d10 - d00) * fx)) * fy;
        const v = a + (b - a) * fz;
        F[idx(i, j, k)] = Math.abs(v) < band ? sdf(x0 + i * h, y0 + j * h, z0 + k * h) : v;
      }
    }
  }
  // 每个跨越表面的体素放一个顶点（边交点平均）
  const VI = new Int32Array(N).fill(-1), P = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const corner = new Float32Array(8), cp = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const v = F[idx(i + cp[c][0], j + cp[c][1], k + cp[c][2])]; corner[c] = v; if (v < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      const va = corner[a], vb = corner[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += cp[a][0] + (cp[b][0] - cp[a][0]) * t; sy += cp[a][1] + (cp[b][1] - cp[a][1]) * t; sz += cp[a][2] + (cp[b][2] - cp[a][2]) * t; n++;
    }
    VI[idx(i, j, k)] = P.length / 3;
    P.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
  }
  // 每条跨越表面的网格边生成一个四边形
  const I = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, d, c, a, c, b); else I.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = F[idx(i, j, k)], in0 = v0 < 0;
    if (in0 !== (F[idx(i + 1, j, k)] < 0)) quad(VI[idx(i, j - 1, k - 1)], VI[idx(i, j, k - 1)], VI[idx(i, j, k)], VI[idx(i, j - 1, k)], !in0);
    if (in0 !== (F[idx(i, j + 1, k)] < 0)) quad(VI[idx(i - 1, j, k - 1)], VI[idx(i - 1, j, k)], VI[idx(i, j, k)], VI[idx(i, j, k - 1)], !in0);
    if (in0 !== (F[idx(i, j, k + 1)] < 0)) quad(VI[idx(i - 1, j - 1, k)], VI[idx(i, j - 1, k)], VI[idx(i, j, k)], VI[idx(i - 1, j, k)], !in0);
  }
  // 投影回表面并求法线
  const nV = P.length / 3, Nn = new Float32Array(nV * 3), Pp = new Float32Array(P), e = h * 0.5;
  for (let v = 0; v < nV; v++) {
    let x = Pp[v * 3], y = Pp[v * 3 + 1], z = Pp[v * 3 + 2];
    // 单步投影，法线沿用投影前的梯度（偏差不足半个体素）
    const d = sdf(x, y, z), gx = sdf(x + e, y, z) - d, gy = sdf(x, y + e, z) - d, gz = sdf(x, y, z + e) - d, gl = Math.hypot(gx, gy, gz) || 1;
    const step = Math.max(-h * 0.5, Math.min(h * 0.5, d));
    x -= (gx / gl) * step; y -= (gy / gl) * step; z -= (gz / gl) * step;
    Pp[v * 3] = x; Pp[v * 3 + 1] = y; Pp[v * 3 + 2] = z;
    Nn[v * 3] = gx / gl; Nn[v * 3 + 1] = gy / gl; Nn[v * 3 + 2] = gz / gl;
  }
  // 按 SDF 梯度统一三角形朝向
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = Pp[b] - Pp[a], uy = Pp[b + 1] - Pp[a + 1], uz = Pp[b + 2] - Pp[a + 2], vx = Pp[c] - Pp[a], vy = Pp[c + 1] - Pp[a + 1], vz = Pp[c + 2] - Pp[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * (Nn[a] + Nn[b] + Nn[c]) + fy * (Nn[a + 1] + Nn[b + 1] + Nn[c + 1]) + fz * (Nn[a + 2] + Nn[b + 2] + Nn[c + 2]) < 0) { const s = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = s; }
  }
  return { P: Pp, N: Nn, I };
}
