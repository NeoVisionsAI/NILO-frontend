import { useEffect } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' resalta la acción de confirmación en rojo (borrados). */
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Diálogo modal de confirmación (reutilizable para acciones destructivas). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div className="nilo-confirm m3" role="dialog" aria-modal="true" aria-labelledby="nilo-confirm-title">
      <div className="nilo-confirm__backdrop" onClick={() => !busy && onCancel()} />
      <div className="nilo-confirm__panel">
        <div className={`nilo-confirm__icon nilo-confirm__icon--${tone}`}>
          <MaterialIcon name={tone === 'danger' ? 'warning' : 'help'} size={26} />
        </div>
        <h2 id="nilo-confirm-title" className="nilo-confirm__title">
          {title}
        </h2>
        <p className="nilo-confirm__message">{message}</p>
        <div className="nilo-confirm__actions">
          <button
            type="button"
            className="nilo-confirm__btn nilo-confirm__btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`nilo-confirm__btn nilo-confirm__btn--${tone}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Eliminando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
