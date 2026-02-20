const corners = [
  { key: 'topLeft', label: 'Верхний левый 90°' },
  { key: 'topRight', label: 'Верхний правый 90°' },
  { key: 'bottomRight', label: 'Нижний правый 90°' },
  { key: 'bottomLeft', label: 'Нижний левый 90°' },
]

export default function TrapezoidInput({ values, flags, errors, onValueChange, onFlagChange }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {[
          ['baseA', 'Верхнее основание (мм)'],
          ['baseB', 'Нижнее основание (мм)'],
          ['left', 'Левая сторона (мм)'],
          ['right', 'Правая сторона (мм)'],
        ].map(([k, label]) => (
          <label key={k} className="text-sm">
            {label}
            <input
              type="number"
              min="1"
              className={`mt-1 w-full rounded border p-2 ${errors?.[k] ? 'border-rose-500' : ''}`}
              value={values[k]}
              onChange={(e) => onValueChange(k, Number(e.target.value || 0))}
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {corners.map((c) => (
          <label key={c.key} className="flex items-center gap-2">
            <input type="checkbox" checked={flags[c.key]} onChange={(e) => onFlagChange(c.key, e.target.checked)} />
            {c.label}
          </label>
        ))}
      </div>
    </div>
  )
}
