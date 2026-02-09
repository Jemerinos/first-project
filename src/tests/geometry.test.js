import {
  computeTriangleFromSides,
  computeTrapezoid,
} from '../lib/geometry.v1'

describe('geometry.v1', () => {
  test('Triangle 3-4-5 valid with area and angles', () => {
    const t = computeTriangleFromSides(3, 4, 5)
    expect(t.valid).toBe(true)
    expect(t.area_mm2).toBeCloseTo(6)
    expect(t.perimeter_mm).toBeCloseTo(12)
    expect(t.angles_deg.C).toBeCloseTo(90)
  })

  test('Invalid triangle', () => {
    const t = computeTriangleFromSides(1, 2, 4)
    expect(t.valid).toBe(false)
  })

  test('Trapezoid generic with no right flags', () => {
    const tr = computeTrapezoid(1800, 2400, 1500, 1600, {})
    expect(tr.valid).toBe(true)
    expect(tr.height_mm).toBeGreaterThan(0)
    expect(tr.area_mm2).toBeGreaterThan(0)
  })

  test('Trapezoid with right corner flags', () => {
    const tr = computeTrapezoid(1800, 2400, 1400, 1500, { bottomLeft: true })
    expect(tr.valid).toBe(true)
    expect(tr.vertices[0].x).toBe(0)
    expect(tr.vertices[3].x).toBe(0)
  })

  test('Vertical trapezoid variation', () => {
    const tr = computeTrapezoid(1800, 1800, 1200, 1200, { bottomLeft: true, bottomRight: true })
    expect(tr.valid).toBe(true)
    expect(tr.height_mm).toBeCloseTo(1200)
  })
})
