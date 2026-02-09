import {
  calcAreaAndPerimeter,
  calcSideFasteners,
  assembleMaterials,
} from '../lib/calculator.rules.v1'

describe('calculator rules v1', () => {
  test('rectangle test', () => {
    const result = calcAreaAndPerimeter('rectangle', { width: 2000, height: 1500 })
    expect(result.areaM2).toBeCloseTo(3)
    expect(result.perimeterM).toBeCloseTo(7)
    expect(result.billableAreaM2).toBe(3)
  })

  test('trapezoid test with corner flags', () => {
    const result = calcAreaAndPerimeter('trapezoid', {
      top: 1800,
      bottom: 2200,
      left: 1400,
      right: 1400,
      height: 1400,
    })
    expect(result.areaM2).toBeCloseTo(2.8)
    expect(result.perimeterM).toBeCloseTo(6.8)
  })

  test('straps vs grommets test', () => {
    const strapSide = calcSideFasteners(2000, 'straps')
    const grommetSide = calcSideFasteners(2000, 'grommets')
    expect(strapSide.count).toBeLessThan(grommetSide.count)

    const materials = assembleMaterials({
      geometry: { billableAreaM2: 2, perimeterM: 6 },
      fastenersBySide: { top: strapSide, bottom: grommetSide, left: { type: 'none', count: 0 }, right: { type: 'none', count: 0 } },
      options: { bottomWeight: false, topDrip: false, rollStraps: false },
      additionalMaterials: [],
      rollStrapsCount: 0,
    })

    expect(materials.some((m) => m.sku === 'HARD-STRAP')).toBe(true)
    expect(materials.some((m) => m.sku === 'HARD-GROMMET')).toBe(true)
  })
})
