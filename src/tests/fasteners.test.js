import {
  computeCornerPlacement,
  computePolygonFasteners,
  computeSidePlacements,
} from '../lib/fasteners.v1'

describe('fasteners.v1', () => {
  test('rectangle width=1000 canto=50 gives expected grommet step logic', () => {
    const side = computeSidePlacements({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      type: 'grommets',
      cornerOffset_mm: 25,
      cantaWidth_mm: 50,
      centroid: { x: 500, y: 250 },
    })

    expect(side.count).toBe(5)
    expect(side.step_mm).toBe(238)
    expect(side.placements.map((p) => p.distFromStart_mm)).toEqual([25, 263, 500, 738, 975])
  })

  test('short side returns corners only', () => {
    const side = computeSidePlacements({ x: 0, y: 0 }, { x: 40, y: 0 }, {
      type: 'grommets',
      cornerOffset_mm: 25,
      cantaWidth_mm: 50,
      centroid: { x: 20, y: 20 },
    })

    expect(side.count).toBe(2)
    expect(side.note).toBe('short_side_only_corners')
    expect(side.placements[0].isCorner).toBe(true)
    expect(side.placements[1].isCorner).toBe(true)
  })

  test('90 degree corner is centered in kanta', () => {
    const corner = computeCornerPlacement(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      25,
      70,
      { x: 50, y: 50 },
    )

    expect(corner.x_mm).toBeGreaterThanOrEqual(30)
    expect(corner.y_mm).toBeGreaterThanOrEqual(30)
  })

  test('polygon computation does not duplicate corner coordinates', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 500 },
      { x: 0, y: 500 },
    ]
    const sideConfig = {
      A: { type: 'grommets', cantaWidth_mm: 150 },
      B: { type: 'grommets', cantaWidth_mm: 150 },
      C: { type: 'grommets', cantaWidth_mm: 150 },
      D: { type: 'grommets', cantaWidth_mm: 150 },
    }
    const res = computePolygonFasteners(vertices, sideConfig, { cornerOffset_mm: 25, sideNames: ['A', 'B', 'C', 'D'] })

    const corners = res.flatMap((s) => [s.placements[0], s.placements[s.placements.length - 1]])
    const unique = new Set(corners.map((c) => `${c.x_mm}:${c.y_mm}`))
    expect(unique.size).toBe(4)
  })
})
