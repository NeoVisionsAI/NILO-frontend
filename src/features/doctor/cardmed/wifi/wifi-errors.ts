export function cardmedWifiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      return 'Tiempo de espera agotado. ¿Estás conectado a la WiFi Nilocardmed-Config-xxxx?'
    }
    if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      return 'No se pudo contactar con el dispositivo. Conecta la tablet al AP Nilocardmed-Config-xxxx y vuelve a intentar.'
    }
    return error.message
  }
  if (typeof error === 'object' && error && 'error' in error) {
    return String((error as { error: string }).error)
  }
  return 'Error de red desconocido'
}
