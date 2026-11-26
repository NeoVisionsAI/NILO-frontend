import { MaterialIcon } from '@/components/ui/MaterialIcon'
import './ExploreDeleteButton.css'

interface ExploreDeleteButtonProps {
  entityLabel: string
  onDelete: () => void
}

/** Disparador de borrado (confirmación en el padre, p. ej. SessionExploreTab). */
export function ExploreDeleteButton({ entityLabel, onDelete }: ExploreDeleteButtonProps) {
  return (
    <button
      type="button"
      className="nilo-explore-round-btn nilo-explore-round-btn--del"
      aria-label={`Eliminar ${entityLabel}`}
      title="Eliminar"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDelete()
      }}
    >
      <MaterialIcon name="delete" size={18} />
    </button>
  )
}