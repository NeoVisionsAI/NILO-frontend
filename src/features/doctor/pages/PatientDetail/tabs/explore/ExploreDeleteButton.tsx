import { MaterialIcon } from '@/components/ui/MaterialIcon'
import './ExploreDeleteButton.css'

interface ExploreDeleteButtonProps {
  entityLabel: string
  onDelete: () => void
  compact?: boolean
}

/** Disparador de borrado (confirmación en el padre, p. ej. SessionExploreTab). */
export function ExploreDeleteButton({ entityLabel, onDelete, compact }: ExploreDeleteButtonProps) {
  return (
    <button
      type="button"
      className={`nilo-explore-del${compact ? ' nilo-explore-del--compact' : ''}`}
      aria-label={`Eliminar ${entityLabel}`}
      title="Eliminar"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDelete()
      }}
    >
      <MaterialIcon name="delete" size={compact ? 18 : 20} />
    </button>
  )
}