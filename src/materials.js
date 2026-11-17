// 共享材质：地形分层着色、草叶、树叶、建筑、角色；全局高度雾
import * as THREE from 'three';
import { VOLCANO as VC } from './layout.js';
const f1 = (v) => v.toFixed(1);

THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\nvarying vec3 vFogW;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\nvFogW = cameraPosition + mvPosition.xyz * mat3(viewMatrix);\n#endif';
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; uniform float fogDensity; uniform vec3 uFogSun; uniform vec3 uFogSunDir; varying vec3 vFogW;
vec3 applyFog(vec3 col, vec3 wp) {
  vec3 rd = wp - cameraPosition; float d = length(rd); rd /= max(d, 1e-4);
  const float b = 0.011;
  float ry = abs(rd.y) < 1e-3 ? 1e-3 : rd.y;
  float amt = fogDensity / b * exp(-max(cameraPosition.y, -20.0) * b) * (1.0 - exp(-d * ry * b)) / ry;
  float f = 1.0 - exp(-amt);
  float s = pow(max(dot(rd, uFogSunDir), 0.0), 6.0);
  return mix(col, fogColor + uFogSun * s, clamp(f, 0.0, 1.0));
}
#endif`;
THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\ngl_FragColor.rgb = applyFog(gl_FragColor.rgb, vFogW);\n#endif';

const NOFLIP = 'float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 nonPerturbedNormal = normal;';

