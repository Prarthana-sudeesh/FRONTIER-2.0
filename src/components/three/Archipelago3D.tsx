import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, QuadraticBezierLine, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { rng, type WorldStyle } from "../../data";
import type { Concept, GapView, Sub } from "../../types";
import { islandLayout, islandX, islandZ, type IslandLayout } from "../islands";
import { oceanShader, skyShader } from "./shaders";

const GROUND = 0.64;
const SUN_DIR = new THREE.Vector3(-0.45, 0.16, -1).normalize();
const SKY_TOP = new THREE.Color("#1a0a3a");
const SKY_HORIZON = new THREE.Color("#e58fc0");
const SUN_COLOR = new THREE.Color("#ffd1a0");

interface Props {
  subs: Sub[];
  index: number;
  open: boolean;
  style: WorldStyle;
  color: string;
  highlight: number | null;
  bridges: GapView[];
  onIsland: (i: number) => void;
  onBeacon: (conceptId: number, island: number) => void;
}

export default function Archipelago3D(props: Props) {
  const layouts = useMemo(() => props.subs.map((s) => islandLayout(s)), [props.subs]);
  const start = islandX(props.index);
  return (
    <Canvas camera={{ position: [start, 34, 48], fov: 45, near: 0.1, far: 900 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <fog attach="fog" args={[SKY_HORIZON.clone().multiplyScalar(0.75), 50, 190]} />
      <SkyDome />
      <Stars radius={160} depth={40} count={1800} factor={4} saturation={0} fade speed={0.3} />
      <hemisphereLight args={["#d9c4ff", "#1f3b5c", 1.0]} />
      <directionalLight position={SUN_DIR.clone().multiplyScalar(50)} intensity={1.8} color="#ffd9c2" />
      <Ocean style={props.style} />
      {props.subs.map((s, i) => (
        <Island
          key={s.id}
          sub={s}
          i={i}
          layout={layouts[i]}
          active={i === props.index}
          near={!props.open && Math.abs(i - props.index) <= 1}
          style={props.style}
          color={props.color}
          highlight={props.highlight}
          onIsland={props.onIsland}
          onBeacon={props.onBeacon}
        />
      ))}
      <Bridges subs={props.subs} layouts={layouts} gaps={props.bridges} />
      <Clouds count={Math.max(6, props.subs.length * 2)} />
      <Birds index={props.index} />
      <Fireflies count={80} scale={[16, 3, 12]} size={9} color={props.color} position={[islandX(props.index), 1.6, islandZ(props.index)]} />
      <Rig index={props.index} open={props.open} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.75} luminanceSmoothing={0.2} intensity={0.85} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}

function SkyDome() {
  const uniforms = useMemo(
    () => ({ uTop: { value: SKY_TOP }, uHorizon: { value: SKY_HORIZON }, uSunDir: { value: SUN_DIR }, uSunColor: { value: SUN_COLOR } }),
    [],
  );
  const ref = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);
  useFrame(() => ref.current?.position.set(camera.position.x, 0, camera.position.z));
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[500, 48, 32]} />
      <shaderMaterial vertexShader={skyShader.vertexShader} fragmentShader={skyShader.fragmentShader} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

function Ocean({ style }: { style: WorldStyle }) {
  const ref = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(style.water[0]) },
      uShallow: { value: new THREE.Color(style.water[1]) },
      uSky: { value: new THREE.Color("#c99ae0") },
      uSunDir: { value: SUN_DIR },
      uSunColor: { value: SUN_COLOR },
    }),
    [style],
  );
  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    // follow the camera in steps of one grid cell so the waves never swim
    if (ref.current) ref.current.position.x = Math.round(camera.position.x / 2) * 2;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -55]}>
      <planeGeometry args={[360, 260, 180, 130]} />
      <shaderMaterial vertexShader={oceanShader.vertexShader} fragmentShader={oceanShader.fragmentShader} uniforms={uniforms} />
    </mesh>
  );
}

