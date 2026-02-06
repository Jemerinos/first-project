import { useMemo, useState } from 'react'

const mmToM = (value) => Number(value || 0) / 1000
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
  { id: 'tinted', label: 'Тонировка', color: '#94a3b8', opacity: 0.6 },
]
const SIDE_LABELS = {
  top: 'Верх',
  right: 'Правая',
  bottom: 'Низ',
  left: 'Левая',
}
const SHAPE_FIELDS = {
  rectangle: ['width', 'height'],
  trapezoid: ['top', 'right', 'bottom', 'left', 'height'],
  triangle: ['a', 'b', 'c'],
  arch: ['width', 'height'],
}

const initialSideSettings = Object.fromEntries(
  Object.keys(SIDE_LABELS).map((side) => [side, { kant: 50, fastener: 'grommets' }]),
)

const readNum = (value) => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : 0
}

function calcSideFasteners(lengthMm, type) {
  if (type === 'none') {
    return { type, count: 0, step: 0, points: [] }
  }

  const edgeOffset = 25
  const usable = Math.max(0, lengthMm - edgeOffset * 2)

  if (type === 'grommets') {
    const step = 200
    const intervals = Math.max(1, Math.floor(usable / step))
    const count = intervals + 1
    const dynamicStep = usable / intervals
    const points = Array.from({ length: count }, (_, i) => edgeOffset + i * dynamicStep)
    return { type, count, step: dynamicStep, points }
  }

  const step = 425
  const innerCount = Math.max(0, Math.floor(usable / step))
  const count = innerCount + 2
  const innerStep = innerCount > 0 ? usable / (innerCount + 1) : 0
  const points = [edgeOffset]
  for (let i = 1; i <= innerCount; i += 1) {
    points.push(edgeOffset + innerStep * i)
  }
  points.push(lengthMm - edgeOffset)

  return {
    type,
    count,
    step: innerStep || step,
    points,
    cornersAsGrommets: true,
  }
}

function getGeometry(shape, dimensions, rightAngles) {
  if (shape === 'rectangle') {
    const width = readNum(dimensions.width)
    const height = readNum(dimensions.height)
    const points = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ]
    return {
      points,
      sides: { top: width, right: height, bottom: width, left: height },
      areaM2: mmToM(width) * mmToM(height),
      perimeterM: 2 * (mmToM(width) + mmToM(height)),
      rightAngles,
    }
  }

  if (shape === 'trapezoid') {
    const top = readNum(dimensions.top)
    const right = readNum(dimensions.right)
    const bottom = readNum(dimensions.bottom)
    const left = readNum(dimensions.left)
    const h = readNum(dimensions.height)
    const offset = Math.max(0, (bottom - top) / 2)
    const points = [
      { x: offset, y: 0 },
      { x: offset + top, y: 0 },
      { x: bottom, y: h },
      { x: 0, y: h },
    ]
    const areaM2 = 0.5 * (mmToM(top) + mmToM(bottom)) * mmToM(h)
    const perimeterM = mmToM(top + right + bottom + left)
    return {
      points,
      sides: { top, right, bottom, left },
      areaM2,
      perimeterM,
      rightAngles,
    }
  }

  if (shape === 'triangle') {
    const a = readNum(dimensions.a)
    const b = readNum(dimensions.b)
    const c = readNum(dimensions.c)
    const x = (a ** 2 + c ** 2 - b ** 2) / (2 * a || 1)
    const ySq = Math.max(0, c ** 2 - x ** 2)
    const y = Math.sqrt(ySq)
    const points = [
      { x: 0, y: y },
      { x: a, y: y },
      { x, y: 0 },
    ]
    const s = (a + b + c) / 2
    const areaMm = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)))
    return {
      points,
      sides: { top: b, right: c, bottom: a, left: 0 },
      areaM2: areaMm / 1000000,
      perimeterM: mmToM(a + b + c),
      rightAngles,
    }
  }

  const width = readNum(dimensions.width)
  const radius = readNum(dimensions.height)
  const points = [
    { x: 0, y: radius },
    { x: width, y: radius },
    { x: width, y: radius },
    { x: 0, y: radius },
  ]
  return {
    points,
    sides: {
      top: Math.PI * radius,
      right: radius,
      bottom: width,
      left: radius,
    },
    arc: { radius, width },
    areaM2: (Math.PI * mmToM(radius) ** 2) / 2,
    perimeterM: mmToM(Math.PI * radius + width + 2 * radius),
    rightAngles,
  }
}

