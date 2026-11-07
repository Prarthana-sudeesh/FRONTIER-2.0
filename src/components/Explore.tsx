import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { hasWebGL, svgPath, subsFor, touchesField, worldStyle, type WorldStyle } from "../data";
import type { Dataset, Field, GapView, Sub } from "../types";
import ErrorBoundary from "./ErrorBoundary";
import Parchment from "./Parchment";
import { islandLayout } from "./islands";

const Universe3D = lazy(() => import("./three/Universe3D"));
const Archipelago3D = lazy(() => import("./three/Archipelago3D"));

export interface WorldInfo {
  field: Field;
  style: WorldStyle;
  concepts: number;
  gaps: number;
  subs: number;
}

export interface WorldLink {
  a: string;
  b: string;
  count: number;
}

interface Props {
  data: Dataset;
  gaps: GapView[];
  fieldById: Map<string, Field>;
  field: string | null;
  focusConcept: number | null;
  onField: (field: string | null) => void;
  onOpenGap: (g: GapView) => void;
}

export default function Explore({ data, gaps, fieldById, field, focusConcept, onField, onOpenGap }: Props) {
  const webgl = useMemo(hasWebGL, []);
  const [failed, setFailed] = useState(false);
  const [splash, setSplash] = useState<{ color: string; key: number } | null>(null);
  const use3d = webgl && !failed;
  const world = field ? fieldById.get(field) : undefined;

  const enter = (f: string) => {
    setSplash({ color: worldStyle(f).water[1], key: Date.now() });
  };

  return (
    <div className="explore">
      {world ? (
        <ArchipelagoView
          key={`${world.id}:${focusConcept ?? ""}`}
          data={data}
          gaps={gaps}
          world={world}
          fieldById={fieldById}
          focusConcept={focusConcept}
          use3d={use3d}
          onFail={() => setFailed(true)}
          onBack={() => onField(null)}
          onOpenGap={onOpenGap}
        />
      ) : (
        <UniverseView
          data={data}
          gaps={gaps}
          use3d={use3d}
          onFail={() => setFailed(true)}
          onEnter={(f) => onField(f)}
          onStartEnter={enter}
        />
      )}
      {splash && (
        <div
          key={splash.key}
          className="splash"
          style={{ ["--splash" as string]: splash.color }}
          onAnimationEnd={() => setSplash(null)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="state">
      <div className="spinner" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Space: four planets
// ---------------------------------------------------------------------------

function UniverseView({
  data,
  gaps,
  use3d,
  onFail,
  onEnter,
  onStartEnter,
}: {
  data: Dataset;
  gaps: GapView[];
  use3d: boolean;
  onFail: () => void;
  onEnter: (f: string) => void;
  onStartEnter: (f: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const worlds = useMemo<WorldInfo[]>(
    () =>
      data.fields
        .map((f) => ({
          field: f,
          style: worldStyle(f.id),
          concepts: data.concepts.filter((c) => c.field === f.id).length,
          gaps: gaps.filter((g) => touchesField(g, f.id)).length,
          subs: subsFor(f.id, data, gaps).length,
        }))
        .filter((w) => w.concepts > 0),
    [data, gaps],
  );

  const links = useMemo<WorldLink[]>(() => {
    const m = new Map<string, WorldLink>();
    for (const g of gaps) {
      if (g.ca.field === g.cb.field) continue;
      const [a, b] = [g.ca.field, g.cb.field].sort();
      const k = `${a}|${b}`;
      const l = m.get(k) ?? { a, b, count: 0 };
      l.count += 1;
      m.set(k, l);
    }
    return [...m.values()];
  }, [gaps]);

  const pick = (f: string) => {
    if (entering) return;
    if (!use3d) {
      onStartEnter(f);
      onEnter(f);
      return;
    }
    setEntering(f);
    timers.current.push(
      window.setTimeout(() => onStartEnter(f), 250),
      window.setTimeout(() => onEnter(f), 850),
    );
  };

  const fallback = <UniverseFallback worlds={worlds} onPick={pick} />;

  return (
    <section className="universe" aria-label="Research universe">
      <div className="explore-canvas">
        {use3d ? (
          <ErrorBoundary fallback={fallback} onError={onFail}>
            <Suspense fallback={<Loading text="Lighting up the planets…" />}>
              <Universe3D worlds={worlds} links={links} entering={entering} hover={hover} onHover={setHover} onPick={pick} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          fallback
        )}
      </div>
      <div className="hud hud-top">
        <p className="eyebrow">Research universe</p>
        <h1 className="hero-title">Where will research go next?</h1>
        <p className="hero-sub">
          Each planet is a field of research. Dive into one to sail between its islands of sub-topics and find the gaps
          nobody has studied yet.
        </p>
      </div>
      <nav className="world-dock" aria-label="Choose a world">
        {worlds.map((w) => (
          <button
            key={w.field.id}
            className={`world-chip ${hover === w.field.id ? "on" : ""}`}
            onClick={() => pick(w.field.id)}
            onMouseEnter={() => setHover(w.field.id)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="dot" style={{ background: w.field.color }} />
            {w.field.name}
          </button>
        ))}
      </nav>
    </section>
  );
}

function UniverseFallback({ worlds, onPick }: { worlds: WorldInfo[]; onPick: (f: string) => void }) {
  return (
    <div className="universe-2d">
      {worlds.map((w) => (
        <button key={w.field.id} className={`planet-2d p${w.style.planet}`} onClick={() => onPick(w.field.id)}>
          <span className="planet-2d-ball" style={{ ["--atmo" as string]: w.style.atmosphere }} />
          <span className="planet-name">{w.field.name}</span>
          <span className="planet-meta">
            {w.subs} islands · {w.gaps} gaps
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ocean: islands of sub-topics
// ---------------------------------------------------------------------------

interface Controls {
  step: (d: number) => void;
  openScroll: () => void;
  up: () => void;
  isOpen: boolean;
}

function ArchipelagoView({
  data,
  gaps,
  world,
  fieldById,
  focusConcept,
  use3d,
  onFail,
  onBack,
  onOpenGap,
}: {
  data: Dataset;
  gaps: GapView[];
  world: Field;
  fieldById: Map<string, Field>;
  focusConcept: number | null;
  use3d: boolean;
  onFail: () => void;
  onBack: () => void;
  onOpenGap: (g: GapView) => void;
}) {
  const subs = useMemo(() => subsFor(world.id, data, gaps), [world.id, data, gaps]);
  const style = worldStyle(world.id);
  const startIndex = focusConcept == null ? 0 : Math.max(0, subs.findIndex((s) => s.concepts.some((c) => c.id === focusConcept)));
  const [index, setIndex] = useState(startIndex);
  const [open, setOpen] = useState(focusConcept != null && subs.length > 0);
  const [highlight, setHighlight] = useState<number | null>(focusConcept);
  const root = useRef<HTMLElement>(null);
  const sub = subs[index];

  const bridges = useMemo(() => gaps.filter((g) => g.ca.field === world.id && g.cb.field === world.id), [gaps, world.id]);

  const step = (d: number) => {
    setIndex((i) => Math.min(subs.length - 1, Math.max(0, i + d)));
    setOpen(false);
    setHighlight(null);
  };
  const goTo = (i: number) => {
    if (i === index) setOpen(true);
    else {
      setIndex(i);
      setOpen(false);
      setHighlight(null);
    }
  };

  const ctl = useRef<Controls>({ step, openScroll: () => {}, up: () => {}, isOpen: false });
  ctl.current = {
    step,
    openScroll: () => subs.length && setOpen(true),
    up: () => (open ? setOpen(false) : onBack()),
    isOpen: open,
  };

  // Wheel: sideways = sail between islands, down = unroll the scroll, up = roll it away / back to space.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let accX = 0;
    let accY = 0;
    let last = 0;
    let quietUntil = 0;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(".island-nav")) return;
      const paper = el.querySelector<HTMLElement>(".parchment-paper");
      const now = performance.now();
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;

      if (paper && ctl.current.isOpen && !horizontal) {
        if (paper.scrollTop <= 0 && e.deltaY < 0) {
          e.preventDefault();
          accY += e.deltaY;
          if (accY < -70) {
            accY = 0;
            quietUntil = now + 800;
            ctl.current.up();
          }
        } else {
          accY = 0;
          if (!target?.closest?.(".parchment-paper")) {
            e.preventDefault();
            paper.scrollTop += e.deltaY;
          }
        }
        return;
      }

      e.preventDefault();
      if (now < quietUntil) return;
      if (horizontal) {
        accX += horizontal;
        accY = 0;
        if (Math.abs(accX) > 50 && now - last > 450) {
          ctl.current.step(accX > 0 ? 1 : -1);
          last = now;
          accX = 0;
        }
        return;
      }
      accY += e.deltaY;
      accX = 0;
      if (accY > 40 && now - last > 450) {
        accY = 0;
        last = now;
        ctl.current.openScroll();
      } else if (accY < -240 && now - last > 450) {
        accY = 0;
        last = now;
        ctl.current.up();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Swipes on touch screens (and mouse drags).
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(".parchment, button, a, .island-nav")) return;
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (dy < -60) ctl.current.openScroll();
    else if (dy > 80) ctl.current.up();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector(".modal")) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const paper = root.current?.querySelector<HTMLElement>(".parchment-paper");
      if (e.key === "ArrowRight") ctl.current.step(1);
      else if (e.key === "ArrowLeft") ctl.current.step(-1);
      else if (e.key === "ArrowDown" && !ctl.current.isOpen) ctl.current.openScroll();
      else if (e.key === "ArrowUp" && ctl.current.isOpen && (!paper || paper.scrollTop <= 0)) ctl.current.up();
      else if (e.key === "Escape") ctl.current.up();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!subs.length || !sub) {
    return (
      <section className="archipelago" ref={root}>
        <div className="state">
          <h2>No islands here yet</h2>
          <p className="muted">This world has no concepts in the current data.</p>
          <button className="btn" onClick={onBack}>
            Back to space
          </button>
        </div>
      </section>
    );
  }

  const fallback = <ArchipelagoFallback subs={subs} index={index} style={style} color={world.color} onIsland={goTo} />;

  return (
    <section
      className={`archipelago ${open ? "is-open" : ""}`}
      ref={root}
      aria-label={`${world.name} islands`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="explore-canvas">
        {use3d ? (
          <ErrorBoundary fallback={fallback} onError={onFail}>
            <Suspense fallback={<Loading text="Raising the islands…" />}>
              <Archipelago3D
                subs={subs}
                index={index}
                open={open}
                style={style}
                color={world.color}
                highlight={highlight}
                bridges={bridges}
                onIsland={goTo}
                onBeacon={(id, i) => {
                  setIndex(i);
                  setHighlight(id);
                  setOpen(true);
                }}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          fallback
        )}
      </div>

      <div className="hud hud-top">
        <button className="btn ghost back-btn" onClick={onBack}>
          ← Back to space
        </button>
        <p className="eyebrow" style={{ color: world.color }}>
          {world.name} · {style.tagline}
        </p>
        <h1 className="island-title">{sub.name}</h1>
        <p className="muted small">
          Island {index + 1} of {subs.length} · {sub.concepts.length} concepts · {sub.gaps.length} research gaps
        </p>
      </div>

      <button className="sail prev" onClick={() => step(-1)} disabled={index === 0} aria-label="Previous island">
        ‹
      </button>
      <button className="sail next" onClick={() => step(1)} disabled={index === subs.length - 1} aria-label="Next island">
        ›
      </button>

      <div className="hud hud-bottom">
        {!open && (
          <button className="unroll-cta" onClick={() => setOpen(true)}>
            <span className="scroll-icon" aria-hidden="true" />
            <span className="cta-desk">Scroll down to unroll this island&apos;s scroll</span>
            <span className="cta-touch">Tap or swipe up to unroll this island&apos;s scroll</span>
          </button>
        )}
        <nav className="island-nav" aria-label="Islands">
          {subs.map((s, i) => (
            <button key={s.id} className={`island-chip ${i === index ? "active" : ""}`} onClick={() => goTo(i)} aria-current={i === index}>
              {s.name}
              <span className="seg-count">{s.gaps.length}</span>
            </button>
          ))}
        </nav>
        <p className="gesture-hint muted small">Scroll sideways or use ← → to sail · scroll down to read · scroll up to rise</p>
      </div>

      {open && (
        <Parchment
          key={sub.id}
          sub={sub}
          world={world}
          fieldById={fieldById}
          highlight={highlight}
          onOpenGap={onOpenGap}
          onClose={() => setOpen(false)}
          onConcept={setHighlight}
        />
      )}
    </section>
  );
}

function ArchipelagoFallback({
  subs,
  index,
  style,
  color,
  onIsland,
}: {
  subs: Sub[];
  index: number;
  style: WorldStyle;
  color: string;
  onIsland: (i: number) => void;
}) {
  return (
    <div className="sea-2d" style={{ ["--deep" as string]: style.water[0], ["--shallow" as string]: style.water[1] }}>
      <div className="sea-track" style={{ transform: `translateX(${-index * 100}%)` }}>
        {subs.map((s, i) => {
          const lay = islandLayout(s);
          return (
            <div className="sea-slide" key={s.id}>
              <button className="island-2d" onClick={() => onIsland(i)} aria-label={`${s.name} island`}>
                <svg viewBox="-7 -7 14 14">
                  <path d={svgPath(lay.foam)} fill="rgba(255,255,255,0.25)" />
                  <path d={svgPath(lay.shape)} fill={style.sand} />
                  <path d={svgPath(lay.top)} fill={style.top} />
                  {lay.beacons.map((b) => (
                    <circle key={b.concept.id} cx={b.p[0]} cy={b.p[1]} r={0.22} fill={color} className="beacon-2d" />
                  ))}
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      <div className="waves-2d" aria-hidden="true" />
    </div>
  );
}
