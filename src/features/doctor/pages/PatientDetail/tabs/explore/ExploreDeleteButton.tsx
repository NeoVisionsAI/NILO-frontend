import { useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/lib/toast'
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

  return (
    <>
      <button
        type="button"
        className={`nilo-explore-del${compact ? ' nilo-explore-del--compact' : ''}`}
        aria-label={`Eliminar ${entityLabel}`}
        title="Eliminar"
        onClick={() => setOpen(true)}
      >
        <MaterialIcon name="delete" size={compact ? 18 : 20} />
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
    </>
  )
}