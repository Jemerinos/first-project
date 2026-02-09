const toDeg = (r) => (r * 180) / Math.PI

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)

// Shoelace formula for polygon area from coordinates.
const shoelaceArea = (vertices) => {
  let sum = 0
  for (let i = 0; i < vertices.length; i += 1) {
    const j = (i + 1) % vertices.length
    sum += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y
  }
  return Math.abs(sum) / 2
}

// Law of cosines for angle opposite side a:
// cos(A) = (b^2 + c^2 - a^2) / (2bc)
const lawOfCosinesAngle = (opposite, side1, side2) => {
  const cosValue = (side1 ** 2 + side2 ** 2 - opposite ** 2) / (2 * side1 * side2)
  const clamped = Math.max(-1, Math.min(1, cosValue))
  return toDeg(Math.acos(clamped))
}

export function computeTriangleFromSides(a_mm, b_mm, c_mm) {
  const a = Number(a_mm)
  const b = Number(b_mm)
  const c = Number(c_mm)

  if (![a, b, c].every((v) => Number.isFinite(v) && v > 0)) {
    return { valid: false, reason: 'Все стороны треугольника должны быть больше 0.' }
  }

  if (!(a + b > c && a + c > b && b + c > a)) {
    return { valid: false, reason: 'Нарушено неравенство треугольника.' }
  }

  const v0 = { x: 0, y: 0 }
  const v1 = { x: c, y: 0 }
  const x = (b ** 2 + c ** 2 - a ** 2) / (2 * c)
  const ySq = b ** 2 - x ** 2
  if (ySq < 0) {
    return { valid: false, reason: 'Невозможно вычислить координаты вершины.' }
  }
  const v2 = { x, y: Math.sqrt(ySq) }

  const vertices = [v0, v1, v2]
  const area_mm2 = shoelaceArea(vertices)
  const perimeter_mm = a + b + c

  const angles_deg = {
    A: lawOfCosinesAngle(a, b, c),
    B: lawOfCosinesAngle(b, a, c),
    C: lawOfCosinesAngle(c, a, b),
  }

  return {
    valid: true,
    vertices,
    sides: { a, b, c },
    angles_deg,
    area_mm2,
    perimeter_mm,
  }
}

export function computeTriangleFromBaseHeight(base_mm, height_mm) {
  const base = Number(base_mm)
  const height = Number(height_mm)
  if (!(base > 0 && height > 0)) {
    return { valid: false, reason: 'Основание и высота должны быть больше 0.' }
  }

  const v0 = { x: 0, y: 0 }
  const v1 = { x: base, y: 0 }
  const v2 = { x: base / 2, y: height }
  const vertices = [v0, v1, v2]

  const a = dist(v1, v2)
  const b = dist(v0, v2)
  const c = dist(v0, v1)

  return {
    valid: true,
    vertices,
    sides: { a, b, c },
    angles_deg: {
      A: lawOfCosinesAngle(a, b, c),
      B: lawOfCosinesAngle(b, a, c),
      C: lawOfCosinesAngle(c, a, b),
    },
    area_mm2: shoelaceArea(vertices),
    perimeter_mm: a + b + c,
  }
}

const quadrilateralFeasible = (sides) => {
  const sum = sides.reduce((acc, v) => acc + v, 0)
  return sides.every((v) => v > 0 && v < sum - v)
}

export function computeTrapezoid(baseA_mm, baseB_mm, left_mm, right_mm, cornerFlags = {}) {
  const baseA = Number(baseA_mm)
  const baseB = Number(baseB_mm)
  const left = Number(left_mm)
  const right = Number(right_mm)

  if (![baseA, baseB, left, right].every((v) => Number.isFinite(v) && v > 0)) {
    return { valid: false, reason: 'Все стороны трапеции должны быть больше 0.' }
  }

  if (!quadrilateralFeasible([baseA, baseB, left, right])) {
    return { valid: false, reason: 'С такими длинами невозможно построить четырёхугольник.' }
  }

  const delta = baseB - baseA
  let xTopLeft = 0

  if (cornerFlags.bottomLeft || cornerFlags.topLeft) {
    xTopLeft = 0
  } else if (cornerFlags.bottomRight || cornerFlags.topRight) {
    xTopLeft = delta
  } else {
    const numerator = delta ** 2 + left ** 2 - right ** 2
    const denominator = 2 * delta || 1
    xTopLeft = numerator / denominator
  }

  let heightSq = left ** 2 - xTopLeft ** 2
  if (heightSq < 0) {
    return { valid: false, reason: 'Невозможно построить трапецию: отрицательная высота.' }
  }
  let height = Math.sqrt(heightSq)

  if (cornerFlags.bottomLeft || cornerFlags.topLeft) {
    height = left
  }
  if (cornerFlags.bottomRight || cornerFlags.topRight) {
    height = right
    xTopLeft = delta
  }

  const vertices = [
    { x: 0, y: 0 },
    { x: baseB, y: 0 },
    { x: xTopLeft + baseA, y: height },
    { x: xTopLeft, y: height },
  ]

  const area_mm2 = shoelaceArea(vertices)
  const perimeter_mm = baseA + baseB + left + right

  return {
    valid: true,
    vertices,
    height_mm: height,
    area_mm2,
    perimeter_mm,
  }
}