function Island({
  sub,
  i,
  layout,
  active,
  near,
  style,
  color,
  highlight,
  onIsland,
  onBeacon,
}: {
  sub: Sub;
  i: number;
  layout: IslandLayout;
  active: boolean;
  near: boolean;
  style: WorldStyle;
  color: string;
  highlight: number | null;
  onIsland: (i: number) => void;
  onBeacon: (id: number, i: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const foam = useRef<THREE.MeshBasicMaterial>(null);
  const shapes = useMemo(() => {
    const toShape = (pts: [number, number][]) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    return { base: toShape(layout.shape), top: toShape(layout.top), foam: toShape(layout.foam) };
  }, [layout]);
  const gapIds = useMemo(() => new Set(sub.gaps.flatMap((g) => [g.a, g.b])), [sub.gaps]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.position.y = Math.sin(t * 0.7 + i * 1.3) * 0.18;
      group.current.rotation.z = Math.sin(t * 0.5 + i) * 0.025;
      group.current.rotation.x = Math.cos(t * 0.4 + i) * 0.02;
    }
    if (foam.current) foam.current.opacity = 0.28 + Math.sin(t * 1.4 + i) * 0.12;
  });

  return (
    <group position={[islandX(i), 0, islandZ(i)]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <shapeGeometry args={[shapes.foam, 24]} />
        <meshBasicMaterial ref={foam} color="#f4ecff" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <group
        ref={group}
        onClick={(e) => {
          e.stopPropagation();
          onIsland(i);
        }}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]}>
          <extrudeGeometry args={[shapes.base, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.5, bevelSegments: 2, curveSegments: 6 }]} />
          <meshStandardMaterial color={style.sand} flatShading roughness={0.95} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
          <extrudeGeometry args={[shapes.top, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.14, bevelSegments: 2, curveSegments: 6 }]} />
          <meshStandardMaterial color={style.top} flatShading roughness={0.9} />
        </mesh>
        {layout.peak && <Peak at={layout.peak} style={style} height={1.3 + Math.min(1.6, sub.concepts.length * 0.12)} size={layout.size} />}
        {layout.decos.map((p, k) => (
          <Deco key={k} at={p} kind={style.deco} seed={sub.seed + k} />
        ))}
        {layout.beacons.map((b) => (
          <Beacon
            key={b.concept.id}
            concept={b.concept}
            at={b.p}
            color={color}
            beam={gapIds.has(b.concept.id)}
            highlighted={highlight === b.concept.id}
            showLabel={active && highlight === b.concept.id}
            onClick={() => onBeacon(b.concept.id, i)}
          />
        ))}
      </group>
      {near && (
        <Html position={[0, 5.2, 0]} center zIndexRange={[10, 0]}>
          <button className={`island-label ${active ? "active" : ""}`} onClick={() => onIsland(i)}>
            <span className="island-name">{sub.name}</span>
            <span className="island-meta">
              {sub.concepts.length} concepts · {sub.gaps.length} gaps
            </span>
          </button>
        </Html>
      )}
    </group>
  );
}

const w = (p: [number, number], y: number): [number, number, number] => [p[0], y, -p[1]];

function Peak({ at, style, height, size }: { at: [number, number]; style: WorldStyle; height: number; size: number }) {
  const r = size * 0.32;
  const crater = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((s) => {
    if (crater.current) crater.current.color.setRGB(2.4 + Math.sin(s.clock.elapsedTime * 2) * 0.6, 0.5, 1.8);
  });
  if (style.deco === "tower") {
    return (
      <mesh position={w(at, GROUND + height * 0.35)}>
        <cylinderGeometry args={[r * 0.75, r, height * 0.7, 7]} />
        <meshStandardMaterial color={style.peak} flatShading />
      </mesh>
    );
  }
  if (style.deco === "vent") {
    return (
      <group position={w(at, GROUND)}>
        <mesh position={[0, height / 2, 0]}>
          <cylinderGeometry args={[r * 0.35, r, height, 8]} />
          <meshStandardMaterial color={style.peak} flatShading />
        </mesh>
        <mesh position={[0, height + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r * 0.3, 12]} />
          <meshBasicMaterial ref={crater} toneMapped={false} />
        </mesh>
        <Fireflies count={16} scale={[0.6, 2.2, 0.6]} position={[0, height + 1.1, 0]} size={7} color="#ff7ad9" rise />
      </group>
    );
  }
  return (
    <group position={w(at, GROUND)}>
      <mesh position={[0, height / 2, 0]}>
        <coneGeometry args={[r, height, 7]} />
        <meshStandardMaterial color={style.peak} flatShading />
      </mesh>
      {style.deco === "crystal" || height > 2 ? (
        <mesh position={[0, height * 0.82, 0]}>
          <coneGeometry args={[r * 0.36, height * 0.36, 7]} />
          <meshStandardMaterial color="#ffffff" flatShading />
        </mesh>
      ) : null}
    </group>
  );
}

