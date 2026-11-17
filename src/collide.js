// 碰撞体：轴对齐盒（可带斜面）与竖直圆柱，按 8 米网格索引
const CELL = 8;
const key = (i, j) => (i + 4096) * 8192 + (j + 4096);
export class Colliders {
  constructor() { this.cells = new Map(); }
  // c: { x0,y0,z0,x1,y1,z1, ramp?: { ax: 'x'|'z', ya, yb } } 或 { cyl: 1, x, z, r, y0, y1 }
  add(c) {
    if (c.cyl) { c.x0 = c.x - c.r; c.x1 = c.x + c.r; c.z0 = c.z - c.r; c.z1 = c.z + c.r; }
    const i0 = Math.floor(c.x0 / CELL), i1 = Math.floor(c.x1 / CELL), j0 = Math.floor(c.z0 / CELL), j1 = Math.floor(c.z1 / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = key(i, j); let a = this.cells.get(k); if (!a) this.cells.set(k, (a = [])); a.push(c); }
    return c;
  }
  remove(list) {
    for (const c of list) {
      const i0 = Math.floor(c.x0 / CELL), i1 = Math.floor(c.x1 / CELL), j0 = Math.floor(c.z0 / CELL), j1 = Math.floor(c.z1 / CELL);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = key(i, j), a = this.cells.get(k); if (!a) continue; const n = a.indexOf(c); if (n >= 0) a.splice(n, 1); if (!a.length) this.cells.delete(k); }
    }
  }
  static top(c, x, z) {
    if (!c.ramp) return c.y1;
    const t = c.ramp.ax === 'x' ? (x - c.x0) / (c.x1 - c.x0) : (z - c.z0) / (c.z1 - c.z0);
    return c.ramp.ya + (c.ramp.yb - c.ramp.ya) * (t < 0 ? 0 : t > 1 ? 1 : t);
  }
  static over(c, x, z, hw) {
    if (c.cyl) { const dx = x - c.x, dz = z - c.z, r = c.r + hw; return dx * dx + dz * dz < r * r; }
    return x + hw > c.x0 && x - hw < c.x1 && z + hw > c.z0 && z - hw < c.z1;
  }
  // 脚印范围内不高于 yMax 的最高顶面
  topAt(x, z, hw, yMax, skipThin) {
    let best = -Infinity;
    const i0 = Math.floor((x - hw) / CELL), i1 = Math.floor((x + hw) / CELL), j0 = Math.floor((z - hw) / CELL), j1 = Math.floor((z + hw) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const a = this.cells.get(key(i, j));
      if (!a) continue;
      for (let n = 0; n < a.length; n++) { const c = a[n]; if ((skipThin && c.thin) || !Colliders.over(c, x, z, hw)) continue; const t = Colliders.top(c, x, z); if (t <= yMax && t > best) best = t; }
    }
    return best;
  }
  // 身体盒 [y, y+hh] 是否与碰撞体相交
  hit(x, y, z, hw, hh, skipThin) {
    const i0 = Math.floor((x - hw) / CELL), i1 = Math.floor((x + hw) / CELL), j0 = Math.floor((z - hw) / CELL), j1 = Math.floor((z + hw) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const a = this.cells.get(key(i, j));
      if (!a) continue;
      for (let n = 0; n < a.length; n++) { const c = a[n]; if (skipThin && c.thin) continue; if (c.y0 < y + hh && Colliders.over(c, x, z, hw) && Colliders.top(c, x, z) > y) return true; }
    }
    return false;
  }
  point(x, y, z) { return this.hit(x, y, z, 0, 0.001); }
}
