// 人物材质：按 aPart 分区着色。面部妆容、眉、唇、眼线、虹膜都在着色器里依据静止姿态坐标绘制，
// 颜色为每个角色独立的 uniform，造型几何体与着色程序在角色之间共享。
import * as THREE from 'three';

const DECL = `
uniform vec3 uSkin; uniform vec3 uRobe; uniform vec3 uTrim; uniform vec3 uSash; uniform vec3 uInner; uniform vec3 uPants; uniform vec3 uBoot;
uniform vec3 uHair; uniform vec3 uIris; uniform vec3 uLip; uniform vec3 uGold; uniform vec3 uJade;
uniform vec3 uHC; uniform float uHS; uniform vec3 uEye; uniform float uFem; uniform float uOld; uniform float uFlash; uniform float uTrimW; uniform float uStubble; uniform float uGlowEye;
varying vec3 vRest; varying float vPart; varying vec4 vCloth; varying vec2 vUv2;
float hh1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn1(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh1(i), hh1(i + vec2(1.0, 0.0)), f.x), mix(hh1(i + vec2(0.0, 1.0)), hh1(i + 1.0), f.x), f.y); }
float tRough = 0.8; float tMetal = 0.0; vec3 tEmi = vec3(0.0);
`;

const FRAG = `{
  int part = int(vPart + 0.5);
  vec3 col = uSkin;
  vec3 q = (vRest - uHC) / uHS; float ax = abs(q.x);
  if (part == 0) {
    tRough = 0.52;
    if (q.y > -0.13 && q.y < 0.11) {
      float front = smoothstep(0.045, 0.075, q.z);
      float bl = exp(-(pow((ax - 0.046) / 0.022, 2.0) + pow((q.y + 0.014) / 0.02, 2.0))) * front;
      col = mix(col, col * vec3(1.04, 0.84, 0.8), bl * (0.2 + 0.2 * uFem));
      // 鼻尖与耳廓微红
      col = mix(col, col * vec3(1.04, 0.84, 0.8), exp(-(pow(q.x / 0.012, 2.0) + pow((q.y + 0.02) / 0.012, 2.0))) * front * 0.5);
      col = mix(col, col * vec3(1.05, 0.8, 0.76), smoothstep(0.066, 0.078, ax) * smoothstep(-0.03, 0.0, q.y) * 0.4);
      // 唇
      float dU = length(vec2(q.x / 0.0195, (q.y + 0.0445) / 0.0072)), dL = length(vec2(q.x / 0.0175, (q.y + 0.0568) / 0.0086));
      float lip = smoothstep(1.08, 0.78, min(dU, dL)) * smoothstep(0.078, 0.086, q.z);
      col = mix(col, uLip, lip * (0.35 + 0.3 * uFem));
      col *= 1.0 - 0.55 * smoothstep(0.0022, 0.0, abs(q.y + 0.0508)) * step(abs(q.x), 0.019) * smoothstep(0.085, 0.092, q.z);
      // 眉
      float bx = ax - 0.007, bt = clamp(bx / 0.044, 0.0, 1.0);
      float by = q.y - (0.0355 + mix(0.004, 0.007, uFem) * sin(bt * 2.8) - bt * mix(0.002, 0.004, uFem));
      float bw = mix(0.0062, 0.0034, uFem) * (1.0 - bt * 0.5);
      float brow = smoothstep(bw, bw * 0.45, abs(by)) * step(0.0, bx) * step(bx, 0.045) * smoothstep(0.06, 0.075, q.z);
      brow *= 0.9 + 0.1 * sin(bx * 1500.0 + by * 700.0);
      col = mix(col, mix(uHair, vec3(0.06), 0.4) * (1.0 - 0.3 * uOld), brow * (0.85 - 0.25 * uOld));
      // 眼线与眼窝
      vec2 e = vec2(ax - 0.031, q.y - 0.012);
      float er = length(e / vec2(0.0172, 0.0108));
      float liner = smoothstep(0.24, 0.02, abs(er - 0.98)) * smoothstep(-0.006, 0.002, e.y) * smoothstep(0.07, 0.08, q.z);
      liner = max(liner, smoothstep(0.004, 0.0, abs(e.y - 0.004 + e.x * 0.25)) * smoothstep(0.016, 0.026, ax - 0.031 + 0.012) * step(ax - 0.031, 0.024) * step(0.0, ax - 0.031 - 0.012) * uFem);
      col = mix(col, vec3(0.06, 0.04, 0.04), liner * (0.55 + 0.35 * uFem));
      col *= 1.0 - 0.14 * exp(-pow(er - 1.05, 2.0) * 5.0) * front;
      // 眼窝内侧（泪阜）
      col = mix(col, vec3(0.55, 0.28, 0.26), smoothstep(1.02, 0.85, er) * smoothstep(0.083, 0.075, q.z) * 0.8);
      col = mix(col, col * vec3(0.95, 0.82, 0.86), uFem * 0.35 * exp(-pow(er - 1.35, 2.0) * 3.0) * step(0.0, e.y) * front);
      // 胡茬
      float stub = uStubble * smoothstep(-0.03, -0.06, q.y) * front * smoothstep(0.02, 0.0, abs(q.y + 0.051) - 0.035) * (0.7 + 0.3 * hh1(floor(vRest.xy * 2500.0)));
      col = mix(col, col * vec3(0.72, 0.72, 0.76), stub * 0.5);
      // 老人皱纹
      col *= 1.0 - uOld * 0.08 * smoothstep(0.6, 1.0, sin(q.y * 900.0)) * smoothstep(0.045, 0.06, q.y) * front;
    }
    // 指甲
    if (vRest.y < 1.3 && q.y < -0.3) col = mix(col, col * vec3(1.05, 0.9, 0.9), 0.2);
    tEmi = col * col * 0.05;
  } else if (part == 6) {
    col = uSkin * 0.93; tRough = 0.5;
    col = mix(col, vec3(0.04, 0.03, 0.03), smoothstep(0.0024, 0.0008, vCloth.x));
  } else if (part == 5) {
    vec3 ec = vec3(sign(vRest.x) * uEye.x, uEye.y, uEye.z);
    vec3 d = normalize(vRest - ec);
    float ir = length(d.xy) / 0.56;
    col = vec3(0.84, 0.82, 0.8) * (1.0 - 0.3 * smoothstep(0.6, 1.0, length(d.xy)));
    if (d.z > 0.0 && ir < 1.0) {
      float an = atan(d.y, d.x);
      vec3 irc = uIris * (0.65 + 0.55 * vn1(vec2(an * 6.0, ir * 3.0))) * (1.15 - 0.5 * ir);
      irc = mix(irc, uIris * 0.35, smoothstep(0.78, 1.0, ir));
      col = mix(irc, vec3(0.015), smoothstep(0.44, 0.38, ir));
      tEmi = uIris * uGlowEye * smoothstep(1.0, 0.5, ir);
    }
    tRough = 0.06;
  } else if (part == 1) {
    col = uRobe;
    float wv = 0.965 + 0.035 * sin(vRest.x * 1300.0 + vRest.y * 400.0) * sin(vRest.y * 1300.0 - vRest.z * 300.0);
    float tw = uTrimW;
    if (vCloth.w < 0.0) col = uInner;
    if (vCloth.x < tw) {
      float tt = vCloth.x / tw;
      col = uTrim;
      float cloud = sin(vCloth.y * 160.0 + sin(vCloth.y * 47.0) * 2.0) * sin(tt * 6.2832);
      col = mix(col, mix(uTrim, uGold, 0.5) * 1.15, smoothstep(0.55, 0.85, cloud) * 0.7);
      col = mix(col, uGold, smoothstep(0.08, 0.0, abs(tt - 0.8)) * 0.8);
      tRough = 0.7;
    } else tRough = 0.92;
    if (vCloth.z < -1.5) { col = vec3(0.32, 0.33, 0.36); tMetal = 0.85; tRough = 0.38; float sc = sin(vRest.y * 260.0) * sin(vRest.x * 180.0); col *= 0.85 + 0.25 * step(0.0, sc); }
    else if (vCloth.z < 0.0) { col = uSash * (0.92 + 0.12 * smoothstep(0.2, 0.9, sin(vRest.y * 380.0))); tRough = 0.75; }
    col *= wv * (0.86 + 0.14 * smoothstep(0.1, 0.7, vRest.y));
  } else if (part == 2) { col = uPants * (0.97 + 0.03 * sin(vRest.y * 1500.0)); tRough = 0.95; }
  else if (part == 3) { col = uBoot; tRough = 0.62; if (vCloth.x < 0.012) col = mix(uTrim, uBoot, 0.4); }
  else if (part == 4) {
    float ang = atan(vRest.x - uHC.x, vRest.z - uHC.z);
#ifdef HAIRCARD
    float s = vn1(vec2(vUv2.x * 22.0, vUv2.y * 3.0)), tip = smoothstep(0.55, 1.0, vUv2.y);
    if (abs(vUv2.x - 0.5) * 2.0 > 1.0 - tip * (0.35 + 0.65 * s) - 0.05 * s) discard;
    col = uHair * (0.72 + 0.5 * s);
#else
    float s = vn1(vec2(ang * 40.0, vRest.y * 18.0)) * 0.6 + vn1(vec2(ang * 140.0, vRest.y * 50.0)) * 0.4;
    col = uHair * (0.7 + 0.55 * s);
#endif
    tRough = 0.42;
  }
  else if (part == 7) { col = uGold; tMetal = 1.0; tRough = 0.3; }
  else if (part == 8) { col = uJade; tRough = 0.14; tEmi = uJade * 0.06; }
  else if (part == 9) { col = uSash; tRough = 0.8; }
  else if (part == 10) { col = vec3(0.34, 0.35, 0.38); tMetal = 0.85; tRough = 0.35; }
  else if (part == 11) { float w = sin(atan(vRest.x - uHC.x, vRest.z - uHC.z) * 60.0) * sin(length(vRest.xz - uHC.xz) * 400.0); col = vec3(0.72, 0.6, 0.36) * (0.85 + 0.2 * step(0.0, w)); tRough = 1.0; }
  else if (part == 12) { col = vec3(0.05); tRough = 0.6; }
  else { col = vec3(0.36, 0.24, 0.14); tRough = 0.8; }
  diffuseColor.rgb = col;
  tEmi += vec3(uFlash);
}`;

