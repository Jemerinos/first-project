import { useMemo, useRef, useState } from 'react'
import { RULES_VERSION, calcAreaAndPerimeter, calcSideFasteners } from './lib/calculator.rules.v1'
import { calculateOrder, createOrderDraft, getOrder } from './mockApi/ordersApi'

const KANT_OPTIONS = [50, 60, 70, 90, 100, 150]
const FASTENER_TYPES = ['none', 'grommets', 'locks', 'straps']
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
const FILM_TYPES = [
  { id: 'transparent', label: 'Прозрачная', color: '#dbeafe', opacity: 0.35 },
  { id: 'tinted', label: 'Тонировка', color: '#64748b', opacity: 0.55 },
]
const SIDE_LABELS = { top: 'Верх', right: 'Правая', bottom: 'Низ', left: 'Левая' }
const SHAPE_FIELDS = {
  rectangle: ['width', 'height'],
  trapezoid: ['top', 'right', 'bottom', 'left', 'height'],
  arch: ['width', 'height'],
}
const TRIANGLE_RIGHT_ANGLES = [
  { id: 'A', label: 'Угол A' },
  { id: 'B', label: 'Угол B' },
  { id: 'C', label: 'Угол C' },
]

const initialSideSettings = Object.fromEntries(
  Object.keys(SIDE_LABELS).map((side) => [side, { kant: 50, fastener: 'grommets' }]),
)

function Drawing({ shape, geometry, filmStyle, kantColor, fastenersBySide, triangleRightAngle }) {
  const width = 460
  const height = 360
  const padding = 40

  const points = useMemo(() => {
    if (shape === 'rectangle') {
      return [
        { x: 0, y: 0 },
        { x: geometry.sides.top, y: 0 },
        { x: geometry.sides.top, y: geometry.sides.left },
        { x: 0, y: geometry.sides.left },
      ]
    }
    if (shape === 'trapezoid') {
      const top = geometry.sides.top
      const bottom = geometry.sides.bottom
      const h = Number(geometry.dims?.height || 0)
      const offset = Math.max(0, (bottom - top) / 2)
      return [
        { x: offset, y: 0 },
        { x: offset + top, y: 0 },
        { x: bottom, y: h },
        { x: 0, y: h },
      ]
    }
    if (shape === 'triangle') {
      const a = Number(geometry.dims?.a || 0)
      const b = Number(geometry.dims?.b || 0)
      const c = Number(geometry.dims?.c || 0)
      const x = (a ** 2 + c ** 2 - b ** 2) / (2 * a || 1)
      const y = Math.sqrt(Math.max(0, c ** 2 - x ** 2))
      return [
        { x: 0, y },
        { x: a, y },
        { x, y: 0 },
      ]
    }

    const r = Number(geometry.dims?.height || 0)
    const w = Number(geometry.dims?.width || 0)
    return [
      { x: 0, y: r },
      { x: w, y: r },
      { x: w, y: r },
      { x: 0, y: r },
    ]
  }, [geometry, shape])

  const maxX = Math.max(...points.map((p) => p.x), 1)
  const maxY = Math.max(...points.map((p) => p.y), 1)
  const scale = Math.min((width - padding * 2) / maxX, (height - padding * 2) / maxY)
  const tx = (x) => padding + x * scale
  const ty = (y) => padding + y * scale

  const segments = shape === 'triangle'
    ? { top: [points[2], points[0]], right: [points[1], points[2]], bottom: [points[0], points[1]] }
    : { top: [points[0], points[1]], right: [points[1], points[2]], bottom: [points[3], points[2]], left: [points[0], points[3]] }

  const rightAngleMap = { A: points[0], B: points[1], C: points[2] }
  const rightPoint = shape === 'triangle' ? rightAngleMap[triangleRightAngle] : null

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-lg bg-slate-50">
      {shape === 'arch' ? (
        <>
          <path d={`M ${tx(0)} ${ty(geometry.sides.left)} A ${geometry.sides.left * scale} ${geometry.sides.left * scale} 0 0 1 ${tx(geometry.sides.bottom)} ${ty(geometry.sides.left)}`} fill="none" stroke={kantColor} strokeWidth="3" />
          <line x1={tx(0)} y1={ty(geometry.sides.left)} x2={tx(geometry.sides.bottom)} y2={ty(geometry.sides.left)} stroke={kantColor} strokeWidth="3" />
          <path d={`M ${tx(0)} ${ty(geometry.sides.left)} A ${geometry.sides.left * scale} ${geometry.sides.left * scale} 0 0 1 ${tx(geometry.sides.bottom)} ${ty(geometry.sides.left)} L ${tx(geometry.sides.bottom)} ${ty(geometry.sides.left)} L ${tx(0)} ${ty(geometry.sides.left)} Z`} fill={filmStyle.color} opacity={filmStyle.opacity} />
        </>
      ) : (
        <polygon points={points.map((p) => `${tx(p.x)},${ty(p.y)}`).join(' ')} fill={filmStyle.color} fillOpacity={filmStyle.opacity} stroke={kantColor} strokeWidth="3" />
      )}

      {rightPoint && <rect x={tx(rightPoint.x) + 5} y={ty(rightPoint.y) + 5} width="10" height="10" fill="none" stroke="#0f172a" strokeWidth="1.5" />}

      {Object.entries(segments).map(([side, [a, b]]) => {
        const current = fastenersBySide[side]
        if (!current?.pointsMm?.length) return null
        const len = geometry.sides[side]
        return current.pointsMm.map((p, idx) => {
          const t = p / len
          const x = tx(a.x + (b.x - a.x) * t)
          const y = ty(a.y + (b.y - a.y) * t)
          const effective = idx === 0 || idx === current.pointsMm.length - 1 ? 'grommets' : current.type
          if (effective === 'grommets') return <circle key={`${side}-${idx}`} cx={x} cy={y} r="3.8" fill="#0284c7" />
          if (effective === 'locks') return <rect key={`${side}-${idx}`} x={x - 4} y={y - 4} width="8" height="8" fill="#ea580c" />
          return <polygon key={`${side}-${idx}`} points={`${x},${y - 5} ${x + 5},${y + 5} ${x - 5},${y + 5}`} fill="#16a34a" />
        })
      })}
    </svg>
  )
}

