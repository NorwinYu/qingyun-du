import * as THREE from 'three';
import { buildTextures } from './tex.js';
import { makeMaterials } from './materials.js';
import { Colliders } from './collide.js';
import { World } from './world.js';
import { forestDensity, TRIB_H } from './height.js';
import { Sky } from './sky.js';
import { WaterSystem } from './water.js';
import { PostFX } from './postfx.js';
import { buildStructures } from './build.js';
import { Particles } from './particles.js';
import { Input, Player, CREATOR, DEFAULT_SEL, lookFromSel } from './player.js';
import { preloadShapes } from './human/shapes.js';
import { rollGear, rollQuality, QUALITY } from './loot.js';
import { Trial, TRIAL_GATE, buildGate } from './trial.js';
import { Side } from './side.js';
import { Actors } from './actors.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { GameAudio } from './audio.js';
import { Character } from './human/character.js';
import { Telegraphs, Bolts, Ghosts, shieldMesh, lightBeam } from './fx.js';
import { ITEMS, REALMS, QUESTS, R_QI, R_WIND, R_ZHUJI, R_JINDAN, VILLAGER_LINES, TOWN_LINES, LORE, ROOTS, ROOT_GRADES, SKILLS } from './data.js';
import { WATER_SURF, PLATFORM, RUINS, QINGYUN, ISLANDS, GROVES, riverZ, TOWN, VALLEY, LAIR, VOLCANO, ARENA, TRIB, PORTALS } from './layout.js';
import { clamp, smoothstep } from './noise.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.info.autoReset = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.2, 4000);

const T = buildTextures(), mats = makeMaterials(T);
const sky = new Sky(scene, mats.shared, T.macro);
const water = new WaterSystem(renderer, scene, mats.shared);
const colliders = new Colliders();
const world = new World({ scene, mats, colliders, waterMat: water.material });
const pois = buildStructures({ scene, mats, col: colliders, water, treeBuilders: world.treeBuilders, world });
const pN = new Particles(scene, 5000, false), pA = new Particles(scene, 5000, true);
water.hide.push(world.waterGroup, water.farMesh, world.grassGroup, water.falls, world.blobGroup, pN.points, pA.points);
const fx = new PostFX(renderer, scene, camera, 0);

// 战斗特效
const tele = new Telegraphs(scene), bolts = new Bolts(scene, mats.glow), ghostFx = new Ghosts(scene), meteors = [];
const shield = shieldMesh(0xffc860); scene.add(shield);
const beacon = lightBeam(0.8, 110, 0xffd860, 0.3); beacon.visible = false; scene.add(beacon);
const pillar = lightBeam(1.5, 260, 0xffe6a8, 0.3); pillar.visible = false; scene.add(pillar);
const meteorGeo = new THREE.IcosahedronGeometry(1, 1);
const meteorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.3, 0.35), toneMapped: false, fog: false });
const oreMat = new THREE.MeshStandardMaterial({ color: 0x3a3e4a, roughness: 0.45, metalness: 0.7, emissive: 0x4a7aff, emissiveIntensity: 0.6, flatShading: true });

const game = new Game();
const input = new Input(canvas);
const audio = new GameAudio();
const ui = new UI(game, input);
ui.world = world;
const player = new Player(scene, mats);
const actors = new Actors({ scene, mats, world, pois, pN, pA, game, fx: { tele, ghosts: ghostFx, meteors, bolts } });

// 额外交互点：测灵石、古修残魂
const rs = pois.spots.rootStone;
pois.interact.push({ type: 'root', x: rs[0], y: rs[1] - 1.6, z: rs[2], r: 2.8, label: '测灵石 · 测试灵根' });
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const GHOST_LOOK = { sex: 'm', age: 'old', hair: 'elder', beard: 'long', outfit: 'daopao' };
const encounters = [[-128, 30], [606, -262], [58, -288], [-286, 262], [262, riverZ(262) + 18]].map(([x, z], i) => {
  let px = x, pz = z;
  for (let k = 0; k < 24 && world.groundY(px, pz) < 1.2; k++) { px = x + Math.cos(k) * k * 2; pz = z + Math.sin(k) * k * 2; }
  const y = world.standY(px, world.groundY(px, pz) + 6, pz);
  const m = new Character(GHOST_LOOK, mats, { shadow: false });
  m.setMaterial(ghostMat);
  m.group.position.set(px, y + 0.35, pz); m.group.rotation.y = i * 1.3;
  scene.add(m.group);
  const it = { type: 'encounter', id: i, x: px, y, z: pz, r: 3.2, label: '古修残魂 · 聆听', m, done: false, fade: 1, t: i * 2 };
  pois.interact.push(it);
  return it;
});
const forgeIt = pois.interact.find((i) => i.type === 'forge');
Object.assign(game.locs, {
  rootStone: { x: rs[0], z: rs[2] }, platform: PLATFORM, ruins: RUINS, golem: RUINS, cage: pois.cage, alchemy: { x: 14.5, z: 10 },
  forge: forgeIt, island: { x: ISLANDS[0].x, z: ISLANDS[0].z, y: ISLANDS[0].y }, trib: { x: TRIB.x, z: TRIB.z, y: TRIB_H }, boar: { x: 604, z: 140 },
  wolf: { x: 10, z: 150 }, wolfking: LAIR, lavagolem: ARENA, bloodwolf: VALLEY,
});

// ---- 设置
let opts = { quality: 1, volume: 0.7 };
try { const o = JSON.parse(localStorage.getItem('qingyun_opts') || '{}'); if (o.quality >= 0 && o.quality <= 2) opts.quality = o.quality; if (o.volume >= 0) opts.volume = o.volume; } catch (e) { /* 忽略 */ }
if (params.get('q')) opts.quality = Number(params.get('q'));
function applyOpts() {
  const q = opts.quality, w = innerWidth, h = innerHeight;
  const pr = q === 2 ? Math.min(devicePixelRatio || 1, 1.5) : 1;
  renderer.setPixelRatio(pr); renderer.setSize(w, h);
  fx.setSamples(q === 0 ? 0 : 4);
  fx.setSize(w, h, pr);
  water.setSize(Math.max(64, Math.round((w * pr) / 2)), Math.max(64, Math.round((h * pr) / 2)));
  camera.aspect = w / h; camera.updateProjectionMatrix();
  world.setQuality(q);
  sky.sun.castShadow = q > 0;
  water.enabled = q > 0;
  audio.setVolume(opts.volume);
  ui.setOpts(opts);
  try { localStorage.setItem('qingyun_opts', JSON.stringify(opts)); } catch (e) { /* 忽略 */ }
}
addEventListener('resize', applyOpts);
applyOpts();

// ---- 灯光池：夜间为最近的灯笼分配点光源
const LP = 7, lamps = [];
for (let i = 0; i < LP; i++) { const l = new THREE.PointLight(0xffffff, 0, 17, 1.7); scene.add(l); lamps.push(l); }
const aura = lamps[0];
let lampT = 0;
const lampList = pois.lights.map((l) => ({ ...l, d: 0 }));
function updateLamps(dt, P) {
  lampT -= dt;
  if (lampT <= 0) {
    lampT = 0.35;
    for (const l of lampList) l.d = Math.hypot(l.p[0] - P.x, l.p[1] - P.y, l.p[2] - P.z);
    lampList.sort((a, b) => a.d - b.d);
  }
  aura.position.set(P.x, P.y + 3.2, P.z);
  if (shieldT > 0) { aura.color.setRGB(1, 0.8, 0.4); aura.intensity = 4 + sky.night * 4; aura.distance = 9; }
  else { aura.color.setRGB(0.62, 0.74, 1); aura.intensity = sky.night * 4; aura.distance = 14; }
  for (let i = 1; i < LP; i++) {
    const l = lampList[i - 1], L = lamps[i];
    if (!l) { L.intensity = 0; continue; }
    const k = (l.always ? Math.max(sky.night, 0.3) : sky.night) * (1 - smoothstep(24, 38, Math.hypot(l.p[0] - P.x, l.p[2] - P.z)));
    L.position.set(l.p[0], l.p[1] + 0.3, l.p[2]); L.color.setRGB(l.c[0], l.c[1], l.c[2]);
    L.intensity = k * l.i * 15 * (0.93 + Math.sin(time * 9 + i * 2.1) * 0.04 + Math.sin(time * 23 + i) * 0.03);
  }
}

