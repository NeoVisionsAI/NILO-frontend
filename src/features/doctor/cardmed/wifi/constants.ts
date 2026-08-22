/** API local del Pi en modo AP (solo accesible en Nilocardmed-Config-xxxx). */
export const CARDMED_WIFI_API_BASE =
  import.meta.env.VITE_CARDMED_WIFI_API_BASE ?? 'http://192.168.4.1:8080'

export const CARDMED_WIFI_AP_PREFIX = 'Nilocardmed-Config-'

export const CARDMED_WIFI_TIMEOUTS = {
  status: 8_000,
  command: 30_000,
  auth: 30_000,
  wifiScan: 60_000,
  wifiConnect: 90_000,
} as const

export function timeoutForWifiCommand(cmd: string): number {
  switch (cmd) {
    case 'wifi_scan':
      return CARDMED_WIFI_TIMEOUTS.wifiScan
    case 'wifi_connect':
    case 'wifi_test':
    case 'cardmed_test':
      return CARDMED_WIFI_TIMEOUTS.wifiConnect
    default:
      return CARDMED_WIFI_TIMEOUTS.command
  }
}
