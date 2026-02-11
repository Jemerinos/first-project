import { useMemo, useState } from 'react'
import TriangleInput from './components/TriangleInput'
import TrapezoidInput from './components/TrapezoidInput'
import SVGCanvas from './components/SVGCanvas'
import { computePolygonFasteners } from './lib/fasteners.v1'
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

function sideLengths(vertices) {
  const names = ['A', 'B', 'C', 'D']
  const result = {}
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i]
    const b = vertices[(i + 1) % vertices.length]
    result[names[i]] = Math.hypot(b.x - a.x, b.y - a.y)
  }
  return result
}

function buildRightTriangleByAngle(width, height, rightAngle) {
  const w = Number(width)
  const h = Number(height)
  if (!(w > 0 && h > 0)) return null

  if (rightAngle === 'B') {
    return [
      { x: -w, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: h },
    ]
  }
  if (rightAngle === 'C') {
    return [
      { x: 0, y: -h },
      { x: w, y: 0 },
      { x: 0, y: 0 },
    ]
  }
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: 0, y: h },
  ]
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
  const [manualMode, setManualMode] = useState(false)
  const [filmSeamSide, setFilmSeamSide] = useState('A')

  const [sideFasteners, setSideFasteners] = useState({ A: 'grommets', B: 'grommets', C: 'grommets', D: 'grommets' })
  const [sideKant, setSideKant] = useState({ A: 50, B: 50, C: 50, D: 50 })
  const [manualPlacements, setManualPlacements] = useState({})
  const [laborCost, setLaborCost] = useState(0)
  const [markupPercent, setMarkupPercent] = useState(30)
  const [calcResult, setCalcResult] = useState(null)

  const selectedFilm = FILM_OPTIONS.find((f) => f.id === filmType) || FILM_OPTIONS[0]
  const selectedKantColor = KANT_COLOR_OPTIONS.find((c) => c.id === kantColorId) || KANT_COLOR_OPTIONS[0]

  const geometryResult = useMemo(() => {
    if (shape === 'triangle') {
      if (triangleMode === 'catheti') {
        const baseResult = computeRightTriangleFromCatheti(triangleCatheti.width, triangleCatheti.height)
        if (!baseResult.valid) return baseResult
        const oriented = buildRightTriangleByAngle(triangleCatheti.width, triangleCatheti.height, triangleRightAngle)
        return oriented ? { ...baseResult, vertices: oriented } : baseResult
      }
      return computeTriangleFromSides(triangleSides.a, triangleSides.b, triangleSides.c)
    }
    if (shape === 'trapezoid') return computeTrapezoid(trapezoid.baseA, trapezoid.baseB, trapezoid.left, trapezoid.right, trapezoidFlags)
    return geometryFromRectangle(Number(rect.width), Number(rect.height))
  }, [shape, triangleMode, triangleSides, triangleCatheti, triangleRightAngle, trapezoid, trapezoidFlags, rect])


  const overallSize = useMemo(() => {
    if (!geometryResult.valid || !geometryResult.vertices?.length) return { width: 0, height: 0, needsSeam: false }
    const xs = geometryResult.vertices.map((v) => v.x)
    const ys = geometryResult.vertices.map((v) => v.y)
    const width = Math.max(...xs) - Math.min(...xs)
    const height = Math.max(...ys) - Math.min(...ys)
    return { width, height, needsSeam: width > 2600 || height > 2600 }
  }, [geometryResult])

  const hooksCount = useMemo(() => {
    if (!hooksEnabled || !geometryResult.valid) return 0
    const xs = geometryResult.vertices.map((v) => v.x)
    const width = Math.max(...xs) - Math.min(...xs)
    const usableBetweenEdgeHooks = Math.max(0, width - 400)
    return 2 + Math.floor(usableBetweenEdgeHooks / 1500)
  }, [hooksEnabled, geometryResult])

  const rawFasteners = useMemo(() => {
    if (!geometryResult.valid) return []
    const sideConfig = {}
    for (let i = 0; i < geometryResult.vertices.length; i += 1) {
      const side = SIDE_NAMES[i]
      sideConfig[side] = {
        type: sideFasteners[side] || 'none',
        cantaWidth_mm: Number(sideKant[side] || 50),
      }
    }
    return computePolygonFasteners(geometryResult.vertices, sideConfig, {
      cornerOffset_mm: 25,
      sideNames: SIDE_NAMES,
    })
  }, [geometryResult, sideFasteners, sideKant])

  const fasteners = useMemo(() => {
    if (!manualMode) return rawFasteners
    return rawFasteners.map((side) => {
      const placements = side.placements.map((p, idx) => {
        const key = `${side.side}-${idx}`
        return manualPlacements[key]
          ? { ...p, ...manualPlacements[key], manual_adjustment: true }
          : p
      })
      return { ...side, placements }
    })
  }, [manualMode, rawFasteners, manualPlacements])

  function handleManualPlacementChange(side, index, field, value) {
    const key = `${side}-${index}`
    setManualPlacements((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: Number(value || 0),
      },
    }))
  }

  function handleCalculate() {
    if (!geometryResult.valid) return

    const billableAreaM2 = Math.max(1, geometryResult.area_mm2 / 1_000_000)

    const materials = assembleMaterials({
      areaM2: billableAreaM2,
      perimeterM: geometryResult.perimeter_mm / 1000,
      fasteners,
      options: { bottomWeight: false, topDrip: false, rollStraps: hooksEnabled },
      kantSizeMm: 50,
      rollStrapsCount: hooksCount,
    })

    const cost = estimateCosts({ materials, laborCost, markupPercent })
    setCalcResult({ specification: materials, cost })
  }

  function exportJson() {
    if (!geometryResult.valid) return
    const payload = {
      rulesVersion: RULES_VERSION,
      shape,
      geometry: {
        shapeType: shape,
        vertices: geometryResult.vertices,
        sides: sideLengths(geometryResult.vertices),
        area_mm2: geometryResult.area_mm2,
        perimeter_mm: geometryResult.perimeter_mm,
      },
      colors: {
        film: selectedFilm,
        kant: selectedKantColor,
      },
      hooks: { enabled: hooksEnabled, count: hooksCount },
      filmSeam: overallSize.needsSeam ? { enabled: true, side: filmSeamSide, rollLimit_mm: 2600 } : { enabled: false, rollLimit_mm: 2600 },
      sideKant,
      fasteners,
      manual_adjustment: manualMode,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `заказ_${shape}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 text-slate-900">
      <h1 className="text-2xl font-bold">Калькулятор мягких окон</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">Геометрия изделия</h2>
          <label className="block text-sm">Форма
            <select className="mt-1 w-full rounded border p-2" value={shape} onChange={(e) => setShape(e.target.value)}>
              <option value="rectangle">Прямоугольник</option>
              <option value="triangle">Треугольник</option>
              <option value="trapezoid">Трапеция</option>
            </select>
          </label>

          {shape === 'rectangle' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Ширина, мм
                <input type="number" className="mt-1 w-full rounded border p-2" value={rect.width} onChange={(e) => setRect((p) => ({ ...p, width: Number(e.target.value || 0) }))} />
              </label>
              <label className="text-sm">Высота, мм
                <input type="number" className="mt-1 w-full rounded border p-2" value={rect.height} onChange={(e) => setRect((p) => ({ ...p, height: Number(e.target.value || 0) }))} />
              </label>
            </div>
          )}

          {shape === 'triangle' && (
            <TriangleInput
              mode={triangleMode}
              onModeChange={setTriangleMode}
              sides={triangleSides}
              catheti={triangleCatheti}
              errors={{}}
              onSidesChange={(k, v) => setTriangleSides((p) => ({ ...p, [k]: v }))}
              onCathetiChange={(k, v) => setTriangleCatheti((p) => ({ ...p, [k]: v }))}
              rightAngle={triangleRightAngle}
              onRightAngleChange={setTriangleRightAngle}
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manualMode} onChange={(e) => setManualMode(e.target.checked)} />
            Редактировать люверсы вручную
          </label>


          {overallSize.needsSeam && (
            <label className="block text-sm">Сварной шов плёнки (лимит рулона 2600 мм)
              <select className="mt-1 w-full rounded border p-2" value={filmSeamSide} onChange={(e) => setFilmSeamSide(e.target.value)}>
                {SIDE_NAMES.slice(0, geometryResult.vertices?.length || 4).map((side) => (
                  <option key={side} value={side}>{`По стороне ${side}`}</option>
                ))}
              </select>
            </label>
          )}
          {!geometryResult.valid && <p className="rounded bg-rose-50 p-2 text-sm text-rose-700">Ошибка геометрии: {geometryResult.reason}</p>}
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">Крепления и кант по сторонам</h2>
          {SIDE_NAMES.slice(0, geometryResult.vertices?.length || 4).map((side) => (
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
            triangleRightAngle={shape === 'triangle' && triangleMode === 'catheti' ? triangleRightAngle : undefined}
            filmColor={selectedFilm.color}
            kantColor={selectedKantColor.color}
            sideKant={sideKant}
            hooksEnabled={hooksEnabled}
            hooksCount={hooksCount}
            seamSide={overallSize.needsSeam ? filmSeamSide : undefined}
          />
          {geometryResult.valid && <p className="text-sm">Площадь изделия: {(Math.max(1, geometryResult.area_mm2 / 1_000_000)).toFixed(3)} м², Периметр: {(geometryResult.perimeter_mm / 1000).toFixed(3)} м</p>}

          <h3 className="pt-2 font-semibold">Расход фурнитуры</h3>
          <table className="w-full border text-sm">
            <thead className="bg-slate-100"><tr><th className="border p-1">Сторона</th><th className="border p-1">Тип</th><th className="border p-1">Кол-во</th><th className="border p-1">Шаг, мм</th><th className="border p-1">Примечание</th></tr></thead>
            <tbody>
              {fasteners.length === 0 ? <tr><td className="border p-1 text-center" colSpan="5">Крепления не выбраны</td></tr> : fasteners.map((item) => (
                <tr key={`${item.side}-${item.type}`}><td className="border p-1">{item.side}</td><td className="border p-1">{FASTENER_OPTIONS[item.type]}</td><td className="border p-1">{item.count}</td><td className="border p-1">{item.step_mm}</td><td className="border p-1">{item.forced_step ? 'Принудительный шаг' : item.overlap_warning ? 'Плотный угол' : ''}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {manualMode && fasteners.length > 0 && (
        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="text-lg font-semibold">Координаты люверсов (мм)</h2>
          <div className="space-y-3">
            {fasteners.map((side) => (
              <div key={`manual-${side.side}`}>
                <p className="mb-1 text-sm font-semibold">Сторона {side.side} — {FASTENER_OPTIONS[side.type]}</p>
                <table className="w-full border text-xs">
                  <thead className="bg-slate-100"><tr><th className="border p-1">#</th><th className="border p-1">Угол</th><th className="border p-1">dist, мм</th><th className="border p-1">x, мм</th><th className="border p-1">y, мм</th></tr></thead>
                  <tbody>
                    {side.placements.map((p, idx) => (
                      <tr key={`${side.side}-${idx}`}>
                        <td className="border p-1">{idx + 1}</td>
                        <td className="border p-1">{p.isCorner ? 'Да' : 'Нет'}</td>
                        <td className="border p-1">{p.distFromStart_mm}</td>
                        <td className="border p-1"><input className="w-24 rounded border p-1" type="number" value={manualPlacements[`${side.side}-${idx}`]?.x_mm ?? p.x_mm} onChange={(e) => handleManualPlacementChange(side.side, idx, 'x_mm', e.target.value)} /></td>
                        <td className="border p-1"><input className="w-24 rounded border p-1" type="number" value={manualPlacements[`${side.side}-${idx}`]?.y_mm ?? p.y_mm} onChange={(e) => handleManualPlacementChange(side.side, idx, 'y_mm', e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

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
