type Props = {
  score: number
  size?: number
  strokeWidth?: number
}

export function ScoreRing({ score, size = 140, strokeWidth = 9 }: Props) {
  const clamp = Math.max(0, Math.min(100, score))
  const r = (size - strokeWidth * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (clamp / 100) * circumference

  const color =
    clamp >= 80 ? "#22c55e" :
    clamp >= 55 ? "#6C47FF" :
    clamp >= 30 ? "#f59e0b" :
    "#ef4444"

  const label =
    clamp >= 80 ? "Very Likely" :
    clamp >= 55 ? "Likely" :
    clamp >= 30 ? "Possible" :
    "Unlikely"

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Score number */}
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={size * 0.26}
          fontWeight="800"
          fontFamily="inherit"
        >
          {clamp}
        </text>
      </svg>
      <span
        className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
        style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}33` }}
      >
        {label}
      </span>
    </div>
  )
}