const TERRAIN_FRAG = `{
#ifdef FAR_TILE
  if (vWP.x > uNearRect.x && vWP.z > uNearRect.y && vWP.x < uNearRect.z && vWP.z < uNearRect.w) discard;
#endif
  vec3 N0 = normalize(vWN);
  float dist = length(vWP - cameraPosition);
  vec4 mac = texture2D(tMacro, vWP.xz * 0.0037);
  vec4 mid = texture2D(tMacro, vWP.xz * 0.041);
  float nz = mid.g - 0.5;
  float slope = 1.0 - N0.y;
  float wRock = max(smoothstep(0.2, 0.32, slope + nz * 0.12), smoothstep(46.0, 64.0, vWP.y + nz * 12.0) * smoothstep(0.06, 0.2, slope));
  float wSnow = smoothstep(70.0, 80.0, vWP.y + nz * 12.0 + mac.r * 10.0 - 5.0) * (1.0 - smoothstep(0.3, 0.5, slope));
  vec2 vcd = vWP.xz - vec2(${f1(VC.x)}, ${f1(VC.z)}); float dVc = length(vcd);
  float wAsh = smoothstep(0.1, 0.42, 1.0 - dVc / ${f1(VC.R)} + nz * 0.16);
  wSnow *= 1.0 - smoothstep(0.0, 0.25, 1.0 - dVc / ${f1(VC.R * 1.15)});
  float wSand = 1.0 - smoothstep(0.2, 0.7, vWP.y + nz * 0.5);
  float wPath = smoothstep(0.36, 0.6, vSplat.x + nz * 0.5);
  float wPave = smoothstep(0.42, 0.58, vSplat.y + nz * 0.15);
  float wFarm = smoothstep(0.4, 0.6, vSplat.z);
  vec2 uv = vWP.xz * 0.25;
  vec4 cG = texture(tAlb, vec3(uv, 0.0));
  cG = mix(cG, texture(tAlb, vec3(uv.yx * 0.23 + 0.31, 0.0)), 0.4 + 0.4 * smoothstep(25.0, 110.0, dist));
  vec4 cD = texture(tAlb, vec3(uv * 1.3, 1.0));
  vec4 cS = texture(tAlb, vec3(uv, 3.0));
  vec4 cW = texture(tAlb, vec3(uv * 0.5, 4.0));
  vec4 cP = texture(tAlb, vec3(vWP.xz * 0.5, 5.0));
  vec3 bw = N0 * N0; bw *= bw; bw /= (bw.x + bw.y + bw.z);
  vec3 cR = texture(tAlb, vec3(vWP.xz * 0.11, 2.0)).rgb * bw.y + texture(tAlb, vec3(vWP.zy * 0.11, 2.0)).rgb * bw.x + texture(tAlb, vec3(vWP.xy * 0.11, 2.0)).rgb * bw.z;
  cR = mix(cR, texture(tAlb, vec3(vWP.xz * 0.027 + vWP.y * 0.011, 2.0)).rgb, 0.4) * (0.86 + 0.28 * sin(vWP.y * 0.7 + mid.r * 7.0 + mac.g * 9.0));
  vec3 col = cG.rgb * vTint * (0.78 + 0.4 * mac.r) * (0.9 + 0.2 * mid.b);
  vec2 n2 = texture(tNrm, vec3(uv, 0.0)).xy - 0.5;
  col = mix(col, cD.rgb, wPath); n2 = mix(n2, texture(tNrm, vec3(uv * 1.3, 1.0)).xy - 0.5, wPath);
  col = mix(col, cD.rgb * vec3(0.62, 0.56, 0.5) * (0.85 + 0.25 * sin(vWP.z * 6.2832)), wFarm);
  n2.y += wFarm * cos(vWP.z * 6.2832) * 0.3;
  col = mix(col, cS.rgb, wSand); n2 = mix(n2, texture(tNrm, vec3(uv, 3.0)).xy - 0.5, wSand);
  float rk = wRock * (1.0 - wPave) * (1.0 - wPath);
  col = mix(col, cR * (0.7 + 0.6 * mac.b), rk); n2 = mix(n2, texture(tNrm, vec3(vWP.xz * 0.11, 2.0)).xy - 0.5, rk);
  col = mix(col, cW.rgb, wSnow); n2 = mix(n2, (texture(tNrm, vec3(uv * 0.5, 4.0)).xy - 0.5) * 0.4, wSnow);
  float ash = wAsh * (1.0 - wPave) * (1.0 - wPath);
  vec3 cAsh = mix(cD.rgb * vec3(0.42, 0.37, 0.35), cR * vec3(0.36, 0.31, 0.3), 0.35 + 0.65 * wRock) * (0.75 + 0.5 * mac.b);
  col = mix(col, cAsh, ash); n2 = mix(n2, texture(tNrm, vec3(vWP.xz * 0.11, 2.0)).xy - 0.5, ash * 0.7);
  float hot = smoothstep(${f1(VC.R * 0.5)}, ${f1(VC.R * 0.14)}, dVc) * ash;
  float ang = atan(vcd.y, vcd.x);
  float flow = smoothstep(0.86, 0.97, sin(ang * 9.0 + mac.g * 6.0 + nz * 2.0)) * smoothstep(0.2, 0.32, mid.b + nz * 0.3);
  float crack = (1.0 - smoothstep(0.0, 0.035, abs(mid.r - 0.5))) * 0.6;
  float lava = hot * max(flow, crack * hot);
  tEmi = vec3(1.6, 0.36, 0.06) * lava * (0.75 + 0.25 * sin(uTime * 1.3 + dVc * 0.2));
  col = mix(col, vec3(0.12, 0.05, 0.03), lava * 0.8);
  col = mix(col, cP.rgb, wPave); n2 = mix(n2, texture(tNrm, vec3(vWP.xz * 0.5, 5.0)).xy - 0.5, wPave);
  float wet = smoothstep(0.5, -0.1, vWP.y);
  float deep = smoothstep(-0.2, -2.6, vWP.y);
  col *= mix(1.0, 0.62, wet); col = mix(col, col * vec3(0.5, 0.75, 0.8), deep);
  tRough = mix(mix(0.95, 0.82, rk), 0.45, wet * (1.0 - deep)); tRough = mix(tRough, 0.7, wSnow); tRough = mix(tRough, 0.75, ash);
  float ns = 2.0 * (1.0 - smoothstep(60.0, 220.0, dist) * 0.7);
  tWN = normalize(N0 + vec3(n2.x, 0.0, n2.y) * ns);
  diffuseColor.rgb = col;
}`;

