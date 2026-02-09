import { useMemo, useState } from 'react'
import TriangleInput from './components/TriangleInput'
import TrapezoidInput from './components/TrapezoidInput'
import SVGCanvas from './components/SVGCanvas'
import { computeFastenersOnSegment } from './lib/fasteners.v1'
import { computeRightTriangleFromCatheti, computeTriangleFromSides, computeTrapezoid } from './lib/geometry.v1'
import { assembleMaterials, estimateCosts, RULES_VERSION } from './lib/calculator.rules.v1'

const SIDE_NAMES = ['A', 'B', 'C', 'D']
const KANT_OPTIONS = [50, 60, 70, 90, 100, 150]
const FASTENER_OPTIONS = {
  none: 'Без креплений',
  grommets: 'Люверсы',
  locks: 'Замки',
  straps: 'Ремни',
}
const FILM_OPTIONS = [
  { id: 'transparent', label: 'Прозрачная', color: '#dbeafe' },
  { id: 'tinted', label: 'Тонировка', color: '#94a3b8' },
]
const KANT_COLOR_OPTIONS = [
  { id: 'brown-gloss', label: 'Коричневый (глянец)', color: '#5c3b1e' },
  { id: 'brown-matte', label: 'Коричневый (матовый)', color: '#6e4b32' },
  { id: 'black-gloss', label: 'Чёрный (глянец)', color: '#111111' },
  { id: 'black-matte', label: 'Чёрный (матовый)', color: '#2b2b2b' },
  { id: 'light-gray', label: 'Светло-серый', color: '#bfc4cb' },
  { id: 'dark-gray', label: 'Тёмно-серый', color: '#5f6368' },
  { id: 'white', label: 'Белый', color: '#f8fafc' },
  { id: 'beige', label: 'Бежевый', color: '#d8c3a5' },
  { id: 'red', label: 'Красный', color: '#b91c1c' },
]

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

function rotateTriangleToRightAngle(vertices, rightAngle) {
  if (!vertices || vertices.length !== 3) return vertices
  const map = { A: 0, B: 1, C: 2 }
  const rightIndex = map[rightAngle] ?? 0
  if (rightIndex === 0) return vertices
  if (rightIndex === 1) return [vertices[1], vertices[2], vertices[0]]
  return [vertices[2], vertices[0], vertices[1]]
}

