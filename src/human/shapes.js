// 人物造型池：同一造型只构建一次；优先交给 Worker 并行构建，失败时回退到主线程
import * as THREE from 'three';
import { buildShape, shapeKey, faceParams } from './build.js';
import { rigSpec } from './rig.js';
import WORKER_SRC from '../../build/hworker.wjs';

const pool = new Map();
let workers = null, nextId = 1, rr = 0;
const pending = new Map();
function getWorkers() {
  if (workers !== null) return workers;
  workers = [];
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2));
    for (let i = 0; i < n; i++) {
      const w = new Worker(url);
      w.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); if (e.data.err) p.fail(e.data.err); else p.done(e.data); };
      w.onerror = () => { for (const [id, p] of pending) { if (p.w === w) { pending.delete(id); p.fail('worker error'); } } };
      workers.push(w);
    }
  } catch (e) { workers = []; }
  return workers;
}
const unpack = (d) => {
  if (!d) return null;
  const g = new THREE.BufferGeometry();
  for (const k in d.attrs) g.setAttribute(k, new THREE.BufferAttribute(d.attrs[k].a, d.attrs[k].n));
  g.setIndex(new THREE.BufferAttribute(d.idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.2, -0.6, -1.2), new THREE.Vector3(1.2, 2.4, 1.2));
  return g;
};
export function shapeLook(look) {
  return { sex: look.sex, age: look.age, outfit: look.outfit, hair: look.hair, beard: look.beard, hat: look.hat, build: look.build, crown: look.crown, acc: look.acc };
}
// 返回 { spec, F, key, geo, hair, ready(Promise) }；geo 在 ready 之后才可用
export function getShape(look, sync = false) {
  const sl = shapeLook(look), key = shapeKey(sl);
  let s = pool.get(key);
  if (s) { if (sync && !s.geo) fill(s, buildShape(sl)); return s; }
  const F = faceParams(sl);
  s = { key, spec: rigSpec({ sex: sl.sex, hs: F.hs }), F, geo: null, hair: null, ready: null };
  pool.set(key, s);
  const W = sync ? [] : getWorkers();
  if (!W.length) { fill(s, buildShape(sl)); s.ready = Promise.resolve(s); return s; }
  s.ready = new Promise((res) => {
    const id = nextId++, w = W[rr++ % W.length];
    pending.set(id, {
      w,
      done: (d) => { if (!s.geo) { s.geo = unpack(d.geo); s.hair = unpack(d.hair); } res(s); },
      fail: (err) => { console.warn('人物造型 Worker 失败，改为主线程构建', err); if (!s.geo) fill(s, buildShape(sl)); res(s); },
    });
    w.postMessage({ id, look: sl });
  });
  return s;
}
function fill(s, r) { s.geo = r.geo; s.hair = r.hair; }
// 预热：提前排队一批造型
export function preloadShapes(looks) { return Promise.all(looks.map((l) => getShape(l).ready)); }
