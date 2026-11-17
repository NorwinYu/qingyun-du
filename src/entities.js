// 平滑角色模型：修士、村民、妖兽、仙鹤、灵草、剑气
import * as THREE from 'three';
import { GB, mat4 } from './geo.js';
import { lerp } from './noise.js';

const TAU = Math.PI * 2;
function part(parent, gb, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(gb.build(), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

// s 为旧体素边长（剑长 = 20s）；剑身沿 +y，握柄中点为原点
export function makeSword(mats, s, kind = 'iron') {
  const L = s * 20, g = new THREE.Group(), b = new GB();
  const blade = kind === 'jade' ? 0x8ff0d8 : kind === 'fly' ? 0x9fe8ff : kind === 'chixiao' ? 0xff7a40 : 0xd8dde6;
  b.col(0x4a3020).cyl(0, -0.1 * L, 0, 0.016 * L, 0.014 * L, 0.2 * L, 6, 0.5, 0, 0);
  b.col(0xe0b040).sphere(0, -0.11 * L, 0, 0.024 * L, 0.024 * L, 0.024 * L, 6, 4);
  b.col(kind === 'iron' ? 0x8a8f9a : 0xe0b040).box(-0.085 * L, 0.1 * L, -0.02 * L, 0.085 * L, 0.128 * L, 0.02 * L);
  b.col(blade, kind === 'iron' ? 1 : 1.5).lathe(0, 0.128 * L, 0, [[0.034 * L, 0], [0.03 * L, 0.6 * L], [0.001, 0.8 * L]], 4, 0.5, 0.2);
  part(g, b, mats.entity);
  if (kind === 'chixiao') {
    // 流火剑脊
    const f = new GB();
    f.col(0xff9a40, 2.2).lathe(0, 0.15 * L, 0, [[0.012 * L, 0], [0.011 * L, 0.58 * L], [0.001, 0.76 * L]], 4, 0.5, 0.75);
    part(g, f, mats.glow);
  }
  return g;
}

// 人形角色。o: { skin, hair, robe, trim, sash, pants, boots, style: 'bun'|'long'|'bald'|'hat', beard, scale }
// 关节层级：body(髋) → legL/R(大腿) → shinL/R(小腿)；upper(腰) → armL/R(上臂) → foreL/R(前臂) → hand
export function makeHumanoid(o, mats) {
  const sc = o.scale || 1, M = o.mat || mats.entity;
  const g = new THREE.Group(), root = new THREE.Group(), body = new THREE.Group();
  root.scale.setScalar(sc); g.add(root); root.add(body);
  const hipY = 0.9;
  body.position.y = hipY;
  const thigh = new GB();
  thigh.col(o.pants).tube([[0, 0.04, 0, 0.088], [0, -0.24, 0.004, 0.08], [0, -0.43, 0.004, 0.074]], 8).sphere(0, -0.42, 0.004, 0.074, 0.074, 0.074, 8, 5);
  const shin = new GB();
  shin.col(o.pants).tube([[0, 0, 0, 0.074], [0, -0.22, 0, 0.066]], 8);
  shin.col(o.boots).tube([[0, -0.18, 0, 0.07], [0, -0.44, 0, 0.064]], 8).sphere(0, -0.435, 0.04, 0.066, 0.045, 0.115, 8, 5);
  const legL = part(body, thigh, M, -0.095, 0, 0), legR = part(body, thigh, M, 0.095, 0, 0);
  const shinL = part(legL, shin, M, 0, -0.42, 0.004), shinR = part(legR, shin, M, 0, -0.42, 0.004);
  const sk = new GB();
  sk.col(o.robe).lathe(0, 0, 0, [[0.3, -0.64], [0.27, -0.4], [0.218, -0.1], [0.196, 0.06]], 14, 0.5, 0.72);
  sk.col(o.trim).lathe(0, 0, 0, [[0.303, -0.66], [0.31, -0.6], [0.3, -0.575]], 14, 0.5, 0.72);
  sk.beam(0, 0.03, 0.146, 0, -0.6, 0.218, 0.05, 0.014);
  const skirt = part(body, sk, M);
  const upper = new THREE.Group(); body.add(upper);
  const tv = new GB();
  tv.col(o.robe).lathe(0, 0, 0, [[0.19, 0], [0.2, 0.2], [0.215, 0.38], [0.19, 0.5], [0.09, 0.57], [0.058, 0.6]], 14, 0.5, 0.62);
  tv.col(o.sash).lathe(0, 0, 0, [[0.2, -0.03], [0.213, 0.03], [0.211, 0.09], [0.198, 0.115]], 14, 0.5, 0.66);
  tv.beam(0.03, 0.02, 0.142, 0.045, -0.3, 0.175, 0.045, 0.014);
  tv.col(o.skin).cyl(0, 0.54, 0, 0.052, 0.048, 0.12, 8, 0.5, 0);
  tv.col(o.trim).beam(-0.08, 0.565, 0.062, 0.05, 0.12, 0.136, 0.042, 0.016).beam(0.08, 0.565, 0.062, -0.005, 0.3, 0.138, 0.042, 0.016);
  const torso = part(upper, tv, M);
  const hv = new GB();
  hv.col(o.skin).sphere(0, 0.13, 0, 0.112, 0.13, 0.118, 14, 9);
  hv.sphere(-0.112, 0.12, 0, 0.02, 0.034, 0.025, 5, 4).sphere(0.112, 0.12, 0, 0.02, 0.034, 0.025, 5, 4);
  hv.col(o.skin, 0.9).sphere(0, 0.108, 0.117, 0.014, 0.022, 0.014, 5, 4);
  hv.col(0x1a1a22).sphere(-0.042, 0.14, 0.104, 0.014, 0.019, 0.008, 6, 4).sphere(0.042, 0.14, 0.104, 0.014, 0.019, 0.008, 6, 4);
  hv.col(o.style === 'bald' && o.beard ? o.beard : o.hair).beam(-0.066, 0.17, 0.103, -0.02, 0.175, 0.113, 0.01, 0.009).beam(0.066, 0.17, 0.103, 0.02, 0.175, 0.113, 0.01, 0.009);
  hv.col(0xb86a5a).beam(-0.022, 0.066, 0.109, 0.022, 0.066, 0.109, 0.012, 0.009);
  if (o.style !== 'bald') {
    hv.col(o.hair).surf(16, 6, (u, v, p) => {
      const a = u * TAU, f = (1 + Math.cos(a)) / 2, ph = v * Math.PI * (0.76 - 0.47 * Math.pow(f, 1.5)), sp = Math.sin(ph);
      p[0] = Math.sin(a) * sp * 0.123; p[1] = 0.134 + Math.cos(ph) * 0.139; p[2] = -0.006 + Math.cos(a) * sp * 0.13; p[3] = u; p[4] = v;
    }, true, true);
  } else hv.col(o.hair).sphere(0, 0.1, -0.1, 0.06, 0.05, 0.03, 6, 4);
  if (o.style === 'bun') {
    hv.col(o.hair).sphere(0, 0.29, -0.02, 0.05, 0.046, 0.05, 8, 6);
    hv.col(o.trim).cyl(0, 0.245, -0.02, 0.042, 0.042, 0.022, 8, 0.5, 0);
    hv.col(0x7ff0d0, 1.3).beam(-0.1, 0.275, -0.02, 0.1, 0.3, -0.02, 0.012, 0.012);
  }
  if (o.style === 'long') {
    hv.col(o.hair).surf(6, 5, (u, v, p) => { p[0] = (u * 2 - 1) * 0.105 * (1 - 0.25 * v); p[1] = 0.16 - v * 0.56; p[2] = -0.118 - 0.035 * Math.sin(v * 2.4) + Math.abs(u * 2 - 1) * 0.03; p[3] = u; p[4] = v; });
    hv.sphere(0, 0.275, -0.03, 0.035, 0.03, 0.035, 6, 4);
  }
  if (o.style === 'hat') {
    hv.col(0xc9aa5c).lathe(0, 0.2, 0, [[0.36, 0], [0.2, 0.085], [0.04, 0.2], [0.001, 0.21]], 16);
    hv.col(0x8a7440).disc(0, 0.2, 0, 0.36, 16, 0.5, true);
  }
  if (o.beard) {
    hv.col(o.beard).sphere(0, 0.02, 0.088, 0.052, 0.085, 0.032, 8, 5);
    hv.sphere(-0.032, 0.078, 0.106, 0.032, 0.012, 0.012, 5, 3).sphere(0.032, 0.078, 0.106, 0.032, 0.012, 0.012, 5, 3);
  }
  const head = part(upper, hv, M, 0, 0.6, 0);
  if (o.eyes) { const e = new GB(); e.col(o.eyes, 3).sphere(-0.042, 0.14, 0.108, 0.016, 0.012, 0.006, 6, 4).sphere(0.042, 0.14, 0.108, 0.016, 0.012, 0.006, 6, 4); part(head, e, mats.glow, 0, 0, 0, false); }
  const ua = new GB();
  ua.col(o.robe).sphere(0, -0.01, 0, 0.088, 0.08, 0.088, 8, 5).tube([[0, 0, 0, 0.076], [0, -0.26, 0, 0.082]], 8);
  const fa = new GB();
  fa.col(o.robe).sphere(0, 0, 0, 0.08, 0.08, 0.08, 8, 4).tube([[0, 0, 0, 0.082], [0, -0.21, 0, 0.106]], 8);
  fa.col(o.trim).tube([[0, -0.2, 0, 0.109], [0, -0.25, 0, 0.109]], 8);
  fa.col(o.robe, 0.55).disc(0, -0.245, 0, 0.106, 8, 0.5, true);
  fa.col(o.skin).sphere(0, -0.285, 0, 0.042, 0.052, 0.042, 6, 5);
  const armL = part(upper, ua, M, -0.245, 0.47, 0), armR = part(upper, ua, M, 0.245, 0.47, 0);
  const foreL = part(armL, fa, M, 0, -0.25, 0), foreR = part(armR, fa, M, 0, -0.25, 0);
  const hand = new THREE.Group(); hand.position.set(0, -0.31, 0.03); foreR.add(hand);
  const back = new THREE.Group(); back.position.set(0, 0.34, -0.17); back.rotation.z = 2.5; upper.add(back);
  return { group: g, root, body, upper, torso, head, armL, armR, foreL, foreR, legL, legR, shinL, shinR, skirt, hand, back, s: 0.06 * sc, hipY, phase: 0, height: 1.8 * sc, flipT: -1 };
}

// 三段连招的姿态关键帧：[右臂抬, 右臂外展, 右肘, 上身扭转, 左臂, 身体前倾, 下沉]
const COMBO = [
  [[-1.3, 0.9, -1.4, 1.0, -0.4, 0.05, 0], [-1.45, -0.2, -0.05, -1.1, 0.5, 0.2, 0.08], [-0.6, 0.2, -0.3, -0.3, 0.1, 0.1, 0]],
  [[-0.4, -0.5, -1.6, -0.9, -0.7, 0.05, 0.05], [-2.5, 0.7, -0.1, 0.9, 0.4, -0.05, 0], [-1.0, 0.3, -0.4, 0.3, 0.1, 0.05, 0]],
  [[-3.0, 0.2, -0.6, 0.15, -2.4, -0.2, -0.28], [0.35, 0.1, -0.1, -0.1, 0.6, 0.45, 0.3], [-0.2, 0.15, -0.3, 0, 0.1, 0.25, 0.15]],
];
const ease = (t) => t * t * (3 - 2 * t);
// a: { speed, air, meditate, fly, glide, dash, flip(-1|0..1), attackT(-1|0..1), combo, cast(-1|0..1), vy, time, talk }
export function animateHumanoid(m, dt, a) {
  const k = 1 - Math.exp(-dt * 14), kf = 1 - Math.exp(-dt * 30);
  let lL = 0, lR = 0, lz = 0, kL = 0.06, kR = 0.06, aL = 0, aR = 0, aLz = -0.07, aRz = 0.07, eL = -0.15, eR = -0.15;
  let bodyY = m.hipY, bodyRx = 0, upRy = 0, upRx = 0, headRx = 0, headRy = 0, skY = 1, skRx = 0, bz = 0;
  const run = Math.min(1, Math.max(0, (a.speed - 6) / 3));
  if (a.meditate) {
    lL = lR = -1.45; lz = 0.62; kL = kR = 2.5; bodyY = 0.2 + Math.sin(a.time * 1.5) * 0.012;
    aL = aR = -0.5; aLz = -0.32; aRz = 0.32; eL = eR = -1.05; headRx = 0.08; skY = 0.28; upRx = Math.sin(a.time * 1.5) * 0.015;
  } else if (a.dash) {
    lL = -0.9; lR = 0.7; kL = 0.5; kR = 1.2; aL = aR = 0.9; aLz = -0.25; aRz = 0.25; eL = eR = -0.2; bodyRx = 0.55; bodyY = m.hipY - 0.08; skRx = 0.5;
  } else if (a.fly) {
    lL = 0.14; lR = -0.32; kL = 0.32; kR = 0.42; aL = 0.16; aR = 0.12; aLz = -0.3; aRz = 0.3; eL = eR = -0.35; bodyRx = 0.1 + Math.min(0.25, a.speed * 0.012);
    bodyY = m.hipY - 0.06; skRx = Math.min(0.45, a.speed * 0.012);
  } else if (a.glide) {
    lL = 0.3; lR = 0.18; kL = 0.45; kR = 0.3; aL = aR = 0.25; aLz = -1.35 + Math.sin(a.time * 3) * 0.06; aRz = 1.35 - Math.sin(a.time * 3) * 0.06; eL = eR = -0.15;
    bodyRx = 0.55; headRx = -0.45; skRx = 0.6;
  } else if (a.air) {
    const up = a.vy > 0;
    lL = up ? -0.75 : 0.35; lR = up ? 0.2 : -0.45; kL = up ? 1.3 : 0.4; kR = up ? 0.55 : 0.9;
    aL = -0.9; aR = -0.7; aLz = -0.6; aRz = 0.6; eL = eR = -0.6; skRx = up ? -0.15 : 0.15;
  } else {
    m.phase += dt * (2.2 + a.speed * 1.45);
    const w = Math.min(1, a.speed / 3), c = Math.cos(m.phase), sw = Math.sin(m.phase) * w * (0.85 + run * 0.2);
    lL = sw; lR = -sw;
    kL = 0.06 + (0.12 + Math.max(0, c) * (0.85 + run * 0.7)) * w; kR = 0.06 + (0.12 + Math.max(0, -c) * (0.85 + run * 0.7)) * w;
    aL = -sw * (0.75 + run * 0.3); aR = sw * (0.75 + run * 0.3); eL = -0.2 - w * 0.25 - run * 0.9; eR = eL;
    bodyY = m.hipY - run * 0.05 + Math.abs(Math.cos(m.phase)) * (0.035 + run * 0.04) * w + Math.sin(a.time * 2) * 0.006;
    bodyRx = 0.08 * w + run * 0.2; upRy = sw * 0.12; headRx = -bodyRx * 0.5;
    aLz = -0.07 - Math.sin(a.time * 1.7) * 0.02 - run * 0.1; aRz = -aLz; skRx = Math.min(0.3, a.speed * 0.028);
    if (w < 0.1) { upRx = Math.sin(a.time * 1.6) * 0.012; headRy = Math.sin(a.time * 0.37) * 0.25 * Math.max(0, Math.sin(a.time * 0.13)); }
    if (a.talk) { aR = -0.5 + Math.sin(a.time * 3) * 0.15; eR = -1.1 + Math.sin(a.time * 2.3) * 0.3; headRx = Math.sin(a.time * 2.2) * 0.05; headRy = 0; }
  }
  let atk = false;
  if (a.attackT >= 0) {
    const K = COMBO[a.combo || 0], t = a.attackT;
    const [p0, p1, p2] = t < 0.35 ? [K[0], K[0], ease(t / 0.35)] : t < 0.62 ? [K[0], K[1], ease((t - 0.35) / 0.27)] : [K[1], K[2], ease((t - 0.62) / 0.38)];
    const f = (i) => p0[i] + (p1[i] - p0[i]) * p2;
    const rest = t < 0.35 ? ease(t / 0.35) : 1, back = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
    const pose = (base, i) => base + (f(i) - base) * rest * back;
    aR = pose(aR, 0); aRz = pose(aRz, 1); eR = pose(eR, 2); upRy = pose(upRy, 3); aL = pose(aL, 4); bodyRx = pose(bodyRx, 5);
    bodyY -= f(6) * rest * back; lL -= 0.35 * rest * back; lR += 0.45 * rest * back; kL += 0.35 * rest * back; kR += 0.25 * rest * back;
    if (a.combo === 2 && t < 0.4) { bodyY += Math.sin((t / 0.4) * Math.PI) * 0.25; kL += 0.8; kR += 0.8; }
    bz = (t > 0.3 && t < 0.7 ? Math.sin(((t - 0.3) / 0.4) * Math.PI) : 0) * (a.combo === 2 ? 0.25 : 0.12);
    atk = true;
  } else if (a.cast >= 0) {
    const r = Math.sin(Math.min(1, a.cast) * Math.PI);
    aR = -1.55 * r + aR * (1 - r); eR = -0.05 * r + eR * (1 - r); aRz = 0.05; upRy = -0.5 * r;
    aL = -1.0 * r + aL * (1 - r); eL = -1.7 * r + eL * (1 - r); aLz = -0.25 * r;
    atk = true;
  }
  const kk = atk ? kf : k;
  m.armR.rotation.x += (aR - m.armR.rotation.x) * kk; m.armR.rotation.z += (aRz - m.armR.rotation.z) * kk;
  m.foreR.rotation.x += (eR - m.foreR.rotation.x) * kk; m.upper.rotation.y += (upRy - m.upper.rotation.y) * kk;
  m.armL.rotation.x += (aL - m.armL.rotation.x) * kk; m.armL.rotation.z += (aLz - m.armL.rotation.z) * k;
  m.foreL.rotation.x += (eL - m.foreL.rotation.x) * kk;
  m.legL.rotation.x += (lL - m.legL.rotation.x) * k; m.legR.rotation.x += (lR - m.legR.rotation.x) * k;
  m.shinL.rotation.x += (kL - m.shinL.rotation.x) * k; m.shinR.rotation.x += (kR - m.shinR.rotation.x) * k;
  m.legL.rotation.z += (-lz - m.legL.rotation.z) * k; m.legR.rotation.z += (lz - m.legR.rotation.z) * k;
  m.body.position.y += (bodyY - m.body.position.y) * k;
  m.body.position.z += (bz - m.body.position.z) * kk;
  m.upper.rotation.x += (upRx - m.upper.rotation.x) * k;
  m.head.rotation.x += (headRx - m.head.rotation.x) * k; m.head.rotation.y += (headRy - m.head.rotation.y) * (1 - Math.exp(-dt * 3));
  m.skirt.scale.y += (skY - m.skirt.scale.y) * k;
  m.skirt.rotation.x += (skRx - m.skirt.rotation.x) * k;
  // 二段跳空翻：绕髋部整周旋转
  if (a.flip >= 0) {
    const t = Math.min(1, a.flip), e = ease(t);
    m.body.rotation.x = bodyRx + e * TAU;
    m.shinL.rotation.x = m.shinR.rotation.x = 1.9 * Math.sin(t * Math.PI) + kL;
    m.legL.rotation.x = m.legR.rotation.x = -1.4 * Math.sin(t * Math.PI);
  } else m.body.rotation.x += (bodyRx - m.body.rotation.x) * k;
}
// 妖兽与动物。返回 { group, body, head, legs[], tail, wings?, arms?, kind, radius, height }
const PALS = {
  wolf: { a: 0x6c717b, b: 0x565b65, c: 0x9a9ea6, d: 0x464a53, l: 0x5d626c, e: 0xff4030 },
  blood: { a: 0x7a3a2c, b: 0x4a1c16, c: 0xb07a60, d: 0x2a100c, l: 0x6a2e24, e: 0xffd040 },
  king: { a: 0x3c3c48, b: 0x202028, c: 0x707080, d: 0x1a1a22, l: 0x30303c, e: 0xff2a20, spikes: 0xff3a2a },
  golem: { a: 0x7c7f84, b: 0x6a6d72, c: 0x8a8d92, m: 0x58803a, core: 0x7ff2ff, e: 0x60f0ff, f: 0x30333a, g: 0x5a5d62 },
  lava: { a: 0x4a3b37, b: 0x3a2f2c, c: 0x5c4a44, m: 0xff5a1a, core: 0xffa040, e: 0xffd060, f: 0x1e1816, g: 0x2e2422, mglow: true },
  wisp: { core: 0xc8fff2, fl: 0x40e0c0 },
  fire: { core: 0xfff0c0, fl: 0xff6a18 },
};
export function makeBeast(kind, mats, pal) {
  const M = mats.entity, MF = mats.entityFlat, g = new THREE.Group(), body = new THREE.Group();
  const P = PALS[pal || kind] || PALS[kind] || {};
  g.add(body);
  const m = { group: g, body, kind, legs: [], phase: 0, tail: null, head: null, arms: null, wings: null, lh: 0 };
  const eyes = (parent, x, y, z, r, c) => { const e = new GB(); e.col(c, 2.6).sphere(-x, y, z, r, r, r, 6, 4).sphere(x, y, z, r, r, r, 6, 4); part(parent, e, mats.glow, 0, 0, 0, false); };
  const leg = (c, c2, len, r0, r1, paw) => { const l = new GB(); l.col(c).tube([[0, 0.06, 0, r0], [0, -len * 0.5, -0.02, (r0 + r1) / 2], [0, -len + paw, 0, r1]], 7); l.col(c2).sphere(0, -len + paw * 0.6, paw * 0.4, paw, paw * 0.6, paw * 1.35, 7, 4); return l; };
  const lift = (lh) => { body.position.y = lh; m.lh = lh; };
  if (kind === 'wolf') {
    lift(0.5);
    const b = new GB();
    b.col(P.a).sphere(0, 0.2, -0.05, 0.19, 0.2, 0.46, 10, 7);
    b.col(P.b).sphere(0, 0.25, 0.26, 0.215, 0.235, 0.27, 10, 7);
    b.col(P.c).sphere(0, 0.1, -0.02, 0.15, 0.13, 0.4, 8, 5);
    b.col(P.d).sphere(0, 0.36, -0.05, 0.09, 0.07, 0.42, 8, 5);
    part(body, b, M);
    const h = new GB();
    h.col(P.a).sphere(0, 0.03, 0.06, 0.135, 0.125, 0.16, 10, 7);
    h.col(P.c).sphere(0, -0.02, 0.24, 0.07, 0.062, 0.14, 8, 5);
    h.col(0xe8e8e8).sphere(0, -0.065, 0.24, 0.05, 0.022, 0.1, 6, 4);
    h.col(0x1c1c20).sphere(0, 0.0, 0.375, 0.026, 0.022, 0.02, 6, 4);
    h.col(P.d).cyl(-0.085, 0.1, 0.0, 0.05, 0.001, 0.15, 5, 0.5, 0).cyl(0.085, 0.1, 0.0, 0.05, 0.001, 0.15, 5, 0.5, 0);
    m.head = part(body, h, M, 0, 0.38, 0.5);
    eyes(m.head, 0.064, 0.066, 0.168, 0.02, P.e);
    for (const [x, z] of [[-0.12, 0.3], [0.12, 0.3], [-0.12, -0.36], [0.12, -0.36]]) m.legs.push(part(body, leg(P.l, P.c, 0.5, 0.068, 0.04, 0.05), M, x, 0, z));
    const t = new GB();
    t.col(P.l).tube([[0, 0.02, 0.05, 0.05], [0, -0.05, -0.2, 0.062], [0, -0.16, -0.42, 0.03]], 7).col(P.c).sphere(0, -0.17, -0.43, 0.032, 0.032, 0.05, 6, 4);
    m.tail = part(body, t, M, 0, 0.3, -0.46);
    if (P.spikes) { const sp = new GB(); sp.col(P.spikes, 2.2); for (let i = 0; i < 7; i++) sp.cyl(0, 0.4 - i * 0.012, 0.3 - i * 0.12, 0.035, 0.001, 0.16 - Math.abs(i - 2) * 0.015, 5, 0.5, 0); part(body, sp, mats.glow, 0, 0, 0, false); }
    m.radius = 0.6; m.height = 1.0;
  } else if (kind === 'boar') {
    lift(0.36);
    const b = new GB();
    b.col(0x6e4b33).sphere(0, 0.27, 0, 0.3, 0.3, 0.52, 10, 7);
    b.col(0x8a6549).sphere(0, 0.14, 0, 0.24, 0.18, 0.44, 8, 5);
    b.col(0x3a2a1e).sphere(0, 0.52, 0.08, 0.07, 0.1, 0.4, 8, 5);
    part(body, b, M);
    const h = new GB();
    h.col(0x6e4b33).sphere(0, 0, 0.08, 0.21, 0.2, 0.22, 10, 7);
    h.col(0x8a6549).sphere(0, -0.06, 0.3, 0.105, 0.095, 0.12, 8, 5);
    h.col(0xc48a78).sphere(0, -0.06, 0.41, 0.07, 0.06, 0.03, 7, 4);
    h.col(0xf4f0e0).cyl(-0.1, -0.1, 0.32, 0.028, 0.001, 0.13, 5, 0.5, 0).cyl(0.1, -0.1, 0.32, 0.028, 0.001, 0.13, 5, 0.5, 0);
    h.col(0x101010).sphere(-0.125, 0.07, 0.22, 0.022, 0.022, 0.022, 5, 4).sphere(0.125, 0.07, 0.22, 0.022, 0.022, 0.022, 5, 4);
    h.col(0x5c3d29).cyl(-0.15, 0.13, 0.02, 0.06, 0.001, 0.13, 5, 0.5, 0).cyl(0.15, 0.13, 0.02, 0.06, 0.001, 0.13, 5, 0.5, 0);
    m.head = part(body, h, M, 0, 0.24, 0.46);
    for (const [x, z] of [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]]) m.legs.push(part(body, leg(0x4a3222, 0x2a1c14, 0.36, 0.078, 0.05, 0.055), M, x, 0, z));
    const t = new GB();
    t.col(0x4a3222).tube([[0, 0, 0.04, 0.025], [0, 0.02, -0.1, 0.02], [0, -0.06, -0.16, 0.008]], 5);
    m.tail = part(body, t, M, 0, 0.4, -0.5);
    m.radius = 0.6; m.height = 1.0;
  } else if (kind === 'rabbit') {
    lift(0.1);
    const b = new GB();
    b.col(0xf2f0ea).sphere(0, 0.13, -0.02, 0.12, 0.13, 0.19, 10, 7);
    b.col(0xffffff).sphere(0, 0.15, -0.2, 0.05, 0.05, 0.05, 6, 4);
    part(body, b, M);
    const h = new GB();
    h.col(0xf2f0ea).sphere(0, 0.03, 0.04, 0.09, 0.09, 0.1, 10, 7);
    for (const s of [-1, 1]) {
      h.xf(mat4(s * 0.04, 0.1, 0, 0, -0.2, -s * 0.18));
      h.col(0xf2f0ea).sphere(0, 0.11, 0, 0.028, 0.115, 0.018, 6, 5);
      h.col(0xf4a6b8).sphere(0, 0.11, 0.012, 0.016, 0.088, 0.01, 5, 4);
    }
    h.xf(null);
    h.col(0xc02030).sphere(-0.066, 0.05, 0.09, 0.016, 0.018, 0.016, 5, 4).sphere(0.066, 0.05, 0.09, 0.016, 0.018, 0.016, 5, 4);
    h.col(0xf4a6b8).sphere(0, 0.02, 0.136, 0.014, 0.012, 0.012, 5, 4);
    m.head = part(body, h, M, 0, 0.22, 0.14);
    const l = () => new GB().col(0xe6e3da).sphere(0, -0.06, 0.02, 0.04, 0.05, 0.075, 6, 4);
    for (const [x, z] of [[-0.07, 0.1], [0.07, 0.1], [-0.08, -0.12], [0.08, -0.12]]) m.legs.push(part(body, l(), M, x, 0, z));
    m.radius = 0.35; m.height = 0.6;
  } else if (kind === 'chicken') {
    lift(0.15);
    const b = new GB();
    b.col(0xf4f1e6).sphere(0, 0.1, -0.01, 0.105, 0.115, 0.16, 10, 7);
    b.col(0xd8d2c0).sphere(-0.1, 0.1, -0.02, 0.03, 0.08, 0.11, 6, 4).sphere(0.1, 0.1, -0.02, 0.03, 0.08, 0.11, 6, 4);
    b.xf(mat4(0, 0.14, -0.14, 0, -0.7, 0)).col(0xe8e2d0).sphere(0, 0.08, 0, 0.05, 0.11, 0.03, 6, 4).xf(null);
    part(body, b, M);
    const h = new GB();
    h.col(0xf4f1e6).sphere(0, 0.05, 0.02, 0.06, 0.065, 0.06, 8, 6).sphere(0, -0.03, 0, 0.05, 0.08, 0.05, 6, 4);
    h.col(0xd82a2a).sphere(0, 0.125, 0.02, 0.014, 0.03, 0.04, 5, 4).sphere(0, 0.0, 0.075, 0.012, 0.022, 0.012, 5, 4);
    h.col(0xe8a020).tube([[0, 0.045, 0.07, 0.022], [0, 0.035, 0.13, 0.002]], 5);
    h.col(0x101010).sphere(-0.05, 0.065, 0.045, 0.011, 0.011, 0.011, 5, 4).sphere(0.05, 0.065, 0.045, 0.011, 0.011, 0.011, 5, 4);
    m.head = part(body, h, M, 0, 0.2, 0.1);
    const l = () => new GB().col(0xe8a020).tube([[0, 0.02, 0, 0.012], [0, -0.14, 0, 0.01]], 5).sphere(0, -0.142, 0.025, 0.03, 0.008, 0.042, 5, 3);
    for (const x of [-0.045, 0.045]) m.legs.push(part(body, l(), M, x, 0, 0));
    m.radius = 0.25; m.height = 0.5;
  } else if (kind === 'golem') {
    lift(0.76);
    const b = new GB();
    b.col(P.a).sphere(0, 0.62, 0, 0.66, 0.62, 0.46, 7, 5);
    b.col(P.b).sphere(0, 0.12, 0, 0.46, 0.3, 0.36, 6, 4);
    b.col(P.c).sphere(-0.55, 1.02, 0, 0.34, 0.27, 0.32, 6, 4).sphere(0.55, 1.02, 0, 0.34, 0.27, 0.32, 6, 4);
    const mo = P.mglow ? new GB() : b;
    mo.col(P.m, P.mglow ? 2.2 : 1).sphere(-0.3, 1.2, -0.05, 0.3, 0.1, 0.28, 6, 3).sphere(0.45, 1.24, 0.05, 0.2, 0.08, 0.2, 6, 3).sphere(0.1, 0.5, -0.42, 0.3, 0.25, 0.08, 6, 3);
    if (P.mglow) { mo.sphere(-0.2, 0.75, 0.42, 0.18, 0.05, 0.06, 6, 3).sphere(0.32, 0.4, 0.4, 0.14, 0.04, 0.05, 6, 3).sphere(-0.55, 1.02, 0.25, 0.1, 0.08, 0.1, 6, 3).sphere(0.55, 1.02, 0.25, 0.1, 0.08, 0.1, 6, 3); part(body, mo, mats.glow, 0, 0, 0, false); }
    part(body, b, MF);
    const c = new GB();
    if (P.mglow) {
      c.col(P.core, 2.6).lathe(0, 0.52, 0.43, [[0.001, 0], [0.1, 0.13], [0.07, 0.24], [0.001, 0.32]], 7);
      // 熔岩裂纹：身躯、手臂、腿上的发光细脉
      c.col(P.m, 2.0);
      for (const [x, y, z, h, rz] of [[-0.25, 0.55, 0.43, 0.42, 0.5], [0.28, 0.7, 0.42, 0.36, -0.6], [-0.42, 0.95, 0.3, 0.3, 1.1], [0.05, 0.25, 0.36, 0.3, 0.2], [0.5, 0.55, 0.2, 0.34, -0.3], [-0.55, 0.5, 0.15, 0.3, 0.4]]) {
        c.xf(mat4(x, y, z, 0, 0, rz)).cyl(0, 0, 0, 0.018, 0.012, h, 4, 0.5, 0.5).xf(null);
      }
    } else c.col(P.core, 2.4).lathe(0, 0.42, 0.44, [[0.001, 0], [0.14, 0.2], [0.001, 0.42]], 4, 0.5, 0.45);
    part(body, c, mats.glow, 0, 0, 0, false);
    const h = new GB();
    h.col(P.c).sphere(0, 0.2, 0, 0.3, 0.25, 0.28, 6, 4);
    h.col(P.mglow ? P.a : P.m).sphere(0, 0.4, -0.02, 0.24, 0.08, 0.22, 6, 3);
    if (P.mglow) { const cr = new GB(); cr.col(P.m, 2.4); for (let i = 0; i < 5; i++) cr.cyl(-0.2 + i * 0.1, 0.4, -0.02, 0.04, 0.001, 0.2 + (i % 2) * 0.1, 5, 0.5, 0); m.crown = cr; }
    h.col(P.f).box(-0.2, 0.14, 0.2, 0.2, 0.25, 0.265);
    m.head = part(body, h, MF, 0, 1.22, 0.06);
    if (m.crown) part(m.head, m.crown, mats.glow, 0, 0, 0, false);
    eyes(m.head, 0.1, 0.195, 0.27, 0.045, P.e);
    const a = () => { const q = new GB(); q.col(P.a).sphere(0, -0.35, 0, 0.2, 0.42, 0.2, 6, 4); q.col(P.b).sphere(0, -0.95, 0, 0.27, 0.3, 0.27, 6, 4); q.col(P.mglow ? P.c : P.m).sphere(0, -0.04, 0, 0.2, 0.1, 0.2, 5, 3); return q; };
    m.arms = [part(body, a(), MF, -0.92, 1.1, 0), part(body, a(), MF, 0.92, 1.1, 0)];
    if (P.mglow) for (const arm of m.arms) { const v = new GB(); v.col(P.m, 2.2).sphere(0, -0.95, 0.2, 0.12, 0.1, 0.1, 5, 3).sphere(0.14, -1.1, 0.12, 0.07, 0.07, 0.07, 5, 3).xf(mat4(0, -0.45, 0.19, 0.3, 0, 0)).cyl(0, 0, 0, 0.02, 0.012, 0.36, 4, 0.5, 0.5).xf(null); part(arm, v, mats.glow, 0, 0, 0, false); }
    const l = () => { const q = new GB(); q.col(P.b).sphere(0, -0.36, 0, 0.25, 0.42, 0.27, 6, 4); q.col(P.g).sphere(0, -0.67, 0.04, 0.28, 0.1, 0.32, 6, 3); return q; };
    for (const x of [-0.32, 0.32]) m.legs.push(part(body, l(), MF, x, 0, 0));
    m.radius = 1.0; m.height = 2.7;
  } else if (kind === 'wisp') {
    body.position.y = 1.1;
    const c = new GB();
    c.col(P.core, 2.2).sphere(0, 0, 0, 0.13, 0.13, 0.13, 10, 7);
    c.col(P.fl, 2.0);
    for (let i = 0; i < 5; i++) { const a = i * 1.2566; c.lathe(Math.cos(a) * 0.27, Math.sin(a * 2.3) * 0.12 - 0.1, Math.sin(a) * 0.27, [[0.001, 0], [0.045, 0.09], [0.001, 0.22]], 4); }
    part(body, c, mats.glow, 0, 0, 0, false);
    m.radius = 0.4; m.height = 1.5;
  } else if (kind === 'fox') {
    lift(0.3);
    const b = new GB();
    b.col(0xf6f2ee).sphere(0, 0.16, -0.02, 0.13, 0.14, 0.3, 10, 7);
    b.col(0xfffcf8).sphere(0, 0.1, 0.1, 0.1, 0.1, 0.16, 8, 5).sphere(0, 0.22, 0.2, 0.12, 0.13, 0.13, 8, 6);
    part(body, b, M);
    const h = new GB();
    h.col(0xf6f2ee).sphere(0, 0.02, 0.03, 0.1, 0.09, 0.1, 10, 7);
    h.col(0xfffcf8).sphere(0, -0.02, 0.13, 0.05, 0.042, 0.11, 8, 5);
    h.col(0x2a2024).sphere(0, -0.005, 0.24, 0.018, 0.015, 0.015, 6, 4);
    for (const s of [-1, 1]) { h.col(0xf6f2ee).cyl(s * 0.06, 0.07, -0.01, 0.045, 0.001, 0.14, 5, 0.5, 0); h.col(0xf0a8b8).cyl(s * 0.06, 0.08, 0.0, 0.026, 0.001, 0.1, 5, 0.5, 0); }
    h.col(0xd83040).sphere(0, 0.1, 0.085, 0.01, 0.022, 0.006, 5, 4);
    m.head = part(body, h, M, 0, 0.3, 0.28);
    eyes(m.head, 0.044, 0.035, 0.1, 0.016, 0x80d8ff);
    for (const [x, z] of [[-0.07, 0.16], [0.07, 0.16], [-0.07, -0.2], [0.07, -0.2]]) m.legs.push(part(body, leg(0xf0ece6, 0xfffcf8, 0.3, 0.035, 0.024, 0.03), M, x, 0, z));
    m.tails = [];
    for (let i = 0; i < 3; i++) {
      const t = new GB(), gl = new GB();
      t.col(0xf8f4f0).tube([[0, 0, 0, 0.05], [0, 0.08, -0.18, 0.085], [0, 0.22, -0.34, 0.07], [0, 0.32, -0.42, 0.02]], 8);
      gl.col(0xffe0a0, 1.6).sphere(0, 0.3, -0.41, 0.045, 0.045, 0.05, 6, 4);
      const tp = part(body, t, M, (i - 1) * 0.05, 0.22, -0.28);
      part(tp, gl, mats.glow, 0, 0, 0, false);
      tp.rotation.z = (i - 1) * 0.55; m.tails.push(tp);
    }
    m.radius = 0.35; m.height = 0.7;
  } else if (kind === 'crane') {
    const b = new GB();
    b.col(0xf6f6f2).sphere(0, 0, 0, 0.12, 0.11, 0.32, 10, 6);
    b.col(0x202428).sphere(0, 0.01, -0.3, 0.085, 0.035, 0.15, 7, 4);
    b.col(0x30343a).tube([[-0.03, -0.06, -0.1, 0.012], [-0.03, -0.08, -0.62, 0.008]], 4).tube([[0.03, -0.06, -0.1, 0.012], [0.03, -0.08, -0.62, 0.008]], 4);
    part(body, b, M);
    const h = new GB();
    h.col(0xf6f6f2).tube([[0, -0.02, -0.04, 0.05], [0, 0.03, 0.14, 0.032], [0, 0.07, 0.24, 0.026]], 6);
    h.col(0x202428).tube([[0, 0.07, 0.24, 0.027], [0, 0.1, 0.4, 0.024]], 6);
    h.col(0xf6f6f2).sphere(0, 0.105, 0.43, 0.036, 0.034, 0.045, 7, 5);
    h.col(0xd82a2a).sphere(0, 0.135, 0.43, 0.022, 0.012, 0.028, 6, 3);
    h.col(0xd8a030).tube([[0, 0.1, 0.46, 0.014], [0, 0.085, 0.62, 0.002]], 5);
    m.head = part(body, h, M, 0, 0.03, 0.26);
    const wing = (s) => { const w = new GB(); w.col(0xf6f6f2).sphere(s * 0.36, 0, 0, 0.38, 0.016, 0.17, 8, 4); w.col(0x202428).sphere(s * 0.68, 0, -0.03, 0.22, 0.017, 0.13, 7, 4); return w; };
    m.wings = [part(body, wing(-1), M, -0.08, 0.07, 0.04), part(body, wing(1), M, 0.08, 0.07, 0.04)];
    m.radius = 0.5; m.height = 0.5;
  }
  return m;
}

// a: { speed, time, attackT(-1|0..1) }
export function animateBeast(m, dt, a) {
  if (m.kind === 'crane') {
    const f = Math.sin(a.time * 5.5) * 0.6;
    m.wings[0].rotation.z = f; m.wings[1].rotation.z = -f;
    return;
  }
  if (m.kind === 'wisp') {
    m.body.position.y = 1.1 + Math.sin(a.time * 2.3 + m.phase) * 0.18;
    m.body.rotation.y += dt * 1.5;
    return;
  }
  m.phase += dt * (1.2 + a.speed * 2.6);
  const w = Math.min(1, a.speed / 2), sw = Math.sin(m.phase) * 0.75 * w;
  const L = m.legs;
  if (L.length === 4) { L[0].rotation.x = sw; L[1].rotation.x = -sw; L[2].rotation.x = -sw; L[3].rotation.x = sw; }
  else if (L.length === 2) { L[0].rotation.x = sw; L[1].rotation.x = -sw; }
  if (m.arms) { m.arms[0].rotation.x = -sw * 0.6; m.arms[1].rotation.x = sw * 0.6; }
  let lunge = 0;
  if (a.attackT >= 0) lunge = Math.sin(a.attackT * Math.PI);
  if (m.kind === 'golem') {
    if (a.attackT >= 0) { m.arms[0].rotation.x = -2.6 * lunge; m.arms[1].rotation.x = -2.6 * lunge; }
    m.body.rotation.x = lunge * 0.25;
  } else {
    m.body.position.z = lunge * 0.45;
    m.body.rotation.x = -lunge * 0.2;
    m.body.position.y = m.lh + (m.kind === 'rabbit' || m.kind === 'chicken' ? Math.abs(Math.sin(m.phase)) * 0.12 * w : Math.abs(Math.sin(m.phase * 2)) * 0.03 * w);
  }
  if (m.head) m.head.rotation.x = Math.sin(a.time * 1.3 + m.phase * 0.2) * 0.06 - lunge * 0.35 + (m.kind === 'chicken' ? Math.max(0, Math.sin(a.time * 0.9 + m.phase)) * 0.9 * (1 - w) : 0);
  if (m.tail) m.tail.rotation.y = Math.sin(a.time * 5 + m.phase) * 0.3;
  if (m.tails) m.tails.forEach((t, i) => { t.rotation.y = Math.sin(a.time * 2.2 + i * 1.3) * 0.35; t.rotation.x = Math.sin(a.time * 1.7 + i) * 0.12 + w * 0.3; });
}

// 灵草：h = { shape: 'grass'|'flower'|'bush'|'lotus', a, b, stem }；返回 [受光几何体, 发光几何体]
export function makeHerbGeos(h) {
  const lit = new GB(), glow = new GB();
  glow.col(h.b, 1.6);
  if (h.shape === 'grass') {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = i ? 0.05 + (i % 3) * 0.04 : 0, t = 0.34 + ((i * 7) % 5) * 0.08, ox = Math.cos(a) * r, oz = Math.sin(a) * r, lx = Math.cos(a) * t * 0.45, lz = Math.sin(a) * t * 0.45;
      lit.col(i % 2 ? h.a : h.stem).tube([[ox, 0, oz, 0.018], [ox + lx * 0.3, t * 0.55, oz + lz * 0.3, 0.014], [ox + lx, t, oz + lz, 0.004]], 4);
      glow.sphere(ox + lx, t + 0.01, oz + lz, 0.028, 0.028, 0.028, 5, 4);
    }
  } else if (h.shape === 'flower') {
    lit.col(h.stem).tube([[0, 0, 0, 0.018], [0.02, 0.25, 0.01, 0.014], [0, 0.48, 0, 0.012]], 5);
    for (let i = 0; i < 3; i++) { lit.xf(mat4(0, 0.08 + i * 0.09, 0, i * 2.2, 0, 0.5)); lit.sphere(0.13, 0, 0, 0.12, 0.012, 0.045, 6, 3); }
    lit.col(h.a);
    for (let i = 0; i < 6; i++) { lit.xf(mat4(0, 0.5, 0, i * 1.047, 0, 0.45)); lit.sphere(0.1, 0, 0, 0.1, 0.014, 0.05, 6, 3); }
    lit.xf(null);
    glow.sphere(0, 0.53, 0, 0.045, 0.04, 0.045, 6, 4);
  } else if (h.shape === 'bush') {
    lit.col(h.stem).cyl(0, 0, 0, 0.035, 0.025, 0.2, 5, 0.5, 0);
    lit.col(h.a).sphere(0, 0.3, 0, 0.22, 0.19, 0.22, 7, 5).sphere(0.14, 0.24, 0.08, 0.15, 0.13, 0.15, 6, 4);
    lit.col(0x2f5a28).sphere(-0.13, 0.22, -0.07, 0.15, 0.13, 0.15, 6, 4).sphere(0.02, 0.4, -0.08, 0.13, 0.11, 0.13, 6, 4);
    for (const [x, y, z] of [[0.2, 0.33, 0.14], [-0.22, 0.26, 0.04], [0.02, 0.5, 0.02], [0.06, 0.26, 0.24], [-0.1, 0.4, -0.18], [0.24, 0.2, -0.06]]) glow.sphere(x, y, z, 0.042, 0.042, 0.042, 6, 4);
  } else if (h.shape === 'shroom') {
    for (const [x, z, s] of [[0, 0, 1], [0.16, 0.1, 0.65], [-0.13, 0.08, 0.55]]) {
      lit.col(h.stem).cyl(x, 0, z, 0.035 * s, 0.045 * s, 0.22 * s, 7);
      lit.col(h.a).sphere(x, 0.22 * s, z, 0.17 * s, 0.07 * s, 0.17 * s, 9, 5);
      glow.sphere(x, 0.25 * s, z, 0.09 * s, 0.035 * s, 0.09 * s, 7, 4);
    }
  } else {
    lit.col(h.stem).cyl(0, 0, 0, 0.26, 0.24, 0.025, 12);
    lit.col(h.a);
    for (let i = 0; i < 8; i++) { lit.xf(mat4(0, 0.03, 0, i * 0.785, 0, 0.5)); lit.sphere(0.13, 0, 0, 0.13, 0.014, 0.06, 6, 3); }
    for (let i = 0; i < 5; i++) { lit.xf(mat4(0, 0.04, 0, i * 1.257 + 0.4, 0, 1.0)); lit.sphere(0.1, 0, 0, 0.1, 0.014, 0.05, 6, 3); }
    lit.xf(null);
    glow.sphere(0, 0.11, 0, 0.05, 0.07, 0.05, 6, 4);
  }
  return [lit.build(), glow.build()];
}

// 月牙形剑气：沿 +z 飞行
export function makeShotGeo(color = 0x9ff4ff) {
  const g = new GB();
  g.col(color, 2.4);
  for (const flip of [false, true]) g.surf(12, 2, (u, v, p) => {
    const a = (u * 2 - 1) * 1.15, w = (1 - (u * 2 - 1) ** 2) * 0.2, r = 0.5 + (v - 0.5) * 2 * w + w * 0.5;
    p[0] = Math.sin(a) * r; p[1] = 0; p[2] = Math.cos(a) * r - 0.45; p[3] = u; p[4] = v; p[5] = v === 0.5 ? 1.6 : 0.8;
  }, flip);
  return g.build();
}
