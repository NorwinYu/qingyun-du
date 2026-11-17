// 水面（平面反射、菲涅尔、岸边泡沫）与瀑布
import * as THREE from 'three';
import { WATER_SURF } from './layout.js';

const NOISE = `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}`;
const WATER_VERT = `
attribute float aDepth;
uniform mat4 uTexMatrix;
uniform float uBaseDepth;
varying vec3 vW; varying float vDepth; varying vec4 vRefl;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz; vDepth = aDepth + uBaseDepth; vRefl = uTexMatrix * wp;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FRAG = `
uniform float uTime, uUseRefl, uFar;
uniform vec3 uSunDir, uSunColor, uTop, uHorizon, uLight, uShallow, uDeep;
uniform vec4 uNearRect;
uniform sampler2D uRefl;
varying vec3 vW; varying float vDepth; varying vec4 vRefl;
#include <fog_pars_fragment>
${NOISE}
float waveH(vec2 p, float t) {
  return vn(p * 0.45 + vec2(t * 0.30, t * 0.18)) * 0.55 + vn(p * 1.3 + vec2(-t * 0.42, t * 0.33)) * 0.28 + vn(p * 3.4 + vec2(t * 0.7, -t * 0.5)) * 0.12 + vn(p * 8.0 + vec2(-t * 0.9, t * 0.8)) * 0.05;
}
void main() {
  if (uFar > 0.5 && vW.x > uNearRect.x && vW.z > uNearRect.y && vW.x < uNearRect.z && vW.z < uNearRect.w) discard;
  vec3 toCam = cameraPosition - vW;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 p = vW.xz;
  float t = uTime;
  float e = 0.08 + dist * 0.004;
  float hx = waveH(p + vec2(e, 0.0), t) - waveH(p - vec2(e, 0.0), t);
  float hz = waveH(p + vec2(0.0, e), t) - waveH(p - vec2(0.0, e), t);
  float str = mix(0.16, 0.05, smoothstep(20.0, 300.0, dist)) / e;
  vec3 N = normalize(vec3(-hx * str, 1.0, -hz * str));
  float ndv = max(dot(V, N), 0.0);
  float F = 0.025 + 0.975 * pow(1.0 - ndv, 5.0);
  vec3 skyRefl = mix(uHorizon, uTop, pow(clamp(reflect(-V, N).y, 0.0, 1.0), 0.5));
  vec3 refl = skyRefl;
  if (uUseRefl > 0.5) {
    vec2 ruv = vRefl.xy / vRefl.w + N.xz * 0.06;
    refl = texture2D(uRefl, clamp(ruv, 0.001, 0.999)).rgb;
  }
  float dk = smoothstep(0.0, 2.4, vDepth);
  vec3 body = mix(uShallow, uDeep, dk) * uLight;
  vec3 col = mix(body, refl, clamp(F * 0.9 + 0.05, 0.0, 1.0));
  vec3 H = normalize(V + uSunDir);
  float spec = pow(max(dot(N, H), 0.0), 320.0);
  col += uSunColor * spec * 2.6;
  float alpha = mix(0.3, 0.94, dk);
  alpha = mix(alpha, 1.0, F);
  float shore = smoothstep(0.5, 0.0, vDepth);
  float fn = vn(p * 2.2 + vec2(t * 0.35, t * 0.2)) * 0.6 + vn(p * 5.5 - vec2(t * 0.3, t * 0.45)) * 0.4;
  float foam = smoothstep(0.55, 0.8, shore * 0.9 + (fn - 0.5) * 0.9 * shore + sin(vDepth * 14.0 - t * 1.6) * 0.08 * shore);
  col = mix(col, uLight * 0.85 + 0.04, foam * 0.75);
  alpha = max(alpha, foam * 0.85) * smoothstep(-0.02, 0.06, vDepth);
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}`;
const FALL_VERT = `
varying vec2 vUv; varying vec3 vW;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FALL_FRAG = `
uniform float uTime; uniform vec3 uLight; uniform vec2 uSize;
varying vec2 vUv; varying vec3 vW;
#include <fog_pars_fragment>
${NOISE}
void main() {
  vec2 q = vec2(vUv.x * uSize.x, vUv.y * uSize.y + uTime * (7.0 + (1.0 - vUv.y) * 5.0));
  float n = vn(vec2(q.x * 3.0, q.y * 0.4)) * 0.6 + vn(vec2(q.x * 8.0, q.y * 1.1)) * 0.28 + vn(vec2(q.x * 19.0, q.y * 2.3)) * 0.12;
  float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
  float a = smoothstep(0.25, 0.75, (0.45 + n * 0.6) * edge) * smoothstep(0.0, 0.12, vUv.y) * 0.92;
  vec3 col = mix(vec3(0.5, 0.74, 0.9), vec3(1.0), smoothstep(0.4, 0.8, n)) * (uLight * 1.15 + 0.06);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}`;

