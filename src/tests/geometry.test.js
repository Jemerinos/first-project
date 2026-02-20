import { computeGeometry, computeVertices, polygonArea, polygonPerimeter, segmentLength } from '../lib/geometry.js'

describe('geometry.js', () => {
  test('rectangle: корректные вершины/площадь/периметр', () => {
    const vertices = computeVertices('rectangle', { width: 1000, height: 500 })
    expect(vertices.valid).toBe(true)
    expect(vertices.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 500 },
      { x: 0, y: 500 },
    ])
    expect(polygonArea(vertices.vertices)).toBe(500000)
    expect(polygonPerimeter(vertices.vertices)).toBe(3000)
    expect(segmentLength(vertices.vertices[0], vertices.vertices[1])).toBe(1000)
  })

  test('triangle inequality validation', () => {
    const tri = computeVertices('triangle', { mode: 'sides', a: 1, b: 2, c: 4 })
    expect(tri.valid).toBe(false)
  })

  test('trapezoid validation: высота должна быть > 0', () => {
    const tr = computeVertices('trapezoid', { baseA: 1800, baseB: 1800, left: 100, right: 100, flags: { bottomLeft: true, bottomRight: true } })
    expect(tr.valid).toBe(false)
  })

  test('computeGeometry: площадь > 0', () => {
    const g = computeGeometry('triangle', { mode: 'catheti', width: 800, height: 600, rightAngle: 'A' })
    expect(g.valid).toBe(true)
    expect(g.area_mm2).toBeGreaterThan(0)
    expect(g.perimeter_mm).toBeGreaterThan(0)
  })
})
