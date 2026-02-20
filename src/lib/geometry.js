const EPS = 1e-9

export function segmentLength(a, b) {
  return Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0))
}

export function polygonArea(vertices = []) {
  if (!Array.isArray(vertices) || vertices.length < 3) return 0
  let sum = 0
  for (let i = 0; i < vertices.length; i += 1) {
    const j = (i + 1) % vertices.length
    sum += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y
  }
  return Math.abs(sum) / 2
}

export function polygonPerimeter(vertices = []) {
  if (!Array.isArray(vertices) || vertices.length < 2) return 0
  let p = 0
  for (let i = 0; i < vertices.length; i += 1) {
    p += segmentLength(vertices[i], vertices[(i + 1) % vertices.length])
  }
  return p
}

export function polygonCentroid(vertices = []) {
  if (!Array.isArray(vertices) || vertices.length === 0) return { x: 0, y: 0 }
  const sum = vertices.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }), { x: 0, y: 0 })
  return { x: sum.x / vertices.length, y: sum.y / vertices.length }
}

export function pointInPolygon(point, vertices = []) {
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x
    const yi = vertices[i].y
    const xj = vertices[j].x
    const yj = vertices[j].y
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || EPS) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function triangleBySides(a, b, c) {
  if (!(a + b > c && a + c > b && b + c > a)) {
    return { valid: false, reason: 'Нарушено неравенство треугольника.' }
  }
  const v0 = { x: 0, y: 0 }
  const v1 = { x: c, y: 0 }
  const x = (b ** 2 + c ** 2 - a ** 2) / (2 * c)
  const ySq = b ** 2 - x ** 2
  if (ySq < -EPS) {
    return { valid: false, reason: 'Невозможно построить треугольник по сторонам.' }
  }
  return { valid: true, vertices: [v0, v1, { x, y: Math.sqrt(Math.max(0, ySq)) }] }
}

function trapezoidVertices(baseA, baseB, left, right, flags = {}) {
  const delta = baseB - baseA
  let xTopLeft = 0

  if (flags.bottomLeft || flags.topLeft) {
    xTopLeft = 0
  } else if (flags.bottomRight || flags.topRight) {
    xTopLeft = delta
  } else {
    const denominator = 2 * delta
    if (Math.abs(denominator) < EPS) {
      xTopLeft = 0
    } else {
      xTopLeft = (delta ** 2 + left ** 2 - right ** 2) / denominator
    }
  }

  let heightSq = left ** 2 - xTopLeft ** 2
  if (flags.bottomLeft || flags.topLeft) {
    heightSq = left ** 2
    xTopLeft = 0
  }
  if (flags.bottomRight || flags.topRight) {
    heightSq = right ** 2
    xTopLeft = delta
  }

  if (heightSq <= EPS) {
    return { valid: false, reason: 'Высота трапеции должна быть больше 0.' }
  }

  const height = Math.sqrt(heightSq)
  const vertices = [
    { x: 0, y: 0 },
    { x: baseB, y: 0 },
    { x: xTopLeft + baseA, y: height },
    { x: xTopLeft, y: height },
  ]
  return { valid: true, vertices }
}

export function computeVertices(shape, params = {}) {
  if (shape === 'rectangle') {
    const W = Number(params.width)
    const H = Number(params.height)
    if (!(W > 0 && H > 0)) return { valid: false, error: true, reason: 'Ширина/высота должны быть > 0.' }
    const vertices = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
    return { valid: true, vertices }
  }

  if (shape === 'triangle') {
    if (params.mode === 'sides') {
      const a = Number(params.a)
      const b = Number(params.b)
      const c = Number(params.c)
      if (![a, b, c].every((v) => Number.isFinite(v) && v > 0)) return { valid: false, error: true, reason: 'Стороны треугольника должны быть > 0.' }
      return triangleBySides(a, b, c)
    }

    const base = Number(params.base || params.width)
    const height = Number(params.height)
    if (!(base > 0 && height > 0)) return { valid: false, error: true, reason: 'Основание и высота должны быть > 0.' }

    const rightAngle = params.rightAngle || 'A'
    if (rightAngle === 'B') {
      return { valid: true, vertices: [{ x: -base, y: 0 }, { x: 0, y: 0 }, { x: 0, y: height }] }
    }
    if (rightAngle === 'C') {
      return { valid: true, vertices: [{ x: 0, y: -height }, { x: base, y: 0 }, { x: 0, y: 0 }] }
    }

    // По умолчанию: основание снизу, вершина сверху по центру.
    return { valid: true, vertices: [{ x: 0, y: 0 }, { x: base, y: 0 }, { x: base / 2, y: height }] }
  }

  if (shape === 'trapezoid') {
    const baseA = Number(params.baseA)
    const baseB = Number(params.baseB)
    const left = Number(params.left)
    const right = Number(params.right)
    if (![baseA, baseB, left, right].every((v) => Number.isFinite(v) && v > 0)) {
      return { valid: false, error: true, reason: 'Все стороны трапеции должны быть > 0.' }
    }
    return trapezoidVertices(baseA, baseB, left, right, params.flags || {})
  }

  return { valid: false, error: true, reason: 'Неподдерживаемая форма.' }
}

export function computeGeometry(shape, params = {}) {
  const base = computeVertices(shape, params)
  if (!base.valid) return { ...base, area_mm2: 0, perimeter_mm: 0, centroid: { x: 0, y: 0 } }

  const area_mm2 = polygonArea(base.vertices)
  if (area_mm2 <= EPS) {
    return { valid: false, error: true, reason: 'Площадь должна быть больше 0.', vertices: base.vertices, area_mm2: 0, perimeter_mm: 0, centroid: polygonCentroid(base.vertices) }
  }

  return {
    valid: true,
    vertices: base.vertices,
    area_mm2,
    perimeter_mm: polygonPerimeter(base.vertices),
    centroid: polygonCentroid(base.vertices),
  }
}
