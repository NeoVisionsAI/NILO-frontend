import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { PATIENT_QUICK_ACTIONS, type PatientQuickAction } from '../patient-quick-actions'
import './PatientQuickActionsFab.css'

interface PatientQuickActionsFabProps {
  onSelect?: (action: PatientQuickAction) => void
}

export function PatientQuickActionsFab({ onSelect }: PatientQuickActionsFabProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function handleSelect(action: PatientQuickAction) {
    setOpen(false)
    onSelect?.(action)
    toast.info(`«${action.label}»: pendiente de implementar.`)
  }

  return (
    <div ref={rootRef} className={`nilo-pdetail-fab${open ? ' nilo-pdetail-fab--open' : ''}`}>
      {open && <div className="nilo-pdetail-fab__backdrop" aria-hidden="true" />}

      <div className="nilo-pdetail-fab__menu" role="menu" aria-hidden={!open}>
        {PATIENT_QUICK_ACTIONS.map((action, index) => (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            className="nilo-pdetail-fab__option"
            style={{ '--fab-index': index } as CSSProperties}
            onClick={() => handleSelect(action)}
            tabIndex={open ? 0 : -1}
          >
            <span className="nilo-pdetail-fab__option-label">{action.label}</span>
            <span className="nilo-pdetail-fab__option-icon">
              <MaterialIcon name={action.icon} size={22} />
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="nilo-pdetail-fab__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? 'Cerrar acciones rápidas' : 'Acciones rápidas'}
      >
        <MaterialIcon name={open ? 'close' : 'add'} size={28} />
      </button>
    </div>
  )
}
