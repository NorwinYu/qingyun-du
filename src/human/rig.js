// 人物骨骼：静止姿态为 A 字（上臂下垂 42°），所有骨骼静止旋转为单位四元数，
// 因此动作里的欧拉角都以世界轴为参照：x 前后俯仰、y 扭转、z 侧倾。
// 坐标：y 向上，角色面朝 +z，+x 为角色左侧。
import * as THREE from 'three';

export const ARM_A = (42 * Math.PI) / 180;
const sA = Math.sin(ARM_A), cA = Math.cos(ARM_A);
export const SKIRT_N = 8;

// 手部标准坐标系（左手）：腕为原点，手指沿 -y，掌心朝 -x，拇指朝 +z
export const HAND = {
  palm: { c: [0, -0.05, 0.002], h: [0.0125, 0.046, 0.04] },
  fingers: [
    // 名称、根部、长度、根半径、梢半径
    { n: 'idx', b: [0.0, -0.094, 0.027], len: 0.074, r0: 0.0085, r1: 0.0068 },
    { n: 'mid', b: [0.0, -0.097, 0.0085], len: 0.081, r0: 0.0088, r1: 0.0069 },
    { n: 'rng', b: [-0.001, -0.095, -0.0095], len: 0.076, r0: 0.0083, r1: 0.0065 },
    { n: 'pnk', b: [-0.002, -0.089, -0.0265], len: 0.06, r0: 0.0074, r1: 0.0058 },
  ],
  thumb: { b: [-0.006, -0.022, 0.03], m: [-0.011, -0.05, 0.054], t: [-0.014, -0.074, 0.066], r0: 0.0115, r1: 0.0082 },
};

