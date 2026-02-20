import { polygonCentroid, segmentLength } from './geometry.js'

const EPS = 1e-9
const RULES = {
  grommets: { stepMin: 200, stepMax: 250 },
  locks: { stepMin: 400, stepMax: 450 },
  straps: { stepMin: 400, stepMax: 450 },
}

const mm = (v) => Math.round(v)
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

function normalize(v) {
  const len = Math.hypot(v.x, v.y)
  if (len < EPS) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

function lineIntersection(p1, d1, p2, d2) {
  const det = d1.x * d2.y - d1.y * d2.x
  if (Math.abs(det) < EPS) return null
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const t = (dx * d2.y - dy * d2.x) / det
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y }
}

function inwardNormal(v1, v2, centroid) {
  const dx = v2.x - v1.x
  const dy = v2.y - v1.y
  let n = normalize({ x: -dy, y: dx })
  const mid = { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 }
  const toCenter = { x: centroid.x - mid.x, y: centroid.y - mid.y }
  const dot = n.x * toCenter.x + n.y * toCenter.y
  if (dot < 0) n = { x: -n.x, y: -n.y }
  return n
}

function resolveStep(usable, stepMin, stepMax) {
  if (usable <= 0) return { step: 0, k: 0, forcedStep: false }

  const kMin = Math.max(0, Math.ceil(usable / stepMax) - 1)
  const kMax = Math.max(0, Math.floor(usable / stepMin) - 1)

  if (kMin <= kMax) {
    const k = kMin
    const step = usable / (k + 1)
    return { step, k, forcedStep: false }
  }

  // fallback: уменьшаем шаг (делаем плотнее), если диапазон недостижим
  const k = kMin
  const step = usable / (k + 1)
  return { step, k, forcedStep: true }
}

export function computeCornerGrommet(prev, V, next, cantaHalf, centroid) {
  const d1 = normalize({ x: prev.x - V.x, y: prev.y - V.y })
  const d2 = normalize({ x: next.x - V.x, y: next.y - V.y })
  const n1 = inwardNormal(V, prev, centroid)
  const n2 = inwardNormal(V, next, centroid)

  const p1 = { x: V.x + n1.x * cantaHalf, y: V.y + n1.y * cantaHalf }
  const p2 = { x: V.x + n2.x * cantaHalf, y: V.y + n2.y * cantaHalf }
  const cross = lineIntersection(p1, d1, p2, d2)

  if (cross) return { x_mm: mm(cross.x), y_mm: mm(cross.y) }

  return {
    x_mm: mm((p1.x + p2.x) / 2),
    y_mm: mm((p1.y + p2.y) / 2),
    fallback_corner_placement: true,
  }
}

export function computeSideGrommets(v1, v2, config = {}) {
  const {
    stepMin,
    stepMax,
    cornerOffset = 25,
    cantaHalf = 25,
    centroid = { x: 0, y: 0 },
    startOffset = 0,
    endOffset = 0,
  } = config

  const L = segmentLength(v1, v2)
  if (L <= 0) return { step_mm: 0, count: 0, placements: [], forcedStep: false, length_mm: 0 }

  const offsetStart = Math.max(0, cornerOffset + Number(startOffset || 0))
  const offsetEnd = Math.max(0, cornerOffset + Number(endOffset || 0))
  const usable = L - offsetStart - offsetEnd

  const dx = v2.x - v1.x
  const dy = v2.y - v1.y
  const normal = inwardNormal(v1, v2, centroid)

  if (usable <= 0) {
    const distances = [clamp(offsetStart, 0, L), clamp(L - offsetEnd, 0, L)]
    const placements = distances.map((s, i) => {
      const t = clamp(s / L, 0, 1)
      const p = { x: v1.x + t * dx, y: v1.y + t * dy }
      return {
        index: i,
        x_mm: mm(p.x + normal.x * cantaHalf),
        y_mm: mm(p.y + normal.y * cantaHalf),
        distFromStart_mm: mm(s),
        isCorner: true,
        forcedStep: false,
      }
    })
    return { step_mm: 0, count: placements.length, placements, forcedStep: false, length_mm: mm(L), note: 'short_side_only_corners' }
  }

  const { step, k, forcedStep } = resolveStep(usable, stepMin, stepMax)
  const placements = []
  for (let i = 0; i <= k + 1; i += 1) {
    const s = offsetStart + i * step
    const t = clamp(s / L, 0, 1)
    const p = { x: v1.x + t * dx, y: v1.y + t * dy }
    placements.push({
      index: i,
      x_mm: mm(p.x + normal.x * cantaHalf),
      y_mm: mm(p.y + normal.y * cantaHalf),
      distFromStart_mm: mm(s),
      isCorner: i === 0 || i === k + 1,
      forcedStep,
    })
  }

  return {
    step_mm: mm(step),
    count: placements.length,
    placements,
    forcedStep,
    length_mm: mm(L),
  }
}

export function computeAllFasteners(vertices = [], sideConfigs = {}, options = {}) {
  if (!Array.isArray(vertices) || vertices.length < 2) return []
  const centroid = options.centroid || polygonCentroid(vertices)
  const sideNames = options.sideNames || ['A', 'B', 'C', 'D']

  const cornerPoints = vertices.map((v, i) => {
    const prev = vertices[(i - 1 + vertices.length) % vertices.length]
    const next = vertices[(i + 1) % vertices.length]
    const prevName = sideNames[(i - 1 + sideNames.length) % sideNames.length] || `S${i}`
    const thisName = sideNames[i] || `S${i + 1}`
    const prevHalf = Number((sideConfigs[prevName] || {}).cantaWidth_mm || 50) / 2
    const thisHalf = Number((sideConfigs[thisName] || {}).cantaWidth_mm || 50) / 2
    return computeCornerGrommet(prev, v, next, (prevHalf + thisHalf) / 2, centroid)
  })

  const result = []
  for (let i = 0; i < vertices.length; i += 1) {
    const sideName = sideNames[i] || `S${i + 1}`
    const cfg = sideConfigs[sideName] || {}
    const type = cfg.type || 'none'
    if (type === 'none') continue

    const rules = RULES[type] || RULES.grommets
    const side = computeSideGrommets(vertices[i], vertices[(i + 1) % vertices.length], {
      stepMin: rules.stepMin,
      stepMax: rules.stepMax,
      cornerOffset: Number(cfg.cornerOffset_mm ?? 25),
      cantaHalf: Number(cfg.cantaWidth_mm || 50) / 2,
      centroid,
      startOffset: Number(cfg.startOffset_mm || 0),
      endOffset: Number(cfg.endOffset_mm || 0),
    })

    if (side.placements.length >= 2) {
      const lastIndex = side.placements.length - 1
      side.placements[0] = { ...side.placements[0], x_mm: cornerPoints[i].x_mm, y_mm: cornerPoints[i].y_mm, isCorner: true }
      side.placements[lastIndex] = {
        ...side.placements[lastIndex],
        x_mm: cornerPoints[(i + 1) % vertices.length].x_mm,
        y_mm: cornerPoints[(i + 1) % vertices.length].y_mm,
        isCorner: true,
      }
    }

    result.push({
      side: sideName,
      sideName,
      type,
      step_mm: side.step_mm,
      count: side.count,
      length_mm: side.length_mm,
      forced_step: side.forcedStep,
      placements: side.placements,
      anchors: {
        start: cornerPoints[i],
        end: cornerPoints[(i + 1) % vertices.length],
      },
    })
  }

  return result
}