export default function App() {
  const [shape, setShape] = useState('rectangle')
  const [dims, setDims] = useState({
    width: 2000,
    height: 1500,
    top: 1800,
    right: 1400,
    bottom: 2200,
    left: 1400,
    a: 2000,
    b: 1700,
    c: 1700,
    cathetusWidth: 1200,
    cathetusHeight: 900,
  })
  const [triangleInputMode, setTriangleInputMode] = useState('sides')
  const [triangleRightAngle, setTriangleRightAngle] = useState('C')
  const [corners, setCorners] = useState({ topLeft: true, topRight: true, bottomRight: true, bottomLeft: true })
  const [sideSettings, setSideSettings] = useState(initialSideSettings)
  const [filmType, setFilmType] = useState('transparent')
  const [kantColorId, setKantColorId] = useState('brown-gloss')
  const [options, setOptions] = useState({ bottomWeight: false, topDrip: false, rollStraps: false })
  const [createdBy, setCreatedBy] = useState('Менеджер')
  const [notes, setNotes] = useState('')
  const [additionalMaterials, setAdditionalMaterials] = useState([{ sku: '', name: '', quantity: 0, unit: 'шт', unitPrice: 0 }])
  const [laborCost, setLaborCost] = useState(0)
  const [markupPercent, setMarkupPercent] = useState(30)
  const [calculation, setCalculation] = useState(null)
  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(false)

  const productionRef = useRef(null)

  const selectedFilm = FILM_TYPES.find((f) => f.id === filmType) || FILM_TYPES[0]
  const selectedKantColor = KANT_COLOR_OPTIONS.find((k) => k.id === kantColorId) || KANT_COLOR_OPTIONS[0]

  const effectiveDims = useMemo(() => {
    if (shape !== 'triangle' || triangleInputMode !== 'catheti') return dims
    const w = Number(dims.cathetusWidth || 0)
    const h = Number(dims.cathetusHeight || 0)
    const hyp = Math.sqrt(w ** 2 + h ** 2)
    return { ...dims, a: w, b: h, c: hyp }
  }, [shape, triangleInputMode, dims])

  const geometry = useMemo(() => ({ ...calcAreaAndPerimeter(shape, effectiveDims), dims: effectiveDims }), [shape, effectiveDims])

  const fastenersBySide = useMemo(
    () => Object.fromEntries(Object.entries(geometry.sides).map(([side, length]) => [side, calcSideFasteners(length, sideSettings[side]?.fastener || 'none')])),
    [geometry.sides, sideSettings],
  )

  const rollStrapsCount = useMemo(() => {
    if (!options.rollStraps) return 0
    const widthMm = shape === 'trapezoid' ? Number(effectiveDims.bottom || 0) : Number(effectiveDims.width || effectiveDims.a || 0)
    return Math.ceil(widthMm / 1500) * 2
  }, [options.rollStraps, shape, effectiveDims])

  const validationErrors = useMemo(() => {
    if (shape === 'triangle') {
      if (triangleInputMode === 'catheti') {
        return ['cathetusWidth', 'cathetusHeight'].filter((key) => Number(dims[key] || 0) <= 0)
      }
      return ['a', 'b', 'c'].filter((key) => Number(dims[key] || 0) <= 0)
    }
    return SHAPE_FIELDS[shape].filter((key) => Number(dims[key] || 0) <= 0)
  }, [shape, dims, triangleInputMode])

  const areaWarning = geometry.areaM2 < 1

  const buildOrderPayload = () => ({
    order_id: orderId || `SW-${Date.now()}`,
    created_by: createdBy,
    created_at: new Date().toISOString(),
    rules_version: RULES_VERSION,
    shape,
    dims: effectiveDims,
    corners: { ...corners, triangleRightAngle, triangleInputMode },
    sideSettings,
    colors: {
      film: { id: selectedFilm.id, label: selectedFilm.label },
      kant: selectedKantColor,
    },
    options,
    rollStrapsCount,
    additionalMaterials,
    labor_cost: Number(laborCost || 0),
    markup_percent: Number(markupPercent || 0),
    notes,
  })

  const calculateSpecificationAndPrice = async () => {
    if (validationErrors.length > 0) return
    const payload = buildOrderPayload()
    setLoading(true)
    try {
      const draft = await createOrderDraft(payload)
      setOrderId(draft.order_id)
      const calculated = await calculateOrder(draft.order_id, payload)
      setCalculation(calculated)
    } finally {
      setLoading(false)
    }
  }

  const generateProductionSheet = async () => {
    if (!calculation) return
    const element = productionRef.current
    if (!element) return
    try {
      const html2canvasLib = 'html2canvas'
      const jsPdfLib = 'jspdf'
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import(/* @vite-ignore */ html2canvasLib),
        import(/* @vite-ignore */ jsPdfLib),
      ])
      const canvas = await html2canvas(element)
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = 190
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(img, 'PNG', 10, 10, pdfWidth, pdfHeight)
      pdf.save(`карта-производства-${orderId || 'черновик'}.pdf`)
    } catch {
      const html = `<html><head><meta charset="utf-8"><title>Карта производства</title></head><body>${element.innerHTML}</body></html>`
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `карта-производства-${orderId || 'черновик'}.html`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const generateWriteOffForm = () => {
    if (!calculation) return
    const html = `<html><head><meta charset="utf-8"><title>Форма списания</title></head><body>
      <h2>Форма списания: ${calculation.order_id}</h2>
      <table border="1" cellspacing="0" cellpadding="6">
      <tr><th>SKU</th><th>Наименование</th><th>Кол-во</th><th>Ед.</th><th>Склад</th><th>Подпись менеджера</th></tr>
      ${calculation.materials.map((m) => `<tr><td>${m.sku}</td><td>${m.name}</td><td>${m.quantity}</td><td>${m.unit}</td><td>Склад №1</td><td></td></tr>`).join('')}
      </table></body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `форма-списания-${orderId || 'черновик'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadJson = async () => {
    const source = orderId ? await getOrder(orderId) : null
    const data = source || {
      ...buildOrderPayload(),
      attachments: fastenersBySide,
      materials: calculation?.materials || [],
      specification: calculation?.specification || [],
      cost: calculation?.cost || null,
    }
    const exportData = {
      order_id: data.order_id,
      created_by: data.created_by,
      created_at: data.created_at,
      rules_version: data.rules_version,
      shape: data.shape,
      dims: data.dims,
      corners: data.corners,
      attachments: data.attachments,
      materials: data.materials,
      specification: data.specification,
      cost: data.cost,
      production_sheet: { generated: Boolean(calculation), fasteners_layout: data.attachments },
      writeoff: { generated: Boolean(calculation), items: data.materials },
      notes: data.notes,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `заказ-${orderId || 'черновик'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Калькулятор «Мягкие окна»</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <label className="block text-sm">Форма изделия
            <select className="mt-1 w-full rounded border p-2" value={shape} onChange={(e) => setShape(e.target.value)}>
              <option value="rectangle">Прямоугольник</option>
              <option value="trapezoid">Трапеция</option>
              <option value="arch">Арка (полукруг)</option>
              <option value="triangle">Треугольник</option>
            </select>
          </label>

          {shape !== 'triangle' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {SHAPE_FIELDS[shape].map((field) => (
                <label key={field} className="text-sm">
                  {field} (мм)
                  <input type="number" min="1" className={`mt-1 w-full rounded border p-2 ${validationErrors.includes(field) ? 'border-rose-500' : ''}`} value={dims[field]} onChange={(e) => setDims((p) => ({ ...p, [field]: Number(e.target.value || 0) }))} />
                </label>
              ))}
            </div>
          )}

          {shape === 'triangle' && (
            <div className="space-y-2">
              <label className="block text-sm">Выбор прямого угла
                <select className="mt-1 w-full rounded border p-2" value={triangleRightAngle} onChange={(e) => setTriangleRightAngle(e.target.value)}>
                  {TRIANGLE_RIGHT_ANGLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="block text-sm">Способ ввода треугольника
                <select className="mt-1 w-full rounded border p-2" value={triangleInputMode} onChange={(e) => setTriangleInputMode(e.target.value)}>
                  <option value="sides">По трём сторонам</option>
                  <option value="catheti">По катетам (ширина и высота)</option>
                </select>
              </label>

              {triangleInputMode === 'sides' ? (
                <div className="grid grid-cols-3 gap-2">
                  {['a', 'b', 'c'].map((field) => (
                    <label key={field} className="text-sm">
                      {`Сторона ${field.toUpperCase()} (мм)`}
                      <input type="number" min="1" className={`mt-1 w-full rounded border p-2 ${validationErrors.includes(field) ? 'border-rose-500' : ''}`} value={dims[field]} onChange={(e) => setDims((p) => ({ ...p, [field]: Number(e.target.value || 0) }))} />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">Ширина катета (мм)
                    <input type="number" min="1" className={`mt-1 w-full rounded border p-2 ${validationErrors.includes('cathetusWidth') ? 'border-rose-500' : ''}`} value={dims.cathetusWidth} onChange={(e) => setDims((p) => ({ ...p, cathetusWidth: Number(e.target.value || 0) }))} />
                  </label>
                  <label className="text-sm">Высота катета (мм)
                    <input type="number" min="1" className={`mt-1 w-full rounded border p-2 ${validationErrors.includes('cathetusHeight') ? 'border-rose-500' : ''}`} value={dims.cathetusHeight} onChange={(e) => setDims((p) => ({ ...p, cathetusHeight: Number(e.target.value || 0) }))} />
                  </label>
                  <p className="col-span-2 rounded bg-slate-100 p-2 text-sm">Гипотенуза рассчитывается автоматически: <strong>{Number(effectiveDims.c || 0).toFixed(2)} мм</strong></p>
                </div>
              )}
            </div>
          )}

          {!!validationErrors.length && <p className="text-sm text-rose-600">Заполните корректно размеры: {validationErrors.join(', ')}</p>}
          {areaWarning && <p className="text-sm text-amber-600">Площадь менее 1 м² — в расчёте применяется минимум 1 м².</p>}

          <label className="block text-sm">Тип плёнки
            <select className="mt-1 w-full rounded border p-2" value={filmType} onChange={(e) => setFilmType(e.target.value)}>
              {FILM_TYPES.map((film) => <option key={film.id} value={film.id}>{film.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Цвет канта
            <select className="mt-1 w-full rounded border p-2" value={kantColorId} onChange={(e) => setKantColorId(e.target.value)}>
              {KANT_COLOR_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Менеджер
            <input className="mt-1 w-full rounded border p-2" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
          </label>
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">Кант и крепления</h2>
          {Object.entries(SIDE_LABELS).map(([side, label]) => (
            <div key={side} className="rounded border p-2">
              <p className="text-sm font-medium">{label}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select className="rounded border p-1 text-sm" value={sideSettings[side].kant} onChange={(e) => setSideSettings((p) => ({ ...p, [side]: { ...p[side], kant: Number(e.target.value) } }))}>
                  {KANT_OPTIONS.map((k) => <option key={k} value={k}>{`Кант ${k} мм`}</option>)}
                </select>
                <select className="rounded border p-1 text-sm" value={sideSettings[side].fastener} onChange={(e) => setSideSettings((p) => ({ ...p, [side]: { ...p[side], fastener: e.target.value } }))}>
                  {FASTENER_TYPES.map((t) => <option key={t} value={t}>{{ none: 'Без креплений', grommets: 'Люверсы', locks: 'Замки', straps: 'Ремни' }[t]}</option>)}
                </select>
              </div>
            </div>
          ))}

          <div className="space-y-1 text-sm">
            <label className="flex gap-2"><input type="checkbox" checked={options.bottomWeight} onChange={(e) => setOptions((p) => ({ ...p, bottomWeight: e.target.checked }))} />Отвес снизу</label>
            <label className="flex gap-2"><input type="checkbox" checked={options.topDrip} onChange={(e) => setOptions((p) => ({ ...p, topDrip: e.target.checked }))} />Отлив сверху</label>
            <label className="flex gap-2"><input type="checkbox" checked={options.rollStraps} onChange={(e) => setOptions((p) => ({ ...p, rollStraps: e.target.checked }))} />Ремни фиксации (в скрутке)</label>
          </div>

          <h3 className="font-semibold">Дополнительные материалы</h3>
          {additionalMaterials.map((item, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-1 text-xs">
              <input className="rounded border p-1" placeholder="SKU" value={item.sku} onChange={(e) => setAdditionalMaterials((p) => p.map((v, i) => i === idx ? { ...v, sku: e.target.value } : v))} />
              <input className="rounded border p-1" placeholder="Наименование" value={item.name} onChange={(e) => setAdditionalMaterials((p) => p.map((v, i) => i === idx ? { ...v, name: e.target.value } : v))} />
              <input type="number" className="rounded border p-1" placeholder="Кол-во" value={item.quantity} onChange={(e) => setAdditionalMaterials((p) => p.map((v, i) => i === idx ? { ...v, quantity: Number(e.target.value || 0) } : v))} />
              <input type="number" className="rounded border p-1" placeholder="Цена" value={item.unitPrice} onChange={(e) => setAdditionalMaterials((p) => p.map((v, i) => i === idx ? { ...v, unitPrice: Number(e.target.value || 0) } : v))} />
            </div>
          ))}
          <button className="rounded bg-slate-200 px-2 py-1 text-sm" onClick={() => setAdditionalMaterials((p) => [...p, { sku: '', name: '', quantity: 0, unit: 'шт', unitPrice: 0 }])}>+ Добавить материал</button>
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">Чертёж и стоимость</h2>
          <Drawing shape={shape} geometry={geometry} filmStyle={selectedFilm} kantColor={selectedKantColor.color} fastenersBySide={fastenersBySide} triangleRightAngle={triangleRightAngle} />
          <p className="text-sm">Площадь: <strong>{geometry.billableAreaM2.toFixed(2)} м²</strong> | Периметр: <strong>{geometry.perimeterM.toFixed(2)} м</strong></p>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <label>Стоимость материалов
              <input className="mt-1 w-full rounded border bg-slate-100 p-2" value={calculation?.cost?.materialsCost ?? 0} readOnly />
            </label>
            <label>Стоимость работ
              <input type="number" className="mt-1 w-full rounded border p-2" value={laborCost} onChange={(e) => setLaborCost(Number(e.target.value || 0))} />
            </label>
            <label>Наценка, %
              <input type="number" className="mt-1 w-full rounded border p-2" value={markupPercent} onChange={(e) => setMarkupPercent(Number(e.target.value || 0))} />
            </label>
            <label>Итоговая цена для клиента
              <input className="mt-1 w-full rounded border bg-slate-100 p-2" value={calculation?.cost?.totalPrice ?? 0} readOnly />
            </label>
          </div>

          <label className="block text-sm">Примечание
            <textarea className="mt-1 w-full rounded border p-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="grid gap-2">
            <button className="rounded bg-slate-900 p-2 text-white" onClick={calculateSpecificationAndPrice} disabled={loading}>{loading ? 'Выполняется расчёт...' : 'Рассчитать спецификацию и цену'}</button>
            <button className="rounded bg-indigo-700 p-2 text-white disabled:opacity-50" onClick={generateProductionSheet} disabled={!calculation}>Сформировать карту производства</button>
            <button className="rounded bg-emerald-700 p-2 text-white disabled:opacity-50" onClick={generateWriteOffForm} disabled={!calculation}>Сформировать форму списания</button>
            <button className="rounded bg-slate-700 p-2 text-white" onClick={downloadJson}>Скачать JSON</button>
          </div>
        </section>
      </div>

      {calculation && (
        <section ref={productionRef} className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="text-xl font-semibold">Карта производства</h2>
          <p>Заказ: {calculation.order_id} | Дата: {new Date(calculation.created_at).toLocaleString()}</p>
          <Drawing shape={shape} geometry={geometry} filmStyle={selectedFilm} kantColor={selectedKantColor.color} fastenersBySide={calculation.attachments} triangleRightAngle={triangleRightAngle} />
          <table className="w-full border text-sm">
            <thead className="bg-slate-100"><tr><th className="border p-1">Сторона</th><th className="border p-1">Тип</th><th className="border p-1">Кол-во</th><th className="border p-1">Шаг, мм</th></tr></thead>
            <tbody>
              {Object.entries(calculation.attachments).map(([side, item]) => (
                <tr key={side}><td className="border p-1">{SIDE_LABELS[side]}</td><td className="border p-1">{item.type}</td><td className="border p-1">{item.count}</td><td className="border p-1">{Number(item.stepMm || 0).toFixed(1)}</td></tr>
              ))}
            </tbody>
          </table>
          <h3 className="font-semibold">Спецификация</h3>
          <table className="w-full border text-sm">
            <thead className="bg-slate-100"><tr><th className="border p-1">SKU</th><th className="border p-1">Наименование</th><th className="border p-1">Кол-во</th><th className="border p-1">Цена</th><th className="border p-1">Сумма</th></tr></thead>
            <tbody>
              {calculation.specification.map((line) => (
                <tr key={`${line.sku}-${line.name}`}><td className="border p-1">{line.sku}</td><td className="border p-1">{line.name}</td><td className="border p-1">{line.quantity}</td><td className="border p-1">{line.unitPrice}</td><td className="border p-1">{line.lineTotal}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm">Примечание: {notes || '—'}</p>
        </section>
      )}
    </main>
  )
}