// ---- 环境粒子
function updateEmitters(dt, cx, cy, cz) {
  const R = Math.random;
  for (const e of pois.emitters) {
    const d = Math.hypot(e.x - cx, e.z - cz, (e.y - cy) * 0.5);
    if (d > (e.range || 130)) continue;
    const r = e.r || 0;
    if (e.type === 'smoke') {
      if (R() < dt * 7) { const t = e.tint || [0.78, 0.78, 0.8]; pN.emit(e.x, e.y, e.z, 0.35 + (R() - 0.5) * 0.4, 0.9 + R() * 0.5, (R() - 0.5) * 0.4, 4.5, 26 + R() * 16, t[0], t[1], t[2], { g: -0.12, d: 0.25, a: 0.34 }); }
    } else if (e.type === 'ember') {
      if (R() < dt * 12) pA.emit(e.x + (R() - 0.5) * (0.5 + r * 0.3), e.y, e.z + (R() - 0.5) * (0.5 + r * 0.3), (R() - 0.5) * 0.8, 1 + R() * 2, (R() - 0.5) * 0.8, 1.2, 4, 1, 0.5 + R() * 0.3, 0.12, { g: -0.6, d: 0.8 });
    } else if (e.type === 'fire') {
      if (R() < dt * 20) pA.emit(e.x + (R() - 0.5) * 0.4, e.y, e.z + (R() - 0.5) * 0.4, (R() - 0.5) * 0.3, 1.2 + R(), (R() - 0.5) * 0.3, 0.6, 7, 1, 0.45 + R() * 0.25, 0.1, { g: -1 });
    } else if (e.type === 'leaf') {
      if (R() < dt * 3) { const a = R() * 6.28, rr = Math.sqrt(R()) * r; pN.emit(e.x + Math.cos(a) * rr, e.y - R() * 3, e.z + Math.sin(a) * rr, 0.6 + R() * 0.8, -0.6, (R() - 0.5) * 0.8, 7, 7, 0.36 + R() * 0.3, 0.55, 0.2, { g: 0.25, d: 0.4 }); }
    } else if (e.type === 'qi') {
      if (R() < dt * (4 + r * 2.5)) { const a = R() * 6.28, rr = Math.sqrt(R()) * r; pA.emit(e.x + Math.cos(a) * rr, e.y + R() * 0.5, e.z + Math.sin(a) * rr, 0, 0.5 + R() * 1.1, 0, 2.6, 4.5, 0.3, 0.95, 0.8, { a: 0.85 }); }
    } else if (e.type === 'mist') {
      if (d < 90) for (let i = 0; i < 2; i++) if (R() < dt * 16) { const a = R() * 6.28; pN.emit(e.x + Math.cos(a) * r * R(), e.y, e.z + Math.sin(a) * r * R(), Math.cos(a) * 1.4, 1 + R() * 2.5, Math.sin(a) * 1.4, 1.5, 16 + R() * 14, 0.92, 0.96, 1, { g: 3.5, d: 0.6, a: 0.4 }); }
    } else if (e.type === 'portal') {
      const on = game.s.portals[e.id];
      if (R() < dt * (on ? 14 : 3)) { const a = R() * 6.28, rr = r * (0.3 + R() * 0.7); pA.emit(e.x + Math.cos(a) * rr, e.y, e.z + Math.sin(a) * rr, 0, on ? 1.5 + R() * 2.5 : 0.6, 0, on ? 2.2 : 1.2, 4, 0.35, 0.8, 1, { a: on ? 0.9 : 0.4 }); }
    } else if (e.type === 'miasma') {
      if (d < 110 && R() < dt * 5) { const a = R() * 6.28, rr = Math.sqrt(R()) * r; pN.emit(e.x + Math.cos(a) * rr, e.y + R(), e.z + Math.sin(a) * rr, (R() - 0.5) * 0.6, 0.25 + R() * 0.3, (R() - 0.5) * 0.6, 9, 30 + R() * 20, 0.42, 0.3, 0.5, { a: 0.22, d: 0.1 }); }
    } else if (e.type === 'plume') {
      if (R() < dt * 5) pN.emit(e.x + (R() - 0.5) * r, e.y + R() * 4, e.z + (R() - 0.5) * r, 1.4 + (R() - 0.5) * 2, 5 + R() * 3, (R() - 0.5) * 2, 26, 90 + R() * 70, 0.22, 0.2, 0.2, { g: -0.05, d: 0.04, a: 0.5 });
      if (d < 500 && R() < dt * 10) pA.emit(e.x + (R() - 0.5) * r, e.y - 6, e.z + (R() - 0.5) * r, (R() - 0.5) * 3, 8 + R() * 10, (R() - 0.5) * 3, 2.5, 10, 1, 0.45, 0.1, { g: 3 });
    } else if (e.type === 'spark') {
      if (R() < dt * 6) { const a = R() * 6.28, rr = R() * r; pA.emit(e.x + Math.cos(a) * rr, e.y + R() * 2, e.z + Math.sin(a) * rr, (R() - 0.5) * 2, R() * 2, (R() - 0.5) * 2, 0.35, 4, 0.7, 0.8, 1, { d: 3 }); }
    }
  }
  // 夜晚萤火
  if (sky.night > 0.6 && weather.k < 0.3 && R() < dt * 10) pA.emit(cx + (R() - 0.5) * 36, world.groundY(cx, cz) + 0.4 + R() * 2.2, cz + (R() - 0.5) * 36, (R() - 0.5) * 0.5, (R() - 0.5) * 0.3, (R() - 0.5) * 0.5, 4, 4, 0.7, 1, 0.35, { a: 0.9 });
}

