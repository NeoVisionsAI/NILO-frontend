import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { patientDisplayName, type MonitoringActivePatient } from '@/types'
import './ActivePatientsSidebar.css'

const AVATAR_COLORS = ['#0369a1', '#0f766e', '#7c3aed', '#be123c', '#b45309', '#4338ca', '#0891b2']

function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toUpperCase()
}

interface ActivePatientsSidebarProps {
  patients: MonitoringActivePatient[]
  selectedPatientId?: string
  onSelectPatient?: (id: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

/**
 * Contenedor A: pacientes con monitorización activa (antes en el header).
 */
export function ActivePatientsSidebar({
  patients,
  selectedPatientId,
  onSelectPatient,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}: ActivePatientsSidebarProps) {
  const classes = [
    'nilo-apsidebar',
    collapsed ? 'nilo-apsidebar--collapsed' : '',
    mobileOpen ? 'nilo-apsidebar--mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        className={
          mobileOpen
            ? 'nilo-apsidebar__overlay nilo-apsidebar__overlay--visible'
            : 'nilo-apsidebar__overlay'
        }
        onClick={onCloseMobile}
      />
      <aside className={classes}>
        <div className="nilo-apsidebar__inner">
          {collapsed ? (
            <>
              <div
                className="nilo-apsidebar__rail-head"
                title="Active monitoring"
                aria-label={`Active monitoring — ${patients.length} patients`}
              >
                <div className="nilo-apsidebar__rail-head-badge">
                  <MaterialIcon name="monitor_heart" size={24} />
                  <span className="nilo-apsidebar__rail-count">{patients.length}</span>
                </div>
                <span className="nilo-apsidebar__rail-label">Active monitoring</span>
              </div>
              <div className="nilo-apsidebar__rail m3-scroll">
                {patients.map((p) => {
                const name = patientDisplayName(p)
                return (
                  <button
                    key={p.id}
                    className={`nilo-apsidebar__rail-btn${selectedPatientId === p.id ? ' nilo-apsidebar__rail-btn--selected' : ''}`}
                    title={name}
                    onClick={() => onSelectPatient?.(p.id)}
                  >
                    {p.photo ? (
                      <img src={p.photo} alt="" />
                    ) : (
                      <span
                        className="nilo-apsidebar__rail-initials"
                        style={{ backgroundColor: colorForName(name) }}
                      >
                        {getInitials(name)}
                      </span>
                    )}
                  </button>
                )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="nilo-apsidebar__head">
                <MaterialIcon name="monitor_heart" size={18} />
                <h2>Active monitoring</h2>
                <span className="nilo-apsidebar__count">{patients.length}</span>
              </div>
              <div className="nilo-apsidebar__list m3-scroll">
                {patients.length === 0 ? (
                  <div className="nilo-apsidebar__empty">
                    <MaterialIcon name="person_off" size={28} />
                    <p>No active patients</p>
                  </div>
                ) : (
                  patients.map((p) => {
                    const name = patientDisplayName(p)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`nilo-apsidebar__item${selectedPatientId === p.id ? ' nilo-apsidebar__item--selected' : ''}`}
                        onClick={() => onSelectPatient?.(p.id)}
                      >
                        {p.photo ? (
                          <img className="nilo-apsidebar__avatar" src={p.photo} alt="" />
                        ) : (
                          <span
                            className="nilo-apsidebar__avatar nilo-apsidebar__avatar--initials"
                            style={{ backgroundColor: colorForName(name) }}
                          >
                            {getInitials(name)}
                          </span>
                        )}
                        <span className="nilo-apsidebar__name">{name}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

        <button
          className="nilo-apsidebar__handle"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expandir panel' : 'Colapsar panel'}
          aria-label={collapsed ? 'Expandir panel lateral' : 'Colapsar panel lateral'}
        >
          <MaterialIcon name={collapsed ? 'chevron_right' : 'chevron_left'} size={20} />
        </button>
      </aside>
    </>
  )
}
