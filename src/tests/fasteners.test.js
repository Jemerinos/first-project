import { computeFastenersOnSegment } from '../lib/fasteners.v1'

describe('fasteners.v1', () => {
  test('grommets use near 200-250 step range', () => {
    const res = computeFastenersOnSegment({ x: 0, y: 0 }, { x: 2000, y: 0 }, 'grommets')
    expect(res.count).toBeGreaterThan(2)
    expect(res.step_mm).toBeGreaterThanOrEqual(200)
    expect(res.step_mm).toBeLessThanOrEqual(250)
    expect(res.placements[0].distFromStart_mm).toBeCloseTo(25)
  })

  test('locks use near 400-450 step range', () => {
    const res = computeFastenersOnSegment({ x: 0, y: 0 }, { x: 2400, y: 0 }, 'locks')
    expect(res.step_mm).toBeGreaterThanOrEqual(350)
    expect(res.step_mm).toBeLessThanOrEqual(450)
    expect(res.placements[0].distFromStart_mm).toBeCloseTo(25)
  })

  test('segment with diagonal coordinates returns absolute points', () => {
    const res = computeFastenersOnSegment({ x: 0, y: 0 }, { x: 1000, y: 1000 }, 'straps')
    expect(res.placements.length).toBeGreaterThan(1)
    expect(res.placements[0].x_mm).toBeGreaterThan(0)
    expect(res.placements[0].y_mm).toBeGreaterThan(0)
  })
})