export default function App() {
  const [shape, setShape] = useState('rectangle')
  const [rect, setRect] = useState({ width: 2000, height: 1500 })
  const [triangleMode, setTriangleMode] = useState('sides')
  const [triangleRightAngle, setTriangleRightAngle] = useState('A')
  const [triangleSides, setTriangleSides] = useState({ a: 3000, b: 4000, c: 5000 })
  const [triangleCatheti, setTriangleCatheti] = useState({ width: 3000, height: 4000 })
  const [trapezoid, setTrapezoid] = useState({ baseA: 2000, baseB: 2600, left: 1500, right: 1700 })
  const [trapezoidFlags, setTrapezoidFlags] = useState({ topLeft: false, topRight: false, bottomRight: false, bottomLeft: false })
  const [filmType, setFilmType] = useState(FILM_OPTIONS[0].id)
  const [kantColorId, setKantColorId] = useState(KANT_COLOR_OPTIONS[0].id)
  const [hooksEnabled, setHooksEnabled] = useState(false)

  const [sideFasteners, setSideFasteners] = useState({ A: 'grommets', B: 'grommets', C: 'grommets', D: 'grommets' })
  const [sideKant, setSideKant] = useState({ A: 50, B: 50, C: 50, D: 50 })
  const [laborCost, setLaborCost] = useState(0)
  const [markupPercent, setMarkupPercent] = useState(30)
  const [calcResult, setCalcResult] = useState(null)

  const selectedFilm = FILM_OPTIONS.find((f) => f.id === filmType) || FILM_OPTIONS[0]
  const selectedKantColor = KANT_COLOR_OPTIONS.find((c) => c.id === kantColorId) || KANT_COLOR_OPTIONS[0]

  const geometryResult = useMemo(() => {
    if (shape === 'triangle') {
      const baseResult = triangleMode === 'sides'
        ? computeTriangleFromSides(triangleSides.a, triangleSides.b, triangleSides.c)
        : computeRightTriangleFromCatheti(triangleCatheti.width, triangleCatheti.height)

      if (!baseResult.valid) return baseResult
      return { ...baseResult, vertices: rotateTriangleToRightAngle(baseResult.vertices, triangleRightAngle) }
    }
    if (shape === 'trapezoid') return computeTrapezoid(trapezoid.baseA, trapezoid.baseB, trapezoid.left, trapezoid.right, trapezoidFlags)
    return geometryFromRectangle(Number(rect.width), Number(rect.height))
  }, [shape, triangleMode, triangleSides, triangleCatheti, triangleRightAngle, trapezoid, trapezoidFlags, rect])

  const hooksCount = useMemo(() => {
    if (!hooksEnabled || !geometryResult.valid) return 0
    const xs = geometryResult.vertices.map((v) => v.x)
    const width = Math.max(...xs) - Math.min(...xs)
    return Math.max(2, Math.ceil(width / 1500) * 2)
  }, [hooksEnabled, geometryResult])

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
      list.push({ side, type, count: segmentFasteners.count, step_mm: segmentFasteners.step_mm, placements: segmentFasteners.placements, kant_mm: sideKant[side] || 50 })
    }
    return list
  }, [geometryResult, sideFasteners, sideKant])

  const handleCalculate = () => {
    if (!geometryResult.valid) return
    const geometry = { billableAreaM2: Math.max(1, geometryResult.area_mm2 / 1_000_000), perimeterM: geometryResult.perimeter_mm / 1000 }
    const fastenersBySide = Object.fromEntries(fasteners.map((side) => [side.side, { type: side.type, count: side.count }]))
    const materials = assembleMaterials({
      geometry,
      fastenersBySide,
      options: { bottomWeight: false, topDrip: false, rollStraps: hooksEnabled },
      additionalMaterials: [],
      rollStrapsCount: hooksCount,
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
      geometry: { vertices: geometryResult.vertices || [], sides: geometryResult.sides || null, area_mm2: geometryResult.area_mm2 || 0, perimeter_mm: geometryResult.perimeter_mm || 0, shapeType: shape },
      colors: { film: selectedFilm, kant: selectedKantColor },
      hooks: { enabled: hooksEnabled, count: hooksCount },
      sideKant,
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
              <label className="text-sm">Ширина (мм)<input type="number" className="mt-1 w-full rounded border p-2" value={rect.width} onChange={(e) => setRect((p) => ({ ...p, width: Number(e.target.value || 0) }))} /></label>
              <label className="text-sm">Высота (мм)<input type="number" className="mt-1 w-full rounded border p-2" value={rect.height} onChange={(e) => setRect((p) => ({ ...p, height: Number(e.target.value || 0) }))} /></label>
            </div>
          )}

          {shape === 'triangle' && (
            <TriangleInput
              mode={triangleMode}
              onModeChange={setTriangleMode}
              rightAngle={triangleRightAngle}
              onRightAngleChange={setTriangleRightAngle}
              sides={triangleSides}
              catheti={triangleCatheti}
              errors={{}}
              onSidesChange={(k, v) => setTriangleSides((p) => ({ ...p, [k]: v }))}
              onCathetiChange={(k, v) => setTriangleCatheti((p) => ({ ...p, [k]: v }))}
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

          <label className="block text-sm">Тип плёнки
            <select className="mt-1 w-full rounded border p-2" value={filmType} onChange={(e) => setFilmType(e.target.value)}>
              {FILM_OPTIONS.map((film) => <option key={film.id} value={film.id}>{film.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Цвет канта
            <select className="mt-1 w-full rounded border p-2" value={kantColorId} onChange={(e) => setKantColorId(e.target.value)}>
              {KANT_COLOR_OPTIONS.map((color) => <option key={color.id} value={color.id}>{color.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hooksEnabled} onChange={(e) => setHooksEnabled(e.target.checked)} />
            Добавить крючки
          </label>

          {!geometryResult.valid && <p className="rounded bg-rose-50 p-2 text-sm text-rose-700">Ошибка геометрии: {geometryResult.reason}</p>}
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">Крепления и кант по сторонам</h2>
          {SIDE_NAMES.map((side) => (
            <div key={side} className="grid grid-cols-2 gap-2">
              <label className="text-sm">Сторона {side}: крепление
                <select className="mt-1 w-full rounded border p-2" value={sideFasteners[side]} onChange={(e) => setSideFasteners((p) => ({ ...p, [side]: e.target.value }))}>
                  {Object.entries(FASTENER_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm">Сторона {side}: кант, мм
                <select className="mt-1 w-full rounded border p-2" value={sideKant[side]} onChange={(e) => setSideKant((p) => ({ ...p, [side]: Number(e.target.value) }))}>
                  {KANT_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
            </div>
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
          <SVGCanvas
            vertices={geometryResult.vertices || []}
            fasteners={fasteners}
            triangleRightAngle={shape === 'triangle' ? triangleRightAngle : undefined}
            filmColor={selectedFilm.color}
            kantColor={selectedKantColor.color}
          />
          {geometryResult.valid && <p className="text-sm">Площадь: {(geometryResult.area_mm2 / 1_000_000).toFixed(3)} м², Периметр: {(geometryResult.perimeter_mm / 1000).toFixed(3)} м</p>}

          <h3 className="pt-2 font-semibold">Расход фурнитуры</h3>
          <table className="w-full border text-sm">
            <thead className="bg-slate-100"><tr><th className="border p-1">Сторона</th><th className="border p-1">Тип</th><th className="border p-1">Кол-во</th><th className="border p-1">Шаг, мм</th><th className="border p-1">Кант, мм</th></tr></thead>
            <tbody>
              {fasteners.length === 0 ? <tr><td className="border p-1 text-center" colSpan="5">Крепления не выбраны</td></tr> : fasteners.map((item) => (
                <tr key={`${item.side}-${item.type}`}><td className="border p-1">{item.side}</td><td className="border p-1">{FASTENER_OPTIONS[item.type]}</td><td className="border p-1">{item.count}</td><td className="border p-1">{item.step_mm.toFixed(1)}</td><td className="border p-1">{item.kant_mm}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {calcResult && (
        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="text-xl font-semibold">Спецификация</h2>
          <table className="w-full border text-sm">
            <thead className="bg-slate-100"><tr><th className="border p-1">SKU</th><th className="border p-1">Наименование</th><th className="border p-1">Кол-во</th><th className="border p-1">Цена</th><th className="border p-1">Сумма</th></tr></thead>
            <tbody>
              {calcResult.specification.map((line) => <tr key={`${line.sku}-${line.name}`}><td className="border p-1">{line.sku}</td><td className="border p-1">{line.name}</td><td className="border p-1">{line.quantity}</td><td className="border p-1">{line.unitPrice}</td><td className="border p-1">{line.lineTotal}</td></tr>)}
            </tbody>
          </table>
          <p className="text-sm">Материалы: {calcResult.cost.materialsCost} ₽ | Работы: {calcResult.cost.laborCost} ₽ | Наценка: {calcResult.cost.markupPercent}% | <strong>Итого: {calcResult.cost.totalPrice} ₽</strong></p>
        </section>
      )}
    </main>
  )
}
