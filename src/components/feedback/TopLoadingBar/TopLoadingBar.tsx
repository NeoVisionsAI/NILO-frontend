import { useSyncExternalStore } from 'react'
import { isActive, subscribeActivity } from '@/lib/activity'
import './TopLoadingBar.css'

/**
 * Barra de progreso indeterminada fija en la parte superior.
 * Se muestra mientras haya al menos una petición al backend en curso.
 */
export function TopLoadingBar() {
  const active = useSyncExternalStore(subscribeActivity, isActive, isActive)
  if (!active) return null
  return (
    <div className="nilo-loadingbar" role="progressbar" aria-label="Cargando">
      <div className="nilo-loadingbar__indicator" />
    </div>
  )
}
