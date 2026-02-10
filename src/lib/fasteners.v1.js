const FASTENER_RULES = {
  grommets: { step_min: 200, step_max: 250 },
  locks: { step_min: 400, step_max: 450 },
  straps: { step_min: 400, step_max: 450 },
}

const EPS = 1e-9

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y)
  if (len < EPS) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y
}

function polygonCentroid(vertices = []) {
  if (!vertices.length) return { x: 0, y: 0 }
  const sum = vertices.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }), { x: 0, y: 0 })
  return { x: sum.x / vertices.length, y: sum.y / vertices.length }
}

export function inwardNormal(v1, v2, centroid) {
  const dir = { x: v2.x - v1.x, y: v2.y - v1.y }
  const norm = normalize({ x: -dir.y, y: dir.x })
  const mid = { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 }
  const toCenter = { x: centroid.x - mid.x, y: centroid.y - mid.y }
  return dot(norm, toCenter) >= 0 ? norm : { x: -norm.x, y: -norm.y }
}

function lineIntersection(p1, d1, p2, d2) {
  const det = d1.x * d2.y - d1.y * d2.x
  if (Math.abs(det) < EPS) return null
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const t = (dx * d2.y - dy * d2.x) / det
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t }
}

function toMm(value) {
  return Math.round(value)
}

export function computeCornerPlacement(V, Vprev, Vnext, cornerOffsetMm, cantaWidthMm, centroid) {
  const C = Math.max(0, Number(cornerOffsetMm || 0))
  const r = Math.max(0, Number(cantaWidthMm || 0)) / 2

  const d1 = normalize({ x: Vprev.x - V.x, y: Vprev.y - V.y })
  const d2 = normalize({ x: Vnext.x - V.x, y: Vnext.y - V.y })

  if ((Math.abs(d1.x) < EPS && Math.abs(d1.y) < EPS) || (Math.abs(d2.x) < EPS && Math.abs(d2.y) < EPS)) {
    return { x_mm: toMm(V.x), y_mm: toMm(V.y), fallback_corner_placement: true }
  }

  const n1 = inwardNormal(V, Vprev, centroid)
  const n2 = inwardNormal(V, Vnext, centroid)

  const p1 = { x: V.x + d1.x * C + n1.x * r, y: V.y + d1.y * C + n1.y * r }
  const p2 = { x: V.x + d2.x * C + n2.x * r, y: V.y + d2.y * C + n2.y * r }

  const exact = lineIntersection(p1, d1, p2, d2)
  if (exact) {
    const proj1 = dot({ x: exact.x - V.x, y: exact.y - V.y }, d1)
    const proj2 = dot({ x: exact.x - V.x, y: exact.y - V.y }, d2)
    if (proj1 >= C - 1 && proj2 >= C - 1) {
      return {
        x_mm: toMm(exact.x),
        y_mm: toMm(exact.y),
      }
    }
  }

  // fallback_corner_placement: average of both offset points + inward radial shift
  const mid = { x: (V.x + d1.x * C + V.x + d2.x * C) / 2, y: (V.y + d1.y * C + V.y + d2.y * C) / 2 }
  const inward = normalize({ x: centroid.x - mid.x, y: centroid.y - mid.y })
  return {
    x_mm: toMm(mid.x + inward.x * r),
    y_mm: toMm(mid.y + inward.y * r),
    fallback_corner_placement: true,
  }
}

function calculateStepAndIntervals(usable, stepMin, stepMax) {
  if (usable <= 0) return { intervals: 1, step: 0, forced_step: false }

  let intervals = Math.floor(usable / stepMax)
  if (intervals < 1) intervals = 1
  const maxIntervals = Math.max(1, Math.floor(usable / stepMin))

  while (intervals <= maxIntervals) {
    const step = usable / intervals
    if (step >= stepMin && step <= stepMax) {
      return { intervals, step, forced_step: false }
    }
    intervals += 1
  }

  const forcedIntervals = Math.max(1, maxIntervals)
  return {
    intervals: forcedIntervals,
    step: usable / forcedIntervals,
    forced_step: true,
  }
}

