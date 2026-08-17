import type { ReactNode } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import './CondataModuleLayout.css'

export type CondataModuleView = 'list' | 'add' | 'detail'

const STEPS: { id: CondataModuleView; label: string }[] = [
  { id: 'list', label: 'Lista' },
  { id: 'add', label: 'Nuevo' },
  { id: 'detail', label: 'Detalle' },
]

interface CondataModuleLayoutProps {
  view: CondataModuleView
  searchQuery: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  addLabel: string
  onAdd: () => void
  listContent: ReactNode
  addContent?: ReactNode
  detailContent?: ReactNode
  detailFooter?: ReactNode
}

/** Patrón lista → añadir → detalle dentro del contenedor principal. */
export function CondataModuleLayout({
  view,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  addLabel,
  onAdd,
  listContent,
  addContent,
  detailContent,
  detailFooter,
}: CondataModuleLayoutProps) {
  return (
    <div className={`nilo-cmodule nilo-cmodule--${view}`}>
      <nav className="nilo-cmodule__steps" aria-label="Vista del módulo">
        {STEPS.map((step) => (
          <span
            key={step.id}
            className={`nilo-cmodule__step${view === step.id ? ' nilo-cmodule__step--active' : ''}`}
            aria-current={view === step.id ? 'step' : undefined}
          >
            {step.label}
          </span>
        ))}
      </nav>

      {view === 'list' && (
        <>
          <div className="nilo-cmodule__toolbar">
            <label className="nilo-cmodule__search">
              <MaterialIcon name="search" size={18} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="nilo-cmodule__search-clear"
                  onClick={() => onSearchChange('')}
                  aria-label="Limpiar búsqueda"
                >
                  <MaterialIcon name="close" size={16} />
                </button>
              )}
            </label>
            <button type="button" className="nilo-cmodule__add-btn" onClick={onAdd}>
              <MaterialIcon name="add" size={20} />
              <span>{addLabel}</span>
            </button>
          </div>
          <div className="nilo-cmodule__list m3-scroll">{listContent}</div>
        </>
      )}

      {view === 'add' && addContent && (
        <div className="nilo-cmodule__panel nilo-cmodule__panel--add">{addContent}</div>
      )}

      {view === 'detail' && detailContent && (
        <>
          <div className="nilo-cmodule__panel nilo-cmodule__panel--detail m3-scroll">{detailContent}</div>
          {detailFooter && <footer className="nilo-cmodule__detail-footer">{detailFooter}</footer>}
        </>
      )}
    </div>
  )
}
