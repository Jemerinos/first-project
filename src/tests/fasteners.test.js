import {
  computeCornerPlacement,
  computePathPlacements,
  computePolygonFasteners,
  computeSidePlacements,
} from '../lib/fasteners.v1'

function makeQuarterArcPath(radius = 500) {
  return {
    getTotalLength() {
      return Math.PI * radius / 2
    },
    getPointAtLength(distance) {
      const clamped = Math.max(0, Math.min(this.getTotalLength(), distance))
      const angle = clamped / radius
      return {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      }
    },
  }
}

describe('fasteners.v1', () => {
  test('Прямоугольник 1000 мм: люверсы равномерно по реальной длине стороны', () => {
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

  test('Треугольник (неравные стороны): координаты считаются от вершин, без form-аппроксимации', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 700, y: 0 }, { x: 250, y: 600 }]
    const sideConfig = {
      A: { type: 'grommets', cantaWidth_mm: 60 },
      B: { type: 'grommets', cantaWidth_mm: 60 },
      C: { type: 'grommets', cantaWidth_mm: 60 },
    }

    const res = computePolygonFasteners(vertices, sideConfig, {
      cornerOffset_mm: 25,
      sideNames: ['A', 'B', 'C'],
    })

    expect(res.length).toBe(3)
    expect(res.every((s) => s.count >= 2)).toBe(true)
    expect(res[0].placements[0].isCorner).toBe(true)
  })

  test('Замки имеют жёсткий шаг 425 мм', () => {
    const side = computeSidePlacements({ x: 0, y: 0 }, { x: 2000, y: 0 }, {
      type: 'locks',
      cornerOffset_mm: 25,
      cantaWidth_mm: 50,
      centroid: { x: 1000, y: 500 },
    })

    expect(side.step_mm).toBe(425)
    expect(side.placements[0].distFromStart_mm).toBe(25)
    expect(side.placements[1].distFromStart_mm).toBe(450)
  })

  test('Трапеция: корректные точки по всем сторонам', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1000, y: 700 }, { x: 200, y: 700 }]
    const sideConfig = {
      A: { type: 'grommets', cantaWidth_mm: 70 },
      B: { type: 'locks', cantaWidth_mm: 70 },
      C: { type: 'grommets', cantaWidth_mm: 70 },
      D: { type: 'straps', cantaWidth_mm: 70 },
    }

    const res = computePolygonFasteners(vertices, sideConfig, {
      cornerOffset_mm: 25,
      sideNames: ['A', 'B', 'C', 'D'],
    })

    expect(res.length).toBe(4)
    expect(res.find((s) => s.side === 'A').step_mm).toBeGreaterThanOrEqual(200)
    expect(res.find((s) => s.side === 'A').step_mm).toBeLessThanOrEqual(250)
    expect(res.find((s) => s.side === 'B').step_mm).toBeGreaterThanOrEqual(400)
  })

  test('Короткая сторона: только угловые точки', () => {
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

  test('Угол 90°: угловой люверс в центре канта', () => {
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

  test('Не дублируются угловые координаты на широком канте', () => {
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



  test('Для прямоугольника середина канта образует внутренний прямоугольник', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 600 },
      { x: 0, y: 600 },
    ]
    const sideConfig = {
      A: { type: 'grommets', cantaWidth_mm: 100 },
      B: { type: 'grommets', cantaWidth_mm: 100 },
      C: { type: 'grommets', cantaWidth_mm: 100 },
      D: { type: 'grommets', cantaWidth_mm: 100 },
    }
    const res = computePolygonFasteners(vertices, sideConfig, { cornerOffset_mm: 25, sideNames: ['A', 'B', 'C', 'D'] })
    const corners = res.map((side) => [side.anchors.start.x_mm, side.anchors.start.y_mm])

    expect(corners).toEqual([
      [50, 50],
      [950, 50],
      [950, 550],
      [50, 550],
    ])
  })

  test('Шаг считается от угловых точек пересечения середины канта', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 600 },
      { x: 0, y: 600 },
    ]
    const sideConfig = {
      A: { type: 'grommets', cantaWidth_mm: 100 },
      B: { type: 'grommets', cantaWidth_mm: 100 },
      C: { type: 'grommets', cantaWidth_mm: 100 },
      D: { type: 'grommets', cantaWidth_mm: 100 },
    }
    const res = computePolygonFasteners(vertices, sideConfig, { cornerOffset_mm: 25, sideNames: ['A', 'B', 'C', 'D'] })
    const top = res.find((s) => s.side === 'A')

    expect(top.placements[0].distFromStart_mm).toBe(0)
    expect(top.placements[top.placements.length - 1].distFromStart_mm).toBe(top.length_mm)
    expect(top.step_mm).toBeGreaterThanOrEqual(200)
    expect(top.step_mm).toBeLessThanOrEqual(250)
  })

  test('Арочная сторона: точки через getTotalLength/getPointAtLength', () => {
    const arcPath = makeQuarterArcPath(500)
    const res = computePathPlacements(arcPath, {
      type: 'grommets',
      cornerOffset_mm: 25,
      cantaWidth_mm: 50,
      centroid: { x: 250, y: 250 },
    })

    expect(res.count).toBeGreaterThan(2)
    expect(res.step_mm).toBeGreaterThanOrEqual(200)
    expect(res.step_mm).toBeLessThanOrEqual(250)
    expect(res.placements[0].isCorner).toBe(true)
  })
})
