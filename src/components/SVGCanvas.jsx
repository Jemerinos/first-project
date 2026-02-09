const SIDE_LABELS = ['A', 'B', 'C', 'D']

function lineLength(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export default function SVGCanvas({ vertices = [], fasteners = [], triangleRightAngle }) {
  if (!vertices.length) return <div className="rounded bg-slate-100 p-4 text-sm">Нет геометрии для отрисовки.</div>

  const minX = Math.min(...vertices.map((v) => v.x))
  const maxX = Math.max(...vertices.map((v) => v.x))
  const minY = Math.min(...vertices.map((v) => v.y))
  const maxY = Math.max(...vertices.map((v) => v.y))
  const pad = 80
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`

  const rightAngleIndex = triangleRightAngle === 'A' ? 0 : triangleRightAngle === 'B' ? 1 : triangleRightAngle === 'C' ? 2 : -1

  return (
    <svg viewBox={viewBox} className="h-[360px] w-full rounded-lg bg-slate-50">
      <polygon points={vertices.map((v) => `${v.x},${v.y}`).join(' ')} fill="#cbd5e1" fillOpacity="0.35" stroke="#0f172a" strokeWidth="6" />

      {vertices.map((v, i) => {
        const next = vertices[(i + 1) % vertices.length]
        const m = midpoint(v, next)
        return (
          <text key={`side-${i}`} x={m.x} y={m.y - 12} textAnchor="middle" className="fill-slate-700 text-[26px]">
            {`${SIDE_LABELS[i] || i + 1}: ${lineLength(v, next).toFixed(1)} мм`}
          </text>
        )
      })}

      {rightAngleIndex >= 0 && vertices[rightAngleIndex] && (
        <rect x={vertices[rightAngleIndex].x + 16} y={vertices[rightAngleIndex].y + 16} width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="4" />
      )}

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
