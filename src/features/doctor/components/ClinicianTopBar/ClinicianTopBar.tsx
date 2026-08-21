import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useAuth } from '@/hooks/useAuth'
import { useFullscreen } from '@/hooks/useFullscreen'
import { toast } from '@/lib/toast'
import { ROOT_PATHS } from '@/router/paths'
import './ClinicianTopBar.css'

export interface ResourceListItem {
  id: string
  primary: string
  secondary?: string
  searchText: string
  leading: ReactNode
  onSelect?: () => void
}

interface ResourcePanelProps {
  open: boolean
  searchPlaceholder: string
  addLabel: string
  emptyLabel: string
  noResultsLabel: string
  items: ResourceListItem[]
  onAdd: () => void
  onClose: () => void
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase())
}

function ResourcePanel({
  open,
  searchPlaceholder,
  addLabel,
  emptyLabel,
  noResultsLabel,
  items,
  onAdd,
  onClose,
}: ResourcePanelProps) {
  const [query, setQuery] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, onClose])

  if (!open) return null

  const filtered = query.trim()
    ? items.filter((i) => matchesQuery(i.searchText, query))
    : items

  return (
    <div className="nilo-ctopbar__panel" ref={panelRef}>
      <div className="nilo-ctopbar__panel-toolbar">
        <MaterialIcon name="search" size={18} className="nilo-ctopbar__panel-search-icon" />
        <input
          type="search"
          className="nilo-ctopbar__panel-input"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <button
            type="button"
            className="nilo-ctopbar__panel-clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            <MaterialIcon name="close" size={16} />
          </button>
        )}
        <button type="button" className="nilo-ctopbar__panel-add" onClick={onAdd} title={addLabel}>
          <MaterialIcon name="add" size={20} />
        </button>
      </div>

      <div className="nilo-ctopbar__panel-list m3-scroll">
        {items.length === 0 ? (
          <p className="nilo-ctopbar__panel-empty">{emptyLabel}</p>
        ) : filtered.length === 0 ? (
          <p className="nilo-ctopbar__panel-empty">{noResultsLabel}</p>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nilo-ctopbar__panel-item"
              onClick={() => {
                item.onSelect?.()
                onClose()
              }}
            >
              {item.leading}
              <div className="nilo-ctopbar__panel-item-text">
                <span className="nilo-ctopbar__panel-item-primary">{item.primary}</span>
                {item.secondary && (
                  <span className="nilo-ctopbar__panel-item-secondary">{item.secondary}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

type OpenPanel = 'patients' | 'nodes' | 'devices-menu' | null

interface ClinicianTopBarProps {
  onToggleSidebar?: () => void
  patientItems: ResourceListItem[]
  nodeItems: ResourceListItem[]
  onAddPatient: () => void
  onAddNode: () => void
  onOpenCardmed: () => void
}

/** Barra superior del área clínica: NILO, Patients, Devices y perfil del clínico. */
export function ClinicianTopBar({
  onToggleSidebar,
  patientItems,
  nodeItems,
  onAddPatient,
  onAddNode,
  onOpenCardmed,
}: ClinicianTopBarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { isFullscreen, toggleFullscreen, supported: fullscreenSupported } = useFullscreen()
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)
  const devicesMenuRef = useRef<HTMLDivElement>(null)

  const fullName = user ? `${user.firstName} ${user.lastName}` : ''

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as globalThis.Node)) {
        setUserMenuOpen(false)
      }
      if (devicesMenuRef.current && !devicesMenuRef.current.contains(e.target as globalThis.Node)) {
        if (openPanel === 'devices-menu') setOpenPanel(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openPanel])

  function togglePanel(panel: OpenPanel) {
    setOpenPanel((prev) => (prev === panel ? null : panel))
    setUserMenuOpen(false)
  }

  function handleLogout() {
    logout()
    navigate(ROOT_PATHS.login, { replace: true })
  }

  async function handleToggleFullscreen() {
    try {
      await toggleFullscreen()
    } catch {
      toast.error('No se pudo activar pantalla completa en este dispositivo.')
    }
  }

  return (
    <header className="nilo-ctopbar">
      <div className="nilo-ctopbar__left">
        {onToggleSidebar && (
          <button
            className="nilo-ctopbar__burger"
            onClick={onToggleSidebar}
            aria-label="Alternar navegación"
          >
            <MaterialIcon name="menu" size={22} />
          </button>
        )}
        <h1 className="nilo-ctopbar__brand">NILO</h1>
      </div>

      <div className="nilo-ctopbar__right">
        <div className="nilo-ctopbar__actions">
          <div className="nilo-ctopbar__action-wrap">
            <button
              type="button"
              className={`nilo-ctopbar__tab${openPanel === 'patients' ? ' nilo-ctopbar__tab--active' : ''}`}
              onClick={() => togglePanel('patients')}
              aria-expanded={openPanel === 'patients'}
            >
              <MaterialIcon name="groups" size={20} />
              <span>Patients</span>
            </button>
            <ResourcePanel
              open={openPanel === 'patients'}
              searchPlaceholder="Search patients…"
              addLabel="Add patient"
              emptyLabel="No patients"
              noResultsLabel="No matching patients"
              items={patientItems}
              onAdd={() => {
                onAddPatient()
                setOpenPanel(null)
              }}
              onClose={() => setOpenPanel(null)}
            />
          </div>

          <div className="nilo-ctopbar__action-wrap" ref={devicesMenuRef}>
            <button
              type="button"
              className={`nilo-ctopbar__tab${openPanel === 'nodes' || openPanel === 'devices-menu' ? ' nilo-ctopbar__tab--active' : ''}`}
              onClick={() => {
                setOpenPanel((prev) => (prev === 'devices-menu' ? null : 'devices-menu'))
                setUserMenuOpen(false)
              }}
              aria-expanded={openPanel === 'devices-menu' || openPanel === 'nodes'}
            >
              <MaterialIcon name="devices" size={20} />
              <span>Devices</span>
              <MaterialIcon name="expand_more" size={18} className="nilo-ctopbar__tab-chevron" />
            </button>

            {openPanel === 'devices-menu' && (
              <div className="nilo-ctopbar__devices-menu" role="menu">
                <button
                  type="button"
                  className="nilo-ctopbar__devices-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setOpenPanel('nodes')
                    setUserMenuOpen(false)
                  }}
                >
                  <MaterialIcon name="hub" size={20} />
                  <span>Node</span>
                </button>
                <button
                  type="button"
                  className="nilo-ctopbar__devices-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setOpenPanel(null)
                    onOpenCardmed()
                  }}
                >
                  <MaterialIcon name="bluetooth" size={20} />
                  <span>Cardmed Device</span>
                </button>
              </div>
            )}

            <ResourcePanel
              open={openPanel === 'nodes'}
              searchPlaceholder="Search nodes…"
              addLabel="Add node"
              emptyLabel="No nodes"
              noResultsLabel="No matching nodes"
              items={nodeItems}
              onAdd={() => {
                onAddNode()
                setOpenPanel(null)
              }}
              onClose={() => setOpenPanel(null)}
            />
          </div>

          {fullscreenSupported && (
            <button
              type="button"
              className={`nilo-ctopbar__tab${isFullscreen ? ' nilo-ctopbar__tab--active' : ''}`}
              onClick={() => void handleToggleFullscreen()}
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              aria-pressed={isFullscreen}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              <MaterialIcon name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} size={20} />
              <span>Pantalla completa</span>
            </button>
          )}
        </div>

        <div className="nilo-ctopbar__user-wrap" ref={userRef}>
          <button
            type="button"
            className="nilo-ctopbar__user"
            onClick={() => {
              setUserMenuOpen((v) => !v)
              setOpenPanel(null)
            }}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
          >
            <Avatar name={fullName || 'NILO'} src={user?.avatarUrl} size={32} />
            <span className="nilo-ctopbar__user-name">{fullName}</span>
          </button>

          {userMenuOpen && (
            <div className="nilo-ctopbar__user-menu" role="menu">
              <button className="nilo-ctopbar__user-menu-item" role="menuitem" onClick={handleLogout}>
                <MaterialIcon name="logout" size={20} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
