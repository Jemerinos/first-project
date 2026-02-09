const sideLabel = ['A', 'B', 'C', 'D']

function lineLength(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export default function SVGCanvas({ vertices = [], fasteners = [] }) {
  if (!vertices.length) return <div className="rounded bg-slate-100 p-4 text-sm">Нет геометрии для отрисовки.</div>

  const minX = Math.min(...vertices.map((v) => v.x))
  const maxX = Math.max(...vertices.map((v) => v.x))
  const minY = Math.min(...vertices.map((v) => v.y))
  const maxY = Math.max(...vertices.map((v) => v.y))
  const pad = 80
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`

  return (
    <svg viewBox={viewBox} className="h-[360px] w-full rounded-lg bg-slate-50">
      <polygon points={vertices.map((v) => `${v.x},${v.y}`).join(' ')} fill="#cbd5e1" fillOpacity="0.35" stroke="#0f172a" strokeWidth="6" />

      {vertices.map((v, i) => {
        const next = vertices[(i + 1) % vertices.length]
        const mx = (v.x + next.x) / 2
        const my = (v.y + next.y) / 2
        return (
          <text key={`side-${i}`} x={mx} y={my - 12} textAnchor="middle" className="fill-slate-700 text-[26px]">
            {`${sideLabel[i] || i + 1}: ${lineLength(v, next).toFixed(1)} мм`}
          </text>
        )
      })}

      {fasteners.flatMap((side) =>
        side.placements.map((p, idx) => (
          <circle key={`${side.side}-${idx}`} cx={p.x_mm} cy={p.y_mm} r="9" fill={side.type === 'grommets' ? '#0284c7' : side.type === 'locks' ? '#ea580c' : '#16a34a'} />
        )),
      )}
    </svg>
  )
}
