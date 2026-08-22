/** Errores de red al contactar el Pi en 192.168.4.1 (fuera del AP). */
export function isWifiNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg === 'failed to fetch' || msg.includes('networkerror') || error.name === 'NetworkError'
  }
  return false
}

export function cardmedWifiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      return 'Tiempo de espera agotado. ¿Estás conectado a la WiFi Nilocardmed-Config-xxxx?'
    }
    if (isWifiNetworkError(error)) {
      return 'No se pudo contactar con el Pi (192.168.4.1). Conecta la tablet al AP Nilocardmed-Config-xxxx y vuelve a intentar.'
    }
    if (error.message.includes('dashboard_failed')) {
      return 'Error interno del Pi al generar el panel (dashboard_failed). Ejecuta update.sh en el dispositivo e inténtalo de nuevo.'
    }
    return error.message
  }
  if (typeof error === 'object' && error && 'error' in error) {
    return String((error as { error: string }).error)
  }
  return 'Error de red desconocido'
}

export function formatDashboardHttpError(status: number, bodyError?: string): string {
  if (status === 500 && bodyError === 'dashboard_failed') {
    return 'Error interno del Pi al generar el panel (dashboard_failed). Ejecuta update.sh en el dispositivo.'
  }
  if (status >= 500) {
    return `Error del dispositivo al cargar el panel (HTTP ${status}). Comprueba que el Pi esté actualizado.`
  }
  return `Panel de estado no disponible (HTTP ${status}). ¿Estás en la WiFi Nilocardmed-Config-xxxx?`
}

export function formatWifiScanMode(scanMode?: string): string | null {
  if (!scanMode) return null
  if (scanMode.includes('iw_fallback') || scanMode === 'rescan+iw_fallback') {
    return 'Escaneo ampliado (rescan + iw) — el Pi usó un método alternativo por limitaciones del AP+STA.'
  }
  return `Modo de escaneo: ${scanMode}`
}

import { CARDMED_WIFI_TIMEOUTS } from './constants'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** Espera mínima de UI antes de mostrar «sin redes» tras wifi_scan. */
export async function withWifiScanMinWait<T>(promise: Promise<T>): Promise<T> {
  const [result] = await Promise.all([promise, delay(CARDMED_WIFI_TIMEOUTS.wifiScanMinUiMs)])
  return result
}
