const SIDE_LABELS = ['A', 'B', 'C', 'D']

function lineLength(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function sideAngleDegrees(vertices, sideName) {
  const sideIndex = SIDE_LABELS.indexOf(sideName)
  if (sideIndex < 0 || sideIndex >= vertices.length) return 0
  const start = vertices[sideIndex]
  const end = vertices[(sideIndex + 1) % vertices.length]
  return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
}

function renderFastenerShape(vertices, side, placement, idx) {
  const x = placement.x_mm
  const y = placement.y_mm
  const commonProps = {
    'data-side': side.side,
    'data-index': idx,
    'data-dist': placement.distFromStart_mm,
  }

  if (side.type === 'grommets') {
    return (
      <g>
        <circle cx={x} cy={y} r="10" fill="#4b5563" stroke="#000000" strokeWidth="2.4" {...commonProps} />
        <circle cx={x} cy={y} r="5" fill="#ffffff" stroke="#000000" strokeWidth="2.2" />
      </g>
    )
  }

  if (side.type === 'locks') {
    const angle = sideAngleDegrees(vertices, side.side)
    return (
      <g transform={`translate(${x} ${y}) rotate(${angle})`} {...commonProps}>
        <rect x={-21} y={-11} width="42" height="22" rx="11" ry="11" fill="none" stroke="#000000" strokeWidth="2.5" />
      </g>
    )
  }

  if (side.type === 'straps') {
    const angle = sideAngleDegrees(vertices, side.side)
    return (
      <g transform={`translate(${x} ${y}) rotate(${angle})`} {...commonProps}>
        <rect x={-35} y={-17.5} width="70" height="35" rx="17.5" ry="17.5" fill="none" stroke="#0f172a" strokeWidth="2" strokeDasharray="6 4" />
      </g>
    )
  }

  return <circle cx={x} cy={y} r="9" fill="#334155" {...commonProps} />
}

export default function SVGCanvas({
  vertices = [],
  edgePaths = {},
  fasteners = [],
  triangleRightAngle,
  filmColor = '#cbd5e1',
  kantColor = '#0f172a',
  sideKant = {},
  hooksEnabled = false,
  hooksCount = 0,
  seamOrientation,
  rollLimitMm = 2600,
  canvasClassName = 'h-[360px] w-full rounded-lg bg-slate-50',
  debug = false,
}) {
  if (!vertices.length) return <div className="rounded bg-slate-100 p-4 text-sm">Нет геометрии для отрисовки.</div>

  const fastenerPoints = fasteners.flatMap((s) => s.placements || [])
  const minX = Math.min(...vertices.map((v) => v.x), ...fastenerPoints.map((p) => p.x_mm || 0))
  const maxX = Math.max(...vertices.map((v) => v.x), ...fastenerPoints.map((p) => p.x_mm || 0))
  const minY = Math.min(...vertices.map((v) => v.y), ...fastenerPoints.map((p) => p.y_mm || 0))
  const maxY = Math.max(...vertices.map((v) => v.y), ...fastenerPoints.map((p) => p.y_mm || 0))
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

  const renderedKeys = new Set()
  const typePriority = { locks: 3, straps: 2, grommets: 1 }

  const uniquePlacements = []
  fasteners.forEach((side) => {
    ;(side.placements || []).forEach((placement, idx) => {
      const key = `${Math.round(placement.x_mm)}:${Math.round(placement.y_mm)}`
      const existingIndex = uniquePlacements.findIndex((it) => it.key === key)
      const candidate = { key, side, placement, idx }
      if (existingIndex < 0) {
        uniquePlacements.push(candidate)
        return
      }
      const existing = uniquePlacements[existingIndex]
      const existingPriority = typePriority[existing.side.type] || 0
      const candidatePriority = typePriority[side.type] || 0
      if (candidatePriority > existingPriority) {
        uniquePlacements[existingIndex] = candidate
      }
    })
  })

  const seamPosition = seamOrientation === 'vertical' ? minX + rollLimitMm : seamOrientation === 'horizontal' ? minY + rollLimitMm : null
  const seamVisible = seamOrientation === 'vertical' ? seamPosition !== null && seamPosition <= maxX : seamOrientation === 'horizontal' ? seamPosition !== null && seamPosition <= maxY : false

  return (
    <svg viewBox={viewBox} className={canvasClassName}>
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
              {edgePaths[sideName]
                ? <path d={edgePaths[sideName]} stroke={kantColor} fill="none" strokeWidth={Math.max(8, kant * 2)} strokeLinecap="butt" strokeLinejoin="miter" />
                : <line x1={v.x} y1={v.y} x2={next.x} y2={next.y} stroke={kantColor} strokeWidth={Math.max(8, kant * 2)} strokeLinecap="butt" strokeLinejoin="miter" />}
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


      {seamVisible && (
        <g>
          {seamOrientation === 'vertical' ? (
            <line
              x1={seamPosition}
              y1={minY}
              x2={seamPosition}
              y2={maxY}
              stroke="#dc2626"
              strokeWidth="6"
              strokeDasharray="18 10"
              strokeLinecap="round"
            />
          ) : (
            <line
              x1={minX}
              y1={seamPosition}
              x2={maxX}
              y2={seamPosition}
              stroke="#dc2626"
              strokeWidth="6"
              strokeDasharray="18 10"
              strokeLinecap="round"
            />
          )}
          <text
            x={seamOrientation === 'vertical' ? seamPosition + 18 : (minX + maxX) / 2}
            y={seamOrientation === 'vertical' ? minY + 24 : seamPosition - 16}
            textAnchor={seamOrientation === 'vertical' ? 'start' : 'middle'}
            className="fill-red-700 text-[18px]"
          >
            Граница рулона 2600 мм / шов
          </text>
        </g>
      )}

      {hookXs.map((x, idx) => (
        <line key={`hook-${idx}`} x1={x} y1={minY} x2={x} y2={hookMidY} stroke="#334155" strokeWidth="5" strokeLinecap="butt" />
      ))}

      {uniquePlacements.map(({ side, placement: p, idx }) => {
        const key = `${Math.round(p.x_mm)}:${Math.round(p.y_mm)}`
        if (renderedKeys.has(key)) return null
        renderedKeys.add(key)
        return (
          <g key={`${side.side}-${idx}`}>
            {renderFastenerShape(vertices, side, p, idx)}
            {debug && (
              <g>
                <text x={p.x_mm + 8} y={p.y_mm - 8} className="fill-slate-700 text-[12px]">{`${side.side}-${idx + 1}`}</text>
                <text x={p.x_mm + 8} y={p.y_mm + 8} className="fill-slate-600 text-[10px]">{`${p.distFromStart_mm}мм`}</text>
              </g>
            )}
            <title>{`Сторона ${side.side}; dist=${p.distFromStart_mm} мм; ${p.isCorner ? 'угловой' : 'внутренний'}`}</title>
          </g>
        )
      })}

      {debug && vertices.map((v, i) => (
        <g key={`dbg-v-${i}`}>
          <circle cx={v.x} cy={v.y} r="6" fill="#1d4ed8" />
          <text x={v.x + 8} y={v.y - 8} className="fill-blue-800 text-[12px]">{`V${i}`}</text>
        </g>
      ))}
    </svg>
  )
}
