// ============ 渲染核心：three.js r170、共享光照与大气 ============
import * as T3 from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
const THREE = { ...T3, OrbitControls, Reflector, BufferGeometryUtils: { mergeBufferGeometries: mergeGeometries } };
window.__three = THREE;

// 所有材质共用的一组 uniform：太阳、天色、雾、风
const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.6, 0.45, -0.3).normalize() },
  uSunCol: { value: new THREE.Vector3(3, 2.7, 2.3) },
  uSkyTop: { value: new THREE.Vector3(0.25, 0.42, 0.7) },
  uSkyHor: { value: new THREE.Vector3(0.66, 0.74, 0.82) },
  uHazeCol: { value: new THREE.Vector3(0.66, 0.74, 0.82) },
  uHazeSun: { value: new THREE.Vector3(0.98, 0.9, 0.76) },
  uCloudCol: { value: new THREE.Vector3(1.2, 1.17, 1.1) },
  uFog: { value: new THREE.Vector4(0.0012, 0.045, 0.0, 0.00016) }, // 密度、随高度衰减、基准高度、远距离薄霭
  uMist: { value: 1.0 },
  uWind: { value: new THREE.Vector4(0.8, 0.6, 1.0, 0.0) },         // 风向 xz、强度
  uNight: { value: 0 },
  uSunVis: { value: 1 },
  uFieldBlend: { value: 0 },
  uGhost: { value: 0 },
  uClay: { value: 0 },
  uMem: { value: 0 },
  uBuild: { value: 1 },
  tHeight: { value: null },
  uHRect: { value: new THREE.Vector4(-180, -180, 360, 360) }
};

const SUI_GLSL = /* glsl */`
uniform float uTime, uMist, uNight, uSunVis, uFieldBlend, uGhost;
uniform vec3 uSunDir, uSunCol, uSkyTop, uSkyHor, uHazeCol, uHazeSun, uCloudCol;
uniform vec4 uFog, uWind;
uniform float uClay, uMem, uBuild; uniform sampler2D tHeight; uniform vec4 uHRect;
vec3 suiGrade(vec3 c){ float l = dot(c, vec3(0.3, 0.59, 0.11)); return mix(c, vec3(l) * vec3(1.12, 1.0, 0.78), uMem * 0.5); }
float sh12(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float svn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(sh12(i), sh12(i + vec2(1, 0)), w.x), mix(sh12(i + vec2(0, 1)), sh12(i + vec2(1, 1)), w.x), w.y); }
float sfbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * svn(p); p = p * 2.07 + 11.3; a *= 0.5; } return s; }
// 远处的空气颜色：背光处偏冷，朝着太阳偏暖
vec3 hazeTint(vec3 rd){
  float s = max(dot(rd, uSunDir), 0.0);
  vec3 c = mix(uHazeCol, uHazeSun, pow(s, 3.0) * 0.8);
  return c + uSunCol * pow(s, 28.0) * 0.04 * uSunVis;
}
// 高度雾 + 距离薄霭 + 贴着谷底游动的晨雾
vec4 suiFog(vec3 wp){
  vec3 d = wp - cameraPosition; float L = length(d); vec3 rd = d / max(L, 1e-3);
  float k = uFog.y * d.y;
  float hf = uFog.x * exp(-uFog.y * (cameraPosition.y - uFog.z)) * L * (abs(k) > 1e-4 ? (1.0 - exp(-k)) / k : 1.0);
  float haze = uFog.w * L;
  float my = clamp(1.0 - (wp.y - 0.5) / 6.0, 0.0, 1.0);
  float mist = 0.0;
  if (my > 0.0 && L > 18.0) {
    vec2 mp = wp.xz * 0.025 + vec2(uTime * 0.008, uTime * 0.005);
    float mn = max(svn(mp) * 1.3 - 0.45 + svn(mp * 3.3) * 0.2, 0.0);
    mist = uMist * my * my * mn * min(L - 18.0, 220.0) * 0.0045;
  }
  return vec4(hazeTint(normalize(vec3(rd.x, max(rd.y, -0.05), rd.z))), exp(-(hf + haze + mist)));
}
vec3 suiAtmos(vec3 col, vec3 wp){ vec4 f = suiFog(wp); return mix(f.rgb, col, f.a); }
// 地面高度（512 格，手工双线性插值），用于墙脚、树根的接地暗影
float suiGH(vec2 xz){
  vec2 uv = (xz - uHRect.xy) / uHRect.zw * 512.0 - 0.5; vec2 i = floor(uv), f = fract(uv);
  ivec2 a = ivec2(clamp(i, 0.0, 511.0)), b = ivec2(clamp(i + 1.0, 0.0, 511.0));
  float h00 = texelFetch(tHeight, a, 0).r, h10 = texelFetch(tHeight, ivec2(b.x, a.y), 0).r, h01 = texelFetch(tHeight, ivec2(a.x, b.y), 0).r, h11 = texelFetch(tHeight, b, 0).r;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}
// 水底光斑：泰森多边形的边
float suiCaustic(vec2 p){
  float t = uTime * 0.7; vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = vec2(sh12(i + g), sh12(i + g + 17.3)); o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return pow(clamp(1.0 - (d2 - d1) * 2.4, 0.0, 1.0), 5.0);
}
// 风：一阵一阵，枝梢比枝干动得多
vec3 suiSway(vec3 wp, float flex, float ph){
  float t = uTime;
  float g = 0.55 + 0.3 * sin(t * 0.45 + dot(wp.xz, uWind.xy) * 0.04) + 0.15 * sin(t * 0.21 + wp.x * 0.02);
  float s = sin(t * 1.6 + ph + dot(wp.xz, uWind.xy) * 0.12) * 0.6 + sin(t * 2.7 + ph * 1.7) * 0.25;
  vec3 dir = vec3(uWind.x, 0.0, uWind.y);
  return (dir * (0.35 + s) + vec3(-uWind.y, 0.0, uWind.x) * sin(t * 1.9 + ph * 2.1) * 0.25) * g * uWind.z * flex;
}
`;

