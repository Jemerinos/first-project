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

function toMm(value) {
  return Math.round(value)
}

export function polygonCentroid(vertices = []) {
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

function calculateStepAndIntervals(usable, stepMin, stepMax, options = {}) {
  const { allowBelowMin = false } = options
  if (usable <= 0) return { intervals: 1, step: 0, forced_step: false }

  let intervals = Math.ceil(usable / stepMax)
  if (intervals < 1) intervals = 1
  const maxIntervals = Math.max(1, Math.floor(usable / stepMin))

  if (intervals <= maxIntervals) {
    while (intervals <= maxIntervals) {
      const step = usable / intervals
      if (step >= stepMin && step <= stepMax) {
        return { intervals, step, forced_step: false }
      }
      intervals += 1
    }
  }

  if (allowBelowMin) {
    const loweredIntervals = Math.max(1, Math.ceil(usable / stepMax))
    return {
      intervals: loweredIntervals,
      step: usable / loweredIntervals,
      forced_step: true,
    }
  }

  const forcedIntervals = Math.max(1, maxIntervals)
  return {
    intervals: forcedIntervals,
    step: usable / forcedIntervals,
    forced_step: true,
  }
}

function placementsFromLength(getPointAtDistance, getNormalAtDistance, length, options = {}) {
  const {
    type,
    cornerOffset_mm = 25,
    cantaWidth_mm = 50,
  } = options

  const rules = FASTENER_RULES[type]
  const allowBelowMin = type === 'locks' || type === 'straps'
  if (!rules || length <= 0) {
    return {
      type,
      count: 0,
      step_mm: 0,
      length_mm: toMm(length || 0),
      placements: [],
      forced_step: false,
      overlap_warning: false,
    }
  }

  const C = Math.max(0, Number(cornerOffset_mm || 0))
  const inwardOffset = Math.max(0, Number(cantaWidth_mm || 0)) / 2
  const usable = length - 2 * C

  if (usable <= 0) {
    const dStart = clamp(C, 0, length)
    const dEnd = clamp(length - C, 0, length)
    const distances = [dStart, dEnd]
    const placements = distances.map((distance, idx) => {
      const point = getPointAtDistance(distance)
      const normal = getNormalAtDistance(distance)
      return {
        index: idx,
        isCorner: true,
        distFromStart_mm: toMm(distance),
        x_mm: toMm(point.x + normal.x * inwardOffset),
        y_mm: toMm(point.y + normal.y * inwardOffset),
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

  const placements = []

  const { intervals, step, forced_step } = calculateStepAndIntervals(usable, rules.step_min, rules.step_max, { allowBelowMin })
  for (let i = 0; i <= intervals; i += 1) {
    const distance = C + i * step
    const point = getPointAtDistance(distance)
    const normal = getNormalAtDistance(distance)
    placements.push({
      index: i,
      isCorner: i === 0 || i === intervals,
      distFromStart_mm: toMm(distance),
      x_mm: toMm(point.x + normal.x * inwardOffset),
      y_mm: toMm(point.y + normal.y * inwardOffset),
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

function applyCornerOverrides(placements, startPoint, endPoint, centroid, cornerOverrides = {}) {
  if (!Array.isArray(placements) || placements.length < 2) return placements
  const sideLength = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y)
  if (sideLength < EPS) return placements

  const sideDir = normalize({ x: endPoint.x - startPoint.x, y: endPoint.y - startPoint.y })
  const sideNormal = inwardNormal(startPoint, endPoint, centroid)

  const result = [...placements]
  if (result[0]?.isCorner && cornerOverrides.start) {
    const along = clamp(Number(cornerOverrides.start.along_mm || 0), 0, sideLength)
    const inward = Math.max(0, Number(cornerOverrides.start.inward_mm || 0))
    result[0] = {
      ...result[0],
      x_mm: toMm(startPoint.x + sideDir.x * along + sideNormal.x * inward),
      y_mm: toMm(startPoint.y + sideDir.y * along + sideNormal.y * inward),
    }
  }

  const lastIndex = result.length - 1
  if (result[lastIndex]?.isCorner && cornerOverrides.end) {
    const along = clamp(Number(cornerOverrides.end.along_mm || 0), 0, sideLength)
    const inward = Math.max(0, Number(cornerOverrides.end.inward_mm || 0))
    result[lastIndex] = {
      ...result[lastIndex],
      x_mm: toMm(endPoint.x - sideDir.x * along + sideNormal.x * inward),
      y_mm: toMm(endPoint.y - sideDir.y * along + sideNormal.y * inward),
    }
  }

  return result
}

function placementsBetweenCornerAnchors(startPoint, endPoint, type, options = {}) {
  const rules = FASTENER_RULES[type]
  const allowBelowMin = type === 'locks' || type === 'straps'
  const dx = endPoint.x - startPoint.x
  const dy = endPoint.y - startPoint.y
  const length = Math.hypot(dx, dy)
  const startOffset = Math.max(0, Number(options.startOffset_mm || 0))
  const endOffset = Math.max(0, Number(options.endOffset_mm || 0))

  if (!rules || length <= 0) {
    return {
      type,
      count: 0,
      step_mm: 0,
      length_mm: toMm(length || 0),
      placements: [],
      forced_step: false,
      overlap_warning: false,
    }
  }

  const usable = length - startOffset - endOffset

  if (usable < rules.step_min && !allowBelowMin) {
    const d0 = clamp(startOffset, 0, length)
    const d1 = clamp(length - endOffset, 0, length)
    const t0 = clamp(d0 / length, 0, 1)
    const t1 = clamp(d1 / length, 0, 1)
    const placements = [
      { index: 0, isCorner: startOffset === 0, distFromStart_mm: toMm(d0), x_mm: toMm(startPoint.x + dx * t0), y_mm: toMm(startPoint.y + dy * t0) },
      { index: 1, isCorner: endOffset === 0, distFromStart_mm: toMm(d1), x_mm: toMm(startPoint.x + dx * t1), y_mm: toMm(startPoint.y + dy * t1) },
    ]
    return {
      type,
      count: placements.length,
      step_mm: toMm(length),
      length_mm: toMm(length),
      placements,
      forced_step: false,
      overlap_warning: length < 1,
      note: 'corner_to_corner_only',
    }
  }

  const placements = []

  const { intervals, step, forced_step } = calculateStepAndIntervals(usable, rules.step_min, rules.step_max, { allowBelowMin })
  for (let i = 0; i <= intervals; i += 1) {
    const distance = startOffset + i * step
    const t = clamp(distance / length, 0, 1)
    placements.push({
      index: i,
      isCorner: (i === 0 && startOffset === 0) || (i === intervals && endOffset === 0),
      distFromStart_mm: toMm(distance),
      x_mm: toMm(startPoint.x + dx * t),
      y_mm: toMm(startPoint.y + dy * t),
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



function computeCornerMidlineIntersection(V, Vprev, Vnext, prevInset, nextInset, centroid) {
  const dPrev = normalize({ x: Vprev.x - V.x, y: Vprev.y - V.y })
  const dNext = normalize({ x: Vnext.x - V.x, y: Vnext.y - V.y })

  if ((Math.abs(dPrev.x) < EPS && Math.abs(dPrev.y) < EPS) || (Math.abs(dNext.x) < EPS && Math.abs(dNext.y) < EPS)) {
    return { x_mm: toMm(V.x), y_mm: toMm(V.y), fallback_corner_placement: true }
  }

  const nPrev = inwardNormal(V, Vprev, centroid)
  const nNext = inwardNormal(V, Vnext, centroid)

  // Жестко фиксируем линии середины канта: параллельно сторонам, сдвиг только перпендикулярно внутрь.
  const l1Point = { x: V.x + nPrev.x * prevInset, y: V.y + nPrev.y * prevInset }
  const l2Point = { x: V.x + nNext.x * nextInset, y: V.y + nNext.y * nextInset }

  const exact = lineIntersection(l1Point, dPrev, l2Point, dNext)
  if (exact) return { x_mm: toMm(exact.x), y_mm: toMm(exact.y) }

  const avgInset = (prevInset + nextInset) / 2
  const inward = normalize({ x: nPrev.x + nNext.x, y: nPrev.y + nNext.y })
  return {
    x_mm: toMm(V.x + inward.x * avgInset),
    y_mm: toMm(V.y + inward.y * avgInset),
    fallback_corner_placement: true,
  }
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
      return { x_mm: toMm(exact.x), y_mm: toMm(exact.y) }
    }
  }

  const mid = { x: (V.x + d1.x * C + V.x + d2.x * C) / 2, y: (V.y + d1.y * C + V.y + d2.y * C) / 2 }
  const inward = normalize({ x: centroid.x - mid.x, y: centroid.y - mid.y })
  return {
    x_mm: toMm(mid.x + inward.x * r),
    y_mm: toMm(mid.y + inward.y * r),
    fallback_corner_placement: true,
  }
}

export function computeSidePlacements(v1, v2, options = {}) {
  const centroid = options.centroid || { x: 0, y: 0 }
  const dx = v2.x - v1.x
  const dy = v2.y - v1.y
  const length = Math.hypot(dx, dy)

  if (length <= 0) {
    return {
      type: options.type,
      count: 0,
      step_mm: 0,
      length_mm: 0,
      placements: [],
      forced_step: false,
      overlap_warning: false,
    }
  }

  const lineNormal = inwardNormal(v1, v2, centroid)
  return placementsFromLength(
    (distance) => {
      const t = clamp(distance / length, 0, 1)
      return { x: v1.x + dx * t, y: v1.y + dy * t }
    },
    () => lineNormal,
    length,
    options,
  )
}

// Для кривых сторон используем SVGGeometryElement API: getTotalLength/getPointAtLength
export function computePathPlacements(pathGeometry, options = {}) {
  if (!pathGeometry || typeof pathGeometry.getTotalLength !== 'function' || typeof pathGeometry.getPointAtLength !== 'function') {
    return {
      type: options.type,
      count: 0,
      step_mm: 0,
      length_mm: 0,
      placements: [],
      forced_step: false,
      overlap_warning: false,
      note: 'invalid_path_geometry',
    }
  }

  const centroid = options.centroid || { x: 0, y: 0 }
  const length = Number(pathGeometry.getTotalLength() || 0)
  const tangentEps = Math.max(1, Number(options.tangentEps_mm || 1))

  return placementsFromLength(
    (distance) => {
      const d = clamp(distance, 0, length)
      const p = pathGeometry.getPointAtLength(d)
      return { x: p.x, y: p.y }
    },
    (distance) => {
      const d1 = clamp(distance - tangentEps, 0, length)
      const d2 = clamp(distance + tangentEps, 0, length)
      const p1 = pathGeometry.getPointAtLength(d1)
      const p2 = pathGeometry.getPointAtLength(d2)
      const tangent = normalize({ x: p2.x - p1.x, y: p2.y - p1.y })
      const nA = { x: -tangent.y, y: tangent.x }
      const p = pathGeometry.getPointAtLength(clamp(distance, 0, length))
      const toCenter = { x: centroid.x - p.x, y: centroid.y - p.y }
      const normal = dot(nA, toCenter) >= 0 ? nA : { x: -nA.x, y: -nA.y }
      return normalize(normal)
    },
    length,
    options,
  )
}

export function computePolygonFasteners(vertices = [], sideConfig = {}, options = {}) {
  if (!Array.isArray(vertices) || vertices.length < 2) return []
  const centroid = polygonCentroid(vertices)
  const cornerOffset = Number(options.cornerOffset_mm ?? 25)
  const sides = options.sideNames || ['A', 'B', 'C', 'D']

  const cornerPoints = vertices.map((vertex, i) => {
    const prevVertex = vertices[(i - 1 + vertices.length) % vertices.length]
    const nextVertex = vertices[(i + 1) % vertices.length]
    const prevSideName = sides[(i - 1 + sides.length) % sides.length] || `S${i}`
    const thisSideName = sides[i] || `S${i + 1}`
    const prevInset = Number((sideConfig[prevSideName] || {}).cantaWidth_mm || 50) / 2
    const thisInset = Number((sideConfig[thisSideName] || {}).cantaWidth_mm || 50) / 2
    return computeCornerMidlineIntersection(vertex, prevVertex, nextVertex, prevInset, thisInset, centroid)
  })

  const allSides = []
  for (let i = 0; i < vertices.length; i += 1) {
    const sideName = sides[i] || `S${i + 1}`
    const cfg = sideConfig[sideName] || {}
    const type = cfg.type || 'none'
    if (type === 'none') continue

    const start = vertices[i]
    const end = vertices[(i + 1) % vertices.length]
    const cantaWidth = Number(cfg.cantaWidth_mm || 50)

    const segment = cfg.pathGeometry
      ? computePathPlacements(cfg.pathGeometry, {
        type,
        cornerOffset_mm: cornerOffset,
        cantaWidth_mm: cantaWidth,
        centroid,
      })
      : placementsBetweenCornerAnchors(
        { x: cornerPoints[i].x_mm, y: cornerPoints[i].y_mm },
        { x: cornerPoints[(i + 1) % vertices.length].x_mm, y: cornerPoints[(i + 1) % vertices.length].y_mm },
        type,
        {
          startOffset_mm: Number(cfg.startOffset_mm || 0),
          endOffset_mm: Number(cfg.endOffset_mm || 0),
        },
      )

    segment.placements = applyCornerOverrides(
      segment.placements,
      { x: cornerPoints[i].x_mm, y: cornerPoints[i].y_mm },
      { x: cornerPoints[(i + 1) % vertices.length].x_mm, y: cornerPoints[(i + 1) % vertices.length].y_mm },
      centroid,
      cfg.cornerOverrides,
    )

    // Для кривых сторон принудительно фиксируем углы в точках пересечения середины канта.
    if (cfg.pathGeometry && segment.placements.length >= 2) {
      segment.placements[0] = {
        ...segment.placements[0],
        x_mm: cornerPoints[i].x_mm,
        y_mm: cornerPoints[i].y_mm,
        isCorner: true,
      }
      segment.placements[segment.placements.length - 1] = {
        ...segment.placements[segment.placements.length - 1],
        x_mm: cornerPoints[(i + 1) % vertices.length].x_mm,
        y_mm: cornerPoints[(i + 1) % vertices.length].y_mm,
        isCorner: true,
      }
    }

    allSides.push({
      side: sideName,
      sideName,
      type,
      step_mm: segment.step_mm,
      count: segment.count,
      length_mm: segment.length_mm,
      forced_step: segment.forced_step,
      overlap_warning: segment.overlap_warning,
      kantaWidth_mm: cantaWidth,
      placements: segment.placements,
      anchors: {
        start: cornerPoints[i],
        end: cornerPoints[(i + 1) % vertices.length],
      },
      rawSegment: { start, end },
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
