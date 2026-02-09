import {
  RULES_VERSION,
  assembleMaterials,
  calcAreaAndPerimeter,
  calcSideFasteners,
  estimateCosts,
} from '../lib/calculator.rules.v1'

const db = new Map()

const sleep = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

export async function createOrderDraft(payload) {
  await sleep()
  const id = payload.order_id || `SW-${Date.now()}`
  const order = {
    ...payload,
    order_id: id,
    created_at: payload.created_at || new Date().toISOString(),
  }
  db.set(id, order)
  return order
}

export async function calculateOrder(orderId, payload) {
  await sleep()
  const geometry = calcAreaAndPerimeter(payload.shape, payload.dims)
  const attachments = Object.fromEntries(
    Object.entries(geometry.sides).map(([side, lengthMm]) => {
      const type = payload.sideSettings?.[side]?.fastener || 'none'
      return [side, calcSideFasteners(lengthMm, type)]
    }),
  )

  const materials = assembleMaterials({
    geometry,
    fastenersBySide: attachments,
    options: payload.options,
    additionalMaterials: payload.additionalMaterials,
    rollStrapsCount: payload.rollStrapsCount,
  })
  const cost = estimateCosts(materials, payload.labor_cost, payload.markup_percent)
  const specification = materials.map((item) => ({
    ...item,
    lineTotal: Number((item.quantity * item.unitPrice).toFixed(2)),
  }))

  const calculated = {
    ...payload,
    order_id: orderId,
    rules_version: RULES_VERSION,
    metrics: geometry,
    attachments,
    materials,
    specification,
    cost,
  }
  db.set(orderId, calculated)
  return calculated
}

export async function getOrder(orderId) {
  await sleep(100)
  return db.get(orderId) || null
}
