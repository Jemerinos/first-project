import { useMemo, useState } from 'react'
import TriangleInput from './components/TriangleInput'
import TrapezoidInput from './components/TrapezoidInput'
import SVGCanvas from './components/SVGCanvas'
import { computeFastenersOnSegment } from './lib/fasteners.v1'
import {
  computeTriangleFromBaseHeight,
  computeTriangleFromSides,
  computeTrapezoid,
} from './lib/geometry.v1'
import { assembleMaterials, estimateCosts, RULES_VERSION } from './lib/calculator.rules.v1'

const SIDE_NAMES = ['A', 'B', 'C', 'D']
const FASTENER_TYPES = ['none', 'grommets', 'locks', 'straps']

function geometryFromRectangle(width, height) {
  if (width <= 0 || height <= 0) return { valid: false, reason: 'Ширина и высота должны быть больше 0.' }
  return {
    valid: true,
    vertices: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    area_mm2: width * height,
    perimeter_mm: 2 * (width + height),
    shapeType: 'rectangle',
  }
}

export default function App() {
  const [shape, setShape] = useState('rectangle')
  const [rect, setRect] = useState({ width: 2000, height: 1500 })
  const [triangleMode, setTriangleMode] = useState('sides')
  const [triangleSides, setTriangleSides] = useState({ a: 3000, b: 4000, c: 5000 })
  const [triangleBaseHeight, setTriangleBaseHeight] = useState({ base: 3000, height: 2000 })
  const [trapezoid, setTrapezoid] = useState({ baseA: 2000, baseB: 2600, left: 1500, right: 1700 })
  const [trapezoidFlags, setTrapezoidFlags] = useState({ topLeft: false, topRight: false, bottomRight: false, bottomLeft: false })

  const [sideFasteners, setSideFasteners] = useState({ A: 'grommets', B: 'grommets', C: 'grommets', D: 'grommets' })
  const [laborCost, setLaborCost] = useState(0)
  const [markupPercent, setMarkupPercent] = useState(30)
  const [calcResult, setCalcResult] = useState(null)

  const geometryResult = useMemo(() => {
    if (shape === 'triangle') {
      return triangleMode === 'sides'
        ? computeTriangleFromSides(triangleSides.a, triangleSides.b, triangleSides.c)
        : computeTriangleFromBaseHeight(triangleBaseHeight.base, triangleBaseHeight.height)
    }
    if (shape === 'trapezoid') {
      return computeTrapezoid(trapezoid.baseA, trapezoid.baseB, trapezoid.left, trapezoid.right, trapezoidFlags)
    }
    return geometryFromRectangle(Number(rect.width), Number(rect.height))
  }, [shape, triangleMode, triangleSides, triangleBaseHeight, trapezoid, trapezoidFlags, rect])

  const fasteners = useMemo(() => {
    if (!geometryResult.valid) return []
    const vertices = geometryResult.vertices
    const sideCount = vertices.length

    const list = []
    for (let i = 0; i < sideCount; i += 1) {
      const side = SIDE_NAMES[i]
      const type = sideFasteners[side] || 'none'
      if (type === 'none') continue
      const start = vertices[i]
      const end = vertices[(i + 1) % sideCount]
      const segmentFasteners = computeFastenersOnSegment(start, end, type)
      list.push({ side, type, count: segmentFasteners.count, step_mm: segmentFasteners.step_mm, placements: segmentFasteners.placements })
    }
    return list
  }, [geometryResult, sideFasteners])

  const handleCalculate = () => {
    if (!geometryResult.valid) return

    const geometry = {
      billableAreaM2: Math.max(1, geometryResult.area_mm2 / 1_000_000),
      perimeterM: geometryResult.perimeter_mm / 1000,
    }

    const fastenersBySide = Object.fromEntries(
      fasteners.map((side) => [
        side.side,
        {
          type: side.type,
          count: side.count,
        },
      ]),
    )

    const materials = assembleMaterials({
      geometry,
      fastenersBySide,
      options: { bottomWeight: false, topDrip: false, rollStraps: false },
      additionalMaterials: [],
      rollStrapsCount: 0,
    })

    const specification = materials.map((m) => ({ ...m, lineTotal: Number((m.quantity * m.unitPrice).toFixed(2)) }))
    const cost = estimateCosts(materials, laborCost, markupPercent)

    setCalcResult({ specification, cost })
  }

  const exportJson = () => {
    const payload = {
      order_id: `SW-${Date.now()}`,
      created_by: 'Менеджер',
      created_at: new Date().toISOString(),
      rules_version: RULES_VERSION,
      geometry: {
        vertices: geometryResult.vertices || [],
        sides: geometryResult.sides || null,
        area_mm2: geometryResult.area_mm2 || 0,
        perimeter_mm: geometryResult.perimeter_mm || 0,
        shapeType: shape,
      },
      fasteners,
      specification: calcResult?.specification || [],
      cost: calcResult?.cost || null,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `заказ-${shape}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Калькулятор «Мягкие окна»</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <label className="block text-sm">Фигура
            <select className="mt-1 w-full rounded border p-2" value={shape} onChange={(e) => setShape(e.target.value)}>
              <option value="rectangle">Прямоугольник</option>
              <option value="triangle">Треугольник</option>
              <option value="trapezoid">Трапеция</option>
            </select>
          </label>

          {shape === 'rectangle' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Ширина (мм)
                <input type="number" className="mt-1 w-full rounded border p-2" value={rect.width} onChange={(e) => setRect((p) => ({ ...p, width: Number(e.target.value || 0) }))} />
              </label>
              <label className="text-sm">Высота (мм)
                <input type="number" className="mt-1 w-full rounded border p-2" value={rect.height} onChange={(e) => setRect((p) => ({ ...p, height: Number(e.target.value || 0) }))} />
              </label>
            </div>
          )}

          {shape === 'triangle' && (
            <TriangleInput
              mode={triangleMode}
              onModeChange={setTriangleMode}
              sides={triangleSides}
              baseHeight={triangleBaseHeight}
              errors={{}}
              onSidesChange={(k, v) => setTriangleSides((p) => ({ ...p, [k]: v }))}
              onBaseHeightChange={(k, v) => setTriangleBaseHeight((p) => ({ ...p, [k]: v }))}
            />
          )}

          {shape === 'trapezoid' && (
            <TrapezoidInput
              values={trapezoid}
              flags={trapezoidFlags}
              errors={{}}
              onValueChange={(k, v) => setTrapezoid((p) => ({ ...p, [k]: v }))}
              onFlagChange={(k, v) => setTrapezoidFlags((p) => ({ ...p, [k]: v }))}
            />
          )}

          {!geometryResult.valid && <p className="rounded bg-rose-50 p-2 text-sm text-rose-700">Ошибка геометрии: {geometryResult.reason}</p>}
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">Крепления по сторонам</h2>
          {SIDE_NAMES.map((side) => (
            <label key={side} className="block text-sm">Сторона {side}
              <select className="mt-1 w-full rounded border p-2" value={sideFasteners[side]} onChange={(e) => setSideFasteners((p) => ({ ...p, [side]: e.target.value }))}>
                {FASTENER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          ))}

          <label className="block text-sm">Стоимость работ
            <input type="number" className="mt-1 w-full rounded border p-2" value={laborCost} onChange={(e) => setLaborCost(Number(e.target.value || 0))} />
          </label>
          <label className="block text-sm">Наценка, %
            <input type="number" className="mt-1 w-full rounded border p-2" value={markupPercent} onChange={(e) => setMarkupPercent(Number(e.target.value || 0))} />
          </label>

          <div className="grid gap-2">
            <button className="rounded bg-slate-900 p-2 text-white" onClick={handleCalculate}>Рассчитать спецификацию и цену</button>
            <button className="rounded bg-slate-700 p-2 text-white" onClick={exportJson}>Скачать JSON</button>
          </div>
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">SVG-чертёж</h2>
          <SVGCanvas vertices={geometryResult.vertices || []} fasteners={fasteners} />
          {geometryResult.valid && (
            <p className="text-sm">
              Площадь: {(geometryResult.area_mm2 / 1_000_000).toFixed(3)} м², Периметр: {(geometryResult.perimeter_mm / 1000).toFixed(3)} м
            </p>
          )}
        </section>
      </div>

      {calcResult && (
        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="text-xl font-semibold">Спецификация</h2>
          <table className="w-full border text-sm">
            <thead className="bg-slate-100"><tr><th className="border p-1">SKU</th><th className="border p-1">Наименование</th><th className="border p-1">Кол-во</th><th className="border p-1">Цена</th><th className="border p-1">Сумма</th></tr></thead>
            <tbody>
              {calcResult.specification.map((line) => (
                <tr key={`${line.sku}-${line.name}`}><td className="border p-1">{line.sku}</td><td className="border p-1">{line.name}</td><td className="border p-1">{line.quantity}</td><td className="border p-1">{line.unitPrice}</td><td className="border p-1">{line.lineTotal}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm">Материалы: {calcResult.cost.materialsCost} ₽ | Работы: {calcResult.cost.laborCost} ₽ | Наценка: {calcResult.cost.markupPercent}% | <strong>Итого: {calcResult.cost.totalPrice} ₽</strong></p>
        </section>
      )}
    </main>
  )
}
