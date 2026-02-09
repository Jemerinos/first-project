const SIDE_LABELS = ['A', 'B', 'C', 'D']

function lineLength(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export default function SVGCanvas({
  vertices = [],
  fasteners = [],
  triangleRightAngle,
  filmColor = '#cbd5e1',
  kantColor = '#0f172a',
  sideKant = {},
  hooksEnabled = false,
  hooksCount = 0,
}) {
  if (!vertices.length) return <div className="rounded bg-slate-100 p-4 text-sm">Нет геометрии для отрисовки.</div>

  const minX = Math.min(...vertices.map((v) => v.x))
  const maxX = Math.max(...vertices.map((v) => v.x))
  const minY = Math.min(...vertices.map((v) => v.y))
  const maxY = Math.max(...vertices.map((v) => v.y))
  const pad = 80
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`

  const rightAngleIndex = triangleRightAngle === 'A' ? 0 : triangleRightAngle === 'B' ? 1 : triangleRightAngle === 'C' ? 2 : -1
  const hookY = minY + (maxY - minY) * 0.55
  const hookXs = hooksEnabled && hooksCount > 0
    ? Array.from({ length: hooksCount }, (_, i) => minX + ((i + 1) * (maxX - minX)) / (hooksCount + 1))
    : []

  return (
    <svg viewBox={viewBox} className="h-[360px] w-full rounded-lg bg-slate-50">
      <polygon points={vertices.map((v) => `${v.x},${v.y}`).join(' ')} fill={filmColor} fillOpacity="0.35" stroke="none" />

      {vertices.map((v, i) => {
        const next = vertices[(i + 1) % vertices.length]
        const m = midpoint(v, next)
        const sideName = SIDE_LABELS[i] || i + 1
        const kant = Number(sideKant[sideName] || 50)
        return (
          <g key={`side-${i}`}>
            <line x1={v.x} y1={v.y} x2={next.x} y2={next.y} stroke={kantColor} strokeWidth={Math.max(8, kant / 2.2)} strokeLinecap="round" />
            <text x={m.x} y={m.y - 12} textAnchor="middle" className="fill-slate-700 text-[26px]">
              {`${sideName}: ${lineLength(v, next).toFixed(1)} мм / кант ${kant} мм`}
            </text>
          </g>
        )
      })}

      {rightAngleIndex >= 0 && vertices[rightAngleIndex] && (
        <rect x={vertices[rightAngleIndex].x + 16} y={vertices[rightAngleIndex].y + 16} width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="4" />
      )}

      {hookXs.map((x, idx) => (
        <line key={`hook-${idx}`} x1={x} y1={hookY - 30} x2={x} y2={hookY + 30} stroke="#334155" strokeWidth="5" strokeLinecap="round" />
      ))}

      {fasteners.flatMap((side) =>
        side.placements.map((p, idx) => (
          <circle
            key={`${side.side}-${idx}`}
            cx={p.x_mm}
            cy={p.y_mm}
            r="9"
            fill={side.type === 'grommets' ? '#0284c7' : side.type === 'locks' ? '#ea580c' : '#16a34a'}
          />
        )),
      )}
    </svg>
  )
}