function sideSegments(shape, geometry) {
  if (shape === 'triangle') {
    const [p0, p1, p2] = geometry.points
    return {
      bottom: [p0, p1],
      right: [p1, p2],
      top: [p2, p0],
    }
  }

  const [p0, p1, p2, p3] = geometry.points
  return {
    top: [p0, p1],
    right: [p1, p2],
    bottom: [p3, p2],
    left: [p0, p3],
  }
}

function Drawing({ shape, geometry, filmStyle, kantColor, fastenersBySide }) {
  const width = 460
  const height = 360
  const padding = 40
  const points = geometry.points
  const maxX = Math.max(...points.map((p) => p.x), 1)
  const maxY = Math.max(...points.map((p) => p.y), 1)
  const scale = Math.min((width - 2 * padding) / maxX, (height - 2 * padding) / maxY)
  const tx = (v) => padding + v * scale
  const ty = (v) => padding + v * scale

  const segments = sideSegments(shape, geometry)

  const angleMarks = Object.entries(geometry.rightAngles || {})
    .filter(([, checked]) => checked)
    .map(([corner]) => corner)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-lg bg-slate-50">
      {shape === 'arch' ? (
        <>
          <path
            d={`M ${tx(0)} ${ty(geometry.arc.radius)} A ${geometry.arc.radius * scale} ${geometry.arc.radius * scale} 0 0 1 ${tx(geometry.arc.width)} ${ty(geometry.arc.radius)}`}
            fill="none"
            stroke={kantColor}
            strokeWidth="3"
          />
          <line x1={tx(0)} y1={ty(geometry.arc.radius)} x2={tx(geometry.arc.width)} y2={ty(geometry.arc.radius)} stroke={kantColor} strokeWidth="3" />
          <path
            d={`M ${tx(0)} ${ty(geometry.arc.radius)} A ${geometry.arc.radius * scale} ${geometry.arc.radius * scale} 0 0 1 ${tx(geometry.arc.width)} ${ty(geometry.arc.radius)} L ${tx(geometry.arc.width)} ${ty(geometry.arc.radius)} L ${tx(0)} ${ty(geometry.arc.radius)} Z`}
            fill={filmStyle.color}
            opacity={filmStyle.opacity}
          />
        </>
      ) : (
        <polygon
          points={points.map((p) => `${tx(p.x)},${ty(p.y)}`).join(' ')}
          fill={filmStyle.color}
          fillOpacity={filmStyle.opacity}
          stroke={kantColor}
          strokeWidth="3"
        />
      )}

      {Object.entries(segments).map(([side, [a, b]]) => {
        const length = geometry.sides[side]
        if (!length) return null
        return (
          <text key={`${side}-label`} x={(tx(a.x) + tx(b.x)) / 2} y={(ty(a.y) + ty(b.y)) / 2 - 8} className="fill-slate-700 text-[10px]" textAnchor="middle">
            {`${SIDE_LABELS[side]}: ${Math.round(length)} мм`}
          </text>
        )
      })}

      {angleMarks.map((corner, idx) => {
        const map = { topLeft: points[0], topRight: points[1], bottomRight: points[2], bottomLeft: points[3] }
        const p = map[corner]
        if (!p) return null
        return <rect key={idx} x={tx(p.x) + 4} y={ty(p.y) + 4} width="10" height="10" fill="none" stroke="#334155" strokeWidth="1.5" />
      })}

      {Object.entries(fastenersBySide).map(([side, fastenerData]) => {
        const seg = segments[side]
        if (!seg) return null
        const [a, b] = seg
        const sideLength = geometry.sides[side]
        if (!sideLength || fastenerData.count === 0) return null

        return fastenerData.points.map((mmPos, i) => {
          const t = mmPos / sideLength
          const x = tx(a.x + (b.x - a.x) * t)
          const y = ty(a.y + (b.y - a.y) * t)
          const type = i === 0 || i === fastenerData.points.length - 1 ? 'grommets' : fastenerData.type

          if (type === 'grommets') {
            return <circle key={`${side}-${i}`} cx={x} cy={y} r="4" fill="#0ea5e9" />
          }
          if (type === 'locks') {
            return <rect key={`${side}-${i}`} x={x - 4} y={y - 4} width="8" height="8" fill="#f97316" />
          }
          return <polygon key={`${side}-${i}`} points={`${x},${y - 5} ${x + 5},${y + 5} ${x - 5},${y + 5}`} fill="#16a34a" />
        })
      })}
    </svg>
  )
}

