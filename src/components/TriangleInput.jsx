const RIGHT_ANGLES = [
  { key: 'A', label: 'Прямой угол в вершине A' },
  { key: 'B', label: 'Прямой угол в вершине B' },
  { key: 'C', label: 'Прямой угол в вершине C' },
]

export default function TriangleInput({
  mode,
  onModeChange,
  rightAngle,
  onRightAngleChange,
  sides,
  baseHeight,
  catheti,
  errors,
  onSidesChange,
  onBaseHeightChange,
  onCathetiChange,
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm">Режим треугольника
        <select className="mt-1 w-full rounded border p-2" value={mode} onChange={(e) => onModeChange(e.target.value)}>
          <option value="sides">По трём сторонам</option>
          <option value="baseHeight">По основанию и высоте</option>
          <option value="catheti">По катетам (прямоугольный)</option>
        </select>
      </label>

      <label className="block text-sm">Положение прямого угла
        <select className="mt-1 w-full rounded border p-2" value={rightAngle} onChange={(e) => onRightAngleChange(e.target.value)}>
          {RIGHT_ANGLES.map((angle) => (
            <option key={angle.key} value={angle.key}>{angle.label}</option>
          ))}
        </select>
      </label>

      {mode === 'sides' && (
        <div className="grid grid-cols-3 gap-2">
          {['a', 'b', 'c'].map((k) => (
            <label key={k} className="text-sm">
              {`Сторона ${k.toUpperCase()} (мм)`}
              <input
                type="number"
                min="1"
                value={sides[k]}
                className={`mt-1 w-full rounded border p-2 ${errors?.[k] ? 'border-rose-500' : ''}`}
                onChange={(e) => onSidesChange(k, Number(e.target.value || 0))}
              />
            </label>
          ))}
        </div>
      )}

      {mode === 'baseHeight' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">Основание (мм)
            <input
              type="number"
              min="1"
              value={baseHeight.base}
              className={`mt-1 w-full rounded border p-2 ${errors?.base ? 'border-rose-500' : ''}`}
              onChange={(e) => onBaseHeightChange('base', Number(e.target.value || 0))}
            />
          </label>
          <label className="text-sm">Высота (мм)
            <input
              type="number"
              min="1"
              value={baseHeight.height}
              className={`mt-1 w-full rounded border p-2 ${errors?.height ? 'border-rose-500' : ''}`}
              onChange={(e) => onBaseHeightChange('height', Number(e.target.value || 0))}
            />
          </label>
        </div>
      )}

      {mode === 'catheti' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">Катет по ширине (мм)
            <input
              type="number"
              min="1"
              value={catheti.width}
              className={`mt-1 w-full rounded border p-2 ${errors?.cathetusWidth ? 'border-rose-500' : ''}`}
              onChange={(e) => onCathetiChange('width', Number(e.target.value || 0))}
            />
          </label>
          <label className="text-sm">Катет по высоте (мм)
            <input
              type="number"
              min="1"
              value={catheti.height}
              className={`mt-1 w-full rounded border p-2 ${errors?.cathetusHeight ? 'border-rose-500' : ''}`}
              onChange={(e) => onCathetiChange('height', Number(e.target.value || 0))}
            />
          </label>
          <p className="col-span-2 rounded bg-slate-100 p-2 text-sm">
            Гипотенуза считается автоматически после ввода катетов.
          </p>
        </div>
      )}
    </div>
  )
}
