// 天空穹顶、日月星辰、程序化云层、昼夜光照与大气雾
import * as THREE from 'three';
import { smoothstep } from './noise.js';

const C = (h) => new THREE.Color(h);
const DAY_TOP = C(0x2a6fd0), DAY_HOR = C(0xa9cdee), SET_TOP = C(0x3d4a8a), SET_HOR = C(0xff9450);
const NIGHT_TOP = C(0x04060f), NIGHT_HOR = C(0x0f1830);
const SUN_NOON = C(0xfff1d6), SUN_LOW = C(0xff9050), MOON_COL = C(0x8fb2ff);
const HEMI_DAY_SKY = C(0xb8d6ff), HEMI_NIGHT_SKY = C(0x3a52a0), HEMI_DAY_GND = C(0x7a745c), HEMI_NIGHT_GND = C(0x14161e);
const CL_DAY = C(0xffffff), CL_SET = C(0xffb27a), CL_NIGHT = C(0x1c2238), CD_DAY = C(0x8a9cb8), CD_SET = C(0x5a4a66), CD_NIGHT = C(0x05070e);

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = `
uniform vec3 uSunDir, uMoonDir, uTop, uHorizon, uSunColor, uGround, uCloudLit, uCloudDark;
uniform float uNight, uTime, uCover;
uniform sampler2D tNoise;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float cloud(vec2 p, vec2 w) {
  return texture2D(tNoise, p * 0.045 + w).r * 0.56 + texture2D(tNoise, p * 0.13 + w * 2.1).g * 0.3 + texture2D(tNoise, p * 0.41 + w * 3.7).b * 0.14;
}
void main() {
  vec3 d = normalize(vDir);
  float t = pow(clamp(d.y, 0.0, 1.0), 0.42);
  vec3 col = mix(uHorizon, uTop, t);
  col = mix(col, uGround, smoothstep(0.0, -0.1, d.y));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 8.0) * 0.07 + pow(sd, 64.0) * 0.2 + pow(sd, 700.0) * 0.7);
  col = mix(col, uSunColor * 7.0 + 1.0, smoothstep(0.99955, 0.9998, sd));
  float md = max(dot(d, uMoonDir), 0.0);
  float moonVis = smoothstep(-0.05, 0.1, uMoonDir.y);
  col += vec3(0.35, 0.45, 0.7) * pow(md, 60.0) * 0.25 * moonVis * uNight;
  if (md > 0.999) {
    vec3 mr = normalize(cross(uMoonDir, vec3(0.0, 0.0, 1.0)));
    vec3 mu = cross(mr, uMoonDir);
    vec2 mp = vec2(dot(d, mr), dot(d, mu));
    float crater = 0.72 + 0.5 * texture2D(tNoise, mp * 5.0 + 0.3).g;
    float lit = smoothstep(-0.012, 0.004, mp.x + mp.y * 0.4 + 0.012);
    col = mix(col, vec3(0.92, 0.95, 1.0) * crater * 1.7 * (0.12 + 0.88 * lit), smoothstep(0.99932, 0.9996, md) * moonVis);
  }
  if (d.y > 0.0 && uNight > 0.01) {
    vec3 q = floor(d * 210.0);
    float s = hash(q);
    float tw = 0.55 + 0.45 * sin(uTime * 2.0 + s * 400.0);
    float pt = 1.0 - smoothstep(0.1, 0.5, length(fract(d * 210.0) - 0.5));
    col += vec3(0.8, 0.9, 1.0) * step(0.9965, s) * pt * tw * uNight * smoothstep(0.0, 0.25, d.y) * 2.4;
  }
  if (d.y > 0.012) {
    vec2 p = d.xz / (d.y + 0.1);
    vec2 w = uTime * vec2(0.0022, 0.0009);
    float n = cloud(p, w);
    float dens = smoothstep(uCover, uCover + 0.2, n);
    vec2 ls = uSunDir.xz * 0.9;
    float n2 = cloud(p + ls, w);
    float shade = clamp(0.55 + (n - n2) * 3.2 + (1.0 - dens) * 0.35, 0.0, 1.0);
    vec3 cc = mix(uCloudDark, uCloudLit, shade) + uSunColor * pow(sd, 12.0) * 0.5 * (1.0 - dens * 0.7);
    col = mix(col, cc, dens * smoothstep(0.012, 0.2, d.y) * 0.94);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  constructor(scene, shared, noiseTex, shadowSize = 4096) {
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.moonDir = new THREE.Vector3(0, -1, 0);
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.night = 0; this.day = 1; this.exposure = 1; this.shared = shared;
    this.top = new THREE.Color(); this.horizon = new THREE.Color(); this.fogColor = new THREE.Color();
    this.lightColor = new THREE.Color(); this.ambient = new THREE.Color();
    this.uniforms = {
      uSunDir: { value: this.sunDir }, uMoonDir: { value: this.moonDir },
      uTop: { value: this.top }, uHorizon: { value: this.horizon }, uGround: { value: this.fogColor },
      uSunColor: { value: new THREE.Color() }, uNight: { value: 0 }, uTime: { value: 0 }, uCover: { value: 0.5 },
      uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() }, tNoise: { value: noiseTex },
    };
    this.dome = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    this.dome.frustumCulled = false; this.dome.renderOrder = -1000;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.ext = 84;
    const sc = this.sun.shadow.camera;
    sc.left = -this.ext; sc.right = this.ext; sc.top = this.ext; sc.bottom = -this.ext; sc.near = 1; sc.far = 600;
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.08;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(this.sun, this.sun.target, this.hemi);
    scene.fog = new THREE.FogExp2(0xffffff, 0.0009);
    this.scene = scene;
    this._qa = NaN;
    this._r = new THREE.Vector3(); this._u = new THREE.Vector3(); this._c = new THREE.Vector3(); this._tc = new THREE.Color();
  }

  update(hour, focus, dt, time) {
    const a = ((hour - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(a), Math.sin(a), 0.45).normalize();
    this.moonDir.set(-Math.cos(a), -Math.sin(a), 0.3).normalize();
    const e = this.sunDir.y;
    const day = smoothstep(-0.12, 0.22, e);
    const sunset = (1 - smoothstep(0.0, 0.3, Math.abs(e))) * smoothstep(-0.25, -0.02, e);
    this.day = day; this.night = 1 - day;
    this.top.lerpColors(NIGHT_TOP, DAY_TOP, day).lerp(SET_TOP, sunset * 0.55);
    this.horizon.lerpColors(NIGHT_HOR, DAY_HOR, day).lerp(SET_HOR, sunset * 0.85);
    this.fogColor.copy(this.horizon).lerp(this.top, 0.1 + sunset * 0.3);
    this.scene.fog.color.copy(this.fogColor);
    this.scene.fog.density = 0.00085 + this.night * 0.0003 + sunset * 0.0002;

    const sunI = 3.1 * smoothstep(-0.03, 0.2, e);
    const moonI = 1.25 * smoothstep(0.02, -0.14, e) * smoothstep(-0.05, 0.15, this.moonDir.y);
    const u = this.uniforms;
    u.uSunColor.value.lerpColors(SUN_LOW, SUN_NOON, smoothstep(0.03, 0.4, e)).multiplyScalar(smoothstep(-0.1, 0.05, e));
    u.uNight.value = this.night; u.uTime.value = time;
    u.uCloudLit.value.lerpColors(CL_NIGHT, CL_DAY, day).lerp(CL_SET, sunset * 0.8);
    u.uCloudDark.value.lerpColors(CD_NIGHT, CD_DAY, day).lerp(CD_SET, sunset * 0.7);
    this.shared.uFogSun.value.copy(u.uSunColor.value).multiplyScalar(0.3 + sunset * 0.5);
    this.shared.uFogSunDir.value.copy(this.sunDir);

    // 光源方向量化，避免阴影持续抖动
    const qa = Math.round(a / 0.004) * 0.004;
    const useSun = sunI >= moonI;
    if (qa !== this._qa || useSun !== this._useSun) {
      this._qa = qa; this._useSun = useSun;
      if (useSun) this.lightDir.set(Math.cos(qa), Math.sin(qa), 0.45).normalize();
      else this.lightDir.set(-Math.cos(qa), -Math.sin(qa), 0.3).normalize();
    }
    if (useSun) { this.lightColor.lerpColors(SUN_LOW, SUN_NOON, smoothstep(0.03, 0.4, e)); this.sun.intensity = sunI; }
    else { this.lightColor.copy(MOON_COL); this.sun.intensity = moonI; }
    this.sun.color.copy(this.lightColor);
    this.hemi.color.lerpColors(HEMI_NIGHT_SKY, HEMI_DAY_SKY, day).lerp(SET_HOR, sunset * 0.25);
    this.hemi.groundColor.lerpColors(HEMI_NIGHT_GND, HEMI_DAY_GND, day);
    this.hemi.intensity = 0.95 + day * 0.3 + sunset * 0.9;
    this.exposure = 1 + sunset * 0.25 + this.night * 0.55;
    this.ambient.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.5).add(this._tc.copy(this.lightColor).multiplyScalar(this.sun.intensity * 0.22));

    // 阴影相机跟随并对齐到纹素
    const d = this.lightDir, r = this._r, up = this._u;
    r.set(0, 1, 0).cross(d).normalize(); up.copy(d).cross(r);
    const texel = (this.ext * 2) / this.sun.shadow.mapSize.x;
    const cx = Math.round(focus.dot(r) / texel) * texel, cy = Math.round(focus.dot(up) / texel) * texel, cz = focus.dot(d);
    const c = this._c.set(0, 0, 0).addScaledVector(r, cx).addScaledVector(up, cy).addScaledVector(d, cz);
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(d, 260);
    this.sun.target.updateMatrixWorld();
  }
}
