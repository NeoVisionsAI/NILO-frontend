/** Comandos que bloquean otros writes BLE hasta completarse (p. ej. wifi_scan ~30 s). */
export const CARDMED_BLOCKING_COMMANDS = new Set([
  'wifi_scan',
  'wifi_connect',
  'camera_capture_test',
])

export function isGattFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('gatt') ||
    msg.includes('disconnected') ||
    msg === 'networkerror' ||
    error.name === 'NetworkError' ||
    error.name === 'NotSupportedError'
  )
}

export function isConnectionLostError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    isGattFailure(error) ||
    error.message === 'disconnected' ||
    error.message.startsWith('timeout BLE')
  )
}