let patched = false;
function patchAtmosphere() {
  if (patched) return; patched = true;
  const C = THREE.ShaderChunk;
  C.common = C.common + '\n' + SUI_GLSL;
  C.fog_pars_vertex = '#ifdef USE_FOG\n varying vec3 vSuiWP; varying vec4 vSuiFog;\n#endif';
  C.fog_vertex = `#ifdef USE_FOG
    vSuiWP = cameraPosition + transpose(mat3(viewMatrix)) * mvPosition.xyz;
    vSuiFog = suiFog(vSuiWP);
  #endif`;
  C.fog_pars_fragment = '#ifdef USE_FOG\n varying vec3 vSuiWP; varying vec4 vSuiFog;\n#endif';
  C.fog_fragment = `#ifdef USE_FOG
    #ifdef SUI_AO
      gl_FragColor.rgb *= mix(0.5, 1.0, smoothstep(0.0, 1.6, vSuiWP.y - suiGH(vSuiWP.xz)));
    #endif
    { float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11)); gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(lum) * vec3(1.06, 1.04, 1.0) * 1.3, uClay); }
    gl_FragColor.rgb = suiGrade(mix(vSuiFog.rgb, gl_FragColor.rgb, vSuiFog.a));
    #ifdef SUI_DISSOLVE
      if (uBuild < 0.999) { float gz = length((vSuiWP.xz - vec2(5.0, -2.0)) / vec2(100.0, 62.0));
        if (gz < 1.0 && sh12(floor(vSuiWP.xz * 3.0) + floor(vSuiWP.y * 3.0) * 7.13) > uBuild) discard; }
    #endif
  #endif`;
}
// 给内置材质接上共享 uniform，可再改一段着色器
function hook(mat, key, edit) {
  mat.userData.hooked = true;
  mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); if (mat.userData.u) Object.assign(sh.uniforms, mat.userData.u); if (edit) edit(sh); };
  mat.customProgramCacheKey = () => key;
  return mat;
}
// 按世界坐标给墙、石、木贴图（方盒投影），合并后的几何也不会拉伸
function boxUV(mat, scale, key, extra) {
  mat.userData.u = Object.assign(mat.userData.u || {}, { uBoxS: { value: scale } });
  return hook(mat, 'box' + key, sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      {
        vec3 bp = (modelMatrix * vec4(position, 1.0)).xyz;
        #ifdef USE_INSTANCING
          bp = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        #endif
        vec3 bn = abs(normalize(mat3(modelMatrix) * normal));
        vec2 buv = bn.y > 0.62 ? bp.xz : (bn.x > bn.z ? bp.zy : bp.xy);
        buv *= uBoxS;
        #ifdef USE_MAP
          vMapUv = buv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = buv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = buv;
        #endif
      }`).replace('#include <common>', '#include <common>\nuniform float uBoxS;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uBoxS;');
    if (extra) extra(sh);
  });
}
function dissolveOn(mat) { mat.defines = Object.assign(mat.defines || {}, { SUI_DISSOLVE: '' }); return mat; }
function aoOn(mat) { mat.defines = Object.assign(mat.defines || {}, { SUI_AO: '' }); return mat; }
