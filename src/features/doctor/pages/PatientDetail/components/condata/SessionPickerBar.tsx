import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { MonitoringSession } from '@/types/monitoring-session'

function formatSessionLabel(session: MonitoringSession): string {
  const started = new Date(session.started_at)
  const date = Number.isNaN(started.getTime())
    ? session.started_at
    : started.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
  const status =
    session.status === 'active' ? 'Activa' : session.status === 'completed' ? 'Cerrada' : session.status
  return `${date} · ${status}`
}

interface SessionPickerBarProps {
  sessions: MonitoringSession[]
  selectedSessionId: string | null
  onSelect: (sessionId: string) => void
  onCreate: () => void
  loading?: boolean
  creating?: boolean
}

export function SessionPickerBar({
  sessions,
  selectedSessionId,
  onSelect,
  onCreate,
  loading,
  creating,
}: SessionPickerBarProps) {
  return (
    <div className="nilo-cmodule__session-bar">
      <label className="nilo-cmodule__session-field">
        <span className="nilo-cmodule__detail-label">Sesión</span>
        <select
          value={selectedSessionId ?? ''}
          disabled={loading || sessions.length === 0}
          onChange={(e) => onSelect(e.target.value)}
        >
          {sessions.length === 0 ? <option value="">Sin sesiones</option> : null}
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {formatSessionLabel(session)}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="nilo-cmodule__session-new" onClick={onCreate} disabled={creating || loading}>
        <MaterialIcon name="play_circle" size={18} />
        <span>{creating ? 'Creando…' : 'Nueva sesión'}</span>
      </button>
    </div>
  )
}