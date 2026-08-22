import { CARDMED_SERVICE_UUID } from './constants'

export type CardmedBleDiscoveryMode = 'filtered' | 'acceptAll'

/** Filtro recomendado: solo NiloCardmed y Chrome suele mostrar el nombre completo. */
export const CARDMED_DEVICE_FILTER: BluetoothLEScanFilter = { namePrefix: 'NiloCardmed' }

export const CARDMED_FILTERED_REQUEST_OPTIONS: RequestDeviceOptions = {
  filters: [CARDMED_DEVICE_FILTER],
  optionalServices: [CARDMED_SERVICE_UUID],
}

/** Sin filtro: lista larga; muchos aparecen como «desconocido» aunque sean conectables. */
export const CARDMED_SYSTEM_PICKER_OPTIONS: RequestDeviceOptions = {
  acceptAllDevices: true,
  optionalServices: [CARDMED_SERVICE_UUID],
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export function isCardmedDeviceName(name: string | undefined | null): boolean {
  if (!name) return false
  return name.startsWith('NiloCardmed')
}

export function formatBleDeviceLabel(device: BluetoothDevice): string {
  if (device.name?.trim()) return device.name.trim()
  const shortId = device.id.length > 14 ? `${device.id.slice(0, 14)}…` : device.id
  return `Dispositivo sin nombre (${shortId})`
}

function assertBluetoothAvailable(): Bluetooth {
  if (!isWebBluetoothSupported() || !navigator.bluetooth) {
    throw new Error('Web Bluetooth no está disponible en este navegador.')
  }
  return navigator.bluetooth
}

function validateNamedCardmed(device: BluetoothDevice): BluetoothDevice {
  if (!isCardmedDeviceName(device.name)) {
    throw new Error(
      `«${formatBleDeviceLabel(device)}» no es un NiloCardmed. Elige uno cuyo nombre empiece por «NiloCardmed».`,
    )
  }
  return device
}

/** Selector filtrado: solo NiloCardmed-* con nombre visible (recomendado). */
export async function requestCardmedBleDeviceFiltered(): Promise<BluetoothDevice> {
  const bluetooth = assertBluetoothAvailable()
  const device = await bluetooth.requestDevice(CARDMED_FILTERED_REQUEST_OPTIONS)
  return validateNamedCardmed(device)
}

/**
 * Selector sin filtro: todos los BLE. Chrome muestra «desconocido» si el nombre no va en el anuncio;
 * aun así puedes elegirlo y validar con la contraseña tras conectar.
 */
export async function requestCardmedBleDeviceAcceptAll(): Promise<BluetoothDevice> {
  const bluetooth = assertBluetoothAvailable()
  return bluetooth.requestDevice(CARDMED_SYSTEM_PICKER_OPTIONS)
}

export async function requestCardmedBleDevice(
  mode: CardmedBleDiscoveryMode = 'filtered',
): Promise<BluetoothDevice> {
  return mode === 'acceptAll' ? requestCardmedBleDeviceAcceptAll() : requestCardmedBleDeviceFiltered()
}

/** Repite requestDevice (sin caché). Usa filtro con nombre visible. */
export async function requestDeviceByBleName(_bleName: string): Promise<BluetoothDevice> {
  return requestCardmedBleDeviceFiltered()
}

/** @deprecated Usar requestDeviceByBleName o requestCardmedBleDevice */
export async function requestDeviceByName(name: string): Promise<BluetoothDevice> {
  return requestDeviceByBleName(name)
}

export function cardmedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotFoundError') {
      return 'No se seleccionó ningún dispositivo. Si la lista filtrada estaba vacía, prueba «Ver todos los dispositivos».'
    }
    if (error.name === 'SecurityError') {
      return 'Permiso Bluetooth denegado. Usa HTTPS y concede permiso de dispositivos cercanos.'
    }
    if (error.name === 'AbortError') return 'Selección cancelada.'
    if (error.message === 'timeout' || error.message.startsWith('timeout BLE')) {
      return 'Tiempo de espera agotado en el dispositivo.'
    }
    if (error.message === 'GATT operation already in progress.') {
      return 'Operación BLE en curso. Espera un momento e inténtalo de nuevo.'
    }
    if (error.message === 'disconnected' || error.message.includes('Conexión Bluetooth')) {
      return error.message
    }
    if (error.name === 'NetworkError') {
      return 'Conexión Bluetooth perdida.'
    }
    return error.message
  }
  if (typeof error === 'object' && error && 'error' in error) {
    return String((error as { error: string }).error)
  }
  return 'Error desconocido'
}
