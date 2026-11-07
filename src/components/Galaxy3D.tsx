import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, QuadraticBezierLine, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { conceptSize } from "../data";
import type { GapView, Vec3 } from "../types";
import type { GalaxyProps } from "./GalaxyView";

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

export default function Galaxy3D(props: GalaxyProps) {
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  return (
    <Canvas
      camera={{ position: [0, 20, 26], fov: 50, near: 0.1, far: 500 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <color attach="background" args={["#05060f"]} />
      <fog attach="fog" args={["#05060f", 40, 90]} />
      <Stars radius={110} depth={50} count={3500} factor={3} saturation={0} fade speed={reduceMotion ? 0 : 0.6} />
      <Core />
      <ConceptStars {...props} />
      {props.arcs.map((g) => (
        <Arc key={g.key} gap={g} props={props} animate={!reduceMotion} />
      ))}
      <Labels {...props} />
      <Rig {...props} autoRotate={!reduceMotion} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.3} intensity={1.15} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}

function Core() {
  return (
    <mesh>
      <sphereGeometry args={[0.7, 32, 32]} />
      <meshBasicMaterial color={[2.2, 2.0, 1.8]} toneMapped={false} />
    </mesh>
  );
}

function ConceptStars({ data, positions, fieldById, selected, onSelect, highlight }: GalaxyProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const [hover, setHover] = useState<number | null>(null);
  const concepts = data.concepts;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    concepts.forEach((c, i) => {
      const p = positions.get(c.id) ?? [0, 0, 0];
      const s = conceptSize(c) * (c.id === selected ? 1.9 : c.id === hover ? 1.5 : 1);
      tmpObj.position.set(p[0], p[1], p[2]);
      tmpObj.scale.setScalar(s);
      tmpObj.updateMatrix();
      mesh.setMatrixAt(i, tmpObj.matrix);
      const dim = highlight != null && !highlight.has(c.id);
      tmpColor.set(fieldById.get(c.field)?.color ?? "#ffffff");
      tmpColor.multiplyScalar(dim ? 0.1 : highlight?.has(c.id) ? 2.6 : 1.6);
      mesh.setColorAt(i, tmpColor);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [concepts, positions, fieldById, selected, hover, highlight]);

  useEffect(() => {
    document.body.style.cursor = hover != null ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover]);

  const idAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId != null && e.instanceId < concepts.length ? concepts[e.instanceId].id : null;

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, concepts.length]}
      onPointerMove={(e) => {
        e.stopPropagation();
        setHover(idAt(e));
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        const id = idAt(e);
        onSelect(id === selected ? null : id);
      }}
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial toneMapped={false} />
      {hover != null && <HoverLabel id={hover} {...{ data, positions }} />}
    </instancedMesh>
  );
}

function HoverLabel({ id, data, positions }: { id: number; data: GalaxyProps["data"]; positions: Map<number, Vec3> }) {
  const c = data.concepts.find((x) => x.id === id);
  const p = positions.get(id);
  if (!c || !p) return null;
  return (
    <Html position={p} center style={{ pointerEvents: "none" }}>
      <div className="label-3d hover">{c.name}</div>
    </Html>
  );
}

function Labels({ data, positions, highlight, selected }: GalaxyProps) {
  if (!highlight) return null;
  const ids = [...highlight].slice(0, 14);
  return (
    <>
      {ids.map((id) => {
        const c = data.concepts.find((x) => x.id === id);
        const p = positions.get(id);
        if (!c || !p) return null;
        return (
          <Html key={id} position={[p[0], p[1] + conceptSize(c) + 0.25, p[2]]} center style={{ pointerEvents: "none" }}>
            <div className={`label-3d ${id === selected ? "main" : ""}`}>{c.name}</div>
          </Html>
        );
      })}
    </>
  );
}

type LineRef = { material?: { dashOffset?: number } };

function Arc({ gap, props, animate }: { gap: GapView; props: GalaxyProps; animate: boolean }) {
  const ref = useRef<LineRef>(null);
  const { positions, fieldById, selected, focus, highlight } = props;
  const pa = positions.get(gap.a);
  const pb = positions.get(gap.b);

  const mid = useMemo<Vec3 | null>(() => {
    if (!pa || !pb) return null;
    const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
    return [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2 + d * 0.35 + 0.5, (pa[2] + pb[2]) / 2];
  }, [pa, pb]);

  useFrame((_, dt) => {
    const m = ref.current?.material;
    if (animate && m && typeof m.dashOffset === "number") m.dashOffset -= dt * 0.6;
  });

  if (!pa || !pb || !mid) return null;
  const on = focus?.key === gap.key || (selected != null && (gap.a === selected || gap.b === selected));
  const faded = highlight != null && !on;
  const color = on ? "#ffffff" : fieldById.get(gap.ca.field)?.color ?? "#ffffff";

  return (
    <QuadraticBezierLine
      ref={ref as any}
      start={pa}
      end={pb}
      mid={mid}
      color={color}
      lineWidth={on ? 2.4 : 1}
      dashed
      dashSize={0.5}
      gapSize={0.35}
      transparent
      opacity={faded ? 0.06 : on ? 1 : 0.4}
      toneMapped={false}
    />
  );
}

/** Orbit controls plus a short camera glide towards whatever is selected. */
function Rig({ positions, selected, focus, autoRotate }: GalaxyProps & { autoRotate: boolean }) {
  const controls = useRef<any>(null);
  const camera = useThree((s) => s.camera);
  const goal = useRef<{ target: THREE.Vector3; cam: THREE.Vector3 } | null>(null);

  useEffect(() => {
    let t: Vec3 | null = null;
    if (selected != null) t = positions.get(selected) ?? null;
    else if (focus) {
      const a = positions.get(focus.a);
      const b = positions.get(focus.b);
      if (a && b) t = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    }
    if (!t) {
      goal.current = null;
      return;
    }
    const target = new THREE.Vector3(...t);
    const dir = camera.position.clone().sub(target).normalize();
    const dist = focus && selected == null ? 24 : 15;
    goal.current = { target, cam: target.clone().add(dir.multiplyScalar(dist)) };
  }, [selected, focus, positions, camera]);

  useFrame((_, dt) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    const k = 1 - Math.exp(-dt * 3.5);
    c.target.lerp(g.target, k);
    camera.position.lerp(g.cam, k);
    c.update();
    if (camera.position.distanceTo(g.cam) < 0.05 && c.target.distanceTo(g.target) < 0.05) goal.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={70}
      autoRotate={autoRotate && selected == null && !focus}
      autoRotateSpeed={0.35}
      onStart={() => {
        goal.current = null;
      }}
    />
  );
}
