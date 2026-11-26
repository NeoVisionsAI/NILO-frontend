import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { parseApiDateMs } from '@/lib/parse-api-datetime'
import type { MonitoringSession } from '@/types/monitoring-session'
import './ExploreSessionPicker.css'

interface ExploreSessionPickerProps {
  sessions: MonitoringSession[]
  value: string | null
  onChange: (sessionId: string | null) => void
  loading?: boolean
}

export function formatExploreSessionLabel(session: MonitoringSession): string {
  const ms = parseApiDateMs(session.started_at)
  const datePart = Number.isNaN(ms)
    ? session.started_at
    : new Date(ms).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
  const idTail = session.id.slice(-8)
  const live = session.status === 'active' ? ' · en curso' : ''
  return `${datePart} · …${idTail}${live}`
}

export function ExploreSessionPicker({ sessions, value, onChange, loading }: ExploreSessionPickerProps) {
  const selected = sessions.find((s) => s.id === value) ?? null

  return (
    <div className="nilo-explore-sess">
      <label className="nilo-explore-sess__field">
        <span className="nilo-explore-sess__icon" aria-hidden>
          <MaterialIcon name="history" size={20} />
        </span>
        <select
          className="nilo-explore-sess__select"
          value={value ?? ''}
          disabled={loading || sessions.length === 0}
          aria-label="Sesión a explorar"
          onChange={(e) => onChange(e.target.value || null)}
        >
          {sessions.length === 0 ? (
            <option value="">{loading ? 'Cargando sesiones…' : 'Sin sesiones'}</option>
          ) : (
            sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {formatExploreSessionLabel(s)}
              </option>
            ))
          )}
        </select>
        <span className="nilo-explore-sess__chev" aria-hidden>
          <MaterialIcon name="expand_more" size={22} />
        </span>
      </label>
      {selected?.status === 'active' && (
        <span className="nilo-explore-sess__live" title="Sesión activa">
          <span className="nilo-explore-sess__live-dot" aria-hidden />
        </span>
      )}
    </div>
  )
}

interface ExploreSessionHeaderActionsProps {
  sessions: MonitoringSession[]
  selectedSessionId: string | null
  sessionsLoading: boolean
  onSessionChange: (id: string | null) => void
  onViewAll?: () => void
}

export function ExploreSessionHeaderActions({
  sessions,
  selectedSessionId,
  sessionsLoading,
  onSessionChange,
  onViewAll,
}: ExploreSessionHeaderActionsProps) {
  return (
    <div className="nilo-explore__head-tools">
      <ExploreSessionPicker
        sessions={sessions}
        value={selectedSessionId}
        loading={sessionsLoading}
        onChange={onSessionChange}
      />
      <button
        type="button"
        className="nilo-explore__view-all"
        title="Próximamente: agregar datos de todas las sesiones"
        onClick={onViewAll}
      >
        <MaterialIcon name="layers" size={18} />
        Ver todo
      </button>
    </div>
  )
}