export default function App() {
  const [shape, setShape] = useState('rectangle')
  const [dimensions, setDimensions] = useState({
    width: 2000,
    height: 1500,
    top: 1800,
    right: 1400,
    bottom: 2200,
    left: 1400,
    a: 2000,
    b: 1700,
    c: 1700,
  })
  const [rightAngles, setRightAngles] = useState({ topLeft: true, topRight: true, bottomRight: true, bottomLeft: true })
  const [sideSettings, setSideSettings] = useState(initialSideSettings)
  const [filmType, setFilmType] = useState(FILM_TYPES[0].id)
  const [kantColorId, setKantColorId] = useState(KANT_COLOR_OPTIONS[0].id)
  const [options, setOptions] = useState({
    bottomWeight: false,
    topDrip: false,
    rollStraps: false,
  })

  const selectedKantColor = useMemo(
    () => KANT_COLOR_OPTIONS.find((option) => option.id === kantColorId) ?? KANT_COLOR_OPTIONS[0],
    [kantColorId],
  )
  const selectedFilm = useMemo(
    () => FILM_TYPES.find((option) => option.id === filmType) ?? FILM_TYPES[0],
    [filmType],
  )

  const geometry = useMemo(() => getGeometry(shape, dimensions, rightAngles), [shape, dimensions, rightAngles])

  const fastenersBySide = useMemo(() => {
    return Object.fromEntries(
      Object.entries(geometry.sides).map(([side, length]) => [side, calcSideFasteners(length, sideSettings[side]?.fastener || 'none')]),
    )
  }, [geometry.sides, sideSettings])

  const strapsCount = useMemo(() => {
    if (!options.rollStraps) return 0
    const widthMm = shape === 'trapezoid' ? readNum(dimensions.bottom) : readNum(dimensions.width || dimensions.a)
    return Math.ceil(mmToM(widthMm) / 1.5) * 2
  }, [dimensions, options.rollStraps, shape])

  const result = useMemo(() => {
    const minArea = Math.max(1, geometry.areaM2)
    return {
      area: minArea,
      perimeter: geometry.perimeterM,
    }
  }, [geometry])

  const exportPayload = useMemo(
    () => ({
      timestamp: new Date().toISOString(),
      shape,
      dimensions,
      rightAngles,
      colors: {
        film: { type: selectedFilm.id, label: selectedFilm.label },
        kant: { id: selectedKantColor.id, label: selectedKantColor.label, hex: selectedKantColor.color },
      },
      sideSettings,
      options,
      metrics: {
        areaM2: Number(result.area.toFixed(2)),
        perimeterM: Number(result.perimeter.toFixed(2)),
      },
      fastenersBySide: Object.fromEntries(
        Object.entries(fastenersBySide).map(([side, data]) => [side, { type: data.type, count: data.count, stepMm: Number(data.step.toFixed(2)) }]),
      ),
      rollStrapsCount: strapsCount,
    }),
    [dimensions, fastenersBySide, options, result, rightAngles, selectedFilm, selectedKantColor, shape, sideSettings, strapsCount],
  )

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `soft-window-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fieldLabels = {
    width: 'Ширина (мм)',
    height: shape === 'arch' ? 'Радиус (мм)' : 'Высота (мм)',
    top: 'Верхняя сторона (мм)',
    right: 'Правая сторона (мм)',
    bottom: 'Нижняя сторона (мм)',
    left: 'Левая сторона (мм)',
    a: 'Сторона A (мм)',
    b: 'Сторона B (мм)',
    c: 'Сторона C (мм)',
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Калькулятор «Мягкие окна»</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-4 rounded-xl bg-white p-4 shadow">
          <div>
            <label className="mb-1 block text-sm font-semibold">Форма изделия</label>
            <select className="w-full rounded border p-2" value={shape} onChange={(e) => setShape(e.target.value)}>
              <option value="rectangle">Прямоугольник</option>
              <option value="trapezoid">Трапеция</option>
              <option value="arch">Арка (полукруг)</option>
              <option value="triangle">Треугольник</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SHAPE_FIELDS[shape].map((field) => (
              <label key={field} className="text-sm">
                {fieldLabels[field]}
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded border p-2"
                  value={dimensions[field]}
                  onChange={(e) => setDimensions((prev) => ({ ...prev, [field]: Math.max(0, Number(e.target.value || 0)) }))}
                />
              </label>
            ))}
          </div>

          {shape !== 'triangle' && (
            <div>
              <p className="mb-2 text-sm font-semibold">Прямые углы (90°)</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.keys(rightAngles).map((corner) => (
                  <label key={corner} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rightAngles[corner]}
                      onChange={(e) => setRightAngles((prev) => ({ ...prev, [corner]: e.target.checked }))}
                    />
                    {corner}
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="text-lg font-semibold">Настройки канта и креплений</h2>
          {Object.entries(SIDE_LABELS).map(([side, label]) => (
            <div key={side} className="rounded border p-2">
              <p className="text-sm font-medium">{label}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <select
                  className="rounded border p-1"
                  value={sideSettings[side].kant}
                  onChange={(e) => setSideSettings((prev) => ({ ...prev, [side]: { ...prev[side], kant: Number(e.target.value) } }))}
                >
                  {KANT_OPTIONS.map((k) => (
                    <option key={k} value={k}>{`Кант ${k} мм`}</option>
                  ))}
                </select>
                <select
                  className="rounded border p-1"
                  value={sideSettings[side].fastener}
                  onChange={(e) => setSideSettings((prev) => ({ ...prev, [side]: { ...prev[side], fastener: e.target.value } }))}
                >
                  {FASTENER_TYPES.map((f) => (
                    <option key={f} value={f}>
                      {{ none: 'Без креплений', grommets: 'Люверсы', locks: 'Замки', straps: 'Ремни' }[f]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 gap-2 text-sm">
            <label>
              Тип плёнки
              <select className="mt-1 w-full rounded border p-2" value={filmType} onChange={(e) => setFilmType(e.target.value)}>
                {FILM_TYPES.map((film) => (
                  <option key={film.id} value={film.id}>
                    {film.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Цвет канта
              <select className="mt-1 w-full rounded border p-2" value={kantColorId} onChange={(e) => setKantColorId(e.target.value)}>
                {KANT_COLOR_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-1 text-sm">
            <label className="flex gap-2"><input type="checkbox" checked={options.bottomWeight} onChange={(e) => setOptions((p) => ({ ...p, bottomWeight: e.target.checked }))} />Отвес снизу</label>
            <label className="flex gap-2"><input type="checkbox" checked={options.topDrip} onChange={(e) => setOptions((p) => ({ ...p, topDrip: e.target.checked }))} />Отлив сверху</label>
            <label className="flex gap-2"><input type="checkbox" checked={options.rollStraps} onChange={(e) => setOptions((p) => ({ ...p, rollStraps: e.target.checked }))} />Ремни фиксации (в скрутке)</label>
          </div>
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="text-lg font-semibold">Чертёж и результат</h2>
          <Drawing
            shape={shape}
            geometry={geometry}
            filmStyle={selectedFilm}
            kantColor={selectedKantColor.color}
            fastenersBySide={fastenersBySide}
          />

          <div className="rounded bg-slate-100 p-3 text-sm">
            <p>Площадь: <strong>{result.area.toFixed(2)} м²</strong></p>
            <p>Периметр: <strong>{result.perimeter.toFixed(2)} м</strong></p>
            {options.rollStraps && <p>Ремней фиксации: <strong>{strapsCount} шт.</strong></p>}
            <div className="mt-2 space-y-1">
              {Object.entries(fastenersBySide).map(([side, data]) => (
                <p key={side}>{SIDE_LABELS[side]}: {data.count} шт. ({data.type})</p>
              ))}
            </div>
          </div>

          <button className="w-full rounded bg-slate-900 p-2 font-medium text-white hover:bg-slate-700" onClick={handleExport}>
            Скачать JSON
          </button>
        </section>
      </div>
    </main>
  )
}
