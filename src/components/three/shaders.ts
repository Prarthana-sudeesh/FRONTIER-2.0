// GLSL for the planets, ocean and skies. Everything is procedural, so no
// texture files have to be downloaded.

/** 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT) plus fbm. */
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p){
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { f += a * snoise(p); p *= 2.03; a *= 0.5; }
  return f;
}
`;

const SPHERE_VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vView;
void main(){
  vPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const planetShader = {
  vertexShader: SPHERE_VERT,
  fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uType;
uniform float uSeed;
uniform float uHover;
uniform vec3 uSun;
uniform vec3 uAtmo;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vView;
${NOISE}
void main(){
  vec3 p = normalize(vPos);
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vView);
  vec3 sun = normalize(uSun);
  float ndl = dot(n, sun);
  float diff = smoothstep(-0.12, 0.55, ndl);
  vec3 col;
  vec3 glow = vec3(0.0);

  if (uType < 0.5) {
    // living ocean world: seas, beaches, jungle, coral highlands, ice caps
    float h = fbm(p * 1.7 + uSeed);
    vec3 deep = vec3(0.02, 0.09, 0.24);
    vec3 shallow = vec3(0.04, 0.33, 0.48);
    if (h < 0.04) {
      col = mix(deep, shallow, smoothstep(-0.45, 0.04, h));
      vec3 r = reflect(-sun, n);
      col += vec3(1.0, 0.9, 0.8) * pow(max(dot(r, v), 0.0), 48.0) * 0.7 * diff;
    } else {
      col = mix(vec3(0.82, 0.72, 0.52), vec3(0.13, 0.44, 0.24), smoothstep(0.04, 0.11, h));
      col = mix(col, vec3(0.08, 0.3, 0.16), smoothstep(0.18, 0.3, h));
      col = mix(col, vec3(0.86, 0.45, 0.55), smoothstep(0.32, 0.5, h));
    }
    col = mix(col, vec3(0.95, 0.97, 1.0), smoothstep(0.8, 0.92, abs(p.y) + h * 0.15));
    col *= diff;
    // city lights of hospitals and labs on the night side
    float lights = step(0.04, h) * smoothstep(0.55, 0.75, snoise(p * 40.0 + uSeed));
    glow = vec3(1.0, 0.75, 0.5) * lights * 0.9;
  } else if (uType < 1.5) {
    // gas giant with bands and a storm
    float warp = fbm(p * vec3(2.0, 7.0, 2.0) + vec3(uTime * 0.015, 0.0, uSeed));
    float band = p.y * 7.0 + warp * 1.8;
    float s = sin(band) * 0.5 + 0.5;
    col = mix(vec3(0.5, 0.28, 0.1), vec3(1.0, 0.83, 0.5), s);
    col = mix(col, vec3(0.98, 0.94, 0.84), smoothstep(0.6, 1.0, sin(band * 2.3 + 1.0) * 0.5 + 0.5) * 0.45);
    vec3 spotC = normalize(vec3(0.6, -0.32, 0.74));
    float spot = smoothstep(0.22, 0.0, distance(p, spotC) + fbm(p * 8.0) * 0.05);
    col = mix(col, vec3(0.75, 0.25, 0.12), spot * 0.85);
    col *= diff;
  } else if (uType < 2.5) {
    // ice world with glowing data grids on the night side
    float h = fbm(p * 2.4 + uSeed);
    col = mix(vec3(0.5, 0.76, 0.93), vec3(0.93, 0.97, 1.0), smoothstep(-0.2, 0.35, h));
    col = mix(col, vec3(0.08, 0.26, 0.5), smoothstep(-0.05, -0.4, h));
    float spec = pow(max(dot(reflect(-sun, n), v), 0.0), 24.0) * 0.35;
    col = col * diff + spec * diff;
    vec2 g = abs(fract(vec2(atan(p.z, p.x) * 9.0, p.y * 18.0)) - 0.5);
    float grid = smoothstep(0.46, 0.5, max(g.x, g.y)) * step(0.05, fbm(p * 4.0 + uSeed * 2.0));
    glow = vec3(0.35, 0.9, 1.0) * grid * 1.2;
  } else {
    // volcanic world: dark basalt with glowing magma rivers
    float h = fbm(p * 2.1 + uSeed);
    col = mix(vec3(0.1, 0.05, 0.16), vec3(0.42, 0.3, 0.55), smoothstep(-0.3, 0.5, h));
    col *= diff;
    float river = 1.0 - smoothstep(0.0, 0.05, abs(fbm(p * 3.2 + uSeed * 1.7 + uTime * 0.008)));
    glow = mix(vec3(1.0, 0.25, 0.75), vec3(1.0, 0.65, 0.3), h + 0.5) * river * 1.4;
  }

  col += glow * (1.0 - smoothstep(-0.1, 0.35, ndl) * 0.85);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += uAtmo * fres * (0.15 + diff) * 0.9;
  col *= 1.0 + uHover * 0.25;
  gl_FragColor = vec4(col, 1.0);
}
`,
};

