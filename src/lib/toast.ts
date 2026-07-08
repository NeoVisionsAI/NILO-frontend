/**
 * Store de notificaciones (toasts) global, framework-agnóstico.
 * - success: verde, 4 s.
 * - error: rojo, 7 s.
 * Cualquier módulo (servicios, componentes) puede lanzar toasts.
 */
export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  error: 7000,
  info: 4000,
}

let items: ToastItem[] = []
let nextId = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function getToasts(): ToastItem[] {
  return items
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

function push(type: ToastType, message: string, duration?: number): number {
  const id = ++nextId
  items = [...items, { id, type, message }]
  emit()
  window.setTimeout(() => dismissToast(id), duration ?? DEFAULT_DURATION[type])
  return id
}

export const toast = {
  success: (message: string, duration?: number) => push('success', message, duration),
  error: (message: string, duration?: number) => push('error', message, duration),
  info: (message: string, duration?: number) => push('info', message, duration),
}