export function computeSidePlacements(v1, v2, options = {}) {
  const {
    type,
    cornerOffset_mm = 25,
    cantaWidth_mm = 50,
    centroid = { x: 0, y: 0 },
  } = options

  const rules = FASTENER_RULES[type]
  if (!rules) {
    return {
      type,
      count: 0,
      step_mm: 0,
      length_mm: 0,
      placements: [],
      forced_step: false,
      overlap_warning: false,
    }
  }

  const dx = v2.x - v1.x
  const dy = v2.y - v1.y
  const length = Math.hypot(dx, dy)
  const C = Math.max(0, Number(cornerOffset_mm || 0))
  const normal = inwardNormal(v1, v2, centroid)
  const perp = Math.max(0, Number(cantaWidth_mm || 0)) / 2

  if (length < EPS) {
    return {
      type,
      count: 0,
      step_mm: 0,
      length_mm: 0,
      placements: [],
      forced_step: false,
      overlap_warning: false,
    }
  }

  const usable = length - 2 * C

  if (usable <= 0) {
    const dStart = clamp(C, 0, length)
    const dEnd = clamp(length - C, 0, length)
    const distances = [dStart, dEnd]
    const placements = distances.map((s, idx) => {
      const t = clamp(s / length, 0, 1)
      return {
        index: idx,
        isCorner: true,
        distFromStart_mm: toMm(s),
        x_mm: toMm(v1.x + dx * t + normal.x * perp),
        y_mm: toMm(v1.y + dy * t + normal.y * perp),
      }
    })
    return {
      type,
      count: placements.length,
      step_mm: 0,
      length_mm: toMm(length),
      placements,
      forced_step: false,
      overlap_warning: Math.abs(dEnd - dStart) < 1,
      note: 'short_side_only_corners',
    }
  }

  const { intervals, step, forced_step } = calculateStepAndIntervals(usable, rules.step_min, rules.step_max)

  const placements = []
  for (let i = 0; i <= intervals; i += 1) {
    const s = C + i * step
    const t = clamp(s / length, 0, 1)
    placements.push({
      index: i,
      isCorner: i === 0 || i === intervals,
      distFromStart_mm: toMm(s),
      x_mm: toMm(v1.x + dx * t + normal.x * perp),
      y_mm: toMm(v1.y + dy * t + normal.y * perp),
    })
  }

  return {
    type,
    count: placements.length,
    step_mm: toMm(step),
    length_mm: toMm(length),
    placements,
    forced_step,
    overlap_warning: false,
  }
}

export function computePolygonFasteners(vertices = [], sideConfig = {}, options = {}) {
  if (!Array.isArray(vertices) || vertices.length < 2) return []
  const centroid = polygonCentroid(vertices)
  const cornerOffset = Number(options.cornerOffset_mm ?? 25)
  const sides = options.sideNames || ['A', 'B', 'C', 'D']

  const allSides = []
  for (let i = 0; i < vertices.length; i += 1) {
    const side = sides[i] || `S${i + 1}`
    const cfg = sideConfig[side] || {}
    const type = cfg.type || 'none'
    if (type === 'none') continue

    const start = vertices[i]
    const end = vertices[(i + 1) % vertices.length]
    const kantaWidth = Number(cfg.cantaWidth_mm || 50)

    const segment = computeSidePlacements(start, end, {
      type,
      cornerOffset_mm: cornerOffset,
      cantaWidth_mm: kantaWidth,
      centroid,
    })

    if (!segment.placements.length) continue

    const prevVertex = vertices[(i - 1 + vertices.length) % vertices.length]
    const nextVertex = vertices[(i + 2) % vertices.length]

    const startCorner = computeCornerPlacement(start, prevVertex, end, cornerOffset, kantaWidth, centroid)
    const nextSideName = sides[(i + 1) % vertices.length] || `S${((i + 1) % vertices.length) + 1}`
    const endKant = Number((sideConfig[nextSideName] || {}).cantaWidth_mm || kantaWidth)
    const endCorner = computeCornerPlacement(end, start, nextVertex, cornerOffset, endKant, centroid)

    segment.placements[0] = {
      ...segment.placements[0],
      x_mm: startCorner.x_mm,
      y_mm: startCorner.y_mm,
      isCorner: true,
    }
    segment.placements[segment.placements.length - 1] = {
      ...segment.placements[segment.placements.length - 1],
      x_mm: endCorner.x_mm,
      y_mm: endCorner.y_mm,
      isCorner: true,
    }

    allSides.push({
      side,
      type,
      step_mm: segment.step_mm,
      count: segment.count,
      forced_step: segment.forced_step,
      overlap_warning: segment.overlap_warning,
      kantaWidth_mm: kantaWidth,
      placements: segment.placements,
    })
  }

  return allSides
}

export function computeFastenersOnSegment(start, end, type, edgeOffsetMm = 25) {
  return computeSidePlacements(start, end, {
    type,
    cornerOffset_mm: edgeOffsetMm,
    cantaWidth_mm: 0,
    centroid: { x: 0, y: 0 },
  })
}
