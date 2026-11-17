// 角色：蒙皮网格 + 骨骼 + 次级物理（头发、袖袋、下摆、垂绦）+ 眨眼与注视
import * as THREE from 'three';
import { makeSkeleton, handPoint, ARM_A, SKIRT_N } from './rig.js';
import { getShape } from './shapes.js';
import { makeHumanMaterial, setHumanColors } from './material.js';
import { Animator } from './anim.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const IDENT = new THREE.Matrix4();

// 链参数：stiff 回弹（每 1/60 秒向静止形状靠拢的比例），damp 速度保留，grav 重力，drag 风阻，coll 碰撞体组
const CHAIN_DEF = [
  ...Array.from({ length: SKIRT_N }, (_, k) => ({ pre: 'sk' + k + '_', n: 3, stiff: 0.2, damp: 0.86, grav: 5, drag: 0.5, coll: 'legs', skirt: true })),
  { pre: 'slvL', n: 2, stiff: 0.16, damp: 0.88, grav: 7, drag: 0.6, coll: 'none' },
  { pre: 'slvR', n: 2, stiff: 0.16, damp: 0.88, grav: 7, drag: 0.6, coll: 'none' },
  { pre: 'hb', n: 4, stiff: 0.1, damp: 0.9, grav: 7, drag: 0.7, coll: 'hair' },
  { pre: 'rib', n: 3, stiff: 0.08, damp: 0.9, grav: 6, drag: 0.8, coll: 'hair' },
  { pre: 'lockL', n: 3, stiff: 0.22, damp: 0.86, grav: 5, drag: 0.5, coll: 'head' },
  { pre: 'lockR', n: 3, stiff: 0.22, damp: 0.86, grav: 5, drag: 0.5, coll: 'head' },
  { pre: 'sashL', n: 3, stiff: 0.12, damp: 0.88, grav: 7, drag: 0.7, coll: 'legs' },
  { pre: 'sashR', n: 3, stiff: 0.12, damp: 0.88, grav: 7, drag: 0.7, coll: 'legs' },
  { pre: 'tas', n: 2, stiff: 0.1, damp: 0.86, grav: 8, drag: 0.3, coll: 'none' },
  { pre: 'pend', n: 2, stiff: 0.12, damp: 0.85, grav: 8, drag: 0.2, coll: 'legs' },
];

