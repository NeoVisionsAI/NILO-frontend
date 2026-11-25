import type { ChangeEvent, ReactNode } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { MonitoringSession } from '@/types/monitoring-session'
import type { Node, PatientUser } from '@/types'
import { ActiveSessionInfo } from './ActiveSessionInfo'
import { PatientAvatarMenu } from './PatientAvatarMenu'
import { SessionElapsedBadge } from './SessionElapsedBadge'
import './PatientDetailHeader.css'

export type PatientViewMode = 'live' | 'explore'

interface PatientDetailHeaderProps {
  patient: PatientUser
  fullName: string
  avatar: ReactNode
  monitoring: boolean
  /** Mostrar Live solo con monitorización y sesión activa resuelta */
  liveAvailable: boolean
  togglingMonitor: boolean
  onMonitoringToggle: () => void
  activeSession: MonitoringSession | null
  loadingSession: boolean
  onSessionUpdated?: (session: MonitoringSession) => void
  viewMode: PatientViewMode
  onViewModeChange: (mode: PatientViewMode) => void
  assignedNodeId: string
  nodes: Node[]
  assigningNode: boolean
  onNodeChange: (e: ChangeEvent<HTMLSelectElement>) => void
  devToolsSlot?: ReactNode
  onEdit: () => void
  onDelete: () => void
}

function profileChip(label: string, value: string | null | undefined) {
  if (!value?.trim()) return null
  return (
    <span className="nilo-pdetail-hdr__chip" title={label}>
      <span className="nilo-pdetail-hdr__chip-k">{label}</span>
      <span className="nilo-pdetail-hdr__chip-v">{value}</span>
    </span>
  )
}

export function PatientDetailHeader({
  patient: p,
  fullName,
  avatar,
  monitoring,
  liveAvailable,
  togglingMonitor,
  onMonitoringToggle,
  activeSession,
  loadingSession,
  onSessionUpdated,
  viewMode,
  onViewModeChange,
  assignedNodeId,
  nodes,
  assigningNode,
  onNodeChange,
  devToolsSlot,
  onEdit,
  onDelete,
}: PatientDetailHeaderProps) {
  const profile = p.patient_profile
  const nodeSelected = Boolean(assignedNodeId)

  return (
    <header className="nilo-pdetail-hdr">
      <section className="nilo-pdetail-hdr__top" aria-label="Identidad del paciente">
        <PatientAvatarMenu patientName={fullName} onEdit={onEdit} onDelete={onDelete}>
          {avatar}
        </PatientAvatarMenu>

        <div className="nilo-pdetail-hdr__identity">
          <h1 className="nilo-pdetail-hdr__name">{fullName}</h1>
          <div className="nilo-pdetail-hdr__chips">
            {profileChip('NHC', profile.medical_record_number)}
            {profileChip('Habitación', profile.room)}
            {profileChip('Cama', profile.bed)}
            {profileChip('Sexo', profile.sex ?? undefined)}
            {profileChip('Tipo', profile.type_patient)}
          </div>

        </div>

        <div className="nilo-pdetail-hdr__controls">
          <div className="nilo-pdetail-hdr__mon-strip" aria-label="Monitorización y sesión">
            <button
              type="button"
              role="switch"
              aria-checked={monitoring}
              disabled={togglingMonitor}
              className={`nilo-pdetail-hdr__mon-pill${monitoring ? ' nilo-pdetail-hdr__mon-pill--on' : ''}`}
              onClick={onMonitoringToggle}
            >
              <span className="nilo-pdetail-hdr__mon-pill-track" aria-hidden>
                <span className="nilo-pdetail-hdr__mon-pill-thumb" />
              </span>
              <span className="nilo-pdetail-hdr__mon-pill-text">
                {monitoring ? 'Monitorizando..' : 'Monitorización desactivada'}
              </span>
            </button>

            {monitoring && activeSession?.status === 'active' && (
              <SessionElapsedBadge startedAt={activeSession.started_at} />
            )}

            {monitoring &&
              (activeSession ? (
                <ActiveSessionInfo
                  session={activeSession}
                  profileActiveSessionId={p.patient_profile?.active_session_id}
                  loading={loadingSession}
                  onSessionUpdated={onSessionUpdated}
                  compact
                  strip
                  hideElapsed
                />
              ) : loadingSession ? (
                <p className="nilo-pdetail-hdr__session-empty">Cargando sesión…</p>
              ) : (
                <p className="nilo-pdetail-hdr__session-warn">Sin sesión abierta.</p>
              ))}
          </div>

          <div className="nilo-pdetail-hdr__actions-row">
            <div className="nilo-pdetail-hdr__view-switch" role="group" aria-label="Vista de contenido">
              {liveAvailable && (
                <button
                  type="button"
                  className={`nilo-pdetail-hdr__view${viewMode === 'live' ? ' nilo-pdetail-hdr__view--on' : ''}`}
                  aria-pressed={viewMode === 'live'}
                  onClick={() => onViewModeChange('live')}
                >
                  <span className="nilo-pdetail-hdr__live-dot" aria-hidden />
                  <MaterialIcon name="monitor_heart" size={18} />
                  Live
                </button>
              )}
              <button
                type="button"
                className={`nilo-pdetail-hdr__view${viewMode === 'explore' ? ' nilo-pdetail-hdr__view--on' : ''}`}
                aria-pressed={viewMode === 'explore'}
                onClick={() => onViewModeChange('explore')}
              >
                <MaterialIcon name="database_search" size={18} />
                Explorar
              </button>
            </div>

            <label
              className={`nilo-pdetail-hdr__node${nodeSelected ? ' nilo-pdetail-hdr__node--selected' : ''}`}
            >
              <MaterialIcon name="hub" size={20} />
              <select
                value={assignedNodeId}
                disabled={assigningNode || monitoring}
                onChange={onNodeChange}
                aria-label="Nodo"
                title={monitoring ? 'No se puede cambiar el nodo mientras monitorizas' : undefined}
              >
                <option value="">Nodo</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>

            {devToolsSlot}
          </div>
        </div>
      </section>
    </header>
  )
}