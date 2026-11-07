import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, QuadraticBezierLine, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { hashStr } from "../../data";
import type { WorldInfo, WorldLink } from "../Explore";
import { atmosphereShader, cloudShader, nebulaShader, planetShader, ringShader } from "./shaders";

// Light comes from the front-left so the planets' faces are lit; the visible sun sits far behind.
const SUN = new THREE.Vector3(-26, 14, 18);
const SUN_VISIBLE = new THREE.Vector3(55, 38, -120);

interface Props {
  worlds: WorldInfo[];
  links: WorldLink[];
  entering: string | null;
  hover: string | null;
  onHover: (field: string | null) => void;
  onPick: (field: string) => void;
}

export default function Universe3D(props: Props) {
  return (
    <Canvas camera={{ position: [0, 0.6, 18], fov: 45, near: 0.1, far: 600 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <color attach="background" args={["#07030f"]} />
      <Nebula />
      <Stars radius={140} depth={60} count={5000} factor={4} saturation={0.3} fade speed={0.4} />
      <Sun />
      <directionalLight position={SUN} intensity={1.6} />
      <ambientLight intensity={0.12} />
      <Scene {...props} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.55} luminanceSmoothing={0.25} intensity={0.9} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}

function Nebula() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, dt) => (uniforms.uTime.value += dt));
  return (
    <mesh>
      <sphereGeometry args={[300, 48, 48]} />
      <shaderMaterial vertexShader={nebulaShader.vertexShader} fragmentShader={nebulaShader.fragmentShader} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

function Sun() {
  return (
    <group position={SUN_VISIBLE}>
      <mesh>
        <sphereGeometry args={[6, 32, 32]} />
        <meshBasicMaterial color={[6, 4.6, 3.4]} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[11, 32, 32]} />
        <meshBasicMaterial color="#ffb37a" transparent opacity={0.08} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Where each planet sits: a row on wide screens, a 2×2 grid on tall ones. */
function usePlacement(worlds: WorldInfo[]) {
  const viewport = useThree((s) => s.viewport);
  return useMemo(() => {
    const n = worlds.length;
    const wide = viewport.width >= viewport.height * 1.05;
    const maxC = Math.max(1, ...worlds.map((w) => w.concepts));
    return worlds.map((w, i) => {
      const weight = 0.75 + 0.25 * Math.sqrt(w.concepts / maxC);
      if (wide) {
        const spacing = Math.min(6.4, viewport.width / (n + 0.4));
        const x = (i - (n - 1) / 2) * spacing;
        const y = (i % 2 ? -0.7 : 0.5) - 0.3;
        return { pos: new THREE.Vector3(x, y, 0), radius: Math.min(2.2, spacing * 0.3) * weight };
      }
      const cols = 2;
      const rows = Math.ceil(n / cols);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cw = viewport.width / cols;
      const rh = (viewport.height * 0.8) / rows;
      const x = (col - (cols - 1) / 2) * cw;
      const y = ((rows - 1) / 2 - row) * rh - viewport.height * 0.06;
      return { pos: new THREE.Vector3(x, y, 0), radius: Math.min(cw, rh) * 0.27 * weight };
    });
  }, [worlds, viewport.width, viewport.height]);
}

function Scene({ worlds, links, entering, hover, onHover, onPick }: Props) {
  const place = usePlacement(worlds);
  const index = new Map(worlds.map((w, i) => [w.field.id, i]));
  const camera = useThree((s) => s.camera);
  const home = useRef(new THREE.Vector3(0, 0.6, 18));
  const look = useRef(new THREE.Vector3());

  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover]);

  useFrame((state, dt) => {
    const k = 1 - Math.exp(-dt * (entering ? 3.2 : 2));
    const i = entering ? index.get(entering) : undefined;
    if (i != null && place[i]) {
      const p = place[i].pos;
      camera.position.lerp(new THREE.Vector3(p.x, p.y, p.z + place[i].radius * 1.25), k);
      look.current.lerp(p, k);
    } else {
      const target = home.current.clone().add(new THREE.Vector3(state.pointer.x * 0.9, state.pointer.y * 0.5, 0));
      camera.position.lerp(target, k);
      look.current.lerp(new THREE.Vector3(0, 0, 0), k);
    }
    camera.lookAt(look.current);
  });

  return (
    <>
      {worlds.map((w, i) =>
        place[i] ? (
          <Planet
            key={w.field.id}
            world={w}
            pos={place[i].pos}
            radius={place[i].radius}
            hovered={hover === w.field.id}
            dimmed={entering != null && entering !== w.field.id}
            onHover={onHover}
            onPick={onPick}
          />
        ) : null,
      )}
      {!entering &&
        links.map((l) => {
          const a = index.get(l.a);
          const b = index.get(l.b);
          if (a == null || b == null || !place[a] || !place[b]) return null;
          return <Link key={`${l.a}-${l.b}`} from={place[a]} to={place[b]} count={l.count} highlight={hover === l.a || hover === l.b} />;
        })}
    </>
  );
}

function Planet({
  world,
  pos,
  radius,
  hovered,
  dimmed,
  onHover,
  onPick,
}: {
  world: WorldInfo;
  pos: THREE.Vector3;
  radius: number;
  hovered: boolean;
  dimmed: boolean;
  onHover: (f: string | null) => void;
  onPick: (f: string) => void;
}) {
  const spin = useRef<THREE.Group>(null);
  const cloud = useRef<THREE.Mesh>(null);
  const holder = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Group>(null);
  const style = world.style;
  const seed = (hashStr(world.field.id) % 1000) / 37;
  const sunDir = useMemo(() => SUN.clone().sub(pos).normalize(), [pos]);
  const atmo = useMemo(() => new THREE.Color(style.atmosphere), [style.atmosphere]);

  const surface = useMemo(
    () => ({
      uTime: { value: 0 },
      uType: { value: style.planet },
      uSeed: { value: seed },
      uHover: { value: 0 },
      uSun: { value: sunDir },
      uAtmo: { value: atmo },
    }),
    // uniforms are created once; values are refreshed every frame below
    [],
  );
  const clouds = useMemo(() => ({ uTime: { value: 0 }, uSeed: { value: seed + 4 }, uSun: { value: sunDir } }), []);
  const atmos = useMemo(() => ({ uColor: { value: atmo }, uSun: { value: sunDir } }), []);
  const ring = useMemo(
    () => ({ uInner: { value: radius * 1.35 }, uOuter: { value: radius * 2.25 }, uColor: { value: new THREE.Color("#e9c88f") } }),
    [],
  );

  useFrame((state, dt) => {
    surface.uSun.value = sunDir;
    clouds.uSun.value = sunDir;
    atmos.uSun.value = sunDir;
    ring.uInner.value = radius * 1.35;
    ring.uOuter.value = radius * 2.25;
    surface.uTime.value += dt;
    clouds.uTime.value += dt;
    surface.uHover.value = THREE.MathUtils.lerp(surface.uHover.value, hovered ? 1 : 0, 1 - Math.exp(-dt * 6));
    if (spin.current) spin.current.rotation.y += dt * (style.planet === 1 ? 0.12 : 0.07);
    if (cloud.current) cloud.current.rotation.y += dt * 0.025;
    if (holder.current) {
      const s = THREE.MathUtils.lerp(holder.current.scale.x, (hovered ? 1.07 : 1) * (dimmed ? 0.9 : 1), 1 - Math.exp(-dt * 6));
      holder.current.scale.setScalar(s);
      holder.current.position.y = pos.y + Math.sin(state.clock.elapsedTime * 0.6 + seed) * 0.08;
    }
    if (moon.current) moon.current.rotation.y += dt * 0.5;
  });

  return (
    <group ref={holder} position={pos}>
      <group
        rotation={[0.25, 0, 0.18]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(world.field.id);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          onPick(world.field.id);
        }}
      >
        <group ref={spin}>
          <mesh>
            <sphereGeometry args={[radius, 96, 96]} />
            <shaderMaterial vertexShader={planetShader.vertexShader} fragmentShader={planetShader.fragmentShader} uniforms={surface} />
          </mesh>
        </group>
        {(style.planet === 0 || style.planet === 2) && (
          <mesh ref={cloud}>
            <sphereGeometry args={[radius * 1.025, 64, 64]} />
            <shaderMaterial vertexShader={cloudShader.vertexShader} fragmentShader={cloudShader.fragmentShader} uniforms={clouds} transparent={true} depthWrite={false} />
          </mesh>
        )}
        {style.planet === 1 && (
          <mesh rotation={[-Math.PI / 2 + 0.35, 0, 0]}>
            <ringGeometry args={[radius * 1.35, radius * 2.25, 160, 1]} />
            <shaderMaterial vertexShader={ringShader.vertexShader} fragmentShader={ringShader.fragmentShader} uniforms={ring} transparent={true} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>
      <mesh scale={1.16}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial vertexShader={atmosphereShader.vertexShader} fragmentShader={atmosphereShader.fragmentShader} uniforms={atmos} side={THREE.BackSide} blending={THREE.AdditiveBlending} transparent={true} depthWrite={false} />
      </mesh>
      {(style.planet === 2 || style.planet === 3) && (
        <group ref={moon} rotation={[0.4, 0, 0.2]}>
          <mesh position={[radius * 1.9, 0, 0]}>
            <icosahedronGeometry args={[radius * 0.16, 3]} />
            <meshStandardMaterial color="#b9b2c9" roughness={0.9} />
          </mesh>
        </group>
      )}
      <Html position={[0, -radius * 1.25 - 0.5, 0]} center zIndexRange={[20, 0]}>
        <button
          className={`planet-label ${hovered ? "on" : ""}`}
          style={{ ["--c" as string]: world.field.color }}
          onPointerEnter={() => onHover(world.field.id)}
          onPointerLeave={() => onHover(null)}
          onClick={() => onPick(world.field.id)}
        >
          <span className="planet-name">{world.field.name}</span>
          <span className="planet-meta">
            {world.subs} islands · {world.gaps} gaps
          </span>
        </button>
      </Html>
    </group>
  );
}

type LineRef = { material?: { dashOffset?: number } };

function Link({
  from,
  to,
  count,
  highlight,
}: {
  from: { pos: THREE.Vector3; radius: number };
  to: { pos: THREE.Vector3; radius: number };
  count: number;
  highlight: boolean;
}) {
  const ref = useRef<LineRef>(null);
  const start = useMemo(() => from.pos.clone().add(new THREE.Vector3(0, from.radius * 0.95, 0)), [from]);
  const end = useMemo(() => to.pos.clone().add(new THREE.Vector3(0, to.radius * 0.95, 0)), [to]);
  const mid = useMemo(() => start.clone().add(end).multiplyScalar(0.5).add(new THREE.Vector3(0, 1.4 + start.distanceTo(end) * 0.18, 1)), [start, end]);
  useFrame((_, dt) => {
    const m = ref.current?.material;
    if (m && typeof m.dashOffset === "number") m.dashOffset -= dt * 0.8;
  });
  return (
    <QuadraticBezierLine
      ref={ref as never}
      start={start}
      end={end}
      mid={mid}
      color={highlight ? "#ffffff" : "#c3a6ff"}
      lineWidth={Math.min(3.5, 0.8 + Math.log2(count + 1) * 0.6) * (highlight ? 1.5 : 1)}
      dashed
      dashSize={0.4}
      gapSize={0.3}
      transparent
      opacity={highlight ? 0.95 : 0.4}
    />
  );
}
