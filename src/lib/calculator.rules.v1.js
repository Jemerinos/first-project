export const RULES_VERSION = 'calculator.rules.v1'

export const PRICE_LIST = {
  film_m2: { sku: 'FILM-PVC', name: 'Плёнка ПВХ', unit: 'м²', unitPrice: 950 },
  kant_m: { sku: 'KANT-BASE', name: 'Кант', unit: 'м', unitPrice: 140 },
  grommet: { sku: 'HARD-GROMMET', name: 'Люверс', unit: 'шт', unitPrice: 18 },
  lock: { sku: 'HARD-LOCK', name: 'Замок', unit: 'шт', unitPrice: 95 },
  strap: { sku: 'HARD-STRAP', name: 'Ремень', unit: 'шт', unitPrice: 80 },
  bottomWeight: { sku: 'ACC-WEIGHT', name: 'Отвес снизу', unit: 'шт', unitPrice: 420 },
  topDrip: { sku: 'ACC-DRIP', name: 'Отлив сверху', unit: 'шт', unitPrice: 520 },
  rollHook: { sku: 'ACC-HOOK', name: 'Крючок для ремня фиксации', unit: 'шт', unitPrice: 60 },
}

const mmToM = (v) => Number(v || 0) / 1000

export function calcAreaAndPerimeter(shape, dims) {
  if (shape === 'rectangle') {
    const width = Number(dims.width || 0)
    const height = Number(dims.height || 0)
    return {
      areaM2: mmToM(width) * mmToM(height),
      billableAreaM2: Math.max(1, mmToM(width) * mmToM(height)),
      perimeterM: 2 * (mmToM(width) + mmToM(height)),
      sides: { top: width, right: height, bottom: width, left: height },
    }
  }

  if (shape === 'trapezoid') {
    const top = Number(dims.top || 0)
    const right = Number(dims.right || 0)
    const bottom = Number(dims.bottom || 0)
    const left = Number(dims.left || 0)
    const height = Number(dims.height || 0)
    const areaM2 = 0.5 * (mmToM(top) + mmToM(bottom)) * mmToM(height)
    return {
      areaM2,
      billableAreaM2: Math.max(1, areaM2),
      perimeterM: mmToM(top + right + bottom + left),
      sides: { top, right, bottom, left },
    }
  }

  if (shape === 'triangle') {
    const a = Number(dims.a || 0)
    const b = Number(dims.b || 0)
    const c = Number(dims.c || 0)
    const s = (a + b + c) / 2
    const areaMm2 = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)))
    return {
      areaM2: areaMm2 / 1_000_000,
      billableAreaM2: Math.max(1, areaMm2 / 1_000_000),
      perimeterM: mmToM(a + b + c),
      sides: { top: b, right: c, bottom: a, left: 0 },
    }
  }

  const width = Number(dims.width || 0)
  const radius = Number(dims.height || 0)
  const areaM2 = (Math.PI * mmToM(radius) ** 2) / 2
  return {
    areaM2,
    billableAreaM2: Math.max(1, areaM2),
    perimeterM: mmToM(Math.PI * radius + width + 2 * radius),
    sides: { top: Math.PI * radius, right: radius, bottom: width, left: radius },
  }
}

export function calcSideFasteners(lengthMm, type) {
  if (!lengthMm || type === 'none') {
    return { type, count: 0, stepMm: 0, pointsMm: [] }
  }

  const edgeOffset = 25
  const usable = Math.max(0, lengthMm - edgeOffset * 2)

  if (type === 'grommets') {
    const targetStep = 225
    const intervals = Math.max(1, Math.round(usable / targetStep))
    const stepMm = usable / intervals
    const pointsMm = Array.from({ length: intervals + 1 }, (_, i) => edgeOffset + i * stepMm)
    return { type, count: pointsMm.length, stepMm, pointsMm, edgeOffsetMm: edgeOffset }
  }

  const targetStep = 425
  const innerCount = Math.max(0, Math.floor(usable / targetStep))
  const innerStep = innerCount > 0 ? usable / (innerCount + 1) : 0
  const pointsMm = [edgeOffset]
  for (let i = 1; i <= innerCount; i += 1) pointsMm.push(edgeOffset + innerStep * i)
  pointsMm.push(lengthMm - edgeOffset)
  return {
    type,
    count: pointsMm.length,
    stepMm: innerStep || targetStep,
    pointsMm,
    edgeOffsetMm: edgeOffset,
    cornersAsGrommets: true,
  }
}

export function assembleMaterials(orderParams) {
  const { geometry, fastenersBySide, options, additionalMaterials = [] } = orderParams
  const materials = []

  materials.push({ ...PRICE_LIST.film_m2, quantity: Number(geometry.billableAreaM2.toFixed(2)) })
  materials.push({ ...PRICE_LIST.kant_m, quantity: Number(geometry.perimeterM.toFixed(2)) })

  let grommets = 0
  let locks = 0
  let straps = 0

  Object.values(fastenersBySide).forEach((item) => {
    if (!item?.count) return
    if (item.type === 'grommets') grommets += item.count
    if (item.type === 'locks') {
      locks += Math.max(0, item.count - 2)
      grommets += 2
    }
    if (item.type === 'straps') {
      straps += Math.max(0, item.count - 2)
      grommets += 2
    }
  })

  if (grommets > 0) materials.push({ ...PRICE_LIST.grommet, quantity: grommets })
  if (locks > 0) materials.push({ ...PRICE_LIST.lock, quantity: locks })
  if (straps > 0) materials.push({ ...PRICE_LIST.strap, quantity: straps })

  if (options.bottomWeight) materials.push({ ...PRICE_LIST.bottomWeight, quantity: 1 })
  if (options.topDrip) materials.push({ ...PRICE_LIST.topDrip, quantity: 1 })
  if (options.rollStraps && orderParams.rollStrapsCount > 0) {
    materials.push({ ...PRICE_LIST.rollHook, quantity: orderParams.rollStrapsCount })
  }

  additionalMaterials
    .filter((m) => m.name && Number(m.quantity) > 0)
    .forEach((m, idx) => {
      materials.push({
        sku: m.sku || `CUSTOM-${idx + 1}`,
        name: m.name,
        unit: m.unit || 'шт',
        unitPrice: Number(m.unitPrice || 0),
        quantity: Number(m.quantity || 0),
      })
    })

  return materials
}

export function estimateCosts(materials, laborCost = 0, markupPercent = 30) {
  const materialsCost = materials.reduce((acc, item) => acc + Number(item.quantity) * Number(item.unitPrice), 0)
  const subtotal = materialsCost + Number(laborCost || 0)
  const totalPrice = subtotal * (1 + Number(markupPercent || 0) / 100)

  return {
    materialsCost: Number(materialsCost.toFixed(2)),
    laborCost: Number(Number(laborCost || 0).toFixed(2)),
    markupPercent: Number(markupPercent || 0),
    totalPrice: Number(totalPrice.toFixed(2)),
  }
}
