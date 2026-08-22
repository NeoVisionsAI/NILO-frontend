export const CARDMED_SERVICE_UUID = '6e400010-b5a3-f393-e0a9-e50e24dcca9e'
export const CARDMED_RX_UUID = '6e400011-b5a3-f393-e0a9-e50e24dcca9e'
export const CARDMED_TX_UUID = '6e400012-b5a3-f393-e0a9-e50e24dcca9e'

export const CARDMED_STORAGE_KEY = 'nilo.cardmed.saved-devices'

/** Timeouts mínimos recomendados por tipo de operación BLE. */
export const CARDMED_TIMEOUTS = {
  default: 30_000,
  wifiScan: 60_000,
  wifiConnect: 90_000,
  imageDownload: 120_000,
} as const satisfies Record<string, number>

export function timeoutForCommand(cmd: string): number {
  switch (cmd) {
    case 'wifi_scan':
      return CARDMED_TIMEOUTS.wifiScan
    case 'wifi_connect':
    case 'wifi_test':
    case 'cardmed_test':
      return CARDMED_TIMEOUTS.wifiConnect
    case 'camera_capture_test':
    case 'camera_capture_chunk':
      return CARDMED_TIMEOUTS.imageDownload
    default:
      return CARDMED_TIMEOUTS.default
  }
}