export const cloudShader = {
  vertexShader: SPHERE_VERT,
  fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform vec3 uSun;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vView;
${NOISE}
void main(){
  vec3 p = normalize(vPos);
  float c = fbm(p * 2.6 + vec3(uTime * 0.02, 0.0, uSeed));
  float a = smoothstep(0.08, 0.5, c);
  float diff = smoothstep(-0.1, 0.5, dot(normalize(vNormal), normalize(uSun)));
  gl_FragColor = vec4(vec3(1.0) * (0.1 + diff), a * 0.85);
}
`,
};

export const atmosphereShader = {
  vertexShader: /* glsl */ `
varying vec3 vNormalV;
varying vec3 vNormalW;
void main(){
  vNormalV = normalize(normalMatrix * normal);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSun;
varying vec3 vNormalV;
varying vec3 vNormalW;
void main(){
  float i = pow(max(0.75 - dot(vNormalV, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
  float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.6, dot(vNormalW, normalize(uSun)));
  gl_FragColor = vec4(uColor * i * lit * 2.2, 1.0);
}
`,
};

export const ringShader = {
  vertexShader: /* glsl */ `
varying vec3 vPos;
void main(){
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
uniform float uInner;
uniform float uOuter;
uniform vec3 uColor;
varying vec3 vPos;
void main(){
  float t = (length(vPos.xy) - uInner) / (uOuter - uInner);
  float bands = 0.55 + 0.45 * sin(t * 70.0) * sin(t * 13.0 + 1.3);
  float gap = smoothstep(0.52, 0.55, t) * (1.0 - smoothstep(0.58, 0.61, t));
  float a = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.9, 1.0, t)) * bands * (1.0 - gap * 0.85);
  gl_FragColor = vec4(uColor * (0.7 + bands * 0.5), a * 0.75);
}
`,
};

export const nebulaShader = {
  vertexShader: /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
uniform float uTime;
varying vec3 vDir;
${NOISE}
void main(){
  float n = fbm(vDir * 2.2 + vec3(0.0, 0.0, uTime * 0.004));
  float m = fbm(vDir * 4.5 + 3.0);
  vec3 base = vec3(0.027, 0.012, 0.06);
  vec3 col = base;
  col += vec3(0.23, 0.08, 0.42) * smoothstep(0.0, 0.7, n) * 0.55;
  col += vec3(0.55, 0.15, 0.45) * smoothstep(0.35, 0.8, m) * 0.18;
  gl_FragColor = vec4(col, 1.0);
}
`,
};

export const oceanShader = {
  vertexShader: /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vH;
// returns (height, d/dx, d/dz) of one sine wave so normals are smooth
vec3 wave(vec2 p, vec2 dir, float freq, float speed, float amp){
  vec2 d = normalize(dir);
  float ph = dot(p, d) * freq + uTime * speed;
  return vec3(sin(ph) * amp, cos(ph) * amp * freq * d);
}
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec3 h = wave(w.xz, vec2(1.0, 0.3), 0.32, 1.1, 0.32)
         + wave(w.xz, vec2(-0.4, 1.0), 0.55, 1.6, 0.16)
         + wave(w.xz, vec2(0.7, -0.8), 1.2, 2.3, 0.07)
         + wave(w.xz, vec2(0.2, 1.0), 2.4, 3.1, 0.03);
  w.y += h.x;
  vH = h.x;
  vNormal = normalize(vec3(-h.y, 1.0, -h.z));
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`,
  fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vH;
void main(){
  // fine ripples on top of the big swells
  vec2 r = vec2(sin(vWorld.x * 4.1 + uTime * 2.0 + sin(vWorld.z * 3.3)), sin(vWorld.z * 3.7 - uTime * 1.7 + sin(vWorld.x * 2.9)));
  vec3 n = normalize(vNormal + vec3(r.x, 0.0, r.y) * 0.06);
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 col = mix(uDeep, uShallow, smoothstep(-0.45, 0.45, vH));
  col = mix(col, uSky, clamp(fres * 0.85, 0.0, 1.0));
  float spec = pow(max(dot(reflect(-normalize(uSunDir), n), v), 0.0), 140.0);
  col += uSunColor * spec * 1.6;
  float foam = smoothstep(0.38, 0.56, vH + 0.08 * sin(vWorld.x * 3.1 + uTime) * sin(vWorld.z * 2.3 - uTime * 0.7));
  col = mix(col, vec3(0.93, 0.9, 1.0), foam * 0.55);
  float d = length(cameraPosition.xz - vWorld.xz);
  col = mix(col, uSky, smoothstep(45.0, 150.0, d));
  gl_FragColor = vec4(col, 1.0);
}
`,
};

export const skyShader = {
  vertexShader: /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vDir;
void main(){
  float y = clamp(vDir.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, y));
  float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 8.0) * 0.35 + pow(s, 600.0) * 3.0);
  gl_FragColor = vec4(col, 1.0);
}
`,
};