function Deco({ at, kind, seed }: { at: [number, number]; kind: WorldStyle["deco"]; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  const r = useMemo(() => rng(seed), [seed]);
  const v = useMemo(() => ({ s: 0.7 + r() * 0.6, rot: r() * Math.PI * 2, ph: r() * 10 }), [r]);
  useFrame((s) => {
    const t = s.clock.elapsedTime + v.ph;
    if (!ref.current) return;
    if (kind === "palm") ref.current.rotation.z = Math.sin(t * 1.2) * 0.06;
    if (kind === "crystal") ref.current.rotation.y = t * 0.4;
    if (kind === "tower") ref.current.rotation.y = v.rot;
  });
  return (
    <group position={w(at, GROUND)} scale={v.s}>
      <group ref={ref}>
        {kind === "palm" && (
          <>
            <mesh position={[0.08, 0.6, 0]} rotation={[0, 0, -0.15]}>
              <cylinderGeometry args={[0.05, 0.09, 1.25, 5]} />
              <meshStandardMaterial color="#7a5434" flatShading />
            </mesh>
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} position={[0.17, 1.22, 0]} rotation={[0, (k / 5) * Math.PI * 2 + v.rot, -0.45]}>
                <boxGeometry args={[0.9, 0.04, 0.24]} />
                <meshStandardMaterial color="#2f8a4a" flatShading />
              </mesh>
            ))}
          </>
        )}
        {kind === "tower" && (
          <>
            <mesh position={[0, 0.7, 0]}>
              <boxGeometry args={[0.32, 1.4, 0.32]} />
              <meshStandardMaterial color="#f2c46b" metalness={0.75} roughness={0.25} />
            </mesh>
            <mesh position={[0, 1.45, 0]}>
              <boxGeometry args={[0.2, 0.1, 0.2]} />
              <meshBasicMaterial color={[3, 2.2, 0.8]} toneMapped={false} />
            </mesh>
          </>
        )}
        {kind === "crystal" && (
          <mesh position={[0, 0.55, 0]} scale={[1, 2.1, 1]}>
            <octahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial color="#8be6ff" emissive="#2fb6e0" emissiveIntensity={0.6} transparent opacity={0.9} flatShading />
          </mesh>
        )}
        {kind === "vent" && (
          <>
            <mesh position={[0, 0.25, 0]}>
              <coneGeometry args={[0.32, 0.5, 6]} />
              <meshStandardMaterial color="#3b2552" flatShading />
            </mesh>
            <mesh position={[0, 0.52, 0]}>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshBasicMaterial color={[2.6, 0.6, 2]} toneMapped={false} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

function Beacon({
  concept,
  at,
  color,
  beam,
  highlighted,
  showLabel,
  onClick,
}: {
  concept: Concept;
  at: [number, number];
  color: string;
  beam: boolean;
  highlighted: boolean;
  showLabel: boolean;
  onClick: () => void;
}) {
  const orb = useRef<THREE.Mesh>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const [hover, setHover] = useState(false);
  const glow = useMemo(() => new THREE.Color(color).multiplyScalar(highlighted ? 4 : 2.6), [color, highlighted]);
  const ph = concept.id * 0.37;

  useFrame((s) => {
    const t = s.clock.elapsedTime + ph;
    if (orb.current) orb.current.scale.setScalar((highlighted || hover ? 1.45 : 1) * (1 + Math.sin(t * 2.2) * 0.12));
    if (beamMat.current) beamMat.current.opacity = (highlighted ? 0.3 : 0.14) + Math.sin(t * 1.6) * 0.05;
  });

  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover]);

  return (
    <group
      position={w(at, GROUND)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.1, 0.16, 0.5, 6]} />
        <meshStandardMaterial color="#d8cfe8" flatShading />
      </mesh>
      <mesh ref={orb} position={[0, 0.72, 0]}>
        <icosahedronGeometry args={[0.17, 1]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {beam && (
        <mesh position={[0, 4.2, 0]}>
          <cylinderGeometry args={[0.05, 0.32, 7, 10, 1, true]} />
          <meshBasicMaterial ref={beamMat} color={color} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {(hover || showLabel) && (
        <Html position={[0, 1.25, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[15, 0]}>
          <div className="beacon-label">{concept.name}</div>
        </Html>
      )}
    </group>
  );
}

type LineRef = { material?: { dashOffset?: number } };

function Bridges({ subs, layouts, gaps }: { subs: Sub[]; layouts: IslandLayout[]; gaps: GapView[] }) {
  const lines = useMemo(() => {
    const where = new Map<number, THREE.Vector3>();
    layouts.forEach((l, i) =>
      l.beacons.forEach((b) => where.set(b.concept.id, new THREE.Vector3(islandX(i) + b.p[0], GROUND + 0.72, islandZ(i) - b.p[1]))),
    );
    const islandOf = new Map<number, number>();
    subs.forEach((s, i) => s.concepts.forEach((c) => islandOf.set(c.id, i)));
    return gaps
      .filter((g) => where.has(g.a) && where.has(g.b) && islandOf.get(g.a) !== islandOf.get(g.b))
      .slice(0, 24)
      .map((g) => {
        const a = where.get(g.a)!;
        const b = where.get(g.b)!;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y += 4 + a.distanceTo(b) * 0.12;
        return { id: g.key, a, b, mid, score: g.score };
      });
  }, [subs, layouts, gaps]);
  return (
    <>
      {lines.map((l) => (
        <Bridge key={l.id} a={l.a} b={l.b} mid={l.mid} score={l.score} />
      ))}
    </>
  );
}

function Bridge({ a, b, mid, score }: { a: THREE.Vector3; b: THREE.Vector3; mid: THREE.Vector3; score: number }) {
  const ref = useRef<LineRef>(null);
  useFrame((_, dt) => {
    const m = ref.current?.material;
    if (m && typeof m.dashOffset === "number") m.dashOffset -= dt * 0.9;
  });
  return (
    <QuadraticBezierLine
      ref={ref as never}
      start={a}
      end={b}
      mid={mid}
      color="#f3e6ff"
      lineWidth={1 + score * 1.6}
      dashed
      dashSize={0.45}
      gapSize={0.3}
      transparent
      opacity={0.55}
    />
  );
}

function Clouds({ count }: { count: number }) {
  const camera = useThree((s) => s.camera);
  const clouds = useMemo(() => {
    const r = rng(99);
    return Array.from({ length: count }, (_, i) => ({
      x: (r() - 0.5) * 140,
      y: 10 + r() * 6,
      z: -14 - r() * 30,
      s: 1 + r() * 1.3,
      speed: 0.25 + r() * 0.35,
      puffs: Array.from({ length: 4 + Math.floor(r() * 3) }, () => [(r() - 0.5) * 4, (r() - 0.3) * 0.9, (r() - 0.5) * 1.6, 0.9 + r() * 0.9] as const),
      key: i,
    }));
  }, [count]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => {
    clouds.forEach((c, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.x += dt * c.speed;
      const rel = g.position.x - camera.position.x;
      if (rel > 75) g.position.x -= 150;
      if (rel < -75) g.position.x += 150;
    });
  });
  return (
    <>
      {clouds.map((c, i) => (
        <group
          key={c.key}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[c.x, c.y, c.z]}
          scale={c.s}
        >
          {c.puffs.map(([x, y, z, r], k) => (
            <mesh key={k} position={[x, y, z]}>
              <icosahedronGeometry args={[r, 1]} />
              <meshStandardMaterial color="#f6e9ff" flatShading roughness={1} transparent opacity={0.92} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function Birds({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null);
  const birds = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ r: 3.5 + i * 0.5, h: 4.5 + (i % 3) * 0.6, ph: i * 1.2, sp: 0.35 + i * 0.04 })), []);
  const wings = useRef<(THREE.Group | null)[]>([]);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    if (group.current) {
      const tx = islandX(index);
      const tz = islandZ(index);
      group.current.position.x += (tx - group.current.position.x) * (1 - Math.exp(-dt * 0.8));
      group.current.position.z += (tz - group.current.position.z) * (1 - Math.exp(-dt * 0.8));
    }
    birds.forEach((b, i) => {
      const g = wings.current[i];
      if (!g) return;
      const a = t * b.sp + b.ph;
      g.position.set(Math.cos(a) * b.r, b.h + Math.sin(t * 0.8 + b.ph) * 0.3, Math.sin(a) * b.r);
      g.rotation.y = -a;
      const flap = Math.sin(t * 9 + b.ph) * 0.6;
      const [l, r] = g.children;
      if (l) l.rotation.x = flap;
      if (r) r.rotation.x = -flap;
    });
  });
  return (
    <group ref={group} position={[islandX(index), 0, islandZ(index)]}>
      {birds.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            wings.current[i] = el;
          }}
        >
          <mesh position={[0, 0, 0.16]}>
            <boxGeometry args={[0.12, 0.015, 0.32]} />
            <meshBasicMaterial color="#2a1840" />
          </mesh>
          <mesh position={[0, 0, -0.16]}>
            <boxGeometry args={[0.12, 0.015, 0.32]} />
            <meshBasicMaterial color="#2a1840" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Rig({ index, open }: { index: number; open: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const look = useRef(new THREE.Vector3(islandX(index), 0, islandZ(index)));
  useFrame((state, dt) => {
    const x = islandX(index);
    const z = islandZ(index);
    const tall = size.width < size.height;
    const k = 1 - Math.exp(-dt * 1.8);
    const px = state.pointer.x;
    const py = state.pointer.y;
    const pos = open
      ? tall
        ? new THREE.Vector3(x, 9, z + 13)
        : new THREE.Vector3(x - 1, 4.6, z + 9.5)
      : new THREE.Vector3(x + px * 1.2, (tall ? 9.5 : 7.2) + py * 0.6, z + (tall ? 22 : 17));
    const target = open ? (tall ? new THREE.Vector3(x, -3.5, z) : new THREE.Vector3(x + 3.4, 1.2, z)) : new THREE.Vector3(x, 1.3, z);
    camera.position.lerp(pos, k);
    look.current.lerp(target, k);
    camera.lookAt(look.current);
  });
  return null;
}

const fireflyShader = {
  vertexShader: /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uRise;
uniform vec3 uScale;
attribute float aSeed;
varying float vFade;
void main(){
  vec3 p = position;
  float t = uTime * (0.3 + aSeed * 0.4) + aSeed * 40.0;
  p.x += sin(t * 1.3) * 0.25;
  p.z += cos(t * 1.1) * 0.25;
  if (uRise > 0.5) {
    float k = fract(uTime * 0.25 + aSeed);
    p.y = (k - 0.5) * uScale.y;
    vFade = 1.0 - k;
  } else {
    p.y += sin(t) * 0.3;
    vFade = 0.55 + 0.45 * sin(t * 2.3);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (10.0 / max(-mv.z, 1.0));
  gl_Position = projectionMatrix * mv;
}
`,
  fragmentShader: /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main(){
  float d = length(gl_PointCoord - vec2(0.5));
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * 2.0, a * a * vFade);
}
`,
};

/** Drifting glowing specks. A soft falloff keeps every pixel finite (no infinities for the glow pass). */
function Fireflies({
  count,
  scale,
  size,
  color,
  position,
  rise = false,
}: {
  count: number;
  scale: [number, number, number];
  size: number;
  color: string;
  position: [number, number, number];
  rise?: boolean;
}) {
  const geo = useMemo(() => {
    const r = rng(count * 7 + scale[0] * 13);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * scale[0];
      pos[i * 3 + 1] = (r() - 0.5) * scale[1];
      pos[i * 3 + 2] = (r() - 0.5) * scale[2];
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count, scale]);
  useEffect(() => () => geo.dispose(), [geo]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: size },
      uRise: { value: rise ? 1 : 0 },
      uScale: { value: new THREE.Vector3(...scale) },
      uColor: { value: new THREE.Color(color) },
    }),
    [size, rise, scale, color],
  );
  const group = useRef<THREE.Points>(null);
  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    if (group.current) {
      const g = group.current.position;
      g.x += (position[0] - g.x) * Math.min(1, dt * 1.5);
      g.y = position[1];
      g.z += (position[2] - g.z) * Math.min(1, dt * 1.5);
    }
  });
  return (
    <points ref={group} geometry={geo} position={position}>
      <shaderMaterial
        vertexShader={fireflyShader.vertexShader}
        fragmentShader={fireflyShader.fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