export class WaterSystem {
  constructor(renderer, scene, fogShared) {
    this.renderer = renderer; this.scene = scene;
    this.enabled = true;
    this.rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.vcam = new THREE.PerspectiveCamera();
    this.texMatrix = new THREE.Matrix4();
    this.shared = {
      uTime: { value: 0 }, uUseRefl: { value: 1 }, uRefl: { value: this.rt.texture }, uTexMatrix: { value: this.texMatrix },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() },
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uLight: { value: new THREE.Color(1, 1, 1) },
      uShallow: { value: new THREE.Color(0x3a9a9c) }, uDeep: { value: new THREE.Color(0x0c3350) },
      uNearRect: { value: new THREE.Vector4() }, uFogSun: fogShared.uFogSun, uFogSunDir: fogShared.uFogSunDir,
    };
    const mk = (far) => {
      const m = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFar: { value: far ? 1 : 0 }, uBaseDepth: { value: far ? 4 : 0 } }]),
        vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, fog: true, depthWrite: false,
      });
      Object.assign(m.uniforms, this.shared);
      return m;
    };
    this.material = mk(false);
    this.farMaterial = mk(true);
    const fg = new THREE.PlaneGeometry(6000, 6000, 1, 1); fg.rotateX(-Math.PI / 2);
    this.farMesh = new THREE.Mesh(fg, this.farMaterial);
    this.farMesh.position.y = WATER_SURF - 0.02;
    this.farMesh.renderOrder = 4; this.farMesh.frustumCulled = false;
    scene.add(this.farMesh);
    this.fallShared = { uTime: this.shared.uTime, uLight: this.shared.uLight, uFogSun: fogShared.uFogSun, uFogSunDir: fogShared.uFogSunDir };
    this.falls = new THREE.Group();
    scene.add(this.falls);
    this.hide = []; // 反射渲染时隐藏的对象
    this._p = new THREE.Plane(); this._n = new THREE.Vector3(); this._wp = new THREE.Vector3(); this._cp = new THREE.Vector3();
    this._rot = new THREE.Matrix4(); this._look = new THREE.Vector3(); this._view = new THREE.Vector3(); this._tgt = new THREE.Vector3();
    this._clip = new THREE.Vector4(); this._q = new THREE.Vector4();
  }
  setSize(w, h) { this.rt.setSize(Math.max(64, w), Math.max(64, h)); }
  addFall(x, yTop, z, width, height, rotY) {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSize: { value: new THREE.Vector2(width, height) } }]),
      vertexShader: FALL_VERT, fragmentShader: FALL_FRAG, transparent: true, fog: true, side: THREE.DoubleSide, depthWrite: false,
    });
    Object.assign(m.uniforms, this.fallShared);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), m);
    mesh.position.set(x, yTop - height / 2, z);
    mesh.rotation.y = rotY;
    mesh.renderOrder = 6;
    this.falls.add(mesh);
    return mesh;
  }
  // 自定义水体（池塘等）：平面网格，深度恒定
  addPool(x, y, z, r, depth = 1.2) {
    const g = new THREE.CircleGeometry(r, 24); g.rotateX(-Math.PI / 2);
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(depth), 1));
    const mesh = new THREE.Mesh(g, this.material);
    mesh.position.set(x, y, z); mesh.renderOrder = 5;
    this.falls.add(mesh);
    return mesh;
  }
  update(time, sky, focus, nearRect) {
    const s = this.shared;
    s.uTime.value = time;
    s.uSunDir.value.copy(sky.lightDir);
    s.uSunColor.value.copy(sky.lightColor).multiplyScalar(sky.sun.intensity);
    s.uTop.value.copy(sky.top); s.uHorizon.value.copy(sky.horizon); s.uLight.value.copy(sky.ambient);
    s.uNearRect.value.copy(nearRect);
    this.farMesh.position.x = Math.round(focus.x / 64) * 64;
    this.farMesh.position.z = Math.round(focus.z / 64) * 64;
  }
  // 以水面为镜面渲染反射贴图（斜裁剪近平面）
  renderReflection(camera) {
    const s = this.shared;
    if (!this.enabled || camera.position.y < WATER_SURF + 0.05 || camera.position.y > 90) { s.uUseRefl.value = 0; return; }
    s.uUseRefl.value = 1;
    const n = this._n.set(0, 1, 0), wp = this._wp.set(0, WATER_SURF, 0), cp = this._cp.setFromMatrixPosition(camera.matrixWorld);
    const view = this._view.subVectors(wp, cp).reflect(n).negate().add(wp);
    this._rot.extractRotation(camera.matrixWorld);
    const look = this._look.set(0, 0, -1).applyMatrix4(this._rot).add(cp);
    const tgt = this._tgt.subVectors(wp, look).reflect(n).negate().add(wp);
    const vc = this.vcam;
    vc.position.copy(view);
    vc.up.set(0, 1, 0).applyMatrix4(this._rot).reflect(n);
    vc.lookAt(tgt);
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);
    this.texMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.texMatrix.multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    const pl = this._p.setFromNormalAndCoplanarPoint(n, wp).applyMatrix4(vc.matrixWorldInverse);
    const clip = this._clip.set(pl.normal.x, pl.normal.y, pl.normal.z, pl.constant);
    const pm = vc.projectionMatrix, q = this._q;
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x; pm.elements[6] = clip.y; pm.elements[10] = clip.z + 1.0 - 0.003; pm.elements[14] = clip.w;
    const r = this.renderer;
    const vis = this.hide.map((o) => o.visible);
    this.hide.forEach((o) => { o.visible = false; });
    const au = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(this.scene, vc);
    r.setRenderTarget(prev);
    r.shadowMap.autoUpdate = au;
    this.hide.forEach((o, i) => { o.visible = vis[i]; });
  }
}
