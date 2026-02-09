export default function TriangleInput({ mode, onModeChange, sides, baseHeight, errors, onSidesChange, onBaseHeightChange }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm">Режим треугольника
        <select className="mt-1 w-full rounded border p-2" value={mode} onChange={(e) => onModeChange(e.target.value)}>
          <option value="sides">По трём сторонам</option>
          <option value="baseHeight">По основанию и высоте</option>
        </select>
      </label>

      {mode === 'sides' ? (
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
      ) : (
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
    </div>
  )
}
