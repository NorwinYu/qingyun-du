// 后期处理：泛光 + 调色暗角 + ACES 色调映射
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const Grade = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uSat: { value: 1.06 }, uUnder: { value: 0 }, uFlash: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float uVignette, uSat, uUnder, uFlash; uniform vec3 uTint; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = mix(vec3(l), c.rgb, uSat) * uTint;
  float v = smoothstep(0.9, 0.3, length(vUv - 0.5));
  c.rgb *= mix(1.0 - uVignette, 1.0, v);
  c.rgb = mix(c.rgb, c.rgb * vec3(0.3, 0.6, 0.85) + vec3(0.0, 0.02, 0.04), uUnder);
  c.rgb += vec3(uFlash);
  gl_FragColor = c;
}`,
};

export class PostFX {
  constructor(renderer, scene, camera, samples = 4) {
    this.renderer = renderer;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 1.02);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(Grade);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }
  setSamples(n) {
    const c = this.composer;
    if (c.renderTarget1.samples === n) return;
    for (const rt of [c.renderTarget1, c.renderTarget2]) { rt.samples = n; rt.dispose(); }
  }
  setSize(w, h, pr) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
  render(dt) { this.composer.render(dt); }
}
