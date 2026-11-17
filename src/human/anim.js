// 程序化动画：多个全身状态按权重混合 + 上身/全身叠加层（连招、施法、格挡、对话、打铁）+ 受击弹簧 + 脚着地修正。
// 姿态以通道数组表示，右侧肢体在应用时镜像（y、z 取反），因此左右写同样的数值即为对称姿态。
import * as THREE from 'three';
import { ARM_A } from './rig.js';

const CH = {}, CHN = {}; let NCH = 0;
const def = (n, k) => { CH[n] = NCH; CHN[n] = k; NCH += k; };
def('root', 3); def('hips', 3); def('spine', 3); def('chest', 3); def('neck', 3); def('head', 3);
for (const S of ['L', 'R']) { def('clav' + S, 3); def('arm' + S, 3); def('fore' + S, 2); def('hand' + S, 3); def('thigh' + S, 3); def('shin' + S, 1); def('foot' + S, 2); def('toe' + S, 1); def('fing' + S, 4); }
def('flip', 1);
export { CH, NCH };

const TAU = Math.PI * 2, clamp = (x, a, b) => (x < a ? a : x > b ? b : x), lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t), easeOut = (t) => 1 - (1 - t) * (1 - t), easeIn = (t) => t * t;
const sA = Math.sin(ARM_A), cA = Math.cos(ARM_A);
const LT = 0.435, LS = 0.415;
const HANDS = { relax: [0.35, 0.45, 0.25, 0], fist: [1.45, 1.5, 0.9, 0], grip: [1.25, 1.4, 1.0, 0], seal: [0.0, 1.5, 1.1, 1], open: [0.06, 0.1, 0.05, 0], soft: [0.2, 0.3, 0.15, 0] };

// 姿态写入助手
const W = (p, n, ...v) => { const o = CH[n]; for (let i = 0; i < v.length; i++) p[o + i] = v[i]; };
const S2 = (p, n, ...v) => { W(p, n + 'L', ...v); W(p, n + 'R', ...v); };
const ADD = (p, n, ...v) => { const o = CH[n]; for (let i = 0; i < v.length; i++) p[o + i] += v[i]; };
const HS = (p, S, k) => W(p, 'fing' + S, ...HANDS[k]);

