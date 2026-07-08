import { useSyncExternalStore } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { dismissToast, getToasts, subscribeToasts } from '@/lib/toast'
import type { ToastType } from '@/lib/toast'
import './ToastHost.css'

const ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
}

/** Renderiza la pila de toasts activos (esquina superior derecha). */
export function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)

  if (toasts.length === 0) return null

  return (
    <div className="nilo-toasts" role="region" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`nilo-toast nilo-toast--${t.type}`} role="alert">
          <MaterialIcon name={ICONS[t.type]} size={20} className="nilo-toast__icon" />
          <span className="nilo-toast__msg">{t.message}</span>
          <button
            className="nilo-toast__close"
            onClick={() => dismissToast(t.id)}
            aria-label="Cerrar"
          >
            <MaterialIcon name="close" size={18} />
          </button>
        </div>
      ))}
    </div>
  )
}