const GRASS_VERT = `
float gt = position.y;
vec3 groot = aPos.xyz;
float gdc = distance(groot, cameraPosition);
float gwn = texture2D(tMacro, groot.xz * 0.011 + uTime * vec2(0.031, 0.019)).r;
float gsway = sin(uTime * 1.9 + groot.x * 0.7 + groot.z * 0.9) * 0.07 + (gwn - 0.45) * 0.95;
vec2 gpv = groot.xz - uPlayer.xz; float gpd = length(gpv);
float gpush = (1.0 - smoothstep(0.35, 1.3, gpd)) * step(abs(groot.y - uPlayer.y), 1.6);
vec2 gdir = aRot.xy;
vec3 transformed = groot;
#ifdef FLOWER
  float gh = aPos.w * (1.0 - gpush * 0.5);
  transformed += position * aRot.w;
  transformed.y += gh;
  transformed.xz += gdir * gsway * 0.3 * gh;
  vColor = vec4(color * (0.75 + 0.5 * smoothstep(0.0, 0.05, length(position.xz))), 1.0);
#else
  float gh = aPos.w * (1.0 - gpush * 0.6);
  float gbend = aRot.z + gsway * 0.5;
  float gw = (0.058 + gdc * 0.0021) * aRot.w * (1.0 - gt * 0.88);
  transformed.xz += vec2(-gdir.y, gdir.x) * position.x * gw + gdir * gbend * gt * gt * gh;
  if (gpd > 0.001) transformed.xz += gpv / gpd * gpush * gt * 0.4;
  transformed.y += gt * gh * (1.0 - 0.22 * gbend * gbend);
  vColor = vec4(mix(color * 0.42, color * 1.12 + vec3(0.02, 0.02, 0.0), gt) * (1.0 + (gwn - 0.45) * 0.55 * gt), 1.0);
#endif
`;