// ---- 全身状态
function idle(p, a, an) {
  const t = a.time, br = Math.sin(t * 1.6), sw = Math.sin(t * 0.42 + an.seed) * 0.7 + Math.sin(t * 0.17 + an.seed * 2) * 0.3;
  W(p, 'root', sw * 0.018, br * 0.003, 0); W(p, 'hips', 0.02, sw * 0.03, sw * 0.035);
  W(p, 'spine', 0.03 + br * 0.008, -sw * 0.02, -sw * 0.025); W(p, 'chest', -0.03 + br * 0.018, 0, -sw * 0.01);
  W(p, 'neck', 0.05, 0, 0); W(p, 'head', 0.02, 0, sw * 0.02);
  S2(p, 'clav', 0, 0, br * 0.015);
  S2(p, 'arm', 0.05, 0.12, 0.17 + br * 0.008); S2(p, 'fore', 0.28, 0.1); S2(p, 'hand', 0.12, 0.05, 0);
  W(p, 'thighL', 0, 0, 0.035 - sw * 0.02); W(p, 'thighR', 0, 0, 0.035 + sw * 0.02);
  W(p, 'shinL', 0.04 + Math.max(0, -sw) * 0.12); W(p, 'shinR', 0.04 + Math.max(0, sw) * 0.12);
  S2(p, 'foot', 0, 0); HS(p, 'L', 'relax'); HS(p, 'R', 'relax');
  const st = a.idle || 'normal';
  if (st === 'behind') { S2(p, 'arm', 0.5, 0.75, 0.2); S2(p, 'fore', 1.5, 0.4); S2(p, 'hand', 0.2, 0, 0); W(p, 'chest', -0.08 + br * 0.018, 0, 0); HS(p, 'L', 'soft'); HS(p, 'R', 'fist'); }
  else if (st === 'clasp') { S2(p, 'arm', -0.25, 0.55, 0.22); S2(p, 'fore', 1.45, 0.4); S2(p, 'hand', 0.3, 0.2, 0); HS(p, 'L', 'soft'); HS(p, 'R', 'fist'); }
  else if (st === 'guard') { W(p, 'armR', -0.2, 0.3, 0.25); W(p, 'foreR', 1.0, 0); W(p, 'armL', 0.15, 0.6, 0.25); W(p, 'foreL', 1.3, 0.3); W(p, 'hips', 0.02, -0.15, 0); W(p, 'thighL', -0.12, 0, 0.12); W(p, 'thighR', 0.1, 0, 0.1); }
  else if (st === 'akimbo') { S2(p, 'arm', 0.15, -0.35, 0.55); S2(p, 'fore', 1.7, -0.3); S2(p, 'hand', -0.3, 0.3, 0); HS(p, 'L', 'fist'); HS(p, 'R', 'fist'); }
}
const LOCO_TMP = new Float32Array(NCH);
function loco(p, a, an) {
  idle(p, a, an);
  const sp = a.speed, w = clamp(sp / 1.6, 0, 1);
  if (w <= 0.001) return;
  const u = clamp((sp - 1.5) / 7.5, 0, 1), ph = an.phase, s = Math.sin(ph), c = Math.cos(ph);
  const q = LOCO_TMP; q.fill(0);
  const tA = lerp(0.36, 0.72, u), aA = lerp(0.32, 0.78, u) * (a.armed ? 0.8 : 1);
  W(q, 'thighL', -tA * s - 0.06 * u, 0, 0.03); W(q, 'thighR', tA * s - 0.06 * u, 0, 0.03);
  const kn = (x, y) => 0.06 + lerp(0.12, 0.3, u) * Math.max(0, Math.sin(x + 0.6)) + lerp(0.6, 1.75, u) * Math.pow(Math.max(0, Math.cos(x - 0.2)), 1.4) * (y || 1);
  W(q, 'shinL', kn(ph)); W(q, 'shinR', kn(ph + Math.PI));
  W(q, 'footL', 0.3 * u * Math.max(0, -s) - 0.18 * Math.max(0, s) * (1 - u * 0.4), 0); W(q, 'footR', 0.3 * u * Math.max(0, s) - 0.18 * Math.max(0, -s) * (1 - u * 0.4), 0);
  W(q, 'root', 0, lerp(0.018, 0.05, u) * Math.cos(2 * ph) - 0.03 * u, 0);
  W(q, 'hips', 0.04 + 0.13 * u, -s * lerp(0.13, 0.18, u), c * 0.03);
  W(q, 'spine', 0.03 + 0.1 * u, s * 0.1, -c * 0.02); W(q, 'chest', 0.02 + 0.05 * u, s * lerp(0.09, 0.14, u), 0);
  W(q, 'neck', 0.03 - 0.07 * u, -s * 0.06, 0); W(q, 'head', -0.06 * u, -s * 0.06, 0);
  S2(q, 'clav', 0, 0, 0.02 * u);
  W(q, 'armL', aA * s - 0.05 * u, 0.12, 0.15 + 0.12 * u); W(q, 'armR', -aA * s - 0.05 * u, 0.12, 0.15 + 0.12 * u);
  const eb = lerp(0.35, 1.55, u);
  W(q, 'foreL', eb + 0.2 * Math.max(0, -s) * (1 + u), 0.1); W(q, 'foreR', eb + 0.2 * Math.max(0, s) * (1 + u), 0.1);
  S2(q, 'hand', 0.1, 0.05, 0);
  const f = lerp(0.4, 1.1, u); S2(q, 'fing', f, f + 0.1, 0.3 + 0.5 * u, 0);
  for (let i = 0; i < NCH; i++) p[i] = lerp(p[i], q[i], w);
}
function air(p, a) {
  const up = clamp((a.vy || 0) / 6, -1, 1), k = (up + 1) / 2;
  W(p, 'root', 0, 0, 0); W(p, 'hips', lerp(0.0, 0.12, k), 0, 0);
  W(p, 'spine', lerp(-0.05, 0.12, k), 0, 0); W(p, 'chest', 0, 0, 0); W(p, 'neck', 0, 0, 0); W(p, 'head', lerp(0.12, -0.05, k), 0, 0);
  W(p, 'thighL', lerp(-0.45, -1.0, k), 0, 0.08); W(p, 'shinL', lerp(0.5, 1.45, k)); W(p, 'thighR', lerp(0.12, -0.2, k), 0, 0.08); W(p, 'shinR', lerp(0.75, 0.6, k));
  S2(p, 'foot', 0.3, 0); S2(p, 'clav', 0, 0, lerp(0.15, 0.05, k));
  S2(p, 'arm', lerp(-0.3, -0.45, k), 0.15, lerp(1.0, 0.65, k)); S2(p, 'fore', lerp(0.4, 0.8, k), 0); S2(p, 'hand', 0, 0, 0);
  HS(p, 'L', 'soft'); HS(p, 'R', 'soft');
}
function dash(p) {
  W(p, 'root', 0, -0.08, 0); W(p, 'hips', 0.55, 0, 0); W(p, 'spine', 0.15, 0, 0); W(p, 'chest', 0.08, 0, 0); W(p, 'neck', -0.3, 0, 0); W(p, 'head', -0.25, 0, 0);
  S2(p, 'arm', 0.95, 0.2, 0.32); S2(p, 'fore', 0.35, 0); S2(p, 'hand', -0.2, 0, 0); S2(p, 'clav', 0, 0, -0.05);
  W(p, 'thighL', -0.85, 0, 0.05); W(p, 'shinL', 1.2); W(p, 'thighR', 0.45, 0, 0.05); W(p, 'shinR', 0.9);
  S2(p, 'foot', 0.4, 0); HS(p, 'L', 'open'); HS(p, 'R', 'open');
}
function fly(p, a) {
  const t = a.time, sp = Math.min(1, (a.speed || 0) / 30), br = Math.sin(t * 1.3);
  W(p, 'root', 0, -0.05 + br * 0.008, 0); W(p, 'hips', 0.04 + sp * 0.1, 0.5, 0); W(p, 'spine', 0.04 + sp * 0.12, -0.25, 0); W(p, 'chest', -0.03, -0.22, 0);
  W(p, 'neck', -0.02, 0, 0); W(p, 'head', -0.02 - sp * 0.1, 0, 0);
  W(p, 'thighL', -0.28, -0.15, 0.1); W(p, 'shinL', 0.32); W(p, 'footL', 0.18, 0.05);
  W(p, 'thighR', 0.18, -0.2, 0.12); W(p, 'shinR', 0.42); W(p, 'footR', -0.14, 0);
  W(p, 'armR', -1.05, 0.25, 0.12); W(p, 'foreR', 1.75, 0.3); W(p, 'handR', -0.25, 0.25, 0.2); HS(p, 'R', 'seal');
  W(p, 'armL', 0.5, 0.7, 0.22 + br * 0.02); W(p, 'foreL', 1.45, 0.4); W(p, 'handL', 0.2, 0, 0); HS(p, 'L', 'fist');
  S2(p, 'clav', 0, 0, 0);
}
function glide(p, a) {
  const t = a.time, f = Math.sin(t * 3) * 0.06;
  W(p, 'root', 0, 0, 0); W(p, 'hips', 0.55, 0, 0); W(p, 'spine', 0.1, 0, 0); W(p, 'chest', -0.1, 0, 0); W(p, 'neck', -0.3, 0, 0); W(p, 'head', -0.3, 0, 0);
  S2(p, 'arm', 0.15, 0.3, 1.4 + f); S2(p, 'fore', 0.2, 0); S2(p, 'hand', 0, 0.2, 0); HS(p, 'L', 'open'); HS(p, 'R', 'open'); S2(p, 'clav', 0, 0, 0.12);
  W(p, 'thighL', 0.25, 0, 0.1); W(p, 'shinL', 0.45); W(p, 'thighR', 0.12, 0, 0.1); W(p, 'shinR', 0.3); S2(p, 'foot', 0.5, 0);
}
function meditate(p, a) {
  const br = Math.sin(a.time * 1.1);
  W(p, 'root', 0, -0.73 + br * 0.006, -0.02); W(p, 'hips', -0.05, 0, 0); W(p, 'spine', 0.04 + br * 0.01, 0, 0); W(p, 'chest', -0.02 + br * 0.02, 0, 0);
  W(p, 'neck', 0.05, 0, 0); W(p, 'head', 0.1, 0, 0);
  S2(p, 'thigh', -1.42, 0.35, 0.78); S2(p, 'shin', 2.55); S2(p, 'foot', 0.35, 0.5);
  S2(p, 'clav', 0, 0, br * 0.01);
  S2(p, 'arm', -0.42, 0.45, 0.3); S2(p, 'fore', 1.15, 0.6); S2(p, 'hand', 0.15, -0.3, 0.5);
  HS(p, 'L', 'soft'); HS(p, 'R', 'soft');
}
function swim(p, a) {
  const t = a.time, s = Math.sin(t * 2.4), c = Math.cos(t * 2.4);
  W(p, 'root', 0, 0, 0); W(p, 'hips', 0.25, 0, 0); W(p, 'spine', 0.1, 0, 0); W(p, 'chest', 0, 0, 0); W(p, 'neck', -0.2, 0, 0); W(p, 'head', -0.12, 0, 0);
  S2(p, 'arm', -0.5, 0.3, 0.75); ADD(p, 'armL', s * 0.25, 0, c * 0.2); ADD(p, 'armR', -s * 0.25, 0, -c * 0.2); S2(p, 'fore', 0.7, 0.3); S2(p, 'hand', 0, 0.3, 0); HS(p, 'L', 'open'); HS(p, 'R', 'open');
  W(p, 'thighL', -0.2 + s * 0.4, 0, 0.1); W(p, 'shinL', 0.6 + c * 0.3); W(p, 'thighR', -0.2 - s * 0.4, 0, 0.1); W(p, 'shinR', 0.6 - c * 0.3); S2(p, 'foot', 0.6, 0);
}
function dead(p) {
  W(p, 'root', 0, -0.8, -0.35); W(p, 'hips', -1.48, 0.1, 0.05); W(p, 'spine', -0.05, 0, 0); W(p, 'chest', -0.05, 0, 0); W(p, 'neck', 0, 0, 0); W(p, 'head', -0.1, 0.55, 0);
  S2(p, 'arm', -0.15, 0.1, 0.85); S2(p, 'fore', 0.35, 0); S2(p, 'hand', 0.1, 0, 0); HS(p, 'L', 'soft'); HS(p, 'R', 'soft'); S2(p, 'clav', 0, 0, 0);
  W(p, 'thighL', 0.1, 0, 0.16); W(p, 'thighR', 0.02, 0, 0.08); W(p, 'shinL', 0.1); W(p, 'shinR', 0.35); S2(p, 'foot', 0.4, 0);
}
function sit(p, a) {
  idle(p, a, { seed: 0 });
  W(p, 'root', 0, -0.5, -0.05); W(p, 'hips', -0.05, 0, 0); S2(p, 'thigh', -1.5, 0, 0.08); S2(p, 'shin', 1.5); S2(p, 'foot', 0, 0);
  S2(p, 'arm', -0.35, 0.3, 0.2); S2(p, 'fore', 0.9, 0.3);
}
const STATES = { loco, air, dash, fly, glide, meditate, swim, dead, sit };

