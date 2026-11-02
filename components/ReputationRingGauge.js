/**
 * Gauge circular de reputação (anel com faixa útil ~270° e gap em baixo).
 * Track + stroke progressivo via stroke-dashoffset (pathLength=100).
 */
export default function ReputationRingGauge({
  percent = 0,
  size = 120,
  strokeWidth = 8,
  className = "",
  trackClassName = "rep-ring-track",
  progressClassName = "rep-ring-progress",
  /** Fração do círculo usada pelo arco (resto = gap em baixo). */
  arcRatio = 0.78,
}) {
  const pct = Math.min(100, Math.max(0, Number(percent) || 0));
  const r = 42;
  const cx = 50;
  const cy = 50;
  const arcLen = Math.max(1, Math.min(100, Number(arcRatio) * 100 || 78));
  const dashOffset = arcLen * (1 - pct / 100);
  // Gap centrado em baixo: início após metade do gap a partir do fundo
  const gapDeg = ((100 - arcLen) / 100) * 360;
  const startDeg = 90 + gapDeg / 2;

  return (
    <svg
      className={`rep-ring ${className}`.trim()}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
    >
      <g transform={`rotate(${startDeg} ${cx} ${cy})`}>
        <circle
          className={trackClassName}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${arcLen} ${100 - arcLen}`}
        />
        <circle
          className={progressClassName}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={arcLen}
          strokeDashoffset={dashOffset}
        />
      </g>
    </svg>
  );
}
