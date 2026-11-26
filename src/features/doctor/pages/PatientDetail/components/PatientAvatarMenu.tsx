import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import './PatientAvatarMenu.css'

interface PatientAvatarMenuProps {
  children: ReactNode
  patientName: string
  onEdit: () => void
  onDelete: () => void
}

export function PatientAvatarMenu({ children, patientName, onEdit, onDelete }: PatientAvatarMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="nilo-pdetail-avatar-menu" ref={wrapRef}>
      <button
        type="button"
        className={`nilo-pdetail-avatar-menu__trigger${open ? ' nilo-pdetail-avatar-menu__trigger--open' : ''}`}
        aria-label={`Opciones de ${patientName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nilo-pdetail-avatar-menu__avatar">{children}</span>
        <span className="nilo-pdetail-avatar-menu__chev" aria-hidden>
          <MaterialIcon name={open ? 'expand_less' : 'expand_more'} size={16} />
        </span>
      </button>

      {open ? (
        <div className="nilo-pdetail-avatar-menu__dropdown" role="menu">
          <p className="nilo-pdetail-avatar-menu__dropdown-title">{patientName}</p>
          <button
            type="button"
            role="menuitem"
            className="nilo-pdetail-avatar-menu__item"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
          >
            <MaterialIcon name="edit" size={20} />
            <span>Editar</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="nilo-pdetail-avatar-menu__item nilo-pdetail-avatar-menu__item--danger"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
          >
            <MaterialIcon name="delete" size={20} />
            <span>Borrar</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}