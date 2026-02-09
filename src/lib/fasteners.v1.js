const STEP_TARGET = {
  grommets: 225,
  locks: 425,
  straps: 425,
}

export function computeFastenersOnSegment(start, end, type, edgeOffsetMm = 25) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)

  if (!STEP_TARGET[type] || length <= 0) {
    return { type, count: 0, step_mm: 0, placements: [] }
  }

  const offset = Math.max(0, Number(edgeOffsetMm || 0))
  const usable = Math.max(0, length - offset * 2)

  if (type === 'grommets') {
    const intervals = Math.max(1, Math.round(usable / STEP_TARGET[type]))
    const step = usable / intervals
    const placements = Array.from({ length: intervals + 1 }, (_, i) => {
      const d = offset + i * step
      const t = d / length
      return {
        x_mm: start.x + dx * t,
        y_mm: start.y + dy * t,
        distFromStart_mm: d,
      }
    })
    return { type, count: placements.length, step_mm: step, placements }
  }

  const innerCount = Math.max(0, Math.floor(usable / STEP_TARGET[type]))
  const step = innerCount > 0 ? usable / (innerCount + 1) : STEP_TARGET[type]
  const distances = [offset]
  for (let i = 1; i <= innerCount; i += 1) distances.push(offset + step * i)
  distances.push(length - offset)

  const placements = distances.map((d) => {
    const t = d / length
    return {
      x_mm: start.x + dx * t,
      y_mm: start.y + dy * t,
      distFromStart_mm: d,
    }
  })

  return { type, count: placements.length, step_mm: step, placements }
}
