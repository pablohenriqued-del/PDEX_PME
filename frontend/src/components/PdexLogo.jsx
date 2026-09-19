/**
 * PDEX brand assets — mark, wordmark, and combined lockup.
 * Colors: cyan → blue → violet gradient inspired by the reference brand board.
 */

const GRAD_STOPS = (
  <>
    <stop offset="0%" stopColor="#22D3EE" />
    <stop offset="45%" stopColor="#3B82F6" />
    <stop offset="100%" stopColor="#8B5CF6" />
  </>
);

export function PdexMark({ size = 40, className = "", rounded = true, glow = true, animated = true }) {
  const id = `pdex-mark-${size}`;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`${animated ? "pdex-mark-anim" : ""} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      data-testid="pdex-mark"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          {GRAD_STOPS}
        </linearGradient>
        {glow && (
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      {rounded && (
        <rect
          x="0"
          y="0"
          width="64"
          height="64"
          rx="14"
          fill="#0A1029"
          stroke="rgba(59,130,246,0.35)"
          strokeWidth="1"
        />
      )}
      {/* X mark — two thick beveled bars crossing */}
      <g
        transform="translate(32 32)"
        fill={`url(#${id}-g)`}
        filter={glow ? `url(#${id}-glow)` : undefined}
      >
        <rect x="-22" y="-5" width="44" height="10" rx="2.5" transform="rotate(45)" />
        <rect x="-22" y="-5" width="44" height="10" rx="2.5" transform="rotate(-45)" />
      </g>
    </svg>
  );
}

export function PdexWordmark({ height = 32, className = "" }) {
  const id = `pdex-wm-${height}`;
  // viewBox tuned so the wordmark scales cleanly at any height
  return (
    <svg
      viewBox="0 0 200 48"
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      data-testid="pdex-wordmark"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="0%">
          {GRAD_STOPS}
        </linearGradient>
      </defs>
      <text
        x="0"
        y="38"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontWeight="800"
        fontSize="44"
        letterSpacing="-1.5"
        fill={`url(#${id}-g)`}
      >
        PDEX
      </text>
    </svg>
  );
}

export default function PdexLogo({
  size = 40,
  className = "",
  showTagline = true,
  tagline = "PME · ERP · SEM LIMITES",
  taglineClassName = "",
  wordmarkClassName = "",
  compact = false,
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`} data-testid="pdex-logo">
      <PdexMark size={size} />
      <div className="leading-none min-w-0">
        <PdexWordmark
          height={compact ? 20 : 24}
          className={wordmarkClassName}
        />
        {showTagline && (
          <div
            className={`mt-1.5 text-[8px] font-mono tracking-[0.18em] text-slate-400 whitespace-nowrap ${taglineClassName}`}
          >
            {tagline}
          </div>
        )}
      </div>
    </div>
  );
}
