// 柔边圆形粒子
import * as THREE from 'three';

const VERT = `
attribute vec4 aColor; attribute float aSize;
uniform float uScale;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, aSize * 1.9 * uScale / max(0.1, -mv.z));
}`;
const FRAG = 'varying vec4 vColor; void main() { float a = vColor.a * smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5)); if (a < 0.01) discard; gl_FragColor = vec4(vColor.rgb, a); }';

export class Particles {
  constructor(scene, max, additive) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.base = new Float32Array(max * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.uniforms = { uScale: { value: 600 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.geo = g;
  }
  // o: { g 重力, d 阻力, a 不透明度 }
  emit(x, y, z, vx, vy, vz, life, size, r, g, b, o) {
    const i = this.i; this.i = (i + 1) % this.max;
    const p = i * 3;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.vel[p] = vx; this.vel[p + 1] = vy; this.vel[p + 2] = vz;
    const c = i * 4;
    this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = 0;
    this.base[i * 2] = size; this.base[i * 2 + 1] = o && o.a !== undefined ? o.a : 1;
    this.life[i] = life; this.maxLife[i] = life;
    this.grav[i] = o && o.g !== undefined ? o.g : 0; this.drag[i] = o && o.d !== undefined ? o.d : 0;
  }
  update(dt) {
    const { pos, vel, col, size, life, maxLife, grav, drag, base, max } = this;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const p = i * 3;
      if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; pos[p + 1] = -9999; continue; }
      vel[p + 1] -= grav[i] * dt;
      if (drag[i] > 0) { const k = Math.max(0, 1 - drag[i] * dt); vel[p] *= k; vel[p + 1] *= k; vel[p + 2] *= k; }
      pos[p] += vel[p] * dt; pos[p + 1] += vel[p + 1] * dt; pos[p + 2] += vel[p + 2] * dt;
      const t = life[i] / maxLife[i];
      col[i * 4 + 3] = base[i * 2 + 1] * Math.min(1, t * 3, (1 - t) * 8 + 0.15);
      size[i] = base[i * 2];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}