export function makeMaterials(T) {
  const shared = {
    uTime: { value: 0 }, uNearRect: { value: new THREE.Vector4(1e9, 1e9, -1e9, -1e9) }, uPlayer: { value: new THREE.Vector3(0, -999, 0) },
    uFogSun: { value: new THREE.Color(0, 0, 0) }, uFogSunDir: { value: new THREE.Vector3(0, 1, 0) }, uGlow: { value: 0.2 },
  };
  let pid = 0;
  const patch = (m, fn) => {
    const id = 'p' + pid++;
    m.onBeforeCompile = (sh) => { sh.uniforms.uFogSun = shared.uFogSun; sh.uniforms.uFogSunDir = shared.uFogSunDir; if (fn) fn(sh); };
    m.customProgramCacheKey = () => id;
    return m;
  };
  const mkTerrain = (far) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    if (far) m.defines = { FAR_TILE: 1 };
    return patch(m, (sh) => {
      sh.uniforms.tAlb = { value: T.terrAlb }; sh.uniforms.tNrm = { value: T.terrNrm }; sh.uniforms.tMacro = { value: T.macro }; sh.uniforms.uNearRect = shared.uNearRect; sh.uniforms.uTime = shared.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aSplat; attribute vec3 aTint; varying vec3 vWP; varying vec3 vWN; varying vec3 vSplat; varying vec3 vTint;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz; vWN = normal; vSplat = aSplat; vTint = aTint;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2DArray tAlb; uniform sampler2DArray tNrm; uniform sampler2D tMacro; uniform vec4 uNearRect; uniform float uTime;\nvarying vec3 vWP; varying vec3 vWN; varying vec3 vSplat; varying vec3 vTint;\nvec3 tWN; float tRough; vec3 tEmi = vec3(0.0);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += tEmi;')
        .replace('#include <map_fragment>', TERRAIN_FRAG)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
        .replace('#include <normal_fragment_maps>', 'normal = normalize(mat3(viewMatrix) * tWN);');
    });
  };
  const mkGrass = (flower) => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    if (flower) m.defines = { FLOWER: 1 };
    return patch(m, (sh) => {
      sh.uniforms.uTime = shared.uTime; sh.uniforms.uPlayer = shared.uPlayer; sh.uniforms.tMacro = { value: T.macro };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aPos; attribute vec4 aRot; uniform float uTime; uniform vec3 uPlayer; uniform sampler2D tMacro;')
        .replace('#include <color_vertex>', GRASS_VERT)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(vec3(aRot.x * 0.3, 1.0, aRot.y * 0.3));')
        .replace('#include <begin_vertex>', '');
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', NOFLIP);
    });
  };
  const foliage = patch(new THREE.MeshLambertMaterial({ map: T.leaf, alphaTest: 0.3, side: THREE.DoubleSide, vertexColors: true, alphaToCoverage: true }), (sh) => {
    sh.uniforms.uTime = shared.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWind; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 wip = instanceMatrix[3].xyz;
#else
  vec3 wip = vec3(0.0);
#endif
float wph = wip.x * 0.31 + wip.z * 0.27 + position.y * 0.35;
transformed.x += aWind * (sin(uTime * 1.3 + wph) * 0.07 + sin(uTime * 3.1 + wph * 2.7 + position.x * 2.0) * 0.025);
transformed.z += aWind * cos(uTime * 1.1 + wph * 1.3) * 0.055;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', NOFLIP);
  });
  const foliageDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.leaf, alphaTest: 0.3, side: THREE.DoubleSide });
  const plainFar = new THREE.MeshLambertMaterial({ vertexColors: true });
  patch(plainFar, (sh) => {
    sh.uniforms.uNearRect = shared.uNearRect;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWP2;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP2 = position.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWP2; uniform vec4 uNearRect;')
      .replace('void main() {', 'void main() {\nif (vWP2.x > uNearRect.x && vWP2.y > uNearRect.y && vWP2.x < uNearRect.z && vWP2.y < uNearRect.w) discard;');
  });
  const blob = patch(new THREE.MeshLambertMaterial({ vertexColors: true }), (sh) => {
    sh.uniforms.uNearRect = shared.uNearRect;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec4 uNearRect;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvec2 bxz = instanceMatrix[3].xz;\nif (bxz.x > uNearRect.x && bxz.y > uNearRect.y && bxz.x < uNearRect.z && bxz.y < uNearRect.w) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);\n#endif');
  });
  const std = (t, o = {}) => patch(new THREE.MeshStandardMaterial({ map: t && t.map, normalMap: t && t.normalMap, vertexColors: true, roughness: 0.9, metalness: 0, ...o }));
  const lantern = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), (sh) => {
    sh.uniforms.uGlow = shared.uGlow;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow;').replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = vColor.rgb * uGlow;');
  });
  return {
    shared,
    terrain: mkTerrain(false), terrainFar: mkTerrain(true),
    grass: mkGrass(false), flower: mkGrass(true),
    foliage, foliageDepth, plainFar, blob,
    plainLow: patch(new THREE.MeshLambertMaterial({ vertexColors: true })),
    plaster: std(T.plaster, { roughness: 0.95 }), wood: std(T.wood, { roughness: 0.75 }), masonry: std(T.masonry, { roughness: 0.92 }),
    tile: std(T.tile, { roughness: 0.6, normalScale: new THREE.Vector2(1.4, 1.4) }), thatch: std(T.thatch, { roughness: 1 }),
    rock: std(T.rock, { roughness: 0.92 }), paving: std(T.paving, { roughness: 0.9 }), turf: std(T.grass, { roughness: 1 }),
    detail: patch(new THREE.MeshStandardMaterial({ map: T.detail, emissiveMap: T.detailEm, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8 })),
    plain: std(null, { roughness: 0.7 }), cloth: std(null, { roughness: 1, side: THREE.DoubleSide }),
    lantern,
    entity: std(null, { roughness: 0.78 }), entityFlat: std(null, { roughness: 0.9, flatShading: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
    plaque: (tex) => patch(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })),
    decal: (tex) => patch(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })),
  };
}
