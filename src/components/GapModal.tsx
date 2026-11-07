import { useEffect, useRef, useState } from "react";
import { arxivSearchUrl, pubmedUrl, scholarUrl } from "../data";
import type { Field, GapView, Meta } from "../types";

interface Props {
  gap: GapView;
  fieldById: Map<string, Field>;
  meta: Meta;
  onClose: () => void;
  onShow: (g: GapView) => void;
}

export default function GapModal({ gap, fieldById, meta, onClose, onShow }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const f = (id: string) => fieldById.get(id);
  const medical = gap.ca.field === "medicine" || gap.cb.field === "medicine";

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  const copy = async () => {
    const text = `${gap.ca.name} × ${gap.cb.name} (FRONTIER score ${gap.score.toFixed(3)})\n${gap.brief}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="modal-wrap" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gap-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} className="icon-btn modal-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
        <p className="eyebrow">Forecast #{gap.rank} · likely {meta.horizon}</p>
        <h2 id="gap-title" className="pair-title">
          <span style={{ color: f(gap.ca.field)?.color }}>{gap.ca.name}</span>
          <span className="x" aria-label="and">×</span>
          <span style={{ color: f(gap.cb.field)?.color }}>{gap.cb.name}</span>
        </h2>
        <div className="chips">
          <span className="chip">{f(gap.ca.field)?.name ?? gap.ca.field}</span>
          {gap.ca.field !== gap.cb.field && <span className="chip">{f(gap.cb.field)?.name ?? gap.cb.field}</span>}
          {gap.ca.field !== gap.cb.field && <span className="chip accent">cross-field</span>}
        </div>

        <div className="stat-row">
          <Stat label="Score" value={gap.score.toFixed(3)} hint="Model probability of a first joint paper" />
          <Stat label="Shared neighbours" value={String(gap.cn)} hint="Concepts already linked to both" />
          <Stat label="Adamic–Adar" value={gap.adamic_adar.toFixed(2)} hint="Shared neighbours, rare ones weighted more" />
          <Stat label="Recent growth" value={`+${gap.growth}`} hint="New links around both concepts in the last window" />
        </div>

        <h3>Why the model expects them to meet</h3>
        <p>{gap.brief}</p>
        {gap.bridgeConcepts.length > 0 && (
          <>
            <h3>Bridge concepts</h3>
            <div className="chips">
              {gap.bridgeConcepts.map((c) => (
                <span key={c.id} className="chip">
                  <span className="dot" style={{ background: f(c.field)?.color }} />
                  {c.name}
                </span>
              ))}
            </div>
          </>
        )}

        <h3>Check it is still open</h3>
        <p className="muted small">
          Forecasts can be wrong or already done. Search for papers mentioning both concepts before starting work.
        </p>
        <div className="btn-row">
          <a className="btn" href={arxivSearchUrl(gap.ca.name, gap.cb.name)} target="_blank" rel="noopener noreferrer">
            Search arXiv
          </a>
          <a className="btn" href={scholarUrl(gap.ca.name, gap.cb.name)} target="_blank" rel="noopener noreferrer">
            Google Scholar
          </a>
          {medical && (
            <a className="btn" href={pubmedUrl(gap.ca.name, gap.cb.name)} target="_blank" rel="noopener noreferrer">
              PubMed
            </a>
          )}
          <button className="btn" onClick={copy}>
            {copied ? "Copied" : "Copy summary"}
          </button>
          <button className="btn primary" onClick={() => onShow(gap)}>
            Show in galaxy
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="stat" title={hint}>
      <span className="stat-value mono">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
