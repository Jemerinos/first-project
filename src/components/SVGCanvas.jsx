const SIDE_LABELS = ['A', 'B', 'C', 'D']

function lineLength(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function pointInPolygon(point, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    const intersects = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi)
    if (intersects) inside = !inside
  }
  return inside
}

function inwardNormal(a, b, polygon) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const m = midpoint(a, b)
  const plus = { x: m.x + nx * 10, y: m.y + ny * 10 }
  return pointInPolygon(plus, polygon) ? { x: nx, y: ny } : { x: -nx, y: -ny }
}



function normalize(v) {
  const len = Math.hypot(v.x, v.y) || 1
  return { x: v.x / len, y: v.y / len }
}

function cornerCenterPoint(vertices, index, sideKant) {
  const n = vertices.length
  const prevIndex = (index - 1 + n) % n
  const nextIndex = (index + 1) % n
  const prev = vertices[prevIndex]
  const cur = vertices[index]
  const next = vertices[nextIndex]

  const nPrev = inwardNormal(prev, cur, vertices)
  const nNext = inwardNormal(cur, next, vertices)
  const bis = normalize({ x: nPrev.x + nNext.x, y: nPrev.y + nNext.y })

  const sideNamePrev = SIDE_LABELS[prevIndex] || prevIndex
  const sideNameCur = SIDE_LABELS[index] || index
  const kPrev = Number(sideKant[sideNamePrev] || 50)
  const kCur = Number(sideKant[sideNameCur] || 50)
  const offset = (kPrev + kCur) / 4

  return {
    x: cur.x + bis.x * offset,
    y: cur.y + bis.y * offset,
  }
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
  const hookMidY = minY + (maxY - minY) * 0.5

  const width = maxX - minX
  const edgeOffset = Math.min(200, Math.max(20, width / 2 - 1))
  const hookStartX = minX + edgeOffset
  const hookEndX = maxX - edgeOffset
  const hookXs = hooksEnabled && hooksCount > 0
    ? Array.from({ length: hooksCount }, (_, i) => hookStartX + (i * (hookEndX - hookStartX)) / Math.max(1, hooksCount - 1))
    : []

  return (
    <svg viewBox={viewBox} className="h-[360px] w-full rounded-lg bg-slate-50">
      <defs>
        <clipPath id="shapeClip">
          <polygon points={vertices.map((v) => `${v.x},${v.y}`).join(' ')} />
        </clipPath>
      </defs>

      <polygon points={vertices.map((v) => `${v.x},${v.y}`).join(' ')} fill={filmColor} fillOpacity="0.35" stroke="none" />

      <g clipPath="url(#shapeClip)">
      {vertices.map((v, i) => {
        const next = vertices[(i + 1) % vertices.length]
        const m = midpoint(v, next)
        const sideName = SIDE_LABELS[i] || i + 1
        const kant = Number(sideKant[sideName] || 50)
        return (
          <g key={`side-${i}`}>
            <line x1={v.x} y1={v.y} x2={next.x} y2={next.y} stroke={kantColor} strokeWidth={Math.max(8, kant * 2)} strokeLinecap="butt" strokeLinejoin="miter" />
            <text x={m.x} y={m.y - 12} textAnchor="middle" className="fill-slate-700 text-[26px]">
              {`${sideName}: ${lineLength(v, next).toFixed(1)} мм / кант ${kant} мм`}
            </text>
          </g>
        )
      })}
      </g>

      {rightAngleIndex >= 0 && vertices[rightAngleIndex] && (
        <rect x={vertices[rightAngleIndex].x + 16} y={vertices[rightAngleIndex].y + 16} width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="4" />
      )}

      {hookXs.map((x, idx) => (
        <line key={`hook-${idx}`} x1={x} y1={minY} x2={x} y2={hookMidY} stroke="#334155" strokeWidth="5" strokeLinecap="butt" />
      ))}

      {(() => {
        const rendered = []
        const unique = new Set()

        fasteners.forEach((side) => {
          const sideIndex = SIDE_LABELS.indexOf(side.side)
          if (sideIndex < 0 || sideIndex >= vertices.length) return

          const a = vertices[sideIndex]
          const b = vertices[(sideIndex + 1) % vertices.length]
          const kant = Number(sideKant[side.side] || 50)
          const n = inwardNormal(a, b, vertices)
          const offset = kant / 2

          const startCorner = cornerCenterPoint(vertices, sideIndex, sideKant)
          const endCorner = cornerCenterPoint(vertices, (sideIndex + 1) % vertices.length, sideKant)

          side.placements.forEach((p, idx) => {
            let x = p.x_mm + n.x * offset
            let y = p.y_mm + n.y * offset

            if (idx === 0) {
              x = startCorner.x
              y = startCorner.y
            } else if (idx === side.placements.length - 1) {
              x = endCorner.x
              y = endCorner.y
            }

            const key = `${Math.round(x)}:${Math.round(y)}`
            if (unique.has(key)) return
            unique.add(key)

            rendered.push(
              <circle
                key={`${side.side}-${idx}`}
                cx={x}
                cy={y}
                r="9"
                fill={side.type === 'grommets' ? '#0284c7' : side.type === 'locks' ? '#ea580c' : '#16a34a'}
              />,
            )
          })
        })

        return rendered
      })()}
    </svg>
  )
}