export const HCOL = { skin: 0xf2d2b6, robe: 0xeef2f6, trim: 0x4a9ad8, sash: 0x2a5a8a, inner: 0xf4f0e8, pants: 0xdfe6ee, boots: 0x2a3848, hair: 0x15141a, iris: 0x3a2618, lip: 0xc0605a, gold: 0xd8b060, jade: 0x9fe0c8 };

export function makeHumanMaterial(shared, look, F, spec, hairCard = false) {
  const c = { ...HCOL, ...(look.col || {}) };
  const col = (h) => ({ value: new THREE.Color(h) });
  const u = {
    uSkin: col(c.skin), uRobe: col(c.robe), uTrim: col(c.trim), uSash: col(c.sash), uInner: col(c.inner), uPants: col(c.pants), uBoot: col(c.boots),
    uHair: col(c.hair), uIris: col(c.iris), uLip: col(c.lip), uGold: col(c.gold), uJade: col(c.jade),
    uHC: { value: new THREE.Vector3(...spec.HC) }, uHS: { value: F.hs }, uEye: { value: new THREE.Vector3(...spec.map.get('eyeL').p) },
    uFem: { value: look.sex === 'f' ? 1 : 0 }, uOld: { value: look.age === 'old' ? 1 : 0 }, uFlash: { value: 0 }, uTrimW: { value: look.trimW ?? 0.024 },
    uStubble: { value: look.sex !== 'f' && look.age !== 'child' ? (look.stubble ?? 0.5) : 0 }, uGlowEye: { value: look.glowEye || 0 },
  };
  const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, side: hairCard ? THREE.DoubleSide : THREE.FrontSide });
  if (hairCard) m.defines = { HAIRCARD: 1 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFogSun = shared.uFogSun; sh.uniforms.uFogSunDir = shared.uFogSunDir;
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPart; attribute vec4 aCloth; varying vec3 vRest; varying float vPart; varying vec4 vCloth; varying vec2 vUv2;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position; vPart = aPart; vCloth = aCloth; vUv2 = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + DECL)
      .replace('#include <map_fragment>', FRAG)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = tMetal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += tEmi;');
    if (hairCard) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= gl_FrontFacing ? 1.0 : -1.0;');
  };
  m.customProgramCacheKey = () => (hairCard ? 'human-hair' : 'human');
  m.userData.u = u;
  return m;
}
// 修改角色配色
export function setHumanColors(mat, cols) {
  const u = mat.userData.u, map = { skin: 'uSkin', robe: 'uRobe', trim: 'uTrim', sash: 'uSash', inner: 'uInner', pants: 'uPants', boots: 'uBoot', hair: 'uHair', iris: 'uIris', lip: 'uLip', gold: 'uGold', jade: 'uJade' };
  for (const k in cols) if (map[k] && cols[k] != null) u[map[k]].value.set(cols[k]);
}
