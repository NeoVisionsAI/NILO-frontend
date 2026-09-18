import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Button } from '@/components/ui/Button'
import type { AdminListFilters } from '../hooks/useAdminList'
import './AdminShared.css'

interface FilterField {
  key: keyof AdminListFilters
  label: string
  placeholder?: string
}

interface AdminSearchToolbarProps {
  q: string
  onQChange: (value: string) => void
  filters: AdminListFilters
  onFilterChange: (key: keyof AdminListFilters, value: string) => void
  showFilters: boolean
  onToggleFilters: () => void
  onSearch: () => void
  onReset: () => void
  filterFields: FilterField[]
  newLabel: string
  onNew: () => void
}

export function AdminSearchToolbar({
  q,
  onQChange,
  filters,
  onFilterChange,
  showFilters,
  onToggleFilters,
  onSearch,
  onReset,
  filterFields,
  newLabel,
  onNew,
}: AdminSearchToolbarProps) {
  return (
    <div className="admin-toolbar">
      <form
        className="admin-toolbar__search"
        onSubmit={(e) => {
          e.preventDefault()
          onSearch()
        }}
      >
        <div className="admin-toolbar__q">
          <MaterialIcon name="search" size={20} />
          <input
            type="search"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Buscar (q)…"
            aria-label="Búsqueda libre"
          />
        </div>
        <Button type="submit" size="sm">
          Buscar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onToggleFilters}>
          {showFilters ? 'Ocultar filtros' : 'Filtros'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onReset}>
          Limpiar
        </Button>
      </form>

      <Button size="sm" onClick={onNew}>
        {newLabel}
      </Button>

      {showFilters && (
        <div className="admin-toolbar__filters">
          {filterFields.map((field) => (
            <label key={field.key} className="admin-field">
              <span>{field.label}</span>
              <input
                type="text"
                value={filters[field.key] ?? ''}
                onChange={(e) => onFilterChange(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
