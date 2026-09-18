import { useEffect, type ReactNode } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import './AdminShared.css'

interface AdminModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function AdminModal({ open, title, onClose, children, footer, wide }: AdminModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
      <div className="admin-modal__backdrop" onClick={onClose} />
      <div className={`admin-modal__panel${wide ? ' admin-modal__panel--wide' : ''}`}>
        <header className="admin-modal__header">
          <h2 id="admin-modal-title">{title}</h2>
          <button type="button" className="admin-modal__close" onClick={onClose} aria-label="Cerrar">
            <MaterialIcon name="close" size={22} />
          </button>
        </header>
        <div className="admin-modal__body m3-scroll">{children}</div>
        {footer && <footer className="admin-modal__footer">{footer}</footer>}
      </div>
    </div>
  )
}
