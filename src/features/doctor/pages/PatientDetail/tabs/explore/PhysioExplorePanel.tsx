import { useMemo, useState } from 'react'
import type { PhysiologicalReading } from '@/services/physiological.service'
import './PhysioExplorePanel.css'

type ViewMode = 'chart' | 'bar' | 'table'

interface PhysioExplorePanelProps {
  readings: PhysiologicalReading[]
}

function metricKeys(readings: PhysiologicalReading[]): string[] {
  const set = new Set<string>()
  for (const r of readings) {
    Object.keys(r.metrics).forEach((k) => set.add(k))
  }
  return [...set].sort()
}

export function PhysioExplorePanel({ readings }: PhysioExplorePanelProps) {
  const keys = useMemo(() => metricKeys(readings), [readings])
  const [metric, setMetric] = useState(keys[0] ?? '')
  const [view, setView] = useState<ViewMode>('chart')

  const series = useMemo(() => {
    if (!metric) return []
    return readings
      .map((r) => ({
        t: new Date(r.timestamp).getTime(),
        v: r.metrics[metric],
        unit: r.units[metric] ?? '',
      }))
      .filter((p) => typeof p.v === 'number' && !Number.isNaN(p.v))
      .sort((a, b) => a.t - b.t)
  }, [readings, metric])

  if (readings.length === 0) {
    return <p className="nilo-explore__placeholder">Sin lecturas fisiológicas en el intervalo seleccionado.</p>
  }

  const minV = series.reduce((m, p) => Math.min(m, p.v), series[0]?.v ?? 0)
  const maxV = series.reduce((m, p) => Math.max(m, p.v), series[0]?.v ?? 1)
  const span = Math.max(maxV - minV, 1e-6)

  const w = 520
  const h = 180
  const pad = 24

  const pointsAttr =
    series.length > 1
      ? series
          .map((p, i) => {
            const x = pad + (i / (series.length - 1)) * (w - pad * 2)
            const y = pad + (1 - (p.v - minV) / span) * (h - pad * 2)
            return `${x},${y}`
          })
          .join(' ')
      : ''

  return (
    <div className="nilo-physio-panel">
      <div className="nilo-physio-panel__toolbar">
        <label>
          Métrica
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <div className="nilo-physio-panel__views" role="group" aria-label="Tipo de vista">
          {(['chart', 'bar', 'table'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`nilo-physio-panel__view${view === mode ? ' nilo-physio-panel__view--on' : ''}`}
              onClick={() => setView(mode)}
            >
              {mode === 'chart' ? 'Línea' : mode === 'bar' ? 'Barras' : 'Tabla'}
            </button>
          ))}
        </div>
      </div>

      {view === 'table' ? (
        <div className="nilo-physio-panel__table-wrap">
          <table className="nilo-physio-panel__table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Dispositivo</th>
                {keys.map((k) => (
                  <th key={k}>
                    {k}
                    {readings[0]?.units[k] ? ` (${readings[0].units[k]})` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.timestamp).toLocaleString('es-ES')}</td>
                  <td>{r.device_id}</td>
                  {keys.map((k) => (
                    <td key={k}>{r.metrics[k] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg className="nilo-physio-panel__svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Serie ${metric}`}>
          {view === 'chart' && pointsAttr && (
            <polyline fill="none" stroke="var(--m3-primary)" strokeWidth="2" points={pointsAttr} />
          )}
          {view === 'bar' &&
            series.map((p, i) => {
              const barW = Math.max(2, (w - pad * 2) / series.length - 2)
              const x = pad + i * ((w - pad * 2) / series.length)
              const barH = ((p.v - minV) / span) * (h - pad * 2)
              const y = h - pad - barH
              return <rect key={i} x={x} y={y} width={barW} height={barH} fill="var(--m3-primary)" opacity={0.85} />
            })}
        </svg>
      )}

      <p className="nilo-physio-panel__meta">
        {series.length} muestras · {metric}{' '}
        {series[0]?.unit ? `(${series[0].unit})` : ''}
      </p>
    </div>
  )
}