import { useEffect, useRef, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import './ClinicianSidebar.css'

type SectionKey = 'patients' | 'nodes'

export interface SidebarItemData {
  id: string
  primary: string
  secondary?: string
  searchText: string
  leading: React.ReactNode
  onSelect?: () => void
  selected?: boolean
}

interface SectionProps {
  title: string
  emptyIcon: string
  emptyLabel: string
  noResultsLabel: string
  addLabel: string
  searchPlaceholder: string
  addVariant: 'primary' | 'outlined'
  open: boolean
  onToggle: () => void
  onAdd?: () => void
  items: SidebarItemData[]
  first?: boolean
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase())
}

/** Sección plegable con búsqueda desplegable (Patients / Nodes). */
function Section({
  title,
  emptyIcon,
  emptyLabel,
  noResultsLabel,
  addLabel,
  searchPlaceholder,
  addVariant,
  open,
  onToggle,
  onAdd,
  items,
  first,
}: SectionProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filtered = searchQuery.trim()
    ? items.filter((item) => matchesQuery(item.searchText, searchQuery))
    : items

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  function toggleSearch(e: React.MouseEvent) {
    e.stopPropagation()
    setSearchOpen((v) => {
      if (v) setSearchQuery('')
      return !v
    })
  }

  const classes = [
    'nilo-csidebar__section',
    open ? 'nilo-csidebar__section--open' : 'nilo-csidebar__section--closed',
    first ? 'nilo-csidebar__section--first' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <div className="nilo-csidebar__section-head">
        <button
          className="nilo-csidebar__section-toggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <MaterialIcon
            name="expand_more"
            size={20}
            className="nilo-csidebar__section-chevron"
            style={{ transform: open ? 'none' : 'rotate(-90deg)' }}
          />
          <h2 className="nilo-csidebar__section-title">{title}</h2>
        </button>

        <div className="nilo-csidebar__head-actions">
          <button
            className={`nilo-csidebar__search-btn${searchOpen ? ' nilo-csidebar__search-btn--active' : ''}`}
            onClick={toggleSearch}
            title="Buscar"
            aria-label="Buscar"
            aria-expanded={searchOpen}
          >
            <MaterialIcon name="search" size={18} />
          </button>
          <button
            className="nilo-csidebar__add"
            onClick={(e) => {
              e.stopPropagation()
              onAdd?.()
            }}
            title={addLabel}
            aria-label={addLabel}
          >
            <MaterialIcon name="add" size={20} />
          </button>
        </div>
      </div>

      {open && (
        <>
          <div
            className={
              searchOpen
                ? 'nilo-csidebar__search nilo-csidebar__search--open'
                : 'nilo-csidebar__search'
            }
          >
            <MaterialIcon name="search" size={18} className="nilo-csidebar__search-icon" />
            <input
              ref={searchInputRef}
              type="search"
              className="nilo-csidebar__search-input"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={searchPlaceholder}
            />
            {searchQuery && (
              <button
                type="button"
                className="nilo-csidebar__search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
              >
                <MaterialIcon name="close" size={16} />
              </button>
            )}
          </div>

          <div className="nilo-csidebar__section-body m3-scroll">
            {items.length === 0 ? (
              <div className="nilo-csidebar__empty">
                <MaterialIcon name={emptyIcon} size={24} />
                <p>{emptyLabel}</p>
                <button
                  className={`nilo-csidebar__cta nilo-csidebar__cta--${addVariant}`}
                  onClick={onAdd}
                >
                  <MaterialIcon name="add" size={18} />
                  <span>{addLabel}</span>
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="nilo-csidebar__empty">
                <MaterialIcon name="search_off" size={24} />
                <p>{noResultsLabel}</p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  className={[
                    'nilo-csidebar__item',
                    item.selected ? 'nilo-csidebar__item--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={item.onSelect}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      item.onSelect?.()
                    }
                  }}
                  role={item.onSelect ? 'button' : undefined}
                  tabIndex={item.onSelect ? 0 : undefined}
                >
                  {item.leading}
                  <div className="nilo-csidebar__item-text">
                    <span className="nilo-csidebar__item-primary">{item.primary}</span>
                    {item.secondary && (
                      <span className="nilo-csidebar__item-secondary">{item.secondary}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

interface ClinicianSidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
  patientItems?: SidebarItemData[]
  nodeItems?: SidebarItemData[]
  onAddPatient?: () => void
  onAddNode?: () => void
}

/**
 * Barra lateral del área clínica (Contenedor A del dashboard).
 */
export function ClinicianSidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
  patientItems = [],
  nodeItems = [],
  onAddPatient,
  onAddNode,
}: ClinicianSidebarProps) {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    patients: true,
    nodes: true,
  })

  function toggle(key: SectionKey) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function openFromRail(key: SectionKey) {
    setOpen((prev) => ({ ...prev, [key]: true }))
    onToggleCollapse?.()
  }

  const classes = [
    'nilo-csidebar',
    collapsed ? 'nilo-csidebar--collapsed' : '',
    mobileOpen ? 'nilo-csidebar--mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        className={
          mobileOpen
            ? 'nilo-csidebar__overlay nilo-csidebar__overlay--visible'
            : 'nilo-csidebar__overlay'
        }
        onClick={onCloseMobile}
      />
      <aside className={classes}>
        <div className="nilo-csidebar__inner">
          {collapsed ? (
            <div className="nilo-csidebar__rail">
              <button
                className="nilo-csidebar__rail-btn"
                title="Patients"
                onClick={() => openFromRail('patients')}
              >
                <MaterialIcon name="groups" size={22} />
              </button>
              <button
                className="nilo-csidebar__rail-btn"
                title="Nodes"
                onClick={() => openFromRail('nodes')}
              >
                <MaterialIcon name="hub" size={22} />
              </button>
            </div>
          ) : (
            <>
              <Section
                first
                title="Patients"
                emptyIcon="person_off"
                emptyLabel="No patients"
                noResultsLabel="No matching patients"
                addLabel="Add patient"
                searchPlaceholder="Search patients…"
                addVariant="primary"
                open={open.patients}
                onToggle={() => toggle('patients')}
                onAdd={onAddPatient}
                items={patientItems}
              />
              <Section
                title="Nodes"
                emptyIcon="hub_off"
                emptyLabel="No nodes"
                noResultsLabel="No matching nodes"
                addLabel="Add node"
                searchPlaceholder="Search nodes…"
                addVariant="outlined"
                open={open.nodes}
                onToggle={() => toggle('nodes')}
                onAdd={onAddNode}
                items={nodeItems}
              />
            </>
          )}
        </div>

        <button
          className="nilo-csidebar__handle"
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