// ---- 连招关键帧：每段 [时间, 通道表]；未列出的通道沿用底层
const K = (t, o) => ({ t, o });
const COMBOS = [
  [ // 右上斜劈
    K(0, {}),
    K(0.34, { hips: [0.05, -0.32, 0], spine: [0.06, -0.2, 0], chest: [0.02, -0.55, 0.05], head: [0, 0.35, 0], armR: [-0.85, -0.55, 1.25], foreR: [1.45, 0.2], handR: [0.1, 0.5, -0.4],
      armL: [-0.75, 0.4, 0.25], foreL: [1.55, 0.5], handL: [-0.3, 0, 0], thighL: [-0.3, 0, 0.1], shinL: [0.4], thighR: [0.28, 0, 0.1], shinR: [0.3], root: [0, -0.07, 0] }),
    K(0.6, { hips: [0.1, 0.38, 0], spine: [0.1, 0.25, 0], chest: [0.06, 0.55, -0.05], head: [0, -0.4, 0], armR: [-1.4, 0.45, -0.45], foreR: [0.12, 0.3], handR: [0, -0.45, 0.5],
      armL: [0.25, 0.4, 0.55], foreL: [0.9, 0.3], handL: [0, 0, 0], thighL: [-0.62, 0, 0.12], shinL: [0.75], thighR: [0.45, 0, 0.1], shinR: [0.2], root: [0, -0.13, 0.14] }),
    K(1, { hips: [0.06, 0.2, 0], spine: [0.06, 0.1, 0], chest: [0.03, 0.2, 0], head: [0, -0.15, 0], armR: [-0.8, 0.2, 0.25], foreR: [0.7, 0.2], handR: [0, 0, 0.2],
      armL: [0, 0.3, 0.35], foreL: [0.8, 0.3], handL: [0, 0, 0], thighL: [-0.35, 0, 0.1], shinL: [0.4], thighR: [0.25, 0, 0.1], shinR: [0.2], root: [0, -0.07, 0.06] }),
  ],
  [ // 反手上撩
    K(0, {}),
    K(0.32, { hips: [0.06, 0.35, 0], spine: [0.1, 0.2, 0], chest: [0.08, 0.5, 0], head: [0.05, -0.4, 0], armR: [-0.5, 0.9, -0.45], foreR: [1.25, 0.6], handR: [0.2, -0.3, 0.9],
      armL: [-0.3, 0.3, 0.55], foreL: [1.2, 0.3], thighL: [0.3, 0, 0.1], shinL: [0.35], thighR: [-0.35, 0, 0.12], shinR: [0.6], root: [0, -0.1, 0] }),
    K(0.62, { hips: [-0.02, -0.4, 0], spine: [-0.06, -0.25, 0], chest: [-0.08, -0.55, -0.06], head: [-0.1, 0.45, 0], armR: [-2.35, -0.3, 0.85], foreR: [0.1, 0], handR: [0, 0.55, -0.3],
      armL: [0.35, 0.5, 0.7], foreL: [0.6, 0.2], thighL: [0.45, 0, 0.1], shinL: [0.3], thighR: [-0.6, 0, 0.12], shinR: [0.7], root: [0, -0.1, 0.16] }),
    K(1, { hips: [0.02, -0.15, 0], spine: [0, -0.1, 0], chest: [0, -0.2, 0], head: [0, 0.15, 0], armR: [-1.1, 0, 0.6], foreR: [0.6, 0], handR: [0, 0.2, 0],
      armL: [0, 0.4, 0.4], foreL: [0.7, 0.2], thighL: [0.25, 0, 0.1], shinL: [0.25], thighR: [-0.3, 0, 0.1], shinR: [0.4], root: [0, -0.06, 0.08] }),
  ],
  [ // 跃起下劈
    K(0, {}),
    K(0.4, { hips: [-0.12, 0, 0], spine: [-0.22, 0, 0], chest: [-0.18, 0, 0], neck: [-0.05, 0, 0], head: [-0.1, 0, 0], armR: [-2.85, 0.1, 0.25], foreR: [0.75, 0], handR: [0.5, 0.4, 0],
      armL: [-2.6, 0.2, 0.1], foreL: [0.9, 0.3], handL: [0, 0, 0], thighL: [-1.05, 0, 0.12], shinL: [1.6], thighR: [-0.35, 0, 0.12], shinR: [1.25], root: [0, 0.12, 0], clavL: [0, 0, 0.2], clavR: [0, 0, 0.2] }),
    K(0.62, { hips: [0.42, 0, 0], spine: [0.35, 0, 0], chest: [0.15, 0, 0], neck: [-0.25, 0, 0], head: [-0.2, 0, 0], armR: [-0.55, 0.15, 0.05], foreR: [0.05, 0], handR: [-0.2, -0.3, 0],
      armL: [-0.4, 0.4, 0.15], foreL: [0.35, 0.3], handL: [0, 0, 0], thighL: [-1.15, 0, 0.12], shinL: [1.45], thighR: [0.62, 0, 0.12], shinR: [1.05], root: [0, -0.33, 0.26], clavL: [0, 0, -0.05], clavR: [0, 0, -0.05] }),
    K(1, { hips: [0.25, 0, 0], spine: [0.2, 0, 0], chest: [0.08, 0, 0], neck: [-0.1, 0, 0], head: [-0.1, 0, 0], armR: [-0.7, 0.1, 0.2], foreR: [0.4, 0], handR: [0, 0, 0],
      armL: [-0.2, 0.3, 0.3], foreL: [0.6, 0.3], handL: [0, 0, 0], thighL: [-0.7, 0, 0.1], shinL: [0.9], thighR: [0.4, 0, 0.1], shinR: [0.6], root: [0, -0.18, 0.15], clavL: [0, 0, 0], clavR: [0, 0, 0] }),
  ],
  [ // 处决：突刺
    K(0, {}),
    K(0.35, { hips: [0.05, -0.5, 0], spine: [0.05, -0.3, 0], chest: [0, -0.4, 0], head: [0, 0.6, 0], armR: [0.3, 0.3, 0.5], foreR: [1.9, 0.6], handR: [0.4, 0.3, -1.2],
      armL: [-1.3, 0.2, 0.15], foreL: [0.3, 0], handL: [-0.8, 0, 0], thighL: [-0.5, 0, 0.12], shinL: [0.8], thighR: [0.45, 0, 0.12], shinR: [0.5], root: [0, -0.15, -0.05] }),
    K(0.55, { hips: [0.3, 0.2, 0], spine: [0.2, 0.15, 0], chest: [0.1, 0.25, 0], head: [-0.15, -0.2, 0], armR: [-1.55, 0.1, 0.05], foreR: [0.0, 0.4], handR: [-0.3, 0.1, -1.4],
      armL: [0.6, 0.4, 0.4], foreL: [0.5, 0], handL: [0, 0, 0], thighL: [-1.0, 0, 0.12], shinL: [1.1], thighR: [0.75, 0, 0.12], shinR: [0.25], root: [0, -0.3, 0.4] }),
    K(1, { hips: [0.2, 0.1, 0], spine: [0.15, 0.1, 0], chest: [0.05, 0.1, 0], head: [-0.1, 0, 0], armR: [-1.0, 0.1, 0.2], foreR: [0.5, 0.2], handR: [0, 0, -0.6],
      armL: [0.2, 0.3, 0.3], foreL: [0.6, 0], handL: [0, 0, 0], thighL: [-0.7, 0, 0.1], shinL: [0.8], thighR: [0.5, 0, 0.1], shinR: [0.3], root: [0, -0.2, 0.25] }),
  ],
];
// 关键帧通道补全：未出现在第 0 帧的通道由底层取值
function evalCombo(p, base, keys, t) {
  let i = 1;
  while (i < keys.length - 1 && t > keys[i].t) i++;
  const k0 = keys[i - 1], k1 = keys[i], f = clamp((t - k0.t) / (k1.t - k0.t), 0, 1);
  const e = i === 1 ? easeIn(f) * 0.4 + ease(f) * 0.6 : i === 2 ? easeOut(easeOut(f)) : ease(f);
  const names = new Set([...Object.keys(k0.o), ...Object.keys(k1.o)]);
  for (const n of names) {
    const o = CH[n], a0 = k0.o[n], a1 = k1.o[n], len = (a1 || a0).length;
    for (let j = 0; j < len; j++) p[o + j] = lerp(a0 ? a0[j] : base[o + j], a1 ? a1[j] : base[o + j], e);
  }
}
// 把 src 按 w 混入 dst
const MIX = (dst, src, w) => { for (let i = 0; i < NCH; i++) dst[i] += (src[i] - dst[i]) * w; };
const UPPER = new Uint8Array(NCH);
for (const n of ['spine', 'chest', 'neck', 'head', 'clavL', 'clavR', 'armL', 'armR', 'foreL', 'foreR', 'handL', 'handR', 'fingL', 'fingR']) UPPER.fill(1, CH[n], CH[n] + CHN[n]);
const MIXM = (dst, src, w, mask) => { for (let i = 0; i < NCH; i++) if (mask[i]) dst[i] += (src[i] - dst[i]) * w; };

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3();
const HAX = { L: new THREE.Vector3(cA, sA, 0), R: new THREE.Vector3(cA, -sA, 0) }, DAX = { L: new THREE.Vector3(sA, -cA, 0), R: new THREE.Vector3(-sA, -cA, 0) }, ZAX = new THREE.Vector3(0, 0, 1), XAX = new THREE.Vector3(1, 0, 0);

