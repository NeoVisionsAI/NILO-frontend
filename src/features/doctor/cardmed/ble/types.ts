export interface CardmedResponse<T = Record<string, unknown>> {
  ok: boolean
  cmd?: string
  id?: string
  data?: T
  error?: string
}

export interface CardmedAuthData {
  token: string
  expires_in: number
  device_name: string
}

export interface SavedCardmedDevice {
  id: string
  name: string
  lastConnected?: string
}

export interface WifiNetwork {
  ssid: string
  signal: number
  security?: string
  bssid?: string
  frequency_mhz?: number
}

export interface CameraDevice {
  id: string
  path: string
  name: string
  driver?: string
  bus_info?: string
  supports_capture?: boolean
}

export interface HealthComponent {
  name: string
  ok: boolean
  message?: string
  severity?: string
}

export type CardmedConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'disconnected'
  | 'error'
