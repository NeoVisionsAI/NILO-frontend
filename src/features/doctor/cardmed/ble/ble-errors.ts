/** Comandos largos que bloquean ping/polling y otros comandos en la UI. */
export const CARDMED_BLOCKING_COMMANDS = new Set([
  'wifi_scan',
  'wifi_connect',
  'camera_capture_test',
  'camera_capture_chunk',
  'cardmed_test',
])

export function isGattFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('gatt') ||
    msg.includes('failed to write') ||
    msg.includes('disconnected') ||
    msg === 'networkerror' ||
    error.name === 'NetworkError' ||
    error.name === 'NotSupportedError'
  )
}

export function isBleTimeout(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('timeout BLE')
}

export function isConnectionLostError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (isBleTimeout(error)) return false
  return isGattFailure(error) || error.message === 'disconnected'
}
