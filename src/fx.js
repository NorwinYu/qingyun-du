// 特效：符文法阵、光柱、岩浆、剑光拖尾、飘带、残影、天雷、预警圈、护体金光
import * as THREE from 'three';
import { GB } from './geo.js';

const TAU = Math.PI * 2;
const NOISE = `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

// ---- 贴图
function canvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d')]; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const TRIGRAMS = [7, 3, 5, 1, 6, 2, 4, 0]; // 八卦：三爻（1 阳 0 阴）
const RUNES = '天地玄黄宇宙洪荒日月盈昃辰宿列张寒来暑往秋收冬藏';
const cacheT = {};
// kind: 'portal' 传送阵 | 'bagua' 打坐八卦 | 'seal' 封印
export function runeTexture(kind = 'portal') {
  if (cacheT[kind]) return cacheT[kind];
  const N = 512, [cv, c] = canvas(N), C = N / 2;
  c.translate(C, C); c.strokeStyle = c.fillStyle = '#fff'; c.lineCap = 'round';
  const ring = (r, w, a = 1) => { c.globalAlpha = a; c.lineWidth = w; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.globalAlpha = 1; };
  ring(248, 6); ring(236, 2, 0.7); ring(168, 4); ring(156, 1.5, 0.6); ring(70, 3);
  c.font = 'bold 30px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const n = kind === 'bagua' ? 8 : 24;
  for (let i = 0; i < 24; i++) {
    c.save(); c.rotate((i / 24) * TAU); c.translate(0, -202);
    c.globalAlpha = 0.85; c.fillText(RUNES[(i * 7 + (kind === 'seal' ? 3 : 0)) % RUNES.length], 0, 0);
    c.restore();
  }
  for (let i = 0; i < n; i++) {
    c.save(); c.rotate((i / n) * TAU);
    if (kind === 'bagua') {
      const t = TRIGRAMS[i];
      for (let k = 0; k < 3; k++) {
        const y = -110 - k * 15; c.lineWidth = 8;
        if ((t >> k) & 1) { c.beginPath(); c.moveTo(-30, y); c.lineTo(30, y); c.stroke(); }
        else { c.beginPath(); c.moveTo(-30, y); c.lineTo(-7, y); c.moveTo(7, y); c.lineTo(30, y); c.stroke(); }
      }
    } else {
      c.lineWidth = 2.5; c.globalAlpha = 0.8;
      c.beginPath(); c.moveTo(0, -150); c.lineTo(0, -80); c.stroke();
      c.beginPath(); c.arc(0, -118, 7, 0, TAU); c.stroke();
    }
    c.restore();
  }
  // 内芯：双方形星 / 太极
  c.lineWidth = 3; c.globalAlpha = 0.9;
  for (const r0 of [0, Math.PI / 4]) { c.save(); c.rotate(r0); c.strokeRect(-110, -110, 220, 220); c.restore(); }
  if (kind === 'bagua') {
    c.globalAlpha = 0.9; c.beginPath(); c.arc(0, 0, 56, -Math.PI / 2, Math.PI / 2); c.arc(0, 28, 28, Math.PI / 2, -Math.PI / 2, true); c.arc(0, -28, 28, Math.PI / 2, -Math.PI / 2); c.fill();
    c.beginPath(); c.arc(0, 0, 56, 0, TAU); c.stroke();
  } else {
    for (let i = 0; i < 6; i++) { c.save(); c.rotate((i / 6) * TAU); c.beginPath(); c.moveTo(0, -66); c.quadraticCurveTo(26, -30, 0, 0); c.stroke(); c.restore(); }
  }
  return (cacheT[kind] = tex(cv));
}
// 竖直渐隐（光柱）
export function beamTexture() {
  if (cacheT.beam) return cacheT.beam;
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128;
  const c = cv.getContext('2d'), g = c.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 4, 128);
  return (cacheT.beam = tex(cv));
}

// ---- 材质
export function addMat(color, map, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
}
export function runeDisc(r, color, kind = 'portal') {
  const g = new THREE.CircleGeometry(r, 48); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, addMat(color, runeTexture(kind), 0.9));
  m.renderOrder = 8;
  return m;
}
export function lightBeam(r, h, color, opacity = 0.5) {
  const g = new THREE.CylinderGeometry(r, r * 1.05, h, 24, 1, true); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, addMat(color, beamTexture(), opacity));
  m.renderOrder = 9;
  return m;
}
// 岩浆：流动噪声，高亮供泛光
export function lavaMaterial(shared) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: `varying vec3 vW;
#include <fog_pars_vertex>
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime; varying vec3 vW;
#include <fog_pars_fragment>
${NOISE}
void main() {
  vec2 p = vW.xz; float t = uTime;
  vec2 w = vec2(vn(p * 0.09 + t * 0.03), vn(p * 0.09 - t * 0.025 + 7.0)) * 3.0;
  float n = vn(p * 0.21 + w + t * 0.04) * 0.55 + vn(p * 0.7 - w * 0.5 - t * 0.1) * 0.3 + vn(p * 2.3 + t * 0.25) * 0.15;
  float crust = smoothstep(0.5, 0.66, n);
  vec3 hot = mix(vec3(1.9, 0.42, 0.06), vec3(3.2, 1.6, 0.35), pow(1.0 - n, 3.0));
  vec3 col = mix(hot, vec3(0.09, 0.035, 0.02), crust * 0.92);
  col += vec3(1.2, 0.35, 0.05) * smoothstep(0.03, 0.0, abs(n - 0.52)) * 0.9;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`,
    fog: true,
  });
  m.uniforms.uTime = shared.uTime; m.uniforms.uFogSun = shared.uFogSun; m.uniforms.uFogSunDir = shared.uFogSunDir;
  return m;
}

// ---- 飘带：Verlet 链 + 平面条带
export class Ribbon {
  // o: { n, len, width, color, tip, mat }
  constructor(scene, o) {
    this.n = o.n || 9; this.seg = (o.len || 1) / (this.n - 1); this.width = o.width || 0.08; this.taper = o.taper ?? 0.4;
    this.p = new Float32Array(this.n * 3); this.q = new Float32Array(this.n * 3); this.init = false;
    const nv = this.n * 2, g = new THREE.BufferGeometry();
    this.pos = new Float32Array(nv * 3); this.nor = new Float32Array(nv * 3);
    const col = new Float32Array(nv * 3), a = new THREE.Color(o.color), b = new THREE.Color(o.tip ?? o.color), idx = [];
    for (let i = 0; i < this.n; i++) {
      const t = i / (this.n - 1), c = a.clone().lerp(b, t);
      for (let s = 0; s < 2; s++) { col[(i * 2 + s) * 3] = c.r; col[(i * 2 + s) * 3 + 1] = c.g; col[(i * 2 + s) * 3 + 2] = c.b; }
      if (i < this.n - 1) { const k = i * 2; idx.push(k, k + 1, k + 3, k, k + 3, k + 2); }
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, o.mat);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    scene.add(this.mesh);
  }
  reset() { this.init = false; }
  // a: 锚点；s: 条带横向；body: {x,y,z,r} 躯干圆柱；wind: [x,y,z] 加速度
  update(dt, ax, ay, az, sx, sy, sz, body, wind, grav = 9) {
    const { n, p, q, seg } = this;
    if (!this.init) { for (let i = 0; i < n; i++) { p[i * 3] = q[i * 3] = ax; p[i * 3 + 1] = q[i * 3 + 1] = ay - i * seg; p[i * 3 + 2] = q[i * 3 + 2] = az; } this.init = true; }
    const h = Math.min(dt, 1 / 30), damp = Math.exp(-h * 2.2), h2 = h * h;
    for (let i = 1; i < n; i++) {
      const k = i * 3, wk = 0.5 + i / n;
      for (let c = 0; c < 3; c++) {
        const v = (p[k + c] - q[k + c]) * damp;
        q[k + c] = p[k + c];
        p[k + c] += v + (wind[c] * wk + (c === 1 ? -grav : 0)) * h2;
      }
    }
    p[0] = ax; p[1] = ay; p[2] = az;
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < n; i++) {
        const a = (i - 1) * 3, k = i * 3;
        let dx = p[k] - p[a], dy = p[k + 1] - p[a + 1], dz = p[k + 2] - p[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6, f = (d - seg) / d;
        if (i === 1) { p[k] -= dx * f; p[k + 1] -= dy * f; p[k + 2] -= dz * f; }
        else { p[a] += dx * f * 0.5; p[a + 1] += dy * f * 0.5; p[a + 2] += dz * f * 0.5; p[k] -= dx * f * 0.5; p[k + 1] -= dy * f * 0.5; p[k + 2] -= dz * f * 0.5; }
        if (body && p[k + 1] > body.y && p[k + 1] < body.y + body.h) {
          const bx = p[k] - body.x, bz = p[k + 2] - body.z, bd = Math.hypot(bx, bz);
          if (bd < body.r && bd > 1e-4) { p[k] = body.x + (bx / bd) * body.r; p[k + 2] = body.z + (bz / bd) * body.r; }
        }
      }
      p[0] = ax; p[1] = ay; p[2] = az;
    }
    const P = this.pos, N = this.nor;
    for (let i = 0; i < n; i++) {
      const k = i * 3, w = this.width * 0.5 * (1 - this.taper * (i / (n - 1)));
      const a = Math.max(0, i - 1) * 3, b = Math.min(n - 1, i + 1) * 3;
      const tx = p[b] - p[a], ty = p[b + 1] - p[a + 1], tz = p[b + 2] - p[a + 2];
      let nx = sy * tz - sz * ty, ny = sz * tx - sx * tz, nz = sx * ty - sy * tx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (let s = 0; s < 2; s++) {
        const sg = s ? 1 : -1, o = (i * 2 + s) * 3;
        P[o] = p[k] + sx * w * sg; P[o + 1] = p[k + 1] + sy * w * sg; P[o + 2] = p[k + 2] + sz * w * sg;
        N[o] = nx; N[o + 1] = ny; N[o + 2] = nz;
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }
}

// ---- 剑光拖尾：记录剑身两端，Catmull-Rom 细分成条带，按时长渐隐
export class Trail {
  constructor(scene, max = 24, life = 0.16) {
    this.max = max; this.life = life; this.S = []; this.color = new THREE.Color(0x9ff4ff);
    const nv = (max - 1) * 3 + 1, g = new THREE.BufferGeometry();
    this.nv = nv;
    this.pos = new Float32Array(nv * 2 * 3); this.col = new Float32Array(nv * 2 * 3);
    const idx = [];
    for (let i = 0; i < nv - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 3, k, k + 3, k + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setIndex(idx); g.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 12;
    scene.add(this.mesh);
  }
  setColor(hex) { this.color.set(hex); }
  push(a, b) { this.S.push({ a: a.clone(), b: b.clone(), t: 0 }); if (this.S.length > this.max) this.S.shift(); }
  update(dt) {
    const S = this.S;
    for (const s of S) s.t += dt;
    while (S.length && S[0].t > this.life) S.shift();
    const g = this.mesh.geometry;
    if (S.length < 2) { g.setDrawRange(0, 0); return; }
    const P = this.pos, C = this.col, cr = this.color.r, cg = this.color.g, cb = this.color.b;
    let v = 0;
    const cr4 = (p0, p1, p2, p3, t, out, o) => {
      const t2 = t * t, t3 = t2 * t;
      for (let c = 0; c < 3; c++) {
        const a0 = p0.getComponent(c), a1 = p1.getComponent(c), a2 = p2.getComponent(c), a3 = p3.getComponent(c);
        out[o + c] = 0.5 * (2 * a1 + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3);
      }
    };
    for (let i = 0; i < S.length - 1; i++) {
      const s0 = S[Math.max(0, i - 1)], s1 = S[i], s2 = S[i + 1], s3 = S[Math.min(S.length - 1, i + 2)];
      for (let k = 0; k < 3; k++) {
        const t = k / 3, age = s1.t + (s2.t - s1.t) * t, f = Math.max(0, 1 - age / this.life);
        cr4(s0.a, s1.a, s2.a, s3.a, t, P, v * 6); cr4(s0.b, s1.b, s2.b, s3.b, t, P, v * 6 + 3);
        const fa = f * f * 1.4, fb = f * 0.25;
        C[v * 6] = cr * fa; C[v * 6 + 1] = cg * fa; C[v * 6 + 2] = cb * fa; C[v * 6 + 3] = cr * fb; C[v * 6 + 4] = cg * fb; C[v * 6 + 5] = cb * fb;
        v++;
      }
    }
    const l = S[S.length - 1], f = Math.max(0, 1 - l.t / this.life);
    P.set([l.a.x, l.a.y, l.a.z, l.b.x, l.b.y, l.b.z], v * 6);
    C.set([cr * f * 1.4, cg * f * 1.4, cb * f * 1.4, cr * f * 0.25, cg * f * 0.25, cb * f * 0.25], v * 6); v++;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    g.setDrawRange(0, (v - 1) * 6);
  }
}

// ---- 残影：克隆模型（共享几何体），叠加发光后淡出；src 为普通模型组或带 ghost() 的蒙皮角色
export class Ghosts {
  constructor(scene) { this.scene = scene; this.list = []; }
  spawn(src, color = 0x7fe8ff, life = 0.4, op = 0.42) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    const g = src.ghost ? src.ghost(mat) : src.clone(true);
    g.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; } if (o.isSprite) o.visible = false; });
    g.matrixAutoUpdate = false; g.updateMatrix();
    this.scene.add(g);
    this.list.push({ g, mat, t: 0, life, op });
  }
  update(dt) {
    for (const o of this.list) { o.t += dt; o.mat.opacity = o.op * Math.max(0, 1 - o.t / o.life); }
    if (this.list.some((o) => o.t >= o.life)) this.list = this.list.filter((o) => { if (o.t < o.life) return true; this.scene.remove(o.g); o.mat.dispose(); o.g.traverse((m) => { if (m.isSkinnedMesh) m.skeleton.dispose(); }); return false; });
  }
}

// ---- 天雷：折线主干 + 分叉
function boltGeo(x0, y0, z0, x1, y1, z1, rnd, r = 0.14) {
  const g = new GB();
  g.col(0xd8e4ff, 4);
  const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.max(6, Math.round(L / 4)), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = i === 0 || i === n ? 0 : (1 - Math.abs(t * 2 - 1) * 0.4) * L * 0.045;
    pts.push([x0 + (x1 - x0) * t + (rnd() - 0.5) * j * 2, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t + (rnd() - 0.5) * j * 2, r * (1 - t * 0.3)]);
  }
  g.tube(pts, 4);
  for (let b = 0; b < 3; b++) {
    const k = 1 + Math.floor(rnd() * (n - 2)), p = pts[k], bl = L * (0.12 + rnd() * 0.15), a = rnd() * TAU, bp = [[p[0], p[1], p[2], r * 0.6]];
    for (let i = 1; i <= 4; i++) bp.push([p[0] + Math.cos(a) * bl * i / 4 + (rnd() - 0.5) * 2, p[1] - bl * i / 4 * 0.9, p[2] + Math.sin(a) * bl * i / 4 + (rnd() - 0.5) * 2, r * 0.6 * (1 - i / 5)]);
    g.tube(bp, 3);
  }
  return g.build();
}
export class Bolts {
  constructor(scene, glowMat) { this.scene = scene; this.mat = glowMat; this.list = []; }
  strike(x, y, z, o = {}) {
    let s = (Math.random() * 1e9) | 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const top = o.top ?? 140, m = new THREE.Mesh(boltGeo(x + (rnd() - 0.5) * 20, y + top, z + (rnd() - 0.5) * 20, x, y, z, rnd, o.r ?? 0.16), this.mat);
    m.frustumCulled = false; m.renderOrder = 11;
    this.scene.add(m);
    this.list.push({ m, t: 0, life: o.life ?? 0.32 });
  }
  update(dt) {
    for (const b of this.list) { b.t += dt; b.m.visible = b.t < 0.06 || (b.t > 0.1 && b.t < 0.16) || b.t > 0.2; }
    if (this.list.some((b) => b.t >= b.life)) this.list = this.list.filter((b) => { if (b.t < b.life) return true; this.scene.remove(b.m); b.m.geometry.dispose(); return false; });
  }
}

// ---- 地面预警圈：外环 + 随时间填充
const TELE_FRAG = `uniform vec3 uColor; uniform float uP, uA; varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  if (r > 1.0) discard;
  float ring = smoothstep(0.86, 0.94, r) * smoothstep(1.0, 0.96, r);
  float fill = step(r, uP) * (0.18 + 0.5 * smoothstep(uP - 0.12, uP, r));
  float a = (ring * 1.2 + fill) * uA;
  gl_FragColor = vec4(uColor * a, a);
}`;
export class Telegraphs {
  constructor(scene) { this.scene = scene; this.list = []; this.geo = new THREE.CircleGeometry(1, 40); this.geo.rotateX(-Math.PI / 2); }
  // 返回句柄；fire() 在 delay 秒后调用
  add(x, y, z, r, delay, color, fire, follow) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uP: { value: 0 }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: TELE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -4,
    });
    const m = new THREE.Mesh(this.geo, mat);
    m.position.set(x, y + 0.08, z); m.scale.setScalar(r); m.renderOrder = 7;
    this.scene.add(m);
    const h = { m, mat, t: 0, delay, fire, follow, r, x, y, z, done: false };
    this.list.push(h);
    return h;
  }
  update(dt) {
    for (const h of this.list) {
      h.t += dt;
      if (h.follow && h.t < h.delay - 0.6) { const p = h.follow(); h.x = p.x; h.y = p.y; h.z = p.z; h.m.position.set(p.x, p.y + 0.08, p.z); }
      h.mat.uniforms.uP.value = Math.min(1, h.t / h.delay);
      h.mat.uniforms.uA.value = 0.75 + 0.25 * Math.sin(h.t * 20);
      if (!h.done && h.t >= h.delay) { h.done = true; if (h.fire) h.fire(h); }
    }
    if (this.list.some((h) => h.done)) this.list = this.list.filter((h) => { if (!h.done) return true; this.scene.remove(h.m); h.mat.dispose(); return false; });
  }
  clear() { for (const h of this.list) { this.scene.remove(h.m); h.mat.dispose(); } this.list = []; }
}

// ---- 护体金光：菲涅尔球 + 流动符文
export function shieldMesh(color = 0xffc860) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uA: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime, uA; varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() {
  float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 2.4);
  float a = atan(vP.z, vP.x);
  float hex = smoothstep(0.92, 1.0, abs(sin(a * 9.0 + uTime * 1.5)) ) * smoothstep(0.9, 1.0, abs(sin(vP.y * 9.0 - uTime * 2.0)));
  float band = smoothstep(0.06, 0.0, abs(fract(vP.y * 1.2 - uTime * 0.6) - 0.5) - 0.42);
  float al = (f * 0.9 + hex * 0.5 + band * 0.25) * uA;
  gl_FragColor = vec4(uColor * al * 1.6, al);
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
  m.renderOrder = 13; m.frustumCulled = false; m.visible = false;
  return m;
}
