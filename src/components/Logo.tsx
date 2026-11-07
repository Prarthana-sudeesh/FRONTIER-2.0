/** FRONTIER mark: an "F" whose top bar rises into a peak, the frontier ahead. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id="fr-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f5cf0" />
          <stop offset="1" stopColor="#3d1670" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#fr-g)" />
      <path d="M20 50V15h20l7-7" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 31h17" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <circle cx="48" cy="44" r="4" fill="#d9c4ff" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wordmark-name">FRONTIER</span>
      <span className="wordmark-tag">Research gap forecasts</span>
    </span>
  );
}