export class Character {
  // look：{ sex, age, outfit, hair, beard, hat, build, crown, acc, scale, col:{...}, idle }；opts：{ shadow, physics, shared }
  constructor(look, mats, opts = {}) {
    this.look = look; this.mats = mats;
    const shape = getShape(look, opts.sync);
    this.shape = shape;
    const spec = (this.spec = shape.spec);
    const sk = makeSkeleton(spec);
    this.bones = sk.bones; this.by = sk.by;
    const sc = look.scale || 1;
    this.scale = sc;
    this.group = new THREE.Group(); this.group.rotation.order = 'YXZ';
    this.root = new THREE.Group(); this.root.scale.setScalar(sc);
    this.group.add(this.root); this.root.add(sk.root);
    this.skeleton = new THREE.Skeleton(this.bones, spec.B.map((b) => new THREE.Matrix4().makeTranslation(-b.p[0], -b.p[1], -b.p[2])));
    this.mat = makeHumanMaterial(mats.shared, look, shape.F, spec);
    this.hairMat = makeHumanMaterial(mats.shared, look, shape.F, spec, true);
    this.shadow = opts.shadow !== false;
    this.mesh = null; this.hairMesh = null;
    this.physics = opts.physics !== false;
    this.height = 1.8 * sc; this.radius = 0.4;
    // 武器与挂点
    this.hand = this._grip(-1); this.handL = this._grip(1);
    this.back = new THREE.Object3D(); this.back.position.set(0, 0.12, -0.17); this.back.rotation.z = 2.5; this.by.chest.add(this.back);
    this.head = this.by.head; this.upper = this.by.chest; this.body = this.by.hips;
    this.anim = new Animator(this);
    this.chains = CHAIN_DEF.filter((d) => this.by[d.pre + '0']).map((d) => ({
      ...d, bones: Array.from({ length: d.n }, (_, i) => this.by[d.pre + i]).map((b) => {
        const sb = spec.map.get(b.name), t = new THREE.Vector3(sb.tail[0] - sb.p[0], sb.tail[1] - sb.p[1], sb.tail[2] - sb.p[2]);
        return { b, tail: t, len: t.length(), dir: t.clone().normalize(), x: new THREE.Vector3(), xp: new THREE.Vector3() };
      }),
    }));
    this.physReset = true; this.lastPos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.wind = new THREE.Vector3();
    this.blinkT = 1 + Math.random() * 3; this.blink = 0; this.eyeClose = 0; this.flash = 0;
    this.lookTarget = null; this.lookW = 0; this.lookYaw = 0; this.lookPitch = 0;
    this.lod = 0; this._acc = 0;
    this.colls = { caps: [], sph: [] };
    if (shape.geo) this._attach(); else shape.ready.then(() => this._attach());
  }
  get ready() { return !!this.mesh; }
  _grip(s) {
    const S = s > 0 ? 'L' : 'R', hb = this.spec.map.get('hand' + S), p = handPoint([-0.012, -0.07, 0.004], s, hb.p);
    const g = new THREE.Object3D();
    g.position.set(p[0] - hb.p[0], p[1] - hb.p[1], p[2] - hb.p[2]);
    // 手部标准坐标：手指 -y，拇指 +z；剑身 +y 对齐拇指方向、剑刃宽向对齐手指
    const base = new THREE.Matrix4().makeRotationZ(s * ARM_A).multiply(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
    g.quaternion.setFromRotationMatrix(base);
    this.by['hand' + S].add(g);
    return g;
  }
  _attach() {
    if (this.mesh) return;
    const sh = this.shape;
    const mk = (geo, mat) => {
      const m = new THREE.SkinnedMesh(geo, mat);
      m.bind(this.skeleton, IDENT);
      m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.7);
      m.boundingBox = geo.boundingBox;
      m.castShadow = this.shadow; m.receiveShadow = true;
      m.frustumCulled = true;
      this.root.add(m);
      return m;
    };
    this.mesh = mk(sh.geo, this.mat);
    if (sh.hair) this.hairMesh = mk(sh.hair, this.hairMat);
    if (this._pendingMat) this.setMaterial(this._pendingMat);
  }
  setShadow(on) { this.shadow = on; if (this.mesh) this.mesh.castShadow = on; if (this.hairMesh) this.hairMesh.castShadow = on; }
  // 整体替换材质（残魂、残影）；null 恢复
  setMaterial(m) {
    this._pendingMat = m;
    if (!this.mesh) return;
    this.mesh.material = m || this.mat;
    if (this.hairMesh) this.hairMesh.material = m || this.hairMat;
  }
  setColors(c) { setHumanColors(this.mat, c); setHumanColors(this.hairMat, c); }
  hit(dx, dz, k = 1) { this.anim.hit(dx, dz, k); this.flash = Math.max(this.flash, 0.5 * k); }
  // 冻结当前姿态的残影（独立骨骼，不再随角色动）
  ghost(mat) {
    const g = new THREE.Group();
    this.group.updateMatrixWorld(true);
    this.root.matrixWorld.decompose(g.position, g.quaternion, g.scale);
    if (!this.mesh) return g;
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const bones = this.bones.map((b) => { const o = new THREE.Bone(); o.matrixAutoUpdate = false; o.matrix.multiplyMatrices(inv, b.matrixWorld); g.add(o); return o; });
    const skel = new THREE.Skeleton(bones, this.skeleton.boneInverses);
    for (const geo of [this.shape.geo, this.shape.hair]) {
      if (!geo) continue;
      const m = new THREE.SkinnedMesh(geo, mat);
      m.bind(skel, IDENT);
      m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.7);
      g.add(m);
    }
    for (const o of this.weapons || []) if (o.visible) { o.updateMatrixWorld(true); const c = o.clone(true); c.matrixAutoUpdate = false; c.matrix.multiplyMatrices(inv, o.matrixWorld); g.add(c); }
    return g;
  }

  // a：动画状态（见 anim.js）；dist：到镜头距离，用于降频
  update(dt, a, dist = 0) {
    this.lod = dist > 60 ? 2 : dist > 26 ? 1 : 0;
    if (this.lod === 2) { this._acc += dt; if (this._acc < 0.1) return; dt = this._acc; }
    this._acc = 0;
    this.anim.update(dt, a);
    this._face(dt, a);
    this.group.updateMatrixWorld(true);
    // 角色速度（世界）用于风阻
    const gp = _v.setFromMatrixPosition(this.root.matrixWorld);
    if (dt > 0) {
      const jump = gp.distanceToSquared(this.lastPos);
      if (jump > 9) this.physReset = true;
      else this.vel.subVectors(gp, this.lastPos).divideScalar(Math.max(dt, 1e-3));
    }
    this.lastPos.copy(gp);
    if (this.physics && this.lod === 0) this._phys(dt, a);
    else if (!this._restChains) { for (const c of this.chains) for (const j of c.bones) j.b.quaternion.identity(); this.physReset = true; this._restChains = true; this.group.updateMatrixWorld(true); }
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 3); }
    this.mat.userData.u.uFlash.value = this.flash * this.flash;
  }
  _face(dt, a) {
    const by = this.by;
    // 眨眼
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 1.8 + Math.random() * 3.5; if (Math.random() < 0.15) this.blinkT = 0.25; }
    let close = 0;
    if (this.blink > 0) { this.blink -= dt / 0.16; close = Math.sin(Math.max(0, this.blink) * Math.PI); }
    const shut = a.meditate || a.dead ? 1 : a.squint || 0;
    this.eyeClose += (shut - this.eyeClose) * (1 - Math.exp(-dt * 4));
    close = Math.max(close, this.eyeClose);
    // 注视：头与眼转向目标
    let yaw = 0, pitch = 0, want = 0;
    if (this.lookTarget && !a.dead && !a.meditate && (a.attackT ?? -1) < 0) {
      const hp = _w.setFromMatrixPosition(by.neck.matrixWorld);
      _u.copy(this.lookTarget).sub(hp);
      const gy = this.group.rotation.y + (this.anim.bodyYaw || 0);
      const lx = _u.x * Math.cos(gy) - _u.z * Math.sin(gy), lz = _u.x * Math.sin(gy) + _u.z * Math.cos(gy);
      yaw = Math.atan2(lx, lz); pitch = -Math.atan2(_u.y, Math.hypot(lx, lz));
      if (Math.abs(yaw) < 1.9) want = 1;
      yaw = Math.max(-1.1, Math.min(1.1, yaw)); pitch = Math.max(-0.5, Math.min(0.5, pitch));
    }
    const k = 1 - Math.exp(-dt * 5);
    this.lookW += (want - this.lookW) * k;
    this.lookYaw += (yaw - this.lookYaw) * k; this.lookPitch += (pitch - this.lookPitch) * k;
    const w = this.lookW;
    if (w > 0.01) {
      _q.setFromEuler(new THREE.Euler(this.lookPitch * 0.35 * w, this.lookYaw * 0.35 * w, 0, 'YXZ')); by.neck.quaternion.multiply(_q);
      _q.setFromEuler(new THREE.Euler(this.lookPitch * 0.45 * w, this.lookYaw * 0.5 * w, 0, 'YXZ')); by.head.quaternion.multiply(_q);
    }
    const ey = Math.max(-0.35, Math.min(0.35, this.lookYaw * 0.3 * w + (this.anim.saccX || 0))), ep = Math.max(-0.25, Math.min(0.25, this.lookPitch * 0.2 * w + (this.anim.saccY || 0)));
    for (const S of ['L', 'R']) {
      by['eye' + S].rotation.set(ep, ey, 0);
      by['lid' + S].rotation.set(-0.62 * (1 - close) + ep * 0.6 * (1 - close), 0, 0);
    }
  }
  _colliders() {
    const by = this.by, C = this.colls, s = this.scale;
    if (!C.pts) C.pts = Array.from({ length: 10 }, () => new THREE.Vector3());
    const p = C.pts, P = (i, b, x = 0, y = 0, z = 0) => p[i].set(x, y, z).applyMatrix4(b.matrixWorld);
    P(0, by.thighL); P(1, by.shinL); P(2, by.footL); P(3, by.thighR); P(4, by.shinR); P(5, by.footR);
    P(6, by.hips, 0, -0.02, 0); P(7, by.head, 0, 0.11, 0); P(8, by.spine); P(9, by.neck);
    C.caps = [[p[0], p[1], 0.095 * s, 'legs'], [p[1], p[2], 0.07 * s, 'legs'], [p[3], p[4], 0.095 * s, 'legs'], [p[4], p[5], 0.07 * s, 'legs'], [p[8], p[9], 0.14 * s, 'hair']];
    C.sph = [[p[6], 0.15 * s, 'legs'], [p[7], 0.098 * s * this.shape.F.hs, 'hair head']];
  }
  _phys(dt, a) {
    this._restChains = false;
    this._colliders();
    const steps = dt > 1 / 45 ? 2 : 1, h = Math.min(dt, 1 / 20) / steps, h2 = h * h, r60 = h * 60;
    const wind = this.wind, vel = this.vel, C = this.colls;
    const vs = Math.min(1, 30 / Math.max(1, vel.length()));
    for (let st = 0; st < steps; st++) {
      for (const c of this.chains) {
        const stiff = 1 - Math.pow(1 - c.stiff, r60), damp = Math.pow(c.damp, r60);
        for (const j of c.bones) {
          const b = j.b;
          b.quaternion.identity(); b.updateMatrix(); b.matrixWorld.multiplyMatrices(b.parent.matrixWorld, b.matrix);
          const head = _v.setFromMatrixPosition(b.matrixWorld);
          const rest = _w.copy(j.tail).applyMatrix4(b.matrixWorld);
          if (this.physReset) { j.x.copy(rest); j.xp.copy(rest); }
          const x = j.x;
          _u.subVectors(x, j.xp).multiplyScalar(damp);
          j.xp.copy(x);
          x.add(_u);
          x.y -= c.grav * h2;
          x.x += (wind.x - vel.x * vs) * c.drag * h2 * 3; x.y += (wind.y - vel.y * vs) * c.drag * h2 * 3; x.z += (wind.z - vel.z * vs) * c.drag * h2 * 3;
          x.lerp(rest, stiff);
          if (c.coll !== 'none') this._collide(x, c.coll, C);
          _u.subVectors(x, head);
          const L = _u.length();
          const len = j.len * this.scale;
          if (L < 1e-6) { x.copy(rest); continue; }
          x.copy(head).addScaledVector(_u, len / L);
          _m.copy(b.matrixWorld).invert();
          _u.copy(x).applyMatrix4(_m).normalize();
          b.quaternion.setFromUnitVectors(j.dir, _u);
          b.updateMatrix(); b.matrixWorld.multiplyMatrices(b.parent.matrixWorld, b.matrix);
        }
      }
      this.physReset = false;
    }
    for (const c of this.chains) for (const j of c.bones) for (const ch of j.b.children) ch.updateMatrixWorld(true);
  }
  _collide(x, tag, C) {
    for (const [p, r, t] of C.sph) {
      if (!t.includes(tag)) continue;
      _u.subVectors(x, p); const d = _u.length();
      if (d < r && d > 1e-6) x.copy(p).addScaledVector(_u, r / d);
    }
    for (const [a, b, r, t] of C.caps) {
      if (t !== tag) continue;
      const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z, L2 = bx * bx + by * by + bz * bz;
      let k = ((x.x - a.x) * bx + (x.y - a.y) * by + (x.z - a.z) * bz) / (L2 || 1); k = k < 0 ? 0 : k > 1 ? 1 : k;
      const cx = a.x + bx * k, cy = a.y + by * k, cz = a.z + bz * k, dx = x.x - cx, dy = x.y - cy, dz = x.z - cz, d = Math.hypot(dx, dy, dz);
      if (d < r && d > 1e-6) { const f = r / d; x.set(cx + dx * f, cy + dy * f, cz + dz * f); }
    }
  }
  dispose() { this.mat.dispose(); this.hairMat.dispose(); }
}
