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

export interface CardmedDeviceLocation {
  address?: string
  city?: string
  zip?: string
  lat?: number | null
  lon?: number | null
  /** Texto libre: planta, habitación, referencias… */
  additionalNotes?: string
}

/** Dispositivo emparejado guardado en localStorage (metadatos + credenciales BLE). */
export interface SavedCardmedDevice {
  /** ID estable del dispositivo Bluetooth (equivalente a MAC en Web Bluetooth). */
  id: string
  /** Nombre BLE del dispositivo (no editable). */
  bleName: string
  /** Alias definido por el usuario en la app. */
  displayName?: string
  /** Contraseña BLE para reconexión automática. */
  password?: string
  /** Fecha del primer emparejamiento. */
  pairedAt: string
  lastConnected?: string
  location?: CardmedDeviceLocation
}

/** @deprecated Usar bleName — conservado para migración desde versiones anteriores. */
export interface LegacySavedCardmedDevice {
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
