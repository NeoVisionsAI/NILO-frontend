import { useState, type MouseEvent, type PointerEvent } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/lib/toast'
import '../../components/condata/CondataModuleLayout.css'
import './ExploreDeleteButton.css'

interface ExploreDeleteButtonProps {
  itemLabel: string
  entityLabel: string
  onConfirmDelete: () => Promise<void>
  compact?: boolean
}

export function ExploreDeleteButton({
  itemLabel,
  entityLabel,
  onConfirmDelete,
  compact,
}: ExploreDeleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const openConfirm = (e: MouseEvent | PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
  }

  return (
    <div className="nilo-explore-del-host">
      <button
        type="button"
        className={`nilo-cmodule__action-btn nilo-cmodule__action-btn--danger nilo-explore-del${compact ? ' nilo-explore-del--compact' : ''}`}
        aria-label={`Eliminar ${entityLabel}`}
        title="Eliminar"
        style={{ cursor: 'pointer' }}
        onClick={openConfirm}
      >
        <MaterialIcon name="delete" size={compact ? 18 : 20} />
        <span className="nilo-explore-del__label">Eliminar</span>
      </button>
      <ConfirmDialog
        open={open}
        title={`Eliminar ${entityLabel}`}
        message={`¿Eliminar «${itemLabel}»? Esta operación no se puede deshacer. Se borrará el registro en el sistema y el fichero asociado en almacenamiento (MinIO), si existe.`}
        confirmLabel="Eliminar"
        tone="danger"
        busy={busy}
        onCancel={() => !busy && setOpen(false)}
        onConfirm={() => {
          setBusy(true)
          void onConfirmDelete()
            .then(() => {
              toast.success(`${entityLabel} eliminado.`)
              setOpen(false)
            })
            .catch(() => {
              toast.error(`No se pudo eliminar el ${entityLabel.toLowerCase()}.`)
            })
            .finally(() => setBusy(false))
        }}
      />
    </div>
  )
}