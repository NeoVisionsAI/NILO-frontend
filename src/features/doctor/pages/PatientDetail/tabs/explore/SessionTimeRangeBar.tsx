import { useMemo } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { msToLocalDatetimeValue, sessionBounds } from '@/lib/explore-time'
import type { MonitoringSession } from '@/types/monitoring-session'
import './SessionTimeRangeBar.css'

interface SessionTimeRangeBarProps {
  session: MonitoringSession
  enabled: boolean
  onEnabledChange: (on: boolean) => void
  /** 0–100 % inicio y fin dentro de la sesión */
  rangePct: [number, number]
  onRangePctChange: (next: [number, number]) => void
  /** ms absolutos derivados (solo lectura UI) */
  fromMs: number
  toMs: number
}

export function SessionTimeRangeBar({
  session,
  enabled,
  onEnabledChange,
  rangePct,
  onRangePctChange,
  fromMs,
  toMs,
}: SessionTimeRangeBarProps) {
  const { startMs, endMs } = useMemo(() => sessionBounds(session), [session])

  const spanMs = Math.max(endMs - startMs, 1)

  function onStartInput(v: number) {
    const nextStart = Math.min(v, rangePct[1] - 1)
    onRangePctChange([Math.max(0, nextStart), rangePct[1]])
  }

  function onEndInput(v: number) {
    const nextEnd = Math.max(v, rangePct[0] + 1)
    onRangePctChange([rangePct[0], Math.min(100, nextEnd)])
  }

  return (
    <div className={`nilo-explore-range${enabled ? '' : ' nilo-explore-range--off'}`}>
      <div className="nilo-explore-range__head">
        <MaterialIcon name="filter_alt" size={18} />
        <span>Filtro temporal en sesión</span>
        <label className="nilo-explore-range__toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
          Activar
        </label>
        {enabled && (
          <button type="button" className="nilo-explore-range__clear" onClick={() => onEnabledChange(false)}>
            Quitar filtro
          </button>
        )}
      </div>

      {enabled && (
        <div className="nilo-explore-range__body">
          <div className="nilo-explore-range__labels">
            <span title={msToLocalDatetimeValue(fromMs)}>
              {new Date(fromMs).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' })}
            </span>
            <span title={msToLocalDatetimeValue(toMs)}>
              {new Date(toMs).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' })}
            </span>
          </div>
          <div className="nilo-explore-range__sliders">
            <input
              type="range"
              min={0}
              max={100}
              value={rangePct[0]}
              aria-label="Inicio del intervalo"
              onChange={(e) => onStartInput(Number(e.target.value))}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={rangePct[1]}
              aria-label="Fin del intervalo"
              onChange={(e) => onEndInput(Number(e.target.value))}
            />
          </div>
          <p className="nilo-explore-range__hint">
            Ventana completa: {new Date(startMs).toLocaleString('es-ES')} →{' '}
            {new Date(endMs).toLocaleString('es-ES')} ({Math.round(spanMs / 60_000)} min)
          </p>
        </div>
      )}
    </div>
  )
}