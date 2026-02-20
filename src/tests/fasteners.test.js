import { computeAllFasteners, computeSideGrommets } from '../lib/fasteners.js'
import { pointInPolygon } from '../lib/geometry.js'

function pointsOnSegment(v1, v2, p, tol = 2) {
  const dx = v2.x - v1.x
  const dy = v2.y - v1.y
  const segLen = Math.hypot(dx, dy)
  const d1 = Math.hypot(p.x_mm - v1.x, p.y_mm - v1.y)
  const d2 = Math.hypot(p.x_mm - v2.x, p.y_mm - v2.y)
  return Math.abs((d1 + d2) - segLen) <= tol + 60 // учитываем сдвиг по нормали в кант
}

describe('fasteners.js', () => {
  test('rectangle 1000x500: люверсы равномерно по стороне', () => {
    const side = computeSideGrommets({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      stepMin: 200,
      stepMax: 250,
      cornerOffset: 25,
      cantaHalf: 25,
      centroid: { x: 500, y: 250 },
    })

    expect(side.count).toBe(5)
    expect(side.step_mm).toBeGreaterThanOrEqual(200)
    expect(side.step_mm).toBeLessThanOrEqual(250)
    const dists = side.placements.map((p) => p.distFromStart_mm)
    expect(dists).toEqual([25, 263, 500, 738, 975])
  })

  test('triangle: точки лежат на сторонах (с учетом сдвига в кант) и внутри полигона', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 600, y: 900 }]
    const sideConfigs = {
      A: { type: 'grommets', cantaWidth_mm: 50 },
      B: { type: 'grommets', cantaWidth_mm: 50 },
      C: { type: 'grommets', cantaWidth_mm: 50 },
    }
    const result = computeAllFasteners(vertices, sideConfigs, { sideNames: ['A', 'B', 'C'] })

    expect(result.length).toBe(3)
    result.forEach((side, i) => {
      const v1 = vertices[i]
      const v2 = vertices[(i + 1) % vertices.length]
      side.placements.forEach((p) => {
        expect(Number.isNaN(p.x_mm)).toBe(false)
        expect(Number.isNaN(p.y_mm)).toBe(false)
        expect(pointsOnSegment(v1, v2, p)).toBe(true)
        expect(pointInPolygon({ x: p.x_mm, y: p.y_mm }, vertices) || p.isCorner).toBe(true)
      })
    })
  })

  test('trapezoid: нет NaN координат', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 2200, y: 0 }, { x: 1800, y: 900 }, { x: 300, y: 900 }]
    const sideConfigs = {
      A: { type: 'grommets', cantaWidth_mm: 70 },
      B: { type: 'locks', cantaWidth_mm: 70 },
      C: { type: 'grommets', cantaWidth_mm: 70 },
      D: { type: 'straps', cantaWidth_mm: 70 },
    }
    const result = computeAllFasteners(vertices, sideConfigs, { sideNames: ['A', 'B', 'C', 'D'] })

    result.forEach((side) => {
      side.placements.forEach((p) => {
        expect(Number.isNaN(p.x_mm)).toBe(false)
        expect(Number.isNaN(p.y_mm)).toBe(false)
      })
    })
  })

  test('distFromStart всегда возрастает', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 2000 }, { x: 0, y: 2000 }]
    const sideConfigs = {
      A: { type: 'grommets', cantaWidth_mm: 50 },
      B: { type: 'grommets', cantaWidth_mm: 50 },
      C: { type: 'grommets', cantaWidth_mm: 50 },
      D: { type: 'grommets', cantaWidth_mm: 50 },
    }

    const result = computeAllFasteners(vertices, sideConfigs, { sideNames: ['A', 'B', 'C', 'D'] })
    result.forEach((side) => {
      for (let i = 1; i < side.placements.length; i += 1) {
        expect(side.placements[i].distFromStart_mm).toBeGreaterThan(side.placements[i - 1].distFromStart_mm)
      }
    })
  })
})