export function rigSpec(body = {}) {
  const f = body.sex === 'f', W = f ? 0.86 : 1, Hp = f ? 1.07 : 1, hs = body.hs || 1;
  const HC = [0, 1.675, 0];
  const B = [], add = (name, parent, p, tail) => { B.push({ name, parent, p, tail }); return p; };
  add('hips', null, [0, 0.98, 0], [0, 1.09, 0]);
  add('spine', 'hips', [0, 1.09, 0], [0, 1.25, -0.005]);
  add('chest', 'spine', [0, 1.25, -0.005], [0, 1.46, -0.02]);
  add('neck', 'chest', [0, 1.46, -0.02], [0, 1.56, -0.012]);
  add('head', 'neck', [0, 1.56, -0.012], [0, 1.8, 0]);
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R';
    add('eye' + S, 'head', [s * 0.031 * hs, HC[1] + 0.012 * hs, 0.0685 * hs]);
    add('lid' + S, 'head', [s * 0.031 * hs, HC[1] + 0.012 * hs, 0.0685 * hs]);
    const clav = add('clav' + S, 'chest', [s * 0.022, 1.425, 0.005], [s * 0.172 * W, 1.415, -0.012]);
    const arm = [s * 0.172 * W, 1.415, -0.012], d = [s * sA, -cA, 0];
    const at = (o, k) => [o[0] + d[0] * k, o[1] + d[1] * k, o[2] + d[2] * k];
    const fore = at(arm, 0.285), hand = at(fore, 0.255);
    add('arm' + S, 'clav' + S, arm, fore);
    add('fore' + S, 'arm' + S, fore, hand);
    add('hand' + S, 'fore' + S, hand, at(hand, 0.1));
    const hp = (c) => handPoint(c, s, hand);
    for (const fg of HAND.fingers) {
      const b0 = fg.b, b1 = [b0[0], b0[1] - fg.len * 0.45, b0[2]], b2 = [b0[0], b0[1] - fg.len, b0[2]];
      add(fg.n + S + '0', 'hand' + S, hp(b0), hp(b1));
      add(fg.n + S + '1', fg.n + S + '0', hp(b1), hp(b2));
    }
    const T = HAND.thumb;
    add('thb' + S + '0', 'hand' + S, hp(T.b), hp(T.m));
    add('thb' + S + '1', 'thb' + S + '0', hp(T.m), hp(T.t));
    // 广袖下垂的袖袋：挂在前臂中段，指向世界下方
    const sr = at(fore, 0.15);
    add('slv' + S + '0', 'fore' + S, [sr[0], sr[1] - 0.03, sr[2]], [sr[0], sr[1] - 0.14, sr[2]]);
    add('slv' + S + '1', 'slv' + S + '0', [sr[0], sr[1] - 0.14, sr[2]], [sr[0], sr[1] - 0.26, sr[2]]);
    void clav;
    // 腿
    add('thigh' + S, 'hips', [s * 0.088 * Hp, 0.935, 0], [s * 0.094 * Hp, 0.5, 0.012]);
    add('shin' + S, 'thigh' + S, [s * 0.094 * Hp, 0.5, 0.012], [s * 0.1 * Hp, 0.085, -0.025]);
    add('foot' + S, 'shin' + S, [s * 0.1 * Hp, 0.085, -0.025], [s * 0.102 * Hp, 0.022, 0.095]);
    add('toe' + S, 'foot' + S, [s * 0.102 * Hp, 0.022, 0.095], [s * 0.102 * Hp, 0.02, 0.155]);
    // 鬓发
    chain(add, 'lock' + S, 'head', [s * 0.066 * hs, HC[1] + 0.02 * hs, 0.045 * hs], [s * 0.003, -0.062, 0.003], 3);
    // 腰带垂绦
    chain(add, 'sash' + S, 'spine', [s * 0.045, 1.0, 0.128], [s * 0.004, -0.125, 0.012], 3);
  }
  // 下摆：8 条链环绕髋部
  for (let k = 0; k < SKIRT_N; k++) {
    const a = (k / SKIRT_N) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
    const v = new THREE.Vector3(sx * 0.12 * Hp, -1, cz * 0.09).normalize().multiplyScalar(0.27);
    chain(add, 'sk' + k + '_', 'hips', [sx * 0.15 * Hp, 0.9, cz * 0.115], [v.x, v.y, v.z], 3);
  }
  chain(add, 'hb', 'head', [0, HC[1] + 0.02 * hs, -0.098 * hs], [0, -0.1, -0.014], 4);
  chain(add, 'rib', 'head', [0, HC[1] + 0.1 * hs, -0.075 * hs], [0, -0.075, -0.03], 3);
  chain(add, 'tas', 'head', [0.045 * hs, HC[1] + 0.1 * hs, -0.025 * hs], [0.004, -0.045, 0], 2);
  chain(add, 'pend', 'spine', [0.12 * Hp, 0.965, 0.095], [0, -0.07, 0.004], 2);
  const map = new Map();
  B.forEach((b, i) => { b.i = i; map.set(b.name, b); });
  for (const b of B) if (!b.tail) { const ch = B.find((c) => c.parent === b.name); b.tail = ch ? ch.p : [b.p[0], b.p[1] + 0.02, b.p[2]]; }
  return { B, map, HC, W, Hp, female: f };
}
function chain(add, pre, parent, root, step, n) {
  let p = root, par = parent;
  for (let i = 0; i < n; i++) {
    const q = [p[0] + step[0], p[1] + step[1], p[2] + step[2]];
    add(pre + i, par, p, q);
    par = pre + i; p = q;
  }
}
// 把标准手坐标（左手）变换到 A 字姿态下的模型坐标
export function handPoint(c, s, hand) {
  const x = c[0] * s, y = c[1], a = s * ARM_A, ca = Math.cos(a), sa = Math.sin(a);
  return [hand[0] + x * ca - y * sa, hand[1] + x * sa + y * ca, hand[2] + c[2]];
}

export function makeSkeleton(spec) {
  const bones = spec.B.map((b) => { const o = new THREE.Bone(); o.name = b.name; return o; });
  spec.B.forEach((b, i) => {
    const o = bones[i];
    if (b.parent) { const p = spec.map.get(b.parent); o.position.set(b.p[0] - p.p[0], b.p[1] - p.p[1], b.p[2] - p.p[2]); bones[p.i].add(o); }
    else o.position.set(b.p[0], b.p[1], b.p[2]);
  });
  const by = {};
  bones.forEach((o) => { by[o.name] = o; });
  return { bones, by, root: bones[0] };
}
