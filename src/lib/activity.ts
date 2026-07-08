/**
 * Store mínimo (pub/sub) que cuenta las peticiones en curso al backend.
 * El cliente API incrementa/decrementa el contador y la barra de carga
 * superior se suscribe para mostrarse mientras haya actividad.
 */
let count = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function startActivity() {
  count += 1
  emit()
}

export function endActivity() {
  count = Math.max(0, count - 1)
  emit()
}

export function isActive(): boolean {
  return count > 0
}

export function subscribeActivity(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
