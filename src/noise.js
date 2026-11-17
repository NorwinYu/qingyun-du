// 确定性噪声与数学工具
export function hashi(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 362437)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
export const hash2 = (x, y, s = 0) => hashi(x, y, s) / 4294967296;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

const G = [1, 0, -1, 0, 0, 1, 0, -1, 0.7071, 0.7071, -0.7071, 0.7071, 0.7071, -0.7071, -0.7071, -0.7071];
function grad(ix, iy, s, dx, dy) {
  const h = (hashi(ix, iy, s) & 7) << 1;
  return G[h] * dx + G[h + 1] * dy;
}
export function perlin2(x, y, s = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = grad(x0, y0, s, fx, fy), b = grad(x0 + 1, y0, s, fx - 1, fy);
  const c = grad(x0, y0 + 1, s, fx, fy - 1), d = grad(x0 + 1, y0 + 1, s, fx - 1, fy - 1);
  return (a + (b - a) * u + (c + (d - c) * u - (a + (b - a) * u)) * v) * 1.5;
}
export function fbm(x, y, oct, s = 0) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += perlin2(x, y, s + i * 17) * amp;
    norm += amp;
    amp *= 0.5; x *= 2.03; y *= 2.03;
  }
  return sum / norm;
}
export function ridged(x, y, oct, s = 0) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(perlin2(x, y, s + i * 17));
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5; x *= 2.07; y *= 2.07;
  }
  return sum / norm;
}
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
