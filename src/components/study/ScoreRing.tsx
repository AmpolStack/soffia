export function ScoreRing({
  value,
  label,
  detail,
  size = 168,
}: {
  value: number;
  label: string;
  detail?: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="score-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${clamped}%${detail ? `, ${detail}` : ''}`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="score-ring__track" cx="60" cy="60" r="52" pathLength={100} />
        <circle
          className="score-ring__value"
          cx="60"
          cy="60"
          r="52"
          pathLength={100}
          strokeDasharray={`${clamped} 100`}
        />
      </svg>
      <div className="score-ring__label">
        <strong>{clamped}%</strong>
        <span>{label}</span>
        {detail ? <small>{detail}</small> : null}
      </div>
    </div>
  );
}