export class Animator {
  constructor(ch) {
    this.ch = ch; this.by = ch.by;
    this.cur = new Float32Array(NCH); this.tgt = new Float32Array(NCH); this.tmp = new Float32Array(NCH); this.tmp2 = new Float32Array(NCH);
    this.w = { loco: 1 }; this.phase = Math.random() * TAU; this.seed = Math.random() * 10;
    this.hx = 0; this.hz = 0; this.hvx = 0; this.hvz = 0;
    this.lastYaw = null; this.yawRate = 0; this.lastSpeed = 0; this.accel = 0; this.lean = 0; this.bank = 0;
    this.blockW = 0; this.talkW = 0; this.castW = 0; this.first = true; this.bodyYaw = 0;
    this.saccT = 1; this.saccX = 0; this.saccY = 0;
    idle(this.cur, { time: 0 }, this);
  }
  hit(dx, dz, k) {
    // 世界方向转到角色局部：前后 -> 俯仰，左右 -> 侧倾
    const y = this.ch.group.rotation.y, lx = dx * Math.cos(y) - dz * Math.sin(y), lz = dx * Math.sin(y) + dz * Math.cos(y);
    this.hvx += -lz * 7 * k; this.hvz += -lx * 6 * k;
  }
  update(dt, a) {
    const t = a.time ?? 0, tgt = this.tgt;
    // 状态选择
    let st = 'loco';
    if (a.dead) st = 'dead';
    else if (a.meditate) st = 'meditate';
    else if (a.sit) st = 'sit';
    else if (a.dash) st = 'dash';
    else if (a.fly) st = 'fly';
    else if (a.glide) st = 'glide';
    else if (a.swim) st = 'swim';
    else if (a.air) st = 'air';
    const rate = st === 'dash' ? 30 : st === 'dead' ? 4 : st === 'meditate' || st === 'sit' ? 3.5 : 9;
    const kw = 1 - Math.exp(-dt * rate);
    for (const n in this.w) this.w[n] += ((n === st ? 1 : 0) - this.w[n]) * kw;
    if (!(st in this.w)) this.w[st] = kw;
    // 步频
    const sp = a.speed || 0;
    this.phase += dt * TAU * (0.8 + 0.155 * Math.min(sp, 10)) * (sp > 0.05 ? 1 : 0);
    // 转身倾斜与加减速前后倾
    const yaw = this.ch.group.rotation.y;
    if (this.lastYaw !== null && dt > 0) { let d = yaw - this.lastYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yawRate += (d / dt - this.yawRate) * (1 - Math.exp(-dt * 8)); }
    this.lastYaw = yaw;
    if (dt > 0) this.accel += ((sp - this.lastSpeed) / dt - this.accel) * (1 - Math.exp(-dt * 6));
    this.lastSpeed = sp;
    const kl = 1 - Math.exp(-dt * 6);
    this.lean += (clamp(this.accel * 0.018, -0.25, 0.3) - this.lean) * kl;
    this.bank += (clamp(-this.yawRate * sp * 0.012, -0.3, 0.3) - this.bank) * kl;
    // 混合全身状态
    tgt.fill(0);
    let tot = 0;
    for (const n in this.w) {
      const wn = this.w[n];
      if (wn < 0.002) continue;
      const q = this.tmp; q.fill(0);
      STATES[n](q, a, this);
      for (let i = 0; i < NCH; i++) tgt[i] += q[i] * wn;
      tot += wn;
    }
    if (tot > 0) for (let i = 0; i < NCH; i++) tgt[i] /= tot;
    const groundW = (this.w.loco || 0) + (this.w.sit || 0) * 0;
    // 转身、加速倾斜
    ADD(tgt, 'hips', this.lean * groundW, 0, this.bank * 0.6); ADD(tgt, 'spine', this.lean * 0.5 * groundW, 0, this.bank * 0.4);
    // 叠加层
    const q = this.tmp2;
    const armed = a.armed;
    if (armed && !a.dead && !a.meditate) HS(tgt, 'R', 'grip');
    if (a.attackT >= 0 && !a.dead) {
      q.set(tgt);
      const keys = COMBOS[a.combo || 0] || COMBOS[0];
      evalCombo(q, tgt, keys, clamp(a.attackT, 0, 1));
      const env = a.attackT < 0.12 ? ease(a.attackT / 0.12) : a.attackT > 0.85 ? 1 - ease((a.attackT - 0.85) / 0.15) : 1;
      // 腾空时腿部保留空中姿态
      const legW = this.w.air > 0.5 ? 0.3 : 1;
      for (let i = 0; i < NCH; i++) tgt[i] += (q[i] - tgt[i]) * env * (UPPER[i] || i < CH.spine ? 1 : legW);
      HS(tgt, 'L', a.attackT > 0.25 ? 'seal' : 'soft');
    }
    const castOn = a.cast >= 0 && !a.dead;
    this.castW += ((castOn ? 1 : 0) - this.castW) * (1 - Math.exp(-dt * 18));
    if (this.castW > 0.01) {
      q.set(tgt);
      const r = castOn ? Math.sin(Math.min(1, a.cast) * Math.PI * 0.5 + 0.2) : 1;
      W(q, 'armR', -1.5 * r - 0.1, 0.05, 0.08); W(q, 'foreR', 0.12, 0.2); W(q, 'handR', -0.65 * r, 0.1, 0.4); HS(q, 'R', 'seal');
      W(q, 'armL', -0.55, 0.65, 0.2); W(q, 'foreL', 1.85, 0.5); W(q, 'handL', -0.3, 0.2, 0.6); HS(q, 'L', 'seal');
      W(q, 'chest', 0.02, -0.4 * r, 0); W(q, 'spine', 0.06, -0.15, 0); W(q, 'head', 0, 0.45 * r, 0);
      MIXM(tgt, q, this.castW, UPPER);
      ADD(tgt, 'hips', 0, -0.2 * this.castW, 0);
    }
    this.blockW += ((a.block ? 1 : 0) - this.blockW) * (1 - Math.exp(-dt * 22));
    if (this.blockW > 0.01) {
      q.set(tgt);
      W(q, 'armR', -1.55, -0.2, 0.55); W(q, 'foreR', 1.25, 0.2); W(q, 'handR', 0.1, 0.3, -1.25);
      W(q, 'armL', -1.25, 0.3, 0.2); W(q, 'foreL', 1.55, 0.3); W(q, 'handL', -0.6, 0, 0.3); HS(q, 'L', 'open');
      W(q, 'chest', 0.04, -0.25, 0); W(q, 'spine', 0.1, -0.1, 0); W(q, 'head', 0.05, 0.25, 0);
      W(q, 'thighL', -0.32, 0, 0.12); W(q, 'thighR', 0.25, 0, 0.12); W(q, 'shinL', 0.55); W(q, 'shinR', 0.45); W(q, 'root', 0, -0.08, 0); W(q, 'hips', 0.06, 0.2, 0);
      MIX(tgt, q, this.blockW * (sp > 2 ? 0.6 : 1));
    }
    this.talkW += ((a.talk ? 1 : 0) - this.talkW) * (1 - Math.exp(-dt * 4));
    if (this.talkW > 0.01) {
      q.set(tgt);
      const s1 = Math.sin(t * 2.1 + this.seed), s2 = Math.sin(t * 1.3 + this.seed * 2), s3 = Math.sin(t * 3.3);
      W(q, 'armR', -0.55 + s1 * 0.18, 0.35, 0.25 + s2 * 0.08); W(q, 'foreR', 1.25 + s2 * 0.3, -0.2 + s3 * 0.2); W(q, 'handR', -0.1 + s3 * 0.15, 0.2, -0.6 + s1 * 0.2); HS(q, 'R', 'soft');
      if (s2 > 0.3) { W(q, 'armL', -0.3, 0.3, 0.22); W(q, 'foreL', 1.0 + s1 * 0.2, -0.3); W(q, 'handL', 0, 0.2, -0.5); HS(q, 'L', 'open'); }
      ADD(q, 'head', Math.sin(t * 2.6) * 0.05, s2 * 0.06, 0); ADD(q, 'chest', 0, s1 * 0.05, 0);
      MIXM(tgt, q, this.talkW, UPPER);
    }
    if (a.work === 'hammer' && a.workT >= 0) {
      const wt = a.workT, up = wt < 0.55 ? ease(wt / 0.55) : 1 - easeIn((wt - 0.55) / 0.45);
      q.set(tgt);
      W(q, 'armR', -0.6 - up * 1.9, 0.1, 0.25); W(q, 'foreR', 0.4 + up * 1.2, 0); W(q, 'handR', 0.1 - up * 0.5, 0, 0); HS(q, 'R', 'fist');
      W(q, 'armL', -0.7, 0.3, 0.2); W(q, 'foreL', 0.9, 0.3); HS(q, 'L', 'fist');
      W(q, 'spine', 0.15 - up * 0.15, 0.1, 0); W(q, 'chest', 0.05 - up * 0.1, -0.15 * up, 0); W(q, 'head', 0.3, 0, 0);
      MIX(tgt, q, 1);
    }
    // 垂钓：双手持竿；workT < 0 为抛竿后摆，> 0 为提竿
    if (a.work === 'fish') {
      const wt = a.workT || 0, back = Math.max(0, -wt), lift = Math.max(0, wt), br = Math.sin(t * 1.3 + this.seed) * 0.03;
      q.set(tgt);
      W(q, 'armR', -0.75 - lift * 0.55 - back * 1.5 + br, 0.25, 0.22); W(q, 'foreR', 0.75 + back * 0.6, 0.15); W(q, 'handR', 0.35 - lift * 0.2 + back * 0.5, 0, -0.35); HS(q, 'R', 'fist');
      W(q, 'armL', -0.55 - lift * 0.3, -0.25, 0.12); W(q, 'foreL', 1.35, 0.4); W(q, 'handL', 0.1, 0, 0.3); HS(q, 'L', 'fist');
      W(q, 'spine', 0.04 - lift * 0.1 - back * 0.12, 0.12, 0); W(q, 'chest', 0.02, 0.05 - back * 0.25, 0); W(q, 'head', 0.22, -0.1, 0);
      MIXM(tgt, q, 1, UPPER);
    }
    // 弯腰种植 / 收获
    if (a.work === 'plant') {
      const s1 = Math.sin(t * 4.2), s2 = Math.sin(t * 2.1);
      q.set(tgt);
      W(q, 'spine', 0.5, 0, 0); W(q, 'chest', 0.35, 0.1 * s2, 0); W(q, 'neck', 0.15, 0, 0); W(q, 'head', 0.15, 0, 0);
      W(q, 'armR', -1.0 + s1 * 0.15, 0.1, 0.15); W(q, 'foreR', 0.35 + s1 * 0.2, 0); W(q, 'handR', 0.3, 0, -0.2); HS(q, 'R', 'soft');
      W(q, 'armL', -0.75 - s1 * 0.12, 0.2, 0.2); W(q, 'foreL', 0.5, 0.2); HS(q, 'L', 'open');
      W(q, 'hips', 0.25, 0, 0); W(q, 'thighL', -0.75, 0, 0.12); W(q, 'thighR', -0.45, 0, 0.12); W(q, 'shinL', 1.05); W(q, 'shinR', 0.75);
      MIX(tgt, q, 1);
    }
    // 受击弹簧
    this.hvx += (-this.hx * 160 - this.hvx * 14) * dt; this.hvz += (-this.hz * 160 - this.hvz * 14) * dt;
    this.hx += this.hvx * dt; this.hz += this.hvz * dt;
    if (Math.abs(this.hx) + Math.abs(this.hz) > 1e-4) {
      ADD(tgt, 'spine', this.hx * 0.6, 0, this.hz * 0.5); ADD(tgt, 'chest', this.hx * 0.5, 0, this.hz * 0.4); ADD(tgt, 'neck', this.hx * 0.6, 0, this.hz * 0.3); ADD(tgt, 'head', this.hx * 0.5, 0, 0);
      S2(tgt, 'clav', 0, 0, 0); ADD(tgt, 'armL', -this.hx * 0.6, 0, Math.abs(this.hx) * 0.8); ADD(tgt, 'armR', -this.hx * 0.6, 0, Math.abs(this.hx) * 0.8);
      ADD(tgt, 'root', 0, -Math.abs(this.hx) * 0.08, this.hx * 0.1);
    }
    // 空翻
    tgt[CH.flip] = a.flip >= 0 ? ease(Math.min(1, a.flip)) * TAU : 0;
    if (a.flip >= 0) { const f = Math.sin(Math.min(1, a.flip) * Math.PI); S2(tgt, 'thigh', -1.5 * f - 0.2, 0, 0.1); S2(tgt, 'shin', 2.1 * f + 0.3); S2(tgt, 'arm', -0.6 * f, 0.2, 0.5); }
    // 脚着地：按支撑腿竖直长度把髋部压低
    const gw = (this.w.loco || 0) * (a.attackT >= 0 && a.combo === 2 && a.attackT < 0.5 ? 0 : 1) * (a.flip >= 0 ? 0 : 1);
    if (gw > 0.01) {
      const ext = (S) => { const th = tgt[CH['thigh' + S]] + tgt[CH.hips], kn = tgt[CH['shin' + S]]; return LT * Math.cos(th) + LS * Math.cos(th + kn); };
      const drop = LT + LS - Math.max(ext('L'), ext('R'));
      tgt[CH.root + 1] -= drop * gw;
    }
    // 平滑
    const cur = this.cur;
    if (this.first) { cur.set(tgt); this.first = false; }
    const ks = 1 - Math.exp(-dt * (a.attackT >= 0 || a.dash || this.blockW > 0.5 ? 34 : 22));
    for (let i = 0; i < NCH; i++) cur[i] += (tgt[i] - cur[i]) * ks;
    if (a.flip >= 0 || tgt[CH.flip] === 0) cur[CH.flip] = tgt[CH.flip];
    this.bodyYaw = cur[CH.hips + 1] + cur[CH.spine + 1] + cur[CH.chest + 1];
    // 眼球微动
    this.saccT -= dt;
    if (this.saccT <= 0) { this.saccT = 0.6 + Math.random() * 2.2; this.saccX = (Math.random() - 0.5) * 0.25; this.saccY = (Math.random() - 0.5) * 0.12; }
    this.apply(cur);
  }
  apply(p) {
    const by = this.by;
    const E = (b, o, order = 'YXZ') => { by[b].quaternion.setFromEuler(_e.set(p[o], p[o + 1], p[o + 2], order)); };
    by.hips.position.set(p[CH.root], 0.98 + p[CH.root + 1], p[CH.root + 2]);
    E('hips', CH.hips);
    if (p[CH.flip]) { _q.setFromAxisAngle(XAX, p[CH.flip]); by.hips.quaternion.premultiply(_q); }
    E('spine', CH.spine); E('chest', CH.chest); E('neck', CH.neck); E('head', CH.head);
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      let o = CH['clav' + S]; by['clav' + S].quaternion.setFromEuler(_e.set(p[o], s * p[o + 1], s * p[o + 2], 'XYZ'));
      o = CH['arm' + S]; by['arm' + S].quaternion.setFromEuler(_e.set(p[o], s * p[o + 1], s * (p[o + 2] - ARM_A), 'XYZ'));
      o = CH['fore' + S]; _q.setFromAxisAngle(HAX[S], -p[o]); _q2.setFromAxisAngle(DAX[S], s * p[o + 1]); by['fore' + S].quaternion.multiplyQuaternions(_q, _q2);
      o = CH['hand' + S];
      _q.setFromAxisAngle(ZAX, -s * p[o]); _q2.setFromAxisAngle(HAX[S], -p[o + 1]); _q.multiply(_q2); _q2.setFromAxisAngle(DAX[S], s * p[o + 2]); by['hand' + S].quaternion.multiplyQuaternions(_q, _q2);
      o = CH['thigh' + S]; by['thigh' + S].quaternion.setFromEuler(_e.set(p[o], s * p[o + 1], s * p[o + 2], 'XYZ'));
      by['shin' + S].quaternion.setFromAxisAngle(XAX, p[CH['shin' + S]]);
      o = CH['foot' + S]; by['foot' + S].quaternion.setFromEuler(_e.set(p[o], 0, s * p[o + 1], 'XYZ'));
      by['toe' + S].quaternion.setFromAxisAngle(XAX, p[CH['toe' + S]]);
      o = CH['fing' + S];
      const c1 = p[o], c2 = p[o + 1], th = p[o + 2];
      for (const [n, c] of [['idx', c1], ['mid', c1 * 0.95 + c2 * 0.05], ['rng', c2], ['pnk', c2 * 1.05]]) {
        by[n + S + '0'].quaternion.setFromAxisAngle(ZAX, -s * c * 0.75);
        by[n + S + '1'].quaternion.setFromAxisAngle(ZAX, -s * c * 1.0);
      }
      _ax.set(DAX[S].x, DAX[S].y, 0.6).normalize();
      by['thb' + S + '0'].quaternion.setFromAxisAngle(_ax, s * th * 0.7);
      by['thb' + S + '1'].quaternion.setFromAxisAngle(ZAX, -s * th * 0.6);
    }
  }
}