// ---- 天气：晴 / 雨（雪线以上为雪，火山为落灰），天劫时雷暴
const weather = { k: 0, target: 0, t: 90, storm: 0, boltT: 5 };
const GRAY = new THREE.Color(), _c = new THREE.Color();
// 雨丝：世界坐标固定、围绕相机循环包裹的线段体，避免逐帧更新顶点
const RAIN_N = 7000, RAIN_W = 56, RAIN_H = 34;
const rain = (() => {
  const p = new Float32Array(RAIN_N * 6), e = new Float32Array(RAIN_N * 2);
  for (let i = 0; i < RAIN_N; i++) {
    const x = Math.random() * RAIN_W, y = Math.random() * RAIN_H, z = Math.random() * RAIN_W;
    p.set([x, y, z, x, y, z], i * 6); e[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(e, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uK: { value: 0 }, uC: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(0.75, 0.8, 0.88) } },
    vertexShader: `uniform float uT; uniform vec3 uC; attribute float aEnd; varying float vA;
      void main(){
        vec3 p = position;
        float y = mod(p.y - uT * 24.0, ${RAIN_H}.0);
        vec2 xz = uC.xz + mod(p.xz + uT * vec2(1.6, 0.7) - uC.xz, ${RAIN_W}.0) - ${RAIN_W / 2}.0;
        vec3 w = vec3(xz.x, uC.y + y - ${RAIN_H / 2 - 4}.0, xz.y) + vec3(0.07, -1.0, 0.03) * aEnd * 1.1;
        float d = length(w - uC);
        vA = (1.0 - aEnd * 0.85) * smoothstep(${RAIN_W / 2}.0, 6.0, d) * smoothstep(0.6, 2.5, d);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: `uniform float uK; uniform vec3 uCol; varying float vA;
      void main(){ gl_FragColor = vec4(uCol, vA * uK * 0.5); }`,
  });
  const l = new THREE.LineSegments(g, m);
  l.frustumCulled = false; l.renderOrder = 5; l.visible = false;
  scene.add(l);
  return l;
})();
function updateWeather(dt, cx, cy, cz) {
  weather.t -= dt;
  if (weather.t <= 0) { weather.t = 100 + Math.random() * 160; weather.target = Math.random() < 0.32 ? 0.55 + Math.random() * 0.45 : 0; }
  const want = trib ? 1 : weather.target;
  weather.k += (want - weather.k) * (1 - Math.exp(-dt * 0.25));
  weather.storm += ((trib ? 1 : 0) - weather.storm) * (1 - Math.exp(-dt * 0.8));
  const k = weather.k, R = Math.random, gh = world.groundY(cx, cz);
  const ash = Math.hypot(cx - VOLCANO.x, cz - VOLCANO.z) < VOLCANO.R * 0.9;
  if (ash) {
    const ar = () => { const a = R() * 6.28, r = 6 + R() * 22; return [Math.cos(a) * r, Math.sin(a) * r]; };
    if (R() < dt * 30) { const [ox, oz] = ar(); pN.emit(cx + ox, cy + 6 + R() * 10, cz + oz, 0.6, -1.2, 0.3, 9, 1.8, 0.35, 0.33, 0.32, { a: 0.7 }); }
    if (R() < dt * 14) { const [ox, oz] = ar(); pA.emit(cx + ox, gh + R() * 6, cz + oz, (R() - 0.5), 1 + R(), (R() - 0.5), 3, 1.1, 1, 0.5, 0.15, { a: 0.9 }); }
  } else if (k > 0.05) {
    const snow = gh > 64 || cy > 90;
    if (snow) {
      const n = Math.floor(dt * k * 160 + R());
      for (let i = 0; i < n; i++) pN.emit(cx + (R() - 0.5) * 44, cy + 6 + R() * 10, cz + (R() - 0.5) * 44, (R() - 0.5) * 1.2, -2 - R(), (R() - 0.5) * 1.2, 6, 2.6, 0.95, 0.97, 1, { a: 0.85 });
    } else {
      // 落地水花
      const n = Math.floor(dt * k * 90 + R());
      for (let i = 0; i < n; i++) { const x = cx + (R() - 0.5) * 26, z = cz + (R() - 0.5) * 26, y = world.standY(x, cy + 4, z); pN.emit(x, y + 0.05, z, (R() - 0.5) * 0.8, 1.2 + R(), (R() - 0.5) * 0.8, 0.35, 0.9, 0.8, 0.85, 0.92, { g: 7, a: 0.5 }); }
    }
    rain.visible = !snow; rain.material.uniforms.uK.value = k;
  }
  if (ash || k <= 0.05) rain.visible = false;
  rain.material.uniforms.uT.value += dt;
  rain.material.uniforms.uC.value.set(cx, cy, cz);
  rain.material.uniforms.uCol.value.setRGB(0.75, 0.8, 0.88).multiplyScalar(0.35 + sky.day * 0.65);
  const wk = ash ? Math.max(k, 0.35) : k;
  // 天色：压暗、雾化
  GRAY.setRGB(0.36, 0.38, 0.42).multiplyScalar((0.25 + sky.day * 0.75) * (1 - weather.storm * 0.5));
  if (ash) GRAY.setRGB(0.42, 0.3, 0.26).multiplyScalar(0.3 + sky.day * 0.7);
  sky.top.lerp(GRAY, wk * 0.75); sky.horizon.lerp(_c.copy(GRAY).multiplyScalar(1.25), wk * 0.7);
  scene.fog.color.lerp(_c.copy(GRAY).multiplyScalar(1.15), wk * 0.7);
  scene.fog.density *= 1 + wk * (ash ? 1.2 : 1.6) + weather.storm;
  sky.uniforms.uCover.value = 0.5 - wk * 0.42;
  sky.uniforms.uCloudLit.value.lerp(GRAY, wk * 0.6); sky.uniforms.uCloudDark.value.lerp(_c.copy(GRAY).multiplyScalar(0.6), wk * 0.6);
  sky.sun.intensity *= 1 - wk * (ash ? 0.65 : 0.8); sky.hemi.intensity *= 1 - wk * 0.2;
  // 雷暴：远处落雷
  if (weather.storm > 0.3 || k > 0.85) {
    weather.boltT -= dt;
    if (weather.boltT <= 0) {
      weather.boltT = (trib ? 1.2 : 5) + Math.random() * (trib ? 2 : 9);
      const a = Math.random() * 6.28, r = 60 + Math.random() * 120, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      bolts.strike(x, world.groundY(x, z), z, { top: 180, r: 0.5, life: 0.35 });
      flash = Math.max(flash, 0.35); setTimeout(() => audio.sfx('thunderFar'), 300 + r * 4);
    }
  }
}

// ---- 地名
const seen = new Set();
const SUBS = { 青云村: '灵脉之上 · 炊烟人家', 聚灵台: '灵气汇聚之地 · 打坐修为倍增', 古修遗迹: '上古修士的埋骨之所', 浮空仙山: '青云宗山门遗址', 青云峰: '云深不知处', 桃花林: '落英缤纷', 翠竹海: '风过竹喧', 雪岭: '千山鸟飞绝',
  落霞镇: '商旅辐辏 · 万宝云集', 万妖谷: '妖气冲霄 · 生人勿近', 妖王洞: '白骨累累', 赤焰火山: '地火焚天 · 三百年未熄', 封魔台: '炎阳宗殉道之地', 雷劫台: '九霄之下 · 渡劫之所', 落霞官道: '一路向东' };
function placeName(x, y, z) {
  if (y > 100 && Math.hypot(x - ISLANDS[0].x, z - ISLANDS[0].z) < 110) return '浮空仙山';
  if (Math.hypot(x - TRIB.x, z - TRIB.z) < 18 && y > TRIB_H - 6) return '雷劫台';
  if (Math.hypot(x - PLATFORM.x, z - PLATFORM.z) < 20) return '聚灵台';
  if (Math.hypot(x - RUINS.x, z - RUINS.z) < 48) return '古修遗迹';
  if (Math.hypot(x, z) < 84) return '青云村';
  if (Math.hypot(x - TOWN.x, z - TOWN.z) < 80) return '落霞镇';
  if (Math.hypot(x - LAIR.x, z - LAIR.z) < 22) return '妖王洞';
  if (Math.hypot(x - VALLEY.x, z - VALLEY.z) < 135) return '万妖谷';
  if (Math.hypot(x - ARENA.x, z - ARENA.z) < 26) return '封魔台';
  if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.R * 0.85) return '赤焰火山';
  if (Math.hypot(x - GROVES.peach.x, z - GROVES.peach.z) < GROVES.peach.r) return '桃花林';
  if (Math.hypot(x - GROVES.bamboo.x, z - GROVES.bamboo.z) < GROVES.bamboo.r) return '翠竹海';
  if (Math.hypot(x - QINGYUN.x, z - QINGYUN.z) < 170) return '青云峰';
  if (x > 100 && x < 540 && Math.abs(z) < 30) return '落霞官道';
  if (Math.abs(z - riverZ(x)) < 16) return '青云河畔';
  const h = world.groundY(x, z);
  if (h > 72) return '雪岭';
  if (h > 40) return '苍山';
  return forestDensity(x, z) > 0.5 ? '莽苍林海' : '荒野';
}

// ---- 游戏事件
let time = 0, shake = 0, flash = 0, combatT = 0, saveT = 0, deathT = -1, debugCam = false, mapTick = 0, place = '', hitStop = 0;
let btT = 0; // 子弹时间（完美闪避后妖兽放慢）
let shieldT = 0, shieldHit = 0, lavaT = 0, pillarT = 0, pendingCh = null, trib = null, meteorT = 60, portalT = 0;
const cds = { qi: 0, dash: 0, shield: 0, wanjian: 0 };
const v3 = new THREE.Vector3();
function numAt(text, x, y, z, color) {
  v3.set(x, y, z).project(camera);
  if (v3.z > 1) return;
  ui.damage(text, (v3.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 30, (-v3.y * 0.5 + 0.5) * innerHeight, color);
}
const burst = (x, y, z, n, s, r, g, b, o = { d: 1.6 }) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = s * (0.4 + Math.random() * 0.6); pA.emit(x, y, z, Math.cos(a) * v, Math.random() * s, Math.sin(a) * v, 1.2, 6, r, g, b, o); } };
const hexRGB = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
function applyRoot() { player.setTrailColor(game.s.root ? ROOTS[game.s.root.el].trail : 0x9ff4ff); }

game.on('item', (id, n) => ui.toast(`获得 ${ITEMS[id].name} × ${n}`, id));
game.on('toast', (t) => ui.toast(t));
game.on('quest', () => { ui.tracker(); actors.refreshMarkers(); });
game.on('questNew', (q) => {
  ui.toast(`接受任务：${q.name}`); audio.sfx('quest');
  if (q.id === 'lavalord') actors.rescan(ARENA.x, ARENA.z + 2);
});
game.on('chapter', (ch) => { pendingCh = ch; });
game.on('questDone', (q) => {
  ui.banner(q.name, '任 务 完 成'); audio.sfx('quest');
  if (q.reward && q.reward.flags && q.reward.flags.includes('ending')) setTimeout(() => ui.chapter('仙途漫漫', '主线已完结 · 这方天地任你遨游'), 5000);
});
game.on('weapon', () => player.setWeapon(game.weaponModel));
game.on('gear', (g) => { const Q = QUALITY[g.q]; ui.toast(`获得灵宝 <b style="color:${Q.color}">【${Q.name}】${g.name}</b>`, g.icon); if (g.q >= 3) { audio.sfx('chest'); ui.callout(Q.name + ' · ' + g.name, Q.color); } });
game.on('equip', () => audio.sfx('pick'));
game.on('learn', (k) => { const S = SKILLS[k]; ui.banner(S.name, `习 得 功 法 · 按 ${S.key} 施 展`, 3600); audio.sfx('break'); flash = 0.4; const P = player.b; burst(P.x, P.y + 1, P.z, 120, 6, 1, 0.85, 0.4); });
game.on('full', () => {
  const r = REALMS[game.s.realm];
  ui.toast(r.gate && !game.count(r.gate) ? `修为圆满 · 需 ${ITEMS[r.gate].name} 方可突破（B）` : r.trib === 'big' ? '修为圆满 · 前往雷劫台渡劫（B）' : r.trib ? '修为圆满 · 突破时将有天劫降下（B）' : '修为圆满 · 按 B 突破境界');
});
game.on('used', () => { audio.sfx('pick'); const P = player.b; for (let i = 0; i < 16; i++) pA.emit(P.x + (Math.random() - 0.5), P.y + Math.random() * 1.6, P.z + (Math.random() - 0.5), 0, 1.5, 0, 0.9, 5, 0.5, 1, 0.6); });
game.on('break', (r) => {
  const big = r === R_QI || r === R_ZHUJI || r === R_JINDAN;
  ui.banner(REALMS[r].name, r === R_JINDAN ? '金 丹 大 道 · 九 霄 雷 动' : big ? '脱 胎 换 骨 · 境 界 大 成' : '境 界 突 破', big ? 5000 : 3200);
  audio.sfx('break'); flash = big ? 0.9 : 0.5; shake = 0.4;
  const P = player.b, c = game.s.root ? hexRGB(ROOTS[game.s.root.el].trail) : [1, 0.82, 0.35];
  for (let i = 0; i < (big ? 260 : 90); i++) { const a = Math.random() * 6.28, s = 3 + Math.random() * 7; pA.emit(P.x, P.y + 0.8, P.z, Math.cos(a) * s, Math.random() * 7, Math.sin(a) * s, 1.4, 6, c[0], c[1], c[2], { d: 1.6 }); }
  if (big) { pillarT = 3.5; pillar.material.color.setRGB(c[0], c[1], c[2]); }
  if (r === R_QI) ui.toast('习得「剑气」：Q 释放 · 右键格挡，敌人出手瞬间按下可弹反');
  if (r === 2) ui.toast('习得「瞬身」：V 键闪避，瞬身期间刀枪不入');
  if (r === R_WIND) ui.toast('习得「御风」：空中再按空格二段跳，下落时按住空格轻功滑翔');
  if (r === R_ZHUJI && game.flag('fly')) ui.toast('已可御剑飞行：按 F');
});
actors.onMobHit = (o, dmg) => {
  ui.target(o.name, o.hp, o.maxHp, o.def.boss);
  if (dmg > 0) numAt(String(Math.round(dmg)), o.b.x, o.b.y + o.height + 0.3, o.b.z, dmg > game.atk * 1.6 ? '#ffd040' : '#ffffff');
  else if (o.def.boss) { audio.sfx('boss'); ui.banner(o.name, o.def.title || '', 2600); shake = 0.5; }
  combatT = 6;
};
actors.onMobKill = (o) => {
  audio.sfx('die');
  if (o.xp) { game.gainXp(o.xp); numAt(`+${Math.round(o.xp * game.xpMult)} 修为`, o.b.x, o.b.y + o.height + 0.9, o.b.z, '#ffd866'); }
  for (const [id, p, a, b] of o.def.drops) if (Math.random() < p) game.add(id, a + Math.floor(Math.random() * (b - a + 1)));
  // 灵宝掉落：精英必掉、首领高品质、普通妖兽小概率
  if (!o.def.ambient && o.kind !== 'heartdemon') {
    const tier = clamp(game.s.realm * 0.7 + (o.lvl - 1) * 0.4 + (o.def.boss ? 1 : 0), 0, 10);
    if (o.def.boss) game.addGear(rollGear(tier, rollQuality(Math.random, 2.2, 3)));
    else if (o.elite) game.addGear(rollGear(tier, rollQuality(Math.random, 0.9 + o.elite.length * 0.3, 1)));
    else if (Math.random() < 0.05) game.addGear(rollGear(tier, rollQuality(Math.random, 0, 0)));
  }
  game.onKill(o.kind);
  side.onKill(o);
  for (let i = 0; i < 20; i++) pA.emit(o.b.x, o.b.y + 0.6, o.b.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 3, (Math.random() - 0.5) * 3, 1.1, 5, 0.7, 0.5, 1, { d: 1 });
  if (o.def.boss) {
    if (ui.tgt) ui.tgt.t = 1.5;
    hitStop = 0.25; flash = 0.5; shake = 0.8; tele.clear();
    burst(o.b.x, o.b.y + o.height * 0.5, o.b.z, 200, 9, 1, 0.8, 0.4);
    if (o.kind !== 'heartdemon') setTimeout(() => ui.banner(o.name, '伏 诛', 3000), 600);
    if (o.kind === 'wolfking') ui.toast('囚笼的妖力封印消散了——去救出灵狐');
    if (o.kind === 'lavagolem') ui.toast('魔君伏诛，回去见炎姬');
  }
};
function hurtPlayer(raw, src) {
  if (raw <= 0 || player.dead || player.invuln) return;
  let d = game.mitigate(raw) * (0.85 + Math.random() * 0.3);
  if (shieldT > 0) { d *= 0.3; shieldHit = 1; }
  d = Math.max(1, Math.round(d));
  game.s.hp -= d; combatT = 6; shake = Math.max(shake, 0.3);
  player.meditating = false;
  ui.hurt(); audio.sfx(shieldT > 0 ? 'block' : 'hurt');
  numAt(`-${d}`, player.b.x, player.b.y + 2.1, player.b.z, shieldT > 0 ? '#ffd890' : '#ff5a4a');
  if (game.s.hp <= 0) die(src);
}
function die() {
  game.s.hp = 0; player.dead = true; player.flying = false; deathT = 0; shieldT = 0; side.onDeath();
  audio.sfx('death'); ui.fade(true); ui.clearTarget();
  if (trib) { ui.banner('渡劫失败', '道基受损 · 一缕残魂飘回青云村……', 3600); endTrib(false); }
  else ui.banner('道消身陨', '一缕残魂飘回青云村……', 3600);
}
// 敌方命中结算：瞬身闪避 / 弹反 / 格挡 / 受伤；返回结果供 actors 处理（嗜血、剑气穿透）
actors.onPlayerHit = (dmg, o, kind) => {
  if (o && o.def && o.def.boss) { shake = Math.max(shake, 0.5); if (dmg <= 0) audio.sfx('boss'); }
  if (dmg <= 0 || player.dead) return 'none';
  if (player.invuln) {
    if (!player.pdUsed && player.time - player.dashAt < 0.32) perfectDodge(o);
    return 'dodge';
  }
  if (player.blocking && kind !== 'aoe') {
    if (player.time - player.blockAt < 0.24 + (game.buff('exec') ? 0.1 : 0)) { parry(o, kind); return 'parry'; }
    hurtPlayer(dmg * 0.3, o); audio.sfx('block');
    const P = player.b; burst(P.x + Math.sin(player.yaw) * 0.5, P.y + 1.2, P.z + Math.cos(player.yaw) * 0.5, 10, 3, 1, 0.85, 0.5);
    return 'block';
  }
  hurtPlayer(dmg, o);
  if (o && o.elite && o.elite.includes('frost')) player.slowT = 2.2;
  return 'hit';
};
function perfectDodge(o) {
  player.pdUsed = true; btT = 1.6 + game.buff('bt'); cds.dash = 0;
  ui.callout('完 美 闪 避', '#8fd8ff'); audio.sfx('perfect');
  const P = player.b, tc = player.trail.color;
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28; pA.emit(P.x, P.y + 1, P.z, Math.cos(a) * 6, Math.random() * 3 - 1, Math.sin(a) * 6, 0.6, 6, tc.r, tc.g, tc.b, { d: 3 }); }
  if (o && o.b && !o.def.boss && Math.random() < 0.5) actors.stagger(o, 1.8);
}
function parry(o, kind) {
  ui.callout('弹 反', '#ffd860'); audio.sfx('parry');
  hitStop = 0.14; shake = Math.max(shake, 0.35); flash = Math.max(flash, 0.15);
  const P = player.b, hx = P.x + Math.sin(player.yaw) * 0.6, hz = P.z + Math.cos(player.yaw) * 0.6;
  for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, b = Math.random() * 2 - 1; pA.emit(hx, P.y + 1.25, hz, Math.cos(a) * 7, b * 5, Math.sin(a) * 7, 0.35, 6, 1, 0.85, 0.4, { g: 6 }); }
  game.s.mp = Math.min(game.maxMp, game.s.mp + game.maxMp * 0.12);
  if (o && o.b && kind === 'melee') { actors.stagger(o, o.def.boss ? 1.6 : 2.6); const d = Math.hypot(o.b.x - P.x, o.b.z - P.z) || 1; o.kx = (o.b.x - P.x) / d * 7; o.kz = (o.b.z - P.z) / d * 7; }
}
actors.onImpact = (x, y, z, kind) => {
  const d = Math.hypot(x - player.b.x, z - player.b.z), k = Math.max(0, 1 - d / 40);
  shake = Math.max(shake, (kind === 'sword' ? 0.12 : kind === 'ring' ? 0.8 : 0.6) * k);
  audio.sfx(kind === 'sword' ? 'swordhit' : 'impact');
};
actors.onBossEvent = (type, o) => {
  if (type === 'howl') { audio.sfx('howl'); shake = 0.7; ui.toast('妖狼王仰天长啸，血狼群闻声而来！'); if (o) for (let i = 0; i < 60; i++) { const a = Math.random() * 6.28; pN.emit(o.b.x, o.b.y + 2, o.b.z, Math.cos(a) * 9, 0.5, Math.sin(a) * 9, 1, 8, 0.6, 0.15, 0.12, { d: 2, a: 0.5 }); } }
  else if (type === 'meteor') audio.sfx('boss');
  else if (type === 'demondash') audio.sfx('dash');
  else if (type === 'demonqi') audio.sfx('qi');
  else if (type === 'petheal') { ui.toast('灵狐吐出一缕灵息，为你疗伤'); audio.sfx('pick'); }
};

function loadAround(x, z) { world.loadAll(x, z); }
// 通用传送：淡出 → 传送 → 回调；y 为空时落在地面
function teleportPlayer(x, y, z, cb, instant) {
  const go = () => {
    loadAround(x, z);
    player.teleport(x, y ?? world.standY(x, world.groundY(x, z) + 8, z) + 0.05, z);
    player.flying = false; player.meditating = false; player.camYaw = 0; player.yaw = Math.PI;
    burst(x, (y ?? player.b.y) + 1, z, 120, 7, 0.6, 0.6, 1); flash = Math.max(flash, 0.3);
    ui.fade(false); place = '';
    if (cb) cb();
  };
  if (instant) { go(); return; }
  ui.fade(true); audio.sfx('portal');
  const P = player.b; burst(P.x, P.y + 1, P.z, 140, 7, 0.6, 0.6, 1);
  setTimeout(go, 650);
}
const gate = buildGate(scene, colliders, world);
const trial = new Trial({ scene, colliders, actors, game, player, ui, audio, burst, setFlash: (f) => { flash = Math.max(flash, f); }, teleportPlayer, save: () => game.save(pos()) });
pois.interact.push({ type: 'trial', x: TRIAL_GATE.x, y: gate.y + 1, z: TRIAL_GATE.z, r: 3.4, label: '秘境之门 · 青云试炼', onUse: () => {
  if (game.s.realm < R_QI) { ui.toast('秘境凶险——踏入炼气境后再来吧'); return; }
  const best = game.s.trialBest || 0;
  ui.dialog({ name: '秘境之门', pages: [`门中灵光流转，隐约可见云端浮岛。秘境共五层，每层清剿妖邪后可得一份机缘，最深处镇守着镜中剑魔。${best ? `（最深抵达：第 ${best} 层）` : ''}`],
    choices: [{ label: '踏入秘境', fn: () => { ui.close(true); trial.enter(); return true; } }] });
} });
const side = new Side({ scene, mats, colliders, world, pois, actors, game, player, ui, audio, input, burst, pA, pN, sky, weather, save: () => game.save(pos()) });
ui.trackExtra = () => side.trackHtml();
ui.rankName = () => side.rankName();
game.on('passive', (id) => { ui.banner(ITEMS[id].name, '参 悟 功 法 · 永 久 生 效', 3200); audio.sfx('break'); flash = 0.35; const P = player.b; burst(P.x, P.y + 1, P.z, 90, 5, 0.6, 1, 0.8); });
function respawn() {
  if (trial.active) trial.leave(false, true);
  const y = world.standY(0, 6, 26);
  player.teleport(0, y, 26); player.dead = false; player.yaw = Math.PI; player.camYaw = 0;
  game.s.hp = game.maxHp; game.s.mp = game.maxMp; game.s.xp = Math.floor(game.s.xp * 0.9);
  loadAround(0, 26);
  ui.fade(false);
}
function teleportTo(id) {
  const p = PORTALS.find((q) => q.id === id), it = pois.portals.find((q) => q.id === id);
  if (!p || !it) return;
  ui.fade(true); audio.sfx('portal'); player.meditating = false; player.flying = false;
  const P = player.b; burst(P.x, P.y + 1, P.z, 140, 7, 0.4, 0.85, 1);
  setTimeout(() => {
    const x = it.x, z = it.z + 5.2;
    loadAround(x, z);
    player.teleport(x, world.standY(x, it.y + 4, z) + 0.05, z); player.camYaw = 0; player.yaw = Math.PI;
    burst(x, it.y + 1, z, 140, 7, 0.4, 0.85, 1); flash = 0.4;
    ui.fade(false); place = '';
  }, 650);
}
ui.on('teleport', teleportTo);

function interact(it) {
  if (!it) return;
  if (it.poi && it.poi.onUse) { it.poi.onUse(it.poi); return; }
  const g = game, P = player.b;
  if (it.type === 'npc') {
    const n = it.npc;
    n.talkT = 4;
    if (n.wander) { const L = n.town ? TOWN_LINES : VILLAGER_LINES; ui.dialog({ name: n.name, pages: [L[(Math.random() * L.length) | 0]] }); }
    else ui.dialog(g.talk(n.id), () => { actors.refreshMarkers(); ui.tracker(); g.save(pos()); });
  } else if (it.type === 'herb') {
    actors.pick(it.herb); g.add(it.herb.kind, 1); audio.sfx('pick'); side.onGather(it.herb.kind);
  } else if (it.type === 'chest') {
    if (g.openChest(it.poi.id)) {
      audio.sfx('chest'); ui.banner(it.poi.label, '宝 匣 开 启'); flash = 0.4;
      for (let i = 0; i < 120; i++) pA.emit(it.poi.x, it.poi.y + 0.5, it.poi.z, (Math.random() - 0.5) * 6, 2 + Math.random() * 7, (Math.random() - 0.5) * 6, 1.6, 6, 1, 0.85, 0.4, { g: 5, d: 0.5 });
      g.save(pos());
    }
  } else if (it.type === 'alchemy') ui.open('alch');
  else if (it.type === 'forge') ui.open('forge');
  else if (it.type === 'portal') {
    const id = it.poi.id;
    if (!g.s.portals[id]) {
      g.s.portals[id] = 1; portalT = 0;
      ui.banner(it.poi.label.replace('传送阵 · ', ''), '传 送 阵 已 点 亮', 3000); audio.sfx('portal'); flash = 0.35;
      burst(it.poi.x, it.poi.y + 0.3, it.poi.z, 160, 8, 0.4, 0.85, 1, { g: -1, d: 1 });
      g.save(pos());
    } else ui.open('map', { teleport: id });
  } else if (it.type === 'cage') {
    const q = g.s.quests.valley;
    if (!q) { ui.toast('笼中的小狐狸警惕地看着你，囚笼上的妖力封印纹丝不动……'); return; }
    if (q.s === 1 && q.c[0] < 1) { ui.toast('囚笼被妖狼王的妖力封着——先击败妖狼王！'); return; }
    g.s.flags.fox = 1; actors.syncPet(); g.emit('quest');
    const c = it.poi; burst(c.x, c.y + 1, c.z, 160, 6, 0.75, 0.95, 1); flash = 0.4; audio.sfx('chest');
    ui.banner('灵狐 · 雪团', '九 尾 灵 狐 认 你 为 主', 3600);
    ui.toast('灵狐会跟随你作战；御剑时它会跳上剑尾');
    g.save(pos());
  } else if (it.type === 'root') {
    if (g.s.root) { const R = ROOTS[g.s.root.el]; ui.toast(`你的灵根：${g.rootName()}（${R.desc}）`); return; }
    if (!g.done('intro')) { ui.toast('石面冰凉，似乎需要村长指点才能使用……'); return; }
    const r = g.testRoot(), R = ROOTS[r.el], G = ROOT_GRADES[r.g], c = hexRGB(R.trail);
    applyRoot(); audio.sfx('break'); flash = 0.6; shake = 0.3; pillarT = 2.5; pillar.material.color.setRGB(c[0], c[1], c[2]);
    const o = it.poi;
    for (let i = 0; i < 200; i++) { const a = Math.random() * 6.28, rr = Math.random() * 1.2; pA.emit(o.x + Math.cos(a) * rr, o.y + Math.random() * 3, o.z + Math.sin(a) * rr, Math.cos(a) * 2, 4 + Math.random() * 8, Math.sin(a) * 2, 1.6, 6, c[0], c[1], c[2], { d: 0.8 }); }
    ui.banner(`${R.name}灵根`, `${G.name} · ${R.desc} · 修炼速度 ×${G.xp}`, 5000);
    g.save(pos());
  } else if (it.type === 'encounter') {
    const e = it.poi;
    ui.dialog({ name: '古修残魂', pages: [LORE[e.id % LORE.length], '……（残魂化作点点灵光，没入你的眉心）'] }, () => {
      e.done = true; g.s.flags['lore' + e.id] = 1;
      g.gainXp(60 + g.s.realm * 25, true); g.add('stone', 15 + g.s.realm * 3);
      ui.banner('奇 遇', '古修残魂 · 得其遗泽', 3000); audio.sfx('quest');
      burst(e.x, e.y + 1, e.z, 120, 5, 0.55, 0.85, 1);
      g.save(pos());
    });
  } else if (it.type === 'meteor') {
    const m = it.poi;
    g.add('meteor_iron', 1); audio.sfx('chest');
    scene.remove(m.mesh); pois.interact.splice(pois.interact.indexOf(m), 1);
    burst(m.x, m.y + 0.5, m.z, 60, 5, 0.6, 0.75, 1);
  }
}
const pos = () => (trial.active ? [TRIAL_GATE.x + 2.5, gate.y + 0.1, TRIAL_GATE.z + 2.5, 0] : [player.b.x, player.b.y, player.b.z, player.camYaw]);
function spiritMult() {
  const P = player.b;
  for (const s of pois.spirit) if (Math.hypot(P.x - s.x, P.z - s.z) < s.r && (s.minY === undefined || P.y >= s.minY)) return s;
  return null;
}
const atTrib = () => Math.hypot(player.b.x - TRIB.x, player.b.z - TRIB.z) < 13 && player.b.y > TRIB_H - 2;

// ---- 技能
function aimPoint(maxD) {
  const f = player.fwd, cp = camera.position;
  const tg = actors.aimTarget(cp.x, cp.y, cp.z, f, maxD, 0.985);
  if (tg) return { x: tg.b.x, y: tg.b.y + tg.height * 0.5, z: tg.b.z, tg };
  const d = Math.min(maxD, 20 + world.rayHit(cp.x, cp.y, cp.z, f.x, f.y, f.z, maxD));
  return { x: cp.x + f.x * d, y: cp.y + f.y * d, z: cp.z + f.z * d, tg: null };
}
function spend(k) {
  const S = SKILLS[k];
  if (!game.hasSkill(k)) { ui.toast({ qi: '踏入炼气境后方可施展剑气', dash: '炼气二层后自悟「瞬身」', shield: '尚未参悟《金刚护体诀》', wanjian: '尚未参悟《万剑归宗》' }[k]); return false; }
  if (cds[k] > 0 || player.dead) return false;
  if (game.s.mp < S.mp) { ui.toast('灵力不足'); return false; }
  game.s.mp -= S.mp; cds[k] = S.cd;
  return true;
}
function castQi() {
  if (!spend('qi')) return;
  player.meditating = false;
  const P = player.b, ox = P.x, oy = P.y + 1.25, oz = P.z, t = aimPoint(70);
  v3.set(t.x - ox, t.y - oy, t.z - oz).normalize();
  player.yaw = Math.atan2(v3.x, v3.z); player.castT = 0;
  actors.shoot(ox + v3.x * 0.7, oy, oz + v3.z * 0.7, v3.x, v3.y, v3.z, game.atk * 1.4 * game.qiMult * (0.9 + Math.random() * 0.2));
  audio.sfx('qi');
}
function castDash() {
  if (player.flying || player.dashT > 0 || !spend('dash')) return;
  if (!player.dash(input)) { cds.dash = 0; game.s.mp += SKILLS.dash.mp; return; }
  audio.sfx('dash');
  const P = player.b; for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28; pN.emit(P.x, P.y + 0.1, P.z, Math.cos(a) * 3, 0.5 + Math.random(), Math.sin(a) * 3, 0.7, 8, 0.85, 0.85, 0.82, { d: 2, a: 0.5 }); }
}
function castShield() {
  if (!spend('shield')) return;
  shieldT = 6; audio.sfx('shield'); flash = 0.2;
  const P = player.b; burst(P.x, P.y + 1, P.z, 60, 4, 1, 0.8, 0.35);
}
function castWanjian() {
  if (!spend('wanjian')) return;
  const P = player.b, t = aimPoint(40);
  let cx = t.x, cz = t.z;
  if (!t.tg) { cx = P.x + Math.sin(player.yaw) * 9; cz = P.z + Math.cos(player.yaw) * 9; }
  player.yaw = Math.atan2(cx - P.x, cz - P.z); player.castT = 0; player.meditating = false;
  actors.swordRain(cx, cz, 10, game.atk * 1.15 * game.qiMult, 22, P.y);
  tele.add(cx, t.tg ? t.tg.b.y : world.standY(cx, P.y + 3, cz), cz, 10, 1.9, 0x7fd8ff, null);
  audio.sfx('wanjian'); flash = 0.25; shake = 0.3;
  for (let i = 0; i < 80; i++) { const a = Math.random() * 6.28; pA.emit(P.x, P.y + 1.4, P.z, Math.cos(a) * 1.5, 8 + Math.random() * 10, Math.sin(a) * 1.5, 0.8, 5, 0.55, 0.9, 1, { d: 1 }); }
}

// ---- 天劫
const CNUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
game.on('tribulation', (kind) => {
  trib = { kind, n: kind === 'big' ? 9 : 3, i: 0, t: 3, phase: 'bolts', demon: null };
  player.meditating = false; player.flying = false;
  ui.chapter(kind === 'big' ? '九霄雷劫' : '筑基天劫', kind === 'big' ? '九道天雷 · 一劫心魔 · 瞬身(V)可避' : '三道天雷降下 · 挺住！');
  audio.sfx('thunder'); flash = 0.5; shake = 0.6;
});
function endTrib(ok) {
  if (!trib) return;
  if (trib.demon && !trib.demon.dead) { trib.demon.dead = true; trib.demon.deathT = 0.6; }
  tele.clear(); trib = null;
  if (ok) game.completeBreak();
}
function updateTrib(dt) {
  if (!trib || player.dead) return;
  const P = player.b, big = trib.kind === 'big';
  if (trib.phase === 'bolts') {
    trib.t -= dt;
    if (trib.t <= 0 && trib.i < trib.n) {
      const i = trib.i++, last = i === trib.n - 1;
      trib.t = big ? 2.3 : 2.8;
      const r = last ? 5.5 : 3.3, pts = [[0, 0]];
      if (big && i >= 4) for (let k = 0; k < (i >= 7 ? 4 : 2); k++) pts.push([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16]);
      pts.forEach((o, k) => {
        tele.add(P.x + o[0], P.y, P.z + o[1], r, last ? 2 : 1.6, last ? 0xd0b0ff : 0x9fb8ff, (h) => {
          const gy = world.standY(h.x, h.y + 3, h.z);
          bolts.strike(h.x, gy, h.z, { r: last ? 0.55 : 0.26, life: 0.5, top: 200 });
          if (!player.dead && Math.hypot(P.x - h.x, P.z - h.z) < r && Math.abs(P.y - gy) < 4) hurtPlayer(game.maxHp * (big ? 0.17 : 0.22) * (last ? 1.6 : 1) * (game.rootEl === 'thunder' ? 0.5 : 1));
          flash = Math.max(flash, last ? 0.9 : 0.6); shake = Math.max(shake, last ? 1.1 : 0.7); audio.sfx('thunder');
          for (let q = 0; q < 50; q++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 8; pA.emit(h.x, gy + 0.3, h.z, Math.cos(a) * s, Math.random() * 6, Math.sin(a) * s, 0.6, 6, 0.75, 0.82, 1, { d: 3 }); }
        }, k === 0 ? () => P : null);
      });
      ui.toast(last ? `第${CNUM[i]}道天雷 · 最后一劫！` : `第${CNUM[i]}道天雷！`);
    }
    if (trib.i >= trib.n && trib.t <= (big ? -0.2 : 0.4)) {
      if (big) {
        trib.phase = 'demon';
        const a = player.yaw, x = P.x + Math.sin(a) * 7, z = P.z + Math.cos(a) * 7;
        trib.demon = actors.spawnBoss('heartdemon', x, z, world.standY(x, P.y + 3, z));
        trib.demon.name = '心魔 · 另一个你';
        ui.chapter('心 魔 劫', '斩不断的，从来都是自己');
        audio.sfx('boss'); flash = 0.5;
        for (let q = 0; q < 120; q++) { const aa = Math.random() * 6.28; pA.emit(x, P.y + 1, z, Math.cos(aa) * 6, Math.random() * 4, Math.sin(aa) * 6, 1, 7, 0.55, 0.2, 0.9, { d: 2 }); }
      } else endTrib(true);
    }
  } else if (trib.phase === 'demon' && (!trib.demon || trib.demon.dead)) endTrib(true);
}

// ---- 流星（掉落天外陨铁）
function spawnMeteor(x, z, t0, world_) {
  const y = world.groundY(x, z);
  meteors.push({ x, y, z, t: -t0, dur: t0, sx: x + 120, sy: y + 260, sz: z - 80, world: world_ });
}
function updateMeteors(dt) {
  for (const m of meteors) {
    m.t += dt;
    const dur = m.dur || 0.9, u = clamp(1 + m.t / Math.min(dur, m.world ? 3 : 0.9), 0, 1);
    if (!m.mesh) { m.mesh = new THREE.Mesh(meteorGeo, meteorMat); m.mesh.scale.setScalar(m.world ? 1.1 : 1.6); m.mesh.frustumCulled = false; scene.add(m.mesh); }
    m.mesh.visible = u > 0 && m.t < 0;
    if (u > 0) {
      const x = m.sx + (m.x - m.sx) * u, y = m.sy + (m.y - m.sy) * u, z = m.sz + (m.z - m.sz) * u;
      m.mesh.position.set(x, y, z); m.mesh.rotation.x += dt * 5;
      for (let i = 0; i < 4; i++) pA.emit(x + (Math.random() - 0.5), y + (Math.random() - 0.5), z + (Math.random() - 0.5), (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.9, m.world ? 7 : 9, 1, 0.5 + Math.random() * 0.3, 0.15, { d: 1 });
      if (Math.random() < 0.5) pN.emit(x, y, z, 0, 0.5, 0, 2.5, 14, 0.3, 0.27, 0.25, { a: 0.5 });
    }
    if (m.t >= 0 && !m.done) {
      m.done = true; scene.remove(m.mesh);
      if (m.world) {
        actors.onImpact(m.x, m.y, m.z, 'meteor'); flash = Math.max(flash, 0.3);
        for (let k = 0; k < 60; k++) { const q = Math.random() * 6.28; pA.emit(m.x, m.y + 0.3, m.z, Math.cos(q) * 8, 2 + Math.random() * 6, Math.sin(q) * 8, 1, 7, 1, 0.6, 0.2, { g: 10 }); }
        const ore = new THREE.Mesh(meteorGeo, oreMat); ore.scale.set(0.8, 0.55, 0.7); ore.position.set(m.x, m.y + 0.25, m.z); ore.castShadow = true; scene.add(ore);
        pois.interact.push({ type: 'meteor', x: m.x, y: m.y, z: m.z, r: 2.6, label: '拾取 · 天外陨铁', mesh: ore });
        ui.toast('流星坠地——去看看落在了哪里');
      }
    }
  }
  if (meteors.some((m) => m.done)) { const keep = meteors.filter((m) => !m.done); meteors.length = 0; meteors.push(...keep); }
}

function startGame(cont, sel) {
  audio.init();
  if (cont && game.load()) { /* 已读档 */ } else { Game.wipe(); game.reset(); game.s.lookSel = { ...DEFAULT_SEL, ...(sel || {}) }; }
  player.setLook(lookFromSel({ ...DEFAULT_SEL, ...(game.s.lookSel || {}) }));
  const p = game.s.pos;
  if (p) { player.teleport(p[0], p[1] + 0.2, p[2]); player.camYaw = p[3] || 0; }
  else { player.teleport(0, world.standY(0, 8, 71) + 0.1, 71); player.camYaw = 0; player.camPitch = 0.12; }
  player.yaw = Math.PI; player.flying = false; player.meditating = false; player.dead = false;
  player.setWeapon(game.weaponModel);
  for (const e of encounters) { e.done = game.flag('lore' + e.id); e.fade = e.done ? 0 : 1; e.m.group.visible = !e.done; }
  side.start();
  applyRoot();
  loadAround(player.b.x, player.b.z);
  ui.begin(); ui.tracker(); actors.refreshMarkers();
  place = '';
  if (!p) {
    ui.dialog({ name: '——', pages: ['你自一场大梦中醒来，身在一座石桥之畔。', '桥的那头，是炊烟袅袅的青云村；远山之上，几座仙山悬于云端。', '传闻那里曾是青云仙宗的山门……先进村，去北边的大殿拜见村长吧。'] }, () => { pendingCh = '第一章 · 青云初醒'; });
  }
}
ui.on('start', startGame);
// 开局捏人：人物立于石桥前，镜头正对
const CR_POS = { x: 0, z: 71 };
let crYaw = 0;
ui.on('create', () => {
  audio.init();
  player.setLook(lookFromSel(DEFAULT_SEL));
  player.teleport(CR_POS.x, world.standY(CR_POS.x, 8, CR_POS.z) + 0.05, CR_POS.z);
  loadAround(CR_POS.x, CR_POS.z);
  crYaw = 0.35;
  ui.openCreator(CREATOR, DEFAULT_SEL);
  // 预热常用造型，切换时少等待
  preloadShapes(['m', 'f'].flatMap((s) => CREATOR.hair[s].map(([h]) => lookFromSel({ ...DEFAULT_SEL, sex: s, hair: h, outfit: s === 'f' ? 'dress' : 'robe' }))));
});
ui.on('look', (sel) => player.setLook(lookFromSel(sel)));
canvas.addEventListener('pointermove', (e) => { if (ui.creating && e.buttons) crYaw += (e.movementX || 0) * 0.012; });
ui.on('sfx', (n) => audio.sfx(n));
ui.on('crafted', () => { ui.tracker(); });
ui.on('save', () => { ui.toast(game.save(pos()) ? '进度已保存' : '保存失败'); });
ui.on('home', () => { side.cancel(); if (trial.active) { trial.leave(false); return; } player.flying = false; endTrib(false); player.teleport(0, world.standY(0, 6, 26), 26); loadAround(0, 26); });
ui.on('reset', () => { Game.wipe(); location.reload(); });
ui.on('opt', (k, v) => { opts[k] = v; applyOpts(); });
addEventListener('beforeunload', () => { if (ui.started && !player.dead && !trib) game.save(pos()); });

// ---- 初始加载与调试接口
const focus = new THREE.Vector3(0, 2, 0);
loadAround(0, 0);
ui.showTitle(Game.hasSave());
window.G = { renderer, scene, camera, world, sky, water, colliders, pois, mats, fx, game, player, actors, ui, input, audio, weather, meteors, tele };
window.G.view = (x, y, z, tx, ty, tz, h) => { debugCam = true; camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); focus.set(tx, ty, tz); if (h !== undefined) game.s.hour = h; loadAround(tx, tz); return 'ok'; };
window.G.play = () => { debugCam = false; return 'ok'; };
window.G.tp = (x, z, y) => { player.teleport(x, y === undefined ? world.standY(x, world.groundY(x, z) + 28, z) + 0.2 : y, z); loadAround(x, z); return 'ok'; };
window.G.cheat = (r) => {
  game.s.realm = r; game.s.flags.meditate = game.s.flags.alchemy = 1; if (r >= R_ZHUJI) game.s.flags.fly = 1;
  game.s.hp = game.maxHp; game.s.mp = game.maxMp; if (!game.s.weapon) game.add('sword_iron', 1); game.emit('quest'); return 'ok';
};
// 跳到某任务：之前的主线视为完成（只发放旗标）
window.G.skip = (id) => {
  for (const q of QUESTS) { if (q.id === id) break; if (!game.s.quests[q.id] || game.s.quests[q.id].s !== 2) { game.s.quests[q.id] = { s: 2, c: q.obj.map(() => 0) }; for (const f of (q.reward && q.reward.flags) || []) if (f !== 'ending') game.s.flags[f] = 1; } }
  if (!game.s.quests[id]) game.accept(id);
  actors.refreshMarkers(); ui.tracker(); return 'ok';
};
window.G.meteor = (d = 30) => { const P = player.b, a = Math.random() * 6.28; spawnMeteor(P.x + Math.cos(a) * d, P.z + Math.sin(a) * d, 3, true); return 'ok'; };
window.G.loot = (q, tier = 3, slot) => { game.addGear(rollGear(tier, q, Math.random, slot)); return 'ok'; };
window.G.trial = trial;
window.G.side = side;
window.G.rain = (k = 1) => { weather.target = k; weather.k = k; weather.t = 300; return 'ok'; };
if (params.get('auto')) startGame(params.get('auto') === '2');
if (params.get('cam')) { const c = params.get('cam').split(',').map(Number); window.G.view(c[0], c[1], c[2], c[3], c[4], c[5], params.get('hour') ? Number(params.get('hour')) : undefined); }

let last = performance.now(), frames = 0, acc = 0, titleA = 0.6;
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000); last = now; time += rdt;
  frames++; acc += rdt;
  if (acc > 2) { window.G.fps = frames / acc; frames = 0; acc = 0; }
  // 命中顿帧：短暂放慢角色与妖兽
  const dt = hitStop > 0 ? rdt * 0.12 : rdt;
  hitStop = Math.max(0, hitStop - rdt);
  btT = Math.max(0, btT - rdt);
  ui.bulletTime(btT > 0 ? Math.min(1, btT * 3) : 0);
  const P = player.b, s = game.s;
  const playing = ui.started && !ui.modal;
  input.active = playing && now - ui.cool > 160;
  let near = null;

  if (!ui.started && ui.creating) {
    const m = player.model, b = player.b;
    m.group.visible = true;
    m.group.position.set(b.x, b.y, b.z); m.group.rotation.set(0, crYaw, 0); player.yaw = crYaw;
    m.update(rdt, { speed: 0, time, idle: 'normal' }, 0);
    player._ribbons(rdt);
    if (!debugCam) { camera.position.set(b.x + 0.1, b.y + 1.3, b.z + 2.9); camera.lookAt(b.x + 0.62, b.y + 1.02, b.z); focus.set(b.x, b.y, b.z); }
  } else if (!ui.started) {
    titleA += rdt * 0.035;
    for (const r of player.ribbons) r.mesh.visible = false;
    if (!debugCam) { camera.position.set(Math.sin(titleA) * 78, 24 + Math.sin(titleA * 1.7) * 5, 26 + Math.cos(titleA) * 62); camera.lookAt(0, 9, -18); }
    if (!debugCam) focus.set(0, 2, 0);
    player.model.group.visible = false;
  } else {
    player.model.group.visible = true;
    if (pendingCh && !ui.modal) { const [a, b] = pendingCh.split(' · '); ui.chapter(a, b || ''); pendingCh = null; }
    if (playing) {
      const r = s.realm, canFly = game.flag('fly') && r >= R_ZHUJI;
      if (deathT >= 0) { deathT += rdt; if (deathT > 2.6) { deathT = -1; respawn(); } }
      if (input.active && !player.dead && !side.busy) {
        const ex = input.clicked[0] && player.attackT < 0 ? actors.execTarget(P, Math.atan2(player.fwd.x, player.fwd.z)) : null;
        if (ex) { if (player.startExecute(ex)) { audio.sfx('dash'); ex.stagger = Math.max(ex.stagger, 0.8); } }
        else if (input.clicked[0] && player.startAttack()) {
          const f = player.fwd, tg = actors.aimTarget(P.x, P.y + 0.8, P.z, v3.set(f.x, 0, f.z).normalize(), 5, 0.15);
          if (tg) player.yaw = Math.atan2(tg.b.x - P.x, tg.b.z - P.z);
        }
        if (input.hit('KeyQ')) castQi();
        if (input.hit('KeyV')) castDash();
        if (input.hit('KeyG')) castShield();
        if (input.hit('KeyR')) castWanjian();
        if (input.hit('KeyC')) {
          if (!game.flag('meditate')) ui.toast('尚未习得引气诀——先去拜见村长');
          else if (player.flying || !P.onGround) ui.toast('需在地面静坐');
          else { player.meditating = !player.meditating; audio.sfx('ui'); }
        }
        if (input.hit('KeyB') && !trib) game.breakthrough(atTrib());
        if (input.hit('KeyF')) {
          if (!canFly) ui.toast(r >= R_ZHUJI ? '尚未得授飞剑——去找云鹤道长' : '筑基之后方可御剑飞行');
          else if (trib) ui.toast('天劫之下，无处可逃！');
          else if (trial.active) ui.toast('秘境之中禁空，无法御剑');
          else { player.flying = !player.flying; player.meditating = false; if (player.flying) { P.vy = 5; audio.sfx('fly'); } }
        }
        if (input.hit('KeyM')) ui.open('map', {});
        if (input.hit('Digit1')) game.useItem('huichun');
        if (input.hit('Digit2')) game.useItem('ningshen');
        if (input.hit('Digit3')) game.useItem('juqi');
      }
      player.update(dt, input, world, { fly: canFly, doubleJump: r >= R_WIND, glide: r >= R_WIND, speed: (r >= R_ZHUJI ? 1.15 : 1) * (1 + game.eq('spd')) * (player.slowT > 0 ? 0.6 : 1), canBoost: s.mp > 1, lock: side.lock });
      for (const e of player.events) {
        if (e === 'swing3') {
          const o = player.execTarget;
          if (o && !o.dead) {
            const dmg = (o.def.boss ? Math.max(game.atk * 5, o.maxHp * 0.1) : o.elite ? Math.max(game.atk * 6, o.maxHp * 0.6) : o.hp + 1) * (1 + game.buff('exec'));
            o.stagger = 0; if (o.stagLab) o.stagLab.visible = false;
            const d = Math.hypot(o.b.x - P.x, o.b.z - P.z) || 1;
            actors.hitMob(o, dmg, (o.b.x - P.x) / d, (o.b.z - P.z) / d);
            numAt('处决 ' + Math.round(dmg), o.b.x, o.b.y + o.height + 0.5, o.b.z, '#ff7a5a');
            hitStop = 0.22; shake = Math.max(shake, 0.6); flash = Math.max(flash, 0.25); btT = Math.max(btT, 0.5);
            ui.callout('处 决', '#ff7a5a'); audio.sfx('exec');
            const tc = player.trail.color;
            for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, sp = 3 + Math.random() * 9; pA.emit(o.b.x, o.b.y + o.height * 0.55, o.b.z, Math.cos(a) * sp, (Math.random() - 0.3) * 6, Math.sin(a) * sp, 0.7, 6, tc.r, tc.g, tc.b, { d: 2.5 }); }
            if (game.eq('leech')) s.hp = Math.min(game.maxHp, s.hp + dmg * game.eq('leech'));
          }
        } else if (e === 'swing0' || e === 'swing1' || e === 'swing2') {
          const c = +e[5], fin = c === 2, crit = Math.random() < 0.12 + game.eq('crit') + (fin ? 0.1 : 0) + (btT > 0 ? 0.5 : 0);
          const dmg = game.atk * [1, 1.15, 1.9][c] * (0.85 + Math.random() * 0.3) * (crit ? 1.8 + game.eq('critDmg') : 1) * (btT > 0 ? 1.3 : 1);
          const n = actors.melee(P, player.yaw, fin ? 3.8 : 2.9, dmg, fin ? -0.3 : 0.25);
          if (n && game.eq('leech')) s.hp = Math.min(game.maxHp, s.hp + dmg * n * game.eq('leech'));
          audio.sfx(n ? 'hit' : 'slash'); if (n) { shake = Math.max(shake, crit || fin ? 0.32 : 0.14); combatT = 6; hitStop = fin ? 0.1 : 0.05; }
          const tc = player.trail.color;
          if (fin) {
            audio.sfx('slam');
            for (let i = 0; i < 36; i++) { const a = (i / 36) * 6.28; pA.emit(P.x + Math.sin(a) * 1.2, P.y + 0.15, P.z + Math.cos(a) * 1.2, Math.sin(a) * 7, 0.4, Math.cos(a) * 7, 0.4, 7, tc.r, tc.g, tc.b, { d: 4 }); pN.emit(P.x + Math.sin(a) * 1.5, P.y + 0.1, P.z + Math.cos(a) * 1.5, Math.sin(a) * 4, 0.8, Math.cos(a) * 4, 0.8, 9, 0.62, 0.58, 0.52, { d: 2.5, a: 0.5 }); }
            if (r >= R_QI) { const fx2 = Math.sin(player.yaw), fz2 = Math.cos(player.yaw); actors.shoot(P.x + fx2 * 0.8, P.y + 1.0, P.z + fz2 * 0.8, fx2, 0, fz2, game.atk * 0.9 * game.qiMult); }
          } else for (let i = -4; i <= 4; i++) { const a = player.yaw + i * 0.2 * (c ? -1 : 1); pA.emit(P.x + Math.sin(a) * 1.7, P.y + 1.15 - i * 0.05, P.z + Math.cos(a) * 1.7, Math.sin(a) * 3, 0, Math.cos(a) * 3, 0.16, 7, tc.r, tc.g, tc.b, { d: 4 }); }
        } else if (e === 'jump') audio.sfx('jump');
        else if (e === 'jump2') { audio.sfx('jump2'); const tc = player.trail.color; for (let i = 0; i < 16; i++) { const a = i * 0.39; pA.emit(P.x, P.y, P.z, Math.cos(a) * 3.5, -0.5, Math.sin(a) * 3.5, 0.45, 5, tc.r, tc.g, tc.b, { d: 3 }); } }
        else if (e === 'step' || e === 'land' || e === 'stepRun') audio.sfx('step');
        else if (e === 'landHard') { audio.sfx('land'); shake = Math.max(shake, 0.18); for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28; pN.emit(P.x, P.y + 0.1, P.z, Math.cos(a) * 3.5, 0.6 + Math.random(), Math.sin(a) * 3.5, 0.9, 8, 0.66, 0.62, 0.55, { d: 2.5, a: 0.5 }); } }
        else if (e === 'ghost') { const tc = player.trail.color; pA.emit(P.x, P.y + 1, P.z, 0, 0.3, 0, 0.4, 9, tc.r, tc.g, tc.b, { a: 0.6 }); }
        else if (e === 'splash') { audio.sfx('splash'); for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28; pN.emit(P.x, WATER_SURF, P.z, Math.cos(a) * 2.5, 2 + Math.random() * 3.5, Math.sin(a) * 2.5, 0.8, 9, 0.85, 0.93, 1, { g: 12, a: 0.7 }); } }
      }
      if (player.gliding && Math.random() < 0.6) { const tc = player.trail.color; pA.emit(P.x - Math.sin(player.yaw) * 0.4, P.y + 1.1, P.z - Math.cos(player.yaw) * 0.4, 0, 0, 0, 0.6, 4, tc.r, tc.g, tc.b, { a: 0.5 }); }
      // 冷却、修炼与恢复
      for (const k in cds) cds[k] = Math.max(0, cds[k] - rdt);
      combatT = Math.max(0, combatT - rdt);
      const sp = spiritMult(), regen = 1 + game.eq('regen');
      if (player.meditating) {
        const mult = sp ? sp.mult : 1;
        game.gainXp((1.25 + r * 0.14) * mult * rdt);
        s.mp = Math.min(game.maxMp, s.mp + game.maxMp * 0.14 * regen * rdt); s.hp = Math.min(game.maxHp, s.hp + game.maxHp * 0.06 * game.regenMult * rdt);
        if (Math.random() < rdt * (10 + mult * 5)) { const a = Math.random() * 6.28, rr = 1.6 + Math.random() * 2, tc = player.trail.color; pA.emit(P.x + Math.cos(a) * rr, P.y + 0.2 + Math.random() * 2.4, P.z + Math.sin(a) * rr, -Math.cos(a) * rr * 0.8, -0.2, -Math.sin(a) * rr * 0.8, 1.15, 5, tc.r * 0.6 + 0.15, tc.g * 0.6 + 0.35, tc.b * 0.6 + 0.3, { a: 0.9 }); }
      } else {
        s.mp = Math.min(game.maxMp, s.mp + game.maxMp * 0.018 * regen * rdt);
        if (combatT <= 0 && !player.dead) s.hp = Math.min(game.maxHp, s.hp + game.maxHp * 0.012 * game.regenMult * rdt);
      }
      if (player.flying) {
        if (player.boosting) s.mp = Math.max(0, s.mp - 5 * rdt);
        if (player.speed > 4) { const bx = P.x - Math.sin(player.yaw) * 1.1, bz = P.z - Math.cos(player.yaw) * 1.1, tc = player.trail.color; for (let i = 0; i < (player.boosting ? 3 : 1); i++) pA.emit(bx + (Math.random() - 0.5) * 0.3, P.y + 0.12, bz + (Math.random() - 0.5) * 0.3, 0, 0.2, 0, 0.7, 6, tc.r, tc.g, tc.b, { a: 0.8 }); }
      }
      // 岩浆灼烧
      lavaT -= rdt;
      for (const l of pois.lava) if (!player.flying && !player.dead && Math.hypot(P.x - l.x, P.z - l.z) < l.r && P.y < l.y + 0.7) {
        if (lavaT <= 0) { lavaT = 0.45; hurtPlayer(game.maxHp * 0.14 + 20); P.vy = 11; for (let i = 0; i < 20; i++) pA.emit(P.x, P.y + 0.3, P.z, (Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4, 0.7, 6, 1, 0.5, 0.1, { g: 8 }); }
        break;
      }
      s.hour = (s.hour + rdt * 0.02 * (sky.night > 0.5 ? 2.4 : 1) * (player.meditating ? 5 : 1)) % 24;
      s.time += rdt;
      actors.update(dt * (btT > 0 ? 0.2 : 1), player, sky.night);
      trial.update(dt);
      side.update(rdt);
      updateTrib(rdt);
      // 夜间流星
      meteorT -= rdt;
      if (meteorT <= 0) {
        meteorT = 140 + Math.random() * 200;
        if (sky.night > 0.5 && pois.interact.filter((i) => i.type === 'meteor').length < 3) {
          for (let k = 0; k < 10; k++) { const a = Math.random() * 6.28, d = 35 + Math.random() * 45, x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d; if (world.groundY(x, z) > 1 && world.standY(x, world.groundY(x, z) + 5, z) < world.groundY(x, z) + 0.1) { spawnMeteor(x, z, 3, true); break; } }
        }
      }
      near = input.active && !player.dead && !side.busy ? actors.nearest(P) : null;
      if (near && input.hit('KeyE')) interact(near);
      saveT += rdt;
      if (saveT > 20 && P.onGround && !player.dead && combatT <= 0 && !trib) { saveT = 0; game.save(pos()); }
      const pl = placeName(P.x, P.y, P.z);
      if (pl !== place) { place = pl; if (!seen.has(pl) && !['荒野', '莽苍林海', '苍山', '青云河畔'].includes(pl)) { seen.add(pl); if (!ui.modal) ui.banner(pl, SUBS[pl] || ''); } }
    }
    if (!debugCam) {
      player.updateCamera(rdt, camera, world);
      // 镜头不穿入大型首领的身体
      for (const o of actors.mobs) {
        if (o.dead || !o.def.boss) continue;
        const cp = camera.position, hx = P.x, hy = P.y + 1.6, hz = P.z, R = o.radius * 1.1 + 0.35;
        if (Math.hypot(cp.x - o.b.x, cp.z - o.b.z) > R + 8) continue;
        for (let t = 0.05; t <= 1.001; t += 0.05) {
          const x = hx + (cp.x - hx) * t, y = hy + (cp.y - hy) * t, z = hz + (cp.z - hz) * t;
          if (Math.hypot(x - o.b.x, z - o.b.z) < R && y > o.b.y - 0.3 && y < o.b.y + o.height + 0.3) {
            const u = Math.max(0.12, t - 0.06);
            cp.set(hx + (cp.x - hx) * u, hy + (cp.y - hy) * u, hz + (cp.z - hz) * u);
            break;
          }
        }
      }
      if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.5; camera.position.z += (Math.random() - 0.5) * shake * 0.5; }
      shake *= Math.exp(-rdt * 7);
      focus.set(P.x, P.y, P.z);
    }
    if (++mapTick % 2 === 0) {
      const marks = [];
      for (const n of actors.npcs) marks.push({ x: n.b.x, z: n.b.z, c: n.wander ? '#d8d8d0' : '#ffd23a', s: n.wander ? 1 : 2 });
      for (const h of actors.herbs) marks.push({ x: h.x, z: h.z, c: '#6fe8a0', s: 1 });
      for (const o of actors.mobs) if (!o.dead && o.def.atk) marks.push({ x: o.b.x, z: o.b.z, c: '#ff5040', s: o.def.boss ? 3 : 1.5 });
      for (const p of pois.portals) marks.push({ x: p.x, z: p.z, c: s.portals[p.id] ? '#7fe0ff' : '#5a6a78', s: 2.5 });
      if (actors.pet) marks.push({ x: actors.pet.b.x, z: actors.pet.b.z, c: '#bfefff', s: 1.5 });
      side.marks(marks);
      ui.updateMap(world, P.x, P.z, player.camYaw, marks, side.target() || game.questTarget());
    }
    const sp2 = player.meditating ? spiritMult() : null;
    const cdf = {}; for (const k in cds) cdf[k] = cds[k] / SKILLS[k].cd;
    ui.update(rdt, { prompt: near ? near.label : '', place, meditating: player.meditating, flying: player.flying, shield: shieldT > 0, cds: cdf,
      state: trib ? (trib.phase === 'demon' ? '心魔劫 · 斩杀心魔' : `渡劫中 · 天雷 ${trib.i}/${trib.n}`) : player.meditating ? `打坐吐纳中${sp2 ? ` · ${sp2.name} 灵气 ×${sp2.mult}` : ''}` : player.flying ? (player.boosting ? '御剑疾行 · 消耗灵力' : '御剑飞行 · 空格升 X降 Shift加速') : player.gliding ? '轻功 · 御风滑翔' : '' });
  }
  if (!ui.started) ui.update(rdt, {});

  // ---- 场景特效
  if (shieldT > 0 || shield.visible) {
    shieldT = Math.max(0, shieldT - rdt); shieldHit = Math.max(0, shieldHit - rdt * 3);
    const u = shield.material.uniforms, fade = Math.min(1, shieldT * 2);
    shield.visible = fade > 0.01;
    shield.position.set(P.x, P.y + (player.meditating ? 0.6 : 0.95), P.z); shield.scale.set(0.95, 1.25, 0.95);
    u.uTime.value = time; u.uA.value = fade * (0.75 + shieldHit * 1.2 + Math.sin(time * 6) * 0.08);
  }
  if (pillarT > 0) {
    pillarT -= rdt; pillar.visible = pillarT > 0;
    pillar.position.set(P.x, P.y - 0.5, P.z); pillar.material.opacity = Math.min(1, pillarT) * 0.3; pillar.scale.set(1 + (3.5 - pillarT) * 0.12, 1, 1 + (3.5 - pillarT) * 0.12);
  }
  tele.update(dt); bolts.update(rdt); ghostFx.update(dt); updateMeteors(dt);
  for (const f of pois.fx) f.mesh.rotation.y += f.spin * rdt;
  portalT -= rdt;
  for (const p of pois.portals) {
    const on = !!s.portals[p.id];
    p.disc.rotation.y += rdt * (on ? 0.35 : 0.05);
    if (portalT <= 0) { p.disc.material.opacity = on ? 0.9 : 0.22; p.beam.visible = on; }
  }
  if (portalT <= 0) portalT = 1;
  for (const e of encounters) {
    if (e.fade <= 0) continue;
    if (e.done) { e.fade -= rdt * 0.5; if (e.fade <= 0) e.m.group.visible = false; }
    const d = Math.hypot(e.x - P.x, e.z - P.z);
    if (d > 90) { e.m.group.visible = false; continue; }
    e.m.group.visible = true; e.t += rdt;
    e.m.group.position.y = e.y + 0.35 + Math.sin(e.t * 1.2) * 0.12;
    e.m.update(rdt, { meditate: true, time: e.t }, d);
    if (Math.random() < rdt * 8) pA.emit(e.x + (Math.random() - 0.5) * 1.2, e.y + Math.random() * 1.6, e.z + (Math.random() - 0.5) * 1.2, 0, 0.6, 0, 1.6, 4, 0.5, 0.85, 1, { a: 0.8 * e.fade });
  }
  ghostMat.opacity = 0.32 + Math.sin(time * 2) * 0.06;
  gate.disc.rotation.z += rdt * 0.6;
  // 任务光柱
  const qt = ui.started ? side.target() || game.questTarget() : null;
  if (qt) {
    const d = Math.hypot(qt.x - P.x, qt.z - P.z);
    beacon.visible = d > 14;
    beacon.position.set(qt.x, qt.y !== undefined ? qt.y : world.groundY(qt.x, qt.z), qt.z);
    beacon.material.opacity = 0.3 * smoothstep(14, 40, d);
  } else beacon.visible = false;

  mats.shared.uTime.value = time;
  world.update(focus.x, focus.z, 5);
  mats.shared.uNearRect.value.copy(world.nearRect);
  sky.update(s.hour, focus, rdt, time);
  updateWeather(rdt, camera.position.x, camera.position.y, camera.position.z);
  renderer.toneMappingExposure = sky.exposure * (1 - weather.k * 0.12);
  mats.shared.uGlow.value = 0.25 + sky.night * 1.5; mats.detail.emissiveIntensity = sky.night * 1.3;
  mats.shared.uPlayer.value.set(P.x, ui.started ? P.y : -999, P.z);
  updateLamps(rdt, focus);
  updateEmitters(rdt, camera.position.x, camera.position.y, camera.position.z);
  const ps = renderer.getDrawingBufferSize(v2).y / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 0.01;
  pN.uniforms.uScale.value = ps; pA.uniforms.uScale.value = ps;
  pN.update(rdt); pA.update(rdt);
  water.update(time, sky, focus, world.nearRect);
  camera.updateMatrixWorld();
  water.renderReflection(camera);
  flash = Math.max(0, flash - rdt * 1.4);
  const gu = fx.grade.uniforms;
  gu.uFlash.value = flash * flash * 0.5;
  gu.uUnder.value = camera.position.y < WATER_SURF && world.groundY(camera.position.x, camera.position.z) < WATER_SURF ? 1 : 0;
  renderer.info.reset();
  fx.render(rdt);
  audio.update(rdt, { night: sky.night, water: clamp(1 - Math.abs(P.z - riverZ(P.x)) / 30, 0, 1) * (P.y < 20 ? 1 : 0), wind: clamp(P.y / 160, 0, 1) * 0.6 + (player.flying ? Math.min(0.6, player.speed / 60) : 0) + (player.gliding ? 0.3 : 0), calm: combatT <= 0 && weather.k < 0.3, rain: weather.k, boss: actors.mobs.some((o) => o.def.boss && !o.dead && o.state === 'chase') || !!trib });
  window.G.info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  input.endFrame();
  requestAnimationFrame(frame);
}
const v2 = new THREE.Vector2();
requestAnimationFrame(frame);
