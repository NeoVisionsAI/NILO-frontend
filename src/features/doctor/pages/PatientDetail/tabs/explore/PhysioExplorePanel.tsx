import { useMemo, useState } from 'react'
import Plotly from 'plotly.js-dist-min'
import createPlotlyComponent from 'react-plotly.js/factory'
import type { PhysiologicalReading } from '@/services/physiological.service'
import { parseApiDateMs } from '@/lib/parse-api-datetime'
import './PhysioExplorePanel.css'

const Plot = createPlotlyComponent(Plotly)

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
        t: parseApiDateMs(r.timestamp),
        v: r.metrics[metric],
        unit: r.units[metric] ?? '',
      }))
      .filter((p) => !Number.isNaN(p.t) && typeof p.v === 'number' && !Number.isNaN(p.v))
      .sort((a, b) => a.t - b.t)
  }, [readings, metric])

  if (readings.length === 0) {
    return <p className="nilo-explore__placeholder">Sin lecturas fisiológicas en el intervalo seleccionado.</p>
  }

  const unit = series[0]?.unit ?? readings[0]?.units[metric] ?? ''
  const x = series.map((p) => new Date(p.t))
  const y = series.map((p) => p.v)

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
        <div className="nilo-physio-panel__plot">
          <Plot
            data={
              view === 'chart'
                ? [
                    {
                      type: 'scatter',
                      mode: 'lines+markers',
                      x,
                      y,
                      line: { color: '#2563eb', width: 2.5, shape: 'spline' },
                      marker: { size: 6, color: '#1d4ed8' },
                      name: metric,
                    },
                  ]
                : [
                    {
                      type: 'bar',
                      x,
                      y,
                      marker: { color: '#059669', opacity: 0.85 },
                      name: metric,
                    },
                  ]
            }
            layout={{
              autosize: true,
              height: 380,
              margin: { l: 56, r: 24, t: 36, b: 56 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(248,250,252,0.6)',
              title: { text: `${metric}${unit ? ` (${unit})` : ''}`, font: { size: 14 } },
              xaxis: {
                title: 'Tiempo',
                type: 'date',
                gridcolor: 'rgba(15,23,42,0.08)',
                zeroline: false,
              },
              yaxis: {
                title: unit ? `${metric} (${unit})` : metric,
                gridcolor: 'rgba(15,23,42,0.08)',
                zeroline: false,
              },
              hovermode: 'x unified',
            }}
            config={{
              responsive: true,
              scrollZoom: true,
              displayModeBar: true,
              modeBarButtonsToRemove: ['lasso2d', 'select2d'],
              displaylogo: false,
            }}
            style={{ width: '100%', minHeight: 380 }}
            useResizeHandler
          />
        </div>
      )}

      <p className="nilo-physio-panel__meta">
        {series.length} muestras · {metric} {unit ? `(${unit})` : ''}
      </p>
    </div>
  )
}