import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useAuth } from '@/hooks/useAuth'
import { patientDisplayName, type MonitoringActivePatient } from '@/types'
import { ROOT_PATHS } from '@/router/paths'
import './TopNavBar.css'

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

interface TopNavBarProps {
  /** Muestra el botón de menú en móvil para abrir la barra lateral. */
  onToggleSidebar?: () => void
  /** Muestra el menú de usuario a la derecha (false en área clínica: va al footer). */
  showUser?: boolean
  /** Pacientes con monitorización activa (centro de la barra). */
  monitoringActive?: MonitoringActivePatient[]
  /** Al pulsar un avatar de paciente monitorizado. */
  onMonitoringPatientClick?: (patientId: string) => void
  /** ID del paciente actualmente seleccionado (resalta su avatar). */
  selectedPatientId?: string
}

function MonitoringAvatar({
  patient,
  selected,
  onClick,
}: {
  patient: MonitoringActivePatient
  selected: boolean
  onClick: () => void
}) {
  const name = patientDisplayName(patient)
  return (
    <button
      type="button"
      className={`nilo-topnav__mon-avatar${selected ? ' nilo-topnav__mon-avatar--selected' : ''}`}
      onClick={onClick}
      title={name}
      aria-label={name}
    >
      {patient.photo ? (
        <img src={patient.photo} alt="" />
      ) : (
        <span
          className="nilo-topnav__mon-initials"
          style={{ backgroundColor: colorForName(name) }}
        >
          {getInitials(name)}
        </span>
      )}
    </button>
  )
}

/**
 * Barra de navegación superior fija, reutilizable por todas las áreas.
 */
export function TopNavBar({
  onToggleSidebar,
  showUser = true,
  monitoringActive = [],
  onMonitoringPatientClick,
  selectedPatientId,
}: TopNavBarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fullName = user ? `${user.firstName} ${user.lastName}` : ''

  function handleLogout() {
    logout()
    navigate(ROOT_PATHS.login, { replace: true })
  }

  return (
    <header className="nilo-topnav">
      <div className="nilo-topnav__left">
        {onToggleSidebar && (
          <button
            className="nilo-topnav__burger"
            onClick={onToggleSidebar}
            aria-label="Alternar navegación"
          >
            <MaterialIcon name="menu" size={22} />
          </button>
        )}
        <h1 className="nilo-topnav__brand">NILO</h1>
      </div>

      {monitoringActive.length > 0 && (
        <div className="nilo-topnav__center" aria-label="Pacientes en monitorización activa">
          <div className="nilo-topnav__mon-list">
            {monitoringActive.map((p) => (
              <MonitoringAvatar
                key={p.id}
                patient={p}
                selected={selectedPatientId === p.id}
                onClick={() => onMonitoringPatientClick?.(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      {showUser && (
        <div className="nilo-topnav__right" ref={menuRef}>
          <button
            className="nilo-topnav__user"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar name={fullName || 'NILO'} src={user?.avatarUrl} size={32} />
            <span className="nilo-topnav__user-name">{fullName}</span>
          </button>

          {menuOpen && (
            <div className="nilo-topnav__menu" role="menu">
              <button className="nilo-topnav__menu-item" role="menuitem" onClick={handleLogout}>
                <MaterialIcon name="logout" size={20} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
