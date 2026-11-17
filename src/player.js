// 输入、碰撞体移动、玩家控制与第三人称相机
import * as THREE from 'three';
import { WATER_SURF } from './layout.js';
import { clamp } from './noise.js';
import { makeSword } from './entities.js';
import { Character } from './human/character.js';
import { shapeLook } from './human/shapes.js';
import { shapeKey } from './human/build.js';
import { HCOL } from './human/material.js';

// 开局捏人选项
export const CREATOR = {
  sex: [['m', '男修'], ['f', '女修']],
  hair: { m: [['bun', '束发冠'], ['pony', '高马尾'], ['loose', '披发'], ['crop', '短发']], f: [['long', '垂云髻'], ['pony', '高马尾'], ['twin', '双丫髻'], ['loose', '披发'], ['bun', '束发冠']] },
  outfit: [['robe', '广袖道袍'], ['dress', '曳地长裙'], ['tunic', '束袖短打']],
  pal: [
    ['月白 · 青锋', { robe: 0xeef2f6, trim: 0x4a9ad8, sash: 0x2a5a8a, pants: 0xdfe6ee, boots: 0x2a3848, inner: 0xf4f0e8 }],
    ['墨玄 · 金纹', { robe: 0x24262e, trim: 0xd8b060, sash: 0x6a4a20, pants: 0x2a2a30, boots: 0x141418, inner: 0xe8e0d0 }],
    ['绯红 · 流云', { robe: 0xb8302a, trim: 0xf0d090, sash: 0x5a1410, pants: 0xe8d8c8, boots: 0x3a1810, inner: 0xf8ecd8 }],
    ['竹青 · 素纱', { robe: 0x5a8a6a, trim: 0xe8f0e0, sash: 0x2a4a3a, pants: 0xdfe8dc, boots: 0x2a3428, inner: 0xf0f4ea }],
    ['紫霞 · 烟罗', { robe: 0x7a5aa8, trim: 0xf0e0ff, sash: 0x3a2a5a, pants: 0xe8e0f0, boots: 0x2a2038, inner: 0xf4eefa }],
    ['霜雪 · 银边', { robe: 0xf8f8fa, trim: 0xa8b0c0, sash: 0x5a6070, pants: 0xf0f0f4, boots: 0x4a4a58, inner: 0xffffff }],
  ],
  hairCol: [['乌黑', 0x15141a], ['墨褐', 0x3a2418], ['银白', 0xd8dae0], ['赤红', 0x6a1a14]],
  skin: [['白皙', 0xf6dcc8], ['自然', 0xf0d0b0], ['健康', 0xd8a878]],
};
export const DEFAULT_SEL = { sex: 'm', hair: 'bun', outfit: 'robe', pal: 0, hairCol: 0, skin: 1 };
export function lookFromSel(s) {
  const C = CREATOR, hairOk = C.hair[s.sex].some((h) => h[0] === s.hair);
  return { sex: s.sex, hair: hairOk ? s.hair : C.hair[s.sex][0][0], outfit: s.outfit, sel: { ...s }, col: { ...C.pal[s.pal][1], hair: C.hairCol[s.hairCol][1], skin: C.skin[s.skin][1] } };
}
export const PLAYER_LOOKS = {
  m: { sex: 'm', hair: 'bun', outfit: 'robe', col: { skin: 0xf2d4b8, hair: 0x15141a, robe: 0xeef2f6, trim: 0x4a9ad8, sash: 0x2a5a8a, pants: 0xdfe6ee, boots: 0x2a3848, inner: 0xf4f0e8 } },
  f: { sex: 'f', hair: 'long', outfit: 'dress', col: { skin: 0xf6dcc8, hair: 0x16121a, robe: 0xf2eef4, trim: 0x5a9ae0, sash: 0x2a4a8a, pants: 0xf0f0f4, boots: 0x3a4058, inner: 0xf6f2ee } },
};
import { Ribbon, Trail, Ghosts, runeDisc } from './fx.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set(); this.pressed = new Set();
    this.mdx = 0; this.mdy = 0; this.wheel = 0;
    this.mouse = [false, false, false]; this.clicked = [false, false, false];
    this.locked = false; this.active = false; // active: 游戏接收操作（无菜单遮挡）
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.fill(false); });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse[e.button] = true;
      if (!this.active) return;
      if (!this.locked && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* 忽略 */ } }
      this.clicked[e.button] = true;
    });
    addEventListener('mouseup', (e) => { this.mouse[e.button] = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.active) return;
      if (this.locked || this.mouse[0] || this.mouse[2]) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; }
    });
    canvas.addEventListener('wheel', (e) => { if (this.active) this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
  }
  down(c) { return this.active && this.keys.has(c); }
  hit(c) { return this.pressed.has(c); }
  release() { if (this.locked && document.exitPointerLock) document.exitPointerLock(); }
  endFrame() { this.pressed.clear(); this.mdx = this.mdy = this.wheel = 0; this.clicked.fill(false); }
}

// b: { x, y, z, vy, hw, hh, onGround }；stepMax 为贴地时可自动迈上的高度；climb 为真（游泳）时离地也可迈上
export function moveBody(world, b, dx, dy, dz, stepMax, climb = false) {
  b.hitWall = false; b.stepped = 0;
  if (dy > 0) {
    b.onGround = false;
    const n = Math.max(1, Math.ceil(dy / 0.4)), s = dy / n;
    for (let i = 0; i < n; i++) { if (world.boxFree(b.x, b.y + s, b.z, b.hw, b.hh)) b.y += s; else { b.vy = 0; break; } }
  } else if (dy < 0) {
    const f = world.floorAt(b.x, b.z, b.hw, b.y + 0.05);
    if (b.y + dy <= f) { b.y = f; b.onGround = true; b.vy = 0; } else { b.y += dy; b.onGround = false; }
  }
  const m = Math.max(Math.abs(dx), Math.abs(dz));
  if (m === 0) return;
  const n = Math.max(1, Math.ceil(m / 0.2)), sx = dx / n, sz = dz / n;
  const tryMove = (ax, az) => {
    const nx = b.x + ax, nz = b.z + az, up = b.onGround || climb ? stepMax : 0.35, g = world.groundY(nx, nz);
    if (g > b.y + up) return false;
    // 过陡的山坡走不上去
    if (b.onGround && !climb && g > b.y + 0.02 && g - world.groundY(b.x, b.z) > Math.hypot(ax, az) * 1.7) return false;
    const f = world.floorAt(nx, nz, b.hw, b.y + up);
    let ty = f > b.y ? f : b.y;
    if (!world.boxFree(nx, ty, nz, b.hw, b.hh)) {
      if (ty === b.y || g > b.y || !world.boxFree(nx, b.y, nz, b.hw, b.hh)) return false;
      ty = b.y;
    }
    const d = ty - b.y;
    b.x = nx; b.z = nz;
    if (d > 0) {
      b.y = ty;
      if (d > 0.12) b.stepped += d;
      if (b.vy <= 0 || climb) { b.onGround = true; if (b.vy < 0) b.vy = 0; }
    } else if (b.onGround && !climb) {
      // 贴地下坡、下台阶
      const fl = world.floorAt(nx, nz, b.hw, b.y + 0.05), drop = b.y - fl;
      if (drop < 0.6) { if (drop > 0.12) b.stepped -= drop; b.y = fl; } else b.onGround = false;
    }
    return true;
  };
  for (let i = 0; i < n; i++) {
    if (sx !== 0 && !tryMove(sx, 0)) b.hitWall = true;
    if (sz !== 0 && !tryMove(0, sz)) b.hitWall = true;
  }
}

const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const turnTo = (cur, target, k) => cur + angDiff(target, cur) * k;

export class Player {
  constructor(scene, mats, look = PLAYER_LOOKS.m) {
    this.scene = scene;
    this.b = { x: 0, y: 2, z: 30, vy: 0, hw: 0.3, hh: 1.7, onGround: false };
    this.vx = 0; this.vz = 0; this.yaw = Math.PI; this.camYaw = 0; this.camPitch = 0.22; this.camDist = 6.5; this.camD = 6.5;
    this.flying = false; this.meditating = false; this.swimming = false; this.jumps = 0; this.air = 0;
    this.attackT = -1; this.combo = 0; this.swung = false; this.queued = false; this.stepOff = 0; this.speed = 0; this.dead = false;
    this.dashT = 0; this.dashX = 0; this.dashZ = 0; this.ghostT = 0; this.gliding = false; this.flipT = -1; this.castT = -1; this.medA = 0;
    this.blocking = false; this.blockAt = -9; this.dashAt = -9; this.execTarget = null; this.slowT = 0; this.pdUsed = false;
    this.work = null; this.workT = 0; // 垂钓、种植等动作
    this.events = []; this.time = 0; this.stepAcc = 0; this.tilt = 0; this.bank = 0; this.shake = 0;
    this.mats = mats; this.weapon = null; this.weaponKind = null; this.model = null;
    this.flySword = makeSword(mats, 0.11, 'fly');
    this.flySword.rotation.x = Math.PI / 2; this.flySword.position.set(0, -0.1, -0.75); this.flySword.visible = false;
    this.setLook(look);
    this.target = new THREE.Vector3(); this.fwd = new THREE.Vector3(0, 0, -1);
    // 飘带、剑光、残影、打坐法阵
    const rm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.65 });
    this.ribbons = [
      new Ribbon(scene, { n: 10, len: 0.95, width: 0.075, color: 0x2a5a8a, tip: 0x7fc8ff, mat: rm }),
      new Ribbon(scene, { n: 10, len: 0.85, width: 0.07, color: 0x2a5a8a, tip: 0x7fc8ff, mat: rm }),
      new Ribbon(scene, { n: 8, len: 0.5, width: 0.035, color: 0x4a9ad8, tip: 0xeef8ff, mat: rm, taper: 0.2 }),
    ];
    this.trail = new Trail(scene, 30, 0.24);
    this.ghosts = new Ghosts(scene);
    this.medDisc = runeDisc(2.3, 0x7fe8ff, 'bagua'); this.medDisc.visible = false; scene.add(this.medDisc);
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._wind = [0, 0, 0];
  }
  // 更换外观（开局捏人）；发型、性别等造型变化会重建模型，配色只改材质
  setLook(look) {
    const old = this.model;
    if (old && old.shape.key === shapeKey(shapeLook(look))) { this._pending = null; old.look = look; old.setColors({ ...HCOL, ...look.col }); return; }
    const m = new Character(look, this.mats);
    this._pending = m;
    // 造型在 Worker 中构建，就绪后再替换，避免捏人时模型闪空
    if (old && !m.ready) { m.shape.ready.then(() => { if (this._pending === m) this._swap(m); else m.dispose(); }); return; }
    this._swap(m);
  }
  _swap(m) {
    const old = this.model;
    this._pending = null;
    if (old) {
      m.group.position.copy(old.group.position); m.group.rotation.copy(old.group.rotation); m.group.visible = old.group.visible;
      if (this.weapon) old.hand.remove(this.weapon);
      old.group.remove(this.flySword);
      this.scene.remove(old.group); old.dispose();
    }
    this.model = m;
    m.group.add(this.flySword);
    this.scene.add(m.group);
    if (this.weapon) { m.hand.add(this.weapon); m.weapons = [this.weapon]; }
    // 披帛挂点（胸背）与发带挂点，按骨骼静止位置换算
    const sp = m.spec, ch = sp.map.get('chest').p, hd = sp.map.get('head').p, HC = sp.HC, hs = m.shape.F.hs;
    this.ribAt = [[-0.075, 1.3 - ch[1], -0.115 - ch[2]], [0.075, 1.29 - ch[1], -0.115 - ch[2]], [HC[0] - hd[0], HC[1] + 0.11 * hs - hd[1], HC[2] - 0.05 * hs - hd[2]]];
    if (this.ribbons) for (const r of this.ribbons) r.reset();
  }
  setTrailColor(hex) { this.trail.setColor(hex); this.medDisc.material.color.set(hex); }
  setWeapon(kind) {
    if (kind === this.weaponKind) return;
    if (this.weapon) { this.weapon.parent.remove(this.weapon); this.weapon = null; this.model.weapons = []; }
    this.weaponKind = kind;
    if (!kind) return;
    this.weapon = makeSword(this.mats, 0.052, kind);
    this.model.hand.add(this.weapon);
    this.model.weapons = [this.weapon];
  }
  teleport(x, y, z) { const b = this.b; b.x = x; b.y = y; b.z = z; b.vy = 0; this.vx = this.vz = 0; this.stepOff = 0; for (const r of this.ribbons) r.reset(); }
  get invuln() { return this.dashT > 0; }
  startAttack() {
    if (this.meditating || this.dead || this.dashT > 0) return false;
    if (this.attackT < 0) { this.attackT = 0; this.combo = 0; this.swung = false; this.yaw = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw)); return true; }
    if (this.attackT > 0.4) this.queued = true;
    return false;
  }
  // 处决：冲向处于破绽的目标，一记突刺
  startExecute(o) {
    if (this.meditating || this.dead || this.flying) return false;
    this.execTarget = o; this.attackT = 0; this.combo = 3; this.swung = false; this.queued = false; this.blocking = false;
    this.yaw = Math.atan2(o.b.x - this.b.x, o.b.z - this.b.z);
    return true;
  }
  // 瞬身：沿移动方向（无输入则沿朝向）位移
  dash(input) {
    if (this.dead || this.flying || this.dashT > 0) return false;
    const mx = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0), mz = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    let wx = -sy * mz + cy * mx, wz = -cy * mz - sy * mx;
    const l = Math.hypot(wx, wz);
    if (l < 0.1) { wx = Math.sin(this.yaw); wz = Math.cos(this.yaw); } else { wx /= l; wz /= l; }
    this.dashX = wx; this.dashZ = wz; this.dashT = 0.2; this.yaw = Math.atan2(wx, wz); this.dashAt = this.time; this.pdUsed = false; this.blocking = false;
    this.attackT = -1; this.queued = false; this.meditating = false; this.ghostT = 0;
    return true;
  }

  // caps: { fly, doubleJump, glide, speed, canBoost }
  update(dt, input, world, caps) {
    const b = this.b, ev = this.events;
    ev.length = 0; this.time += dt;
    this.camYaw -= input.mdx * 0.0027;
    this.camPitch = clamp(this.camPitch + input.mdy * 0.0023, -1.15, 1.45);
    if (input.down('ArrowLeft')) this.camYaw += dt * 1.9;
    if (input.down('ArrowRight')) this.camYaw -= dt * 1.9;
    if (input.down('ArrowUp')) this.camPitch = clamp(this.camPitch + dt * 1.2, -1.15, 1.45);
    if (input.down('ArrowDown')) this.camPitch = clamp(this.camPitch - dt * 1.2, -1.15, 1.45);
    if (input.wheel) this.camDist = clamp(this.camDist * (1 + input.wheel * 0.0012), 2.2, 18);

    let mx = 0, mz = 0, jump = false, jumpHeld = false, sprint = false, down = false;
    if (!this.dead && !caps.lock) {
      mx = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
      mz = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
      jump = input.active && input.hit('Space'); jumpHeld = input.down('Space');
      sprint = input.down('ShiftLeft') || input.down('ShiftRight');
      down = input.down('KeyX') || input.down('KeyZ');
    }
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    let wx = -sy * mz + cy * mx, wz = -cy * mz - sy * mx;
    const ml = Math.hypot(wx, wz);
    if (ml > 0) { wx /= ml; wz /= ml; }
    if (this.meditating && (ml > 0 || jump)) { this.meditating = false; jump = false; }
    // 格挡：按住右键；刚按下的一瞬为弹反窗口
    const wantBlock = !this.dead && !caps.lock && input.active && input.mouse[2] && b.onGround && !this.flying && !this.meditating && this.dashT <= 0 && this.attackT < 0 && !this.swimming;
    if (wantBlock && !this.blocking) this.blockAt = this.time;
    this.blocking = wantBlock;
    if (this.blocking) this.yaw = turnTo(this.yaw, Math.atan2(-sy, -cy), 1 - Math.exp(-dt * 14));
    if (this.slowT > 0) this.slowT -= dt;
    if (this.flying && !caps.fly) this.flying = false;

    const gH = world.groundY(b.x, b.z);
    const inWater = !this.flying && gH < WATER_SURF && b.y < WATER_SURF - 0.95;
    if (inWater && !this.swimming && b.vy < -3) ev.push('splash');
    this.swimming = inWater;
    const wasGround = b.onGround;
    this.gliding = false;

    if (this.dashT > 0) {
      this.dashT -= dt;
      const sp = 42;
      this.vx = this.dashX * sp; this.vz = this.dashZ * sp; b.vy = this.flying ? 0 : Math.max(b.vy, 0);
      moveBody(world, b, this.vx * dt, 0, this.vz * dt, 0.9);
      if (this.dashT <= 0) { this.vx *= 0.25; this.vz *= 0.25; }
      this.ghostT -= dt;
      if (this.ghostT <= 0) { this.ghostT = 0.035; ev.push('ghost'); }
    } else if (this.flying) {
      const boost = sprint && caps.canBoost, sp = boost ? 48 : 21;
      const pf = this.camPitch - 0.2, cp = Math.cos(pf);
      let tx = (-sy * cp * mz + cy * mx * 0.6) * sp, tz = (-cy * cp * mz - sy * mx * 0.6) * sp;
      let ty = -Math.sin(pf) * mz * sp + ((jumpHeld ? 1 : 0) - (down ? 1 : 0)) * 13;
      const k = 1 - Math.exp(-dt * 3.2);
      this.vx += (tx - this.vx) * k; this.vz += (tz - this.vz) * k; b.vy += (ty - b.vy) * k;
      moveBody(world, b, this.vx * dt, b.vy * dt, this.vz * dt, 0);
      if (b.hitWall) { this.vx *= 0.5; this.vz *= 0.5; }
      this.boosting = boost && (mz !== 0 || mx !== 0);
      b.onGround = false; this.jumps = 0;
    } else {
      let sp = (sprint ? 9.2 : 5.6) * caps.speed;
      if (inWater) sp *= 0.55;
      if (this.attackT >= 0) sp *= this.combo === 2 ? 0.15 : 0.4;
      if (this.blocking) sp *= 0.3;
      if (this.combo === 3 && this.attackT >= 0) sp = 0;
      if (this.meditating) sp = 0;
      // 轻功滑翔：下落中按住空格
      const glide = caps.glide && !b.onGround && !inWater && jumpHeld && b.vy < -1 && this.air > 0.3 && this.attackT < 0;
      if (glide) { this.gliding = true; sp = 12.5 * caps.speed; }
      const k = 1 - Math.exp(-dt * (b.onGround || inWater ? 14 : glide ? 2.2 : 4.5));
      const gx = glide && ml === 0 ? Math.sin(this.yaw) : wx, gz = glide && ml === 0 ? Math.cos(this.yaw) : wz;
      this.vx += (gx * sp - this.vx) * k; this.vz += (gz * sp - this.vz) * k;
      if (inWater) {
        b.vy += ((WATER_SURF - 1.32 - b.y) * 9 - b.vy * 3.5) * dt;
        if (jumpHeld) b.vy = Math.max(b.vy, 2.4);
        this.jumps = 0;
      } else {
        b.vy = Math.max(-55, b.vy - 27 * dt);
        if (glide) b.vy += (-2.4 - b.vy) * (1 - Math.exp(-dt * 6));
        if (jump) {
          if (b.onGround || this.air < 0.12) { b.vy = 9.4; this.jumps = 1; ev.push('jump'); }
          else if (caps.doubleJump && this.jumps < 2) { b.vy = 10.5; this.jumps = 2; this.flipT = 0; ev.push('jump2'); }
        }
      }
      moveBody(world, b, this.vx * dt, b.vy * dt, this.vz * dt, inWater ? 1.2 : 0.55, inWater);
      if (inWater && b.stepped) b.onGround = true;
      if (b.onGround) { if (!wasGround && this.air > 0.25) ev.push(this.air > 0.9 ? 'landHard' : 'land'); this.air = 0; if (b.vy <= 0) this.jumps = 0; this.flipT = -1; }
      else this.air += dt;
      this.boosting = false;
    }
    if (this.flipT >= 0) { this.flipT += dt / 0.5; if (this.flipT >= 1) this.flipT = -1; }
    if (b.stepped) this.stepOff -= b.stepped;
    this.stepOff *= Math.exp(-dt * 13);
    if (b.y < -30) { b.y = Math.max(gH, 0) + 3; b.vy = 0; }
    this.speed = Math.hypot(this.vx, this.vz);

    // 三段连招；combo 3 为处决
    if (this.attackT >= 0) {
      const dur = this.combo === 3 ? 0.72 : this.combo === 2 ? 0.62 : 0.42;
      this.attackT += dt / dur;
      const tg = this.execTarget;
      if (this.combo === 3 && tg && this.attackT < 0.45) {
        const dx = tg.b.x - b.x, dz = tg.b.z - b.z, d = Math.hypot(dx, dz), want = d - (tg.radius || 0.5) - 0.7;
        if (want > 0.05) { const st = Math.min(want, dt * 16); moveBody(world, b, (dx / d) * st, 0, (dz / d) * st, 0.6); }
        this.yaw = Math.atan2(dx, dz);
      }
      if (!this.swung && this.attackT >= (this.combo === 3 ? 0.45 : this.combo === 2 ? 0.5 : 0.4)) { this.swung = true; ev.push('swing' + this.combo); }
      if (this.combo === 3) { if (this.attackT >= 1) { this.attackT = -1; this.combo = 0; this.execTarget = null; } }
      else if (this.attackT >= 0.78 && this.queued) { this.queued = false; this.combo = (this.combo + 1) % 3; this.attackT = 0.08; this.swung = false; this.yaw = Math.atan2(-sy, -cy); }
      else if (this.attackT >= 1) { this.attackT = -1; this.queued = false; this.combo = 0; }
    }
    if (this.castT >= 0) { this.castT += dt / 0.45; if (this.castT >= 1) this.castT = -1; }
    // 朝向
    const kt = 1 - Math.exp(-dt * 12);
    if (this.attackT < 0 && this.dashT <= 0 && this.speed > 0.6 && (ml > 0 || this.flying || this.gliding)) this.yaw = turnTo(this.yaw, Math.atan2(this.vx, this.vz), kt);
    // 脚步
    if (b.onGround && this.speed > 1.5 && !inWater && this.dashT <= 0) { this.stepAcc += this.speed * dt; if (this.stepAcc > 2.3) { this.stepAcc = 0; ev.push(this.speed > 8 ? 'stepRun' : 'step'); } }

    const m = this.model, g = m.group;
    g.position.set(b.x, b.y + this.stepOff + (this.flying ? 0.22 : 0), b.z);
    const tiltT = this.flying ? clamp(-b.vy * 0.012, -0.35, 0.35) : 0;
    const bankT = this.flying || this.gliding ? clamp(angDiff(Math.atan2(this.vx, this.vz), this.yaw) * -1.2, -0.5, 0.5) * Math.min(1, this.speed / 10) : 0;
    this.tilt += (tiltT - this.tilt) * kt; this.bank += (bankT - this.bank) * kt * 0.5;
    g.rotation.set(this.tilt, this.yaw, this.bank);
    this.flySword.visible = this.flying;
    if (this.weapon) this.weapon.visible = !this.work && (!this.flying || this.attackT >= 0);
    m.update(dt, { speed: this.speed, air: !b.onGround && !inWater && this.air > 0.12, vy: b.vy, meditate: this.meditating, fly: this.flying, glide: this.gliding, dash: this.dashT > 0, swim: inWater && !b.onGround,
      flip: this.flipT, attackT: this.attackT, combo: this.combo, cast: this.castT, block: this.blocking, time: this.time, armed: !!this.weapon && !this.flying && !this.work, idle: this.idleStyle, work: this.work, workT: this.workT });
    // 剑光拖尾
    if (this.weapon && this.attackT > 0.28 && this.attackT < 0.85) {
      this.trail.push(this.weapon.localToWorld(this._a.set(0, 0.3, 0)), this.weapon.localToWorld(this._b.set(0, this.combo >= 2 ? 1.75 : 1.4, 0)));
    }
    this.trail.update(dt);
    if (ev.includes('ghost')) this.ghosts.spawn(m, this.trail.color.getHex(), 0.38, 0.38);
    this.ghosts.update(dt);
    this._ribbons(dt);
    // 打坐法阵
    this.medA += ((this.meditating ? 1 : 0) - this.medA) * (1 - Math.exp(-dt * 3));
    const md = this.medDisc;
    md.visible = this.medA > 0.02;
    if (md.visible) { md.position.set(b.x, b.y + 0.06, b.z); md.rotation.y += dt * 0.25; md.material.opacity = this.medA * (0.55 + 0.15 * Math.sin(this.time * 2)); md.scale.setScalar(0.6 + this.medA * 0.4); }
  }
  _ribbons(dt) {
    const m = this.model, b = this.b, R = this.ribbons, w = this._wind;
    const sx = Math.cos(this.yaw), sz = -Math.sin(this.yaw);
    const t = this.time, gust = Math.sin(t * 1.7) * 0.8 + Math.sin(t * 4.3) * 0.4;
    w[0] = -this.vx * 3.2 + sz * gust * 0.6 + Math.sin(t * 0.7) * 0.6; w[1] = -(this.flying ? 0 : Math.min(0, this.b.vy)) * 1.2 + (this.gliding ? 6 : 0); w[2] = -this.vz * 3.2 - sx * gust * 0.6 + Math.cos(t * 0.6) * 0.6;
    const body = { x: b.x, y: b.y + 0.15, z: b.z, h: 1.4, r: this.meditating ? 0.45 : 0.27 };
    const vis = this.model.group.visible;
    for (const r of R) r.mesh.visible = vis;
    if (!vis) return;
    const p = this._a, A = this.ribAt;
    m.upper.localToWorld(p.set(...A[0])); R[0].update(dt, p.x, p.y, p.z, sx, 0, sz, body, w);
    m.upper.localToWorld(p.set(...A[1])); R[1].update(dt, p.x, p.y, p.z, sx, 0, sz, body, w);
    m.head.localToWorld(p.set(...A[2])); R[2].update(dt, p.x, p.y, p.z, sx, 0, sz, null, w, 6);
  }

  updateCamera(dt, camera, world) {
    const b = this.b;
    const ty = b.y + (this.meditating ? 1.05 : 1.55) + this.stepOff + (this.flying ? 0.3 : 0);
    this.target.x = b.x; this.target.z = b.z;
    this.target.y += (ty - this.target.y) * (1 - Math.exp(-dt * 16));
    if (Math.abs(ty - this.target.y) > 4) this.target.y = ty;
    const cp = Math.cos(this.camPitch), dx = Math.sin(this.camYaw) * cp, dy = Math.sin(this.camPitch), dz = Math.cos(this.camYaw) * cp;
    const want = this.camDist * (this.flying ? 1.3 : this.meditating ? 1.15 : 1);
    const t = this.target;
    const hit = Math.max(0.5, world.rayHit(t.x, t.y, t.z, dx, dy, dz, want + 0.5) - 0.5);
    this.camD = hit < this.camD ? hit : this.camD + (hit - this.camD) * (1 - Math.exp(-dt * 5));
    camera.position.set(t.x + dx * this.camD, t.y + dy * this.camD, t.z + dz * this.camD);
    camera.lookAt(t.x, t.y + 0.15, t.z);
    this.fwd.set(-dx, -dy, -dz);
    const fov = 60 + (this.flying ? Math.min(18, this.speed * 0.4) : this.dashT > 0 ? 9 : this.gliding ? 7 : Math.min(5, this.speed * 0.5));
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * (this.dashT > 0 ? 12 : 4))); camera.updateProjectionMatrix(); }
  }
}
