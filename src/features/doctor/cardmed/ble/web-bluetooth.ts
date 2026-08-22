import { CARDMED_SERVICE_UUID } from './constants'

/**
 * Filtro de descubrimiento Web Bluetooth.
 * El Pi anuncia LocalName `NiloCardmed-<uuid>`; NO incluye el UUID de servicio en advertising.
 * optionalServices es solo para GATT tras conectar, no para descubrimiento.
 */
export const CARDMED_DEVICE_FILTER: BluetoothLEScanFilter = { namePrefix: 'NiloCardmed' }

export const CARDMED_REQUEST_DEVICE_OPTIONS: RequestDeviceOptions = {
  filters: [CARDMED_DEVICE_FILTER],
  optionalServices: [CARDMED_SERVICE_UUID],
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export function isCardmedDeviceName(name: string | undefined | null): boolean {
  if (!name) return false
  return name.startsWith('NiloCardmed')
}

/** Abre el diálogo nativo de Chrome/Android para elegir un NiloCardmed. Requiere gesto de usuario. */
export async function requestCardmedBleDevice(): Promise<BluetoothDevice> {
  if (!isWebBluetoothSupported() || !navigator.bluetooth) {
    throw new Error('Web Bluetooth no está disponible en este navegador.')
  }

  const device = await navigator.bluetooth.requestDevice(CARDMED_REQUEST_DEVICE_OPTIONS)

  if (!isCardmedDeviceName(device.name)) {
    throw new Error(
      `«${device.name ?? 'Dispositivo sin nombre'}» no es un NiloCardmed. Elige uno cuyo nombre empiece por «NiloCardmed».`,
    )
  }

  return device
}

/**
 * Diagnóstico temporal: si con esto aparece el dispositivo pero no con namePrefix, el filtro era el bug.
 * Solo disponible en builds de desarrollo.
 */
export async function requestCardmedBleDeviceDebugAcceptAll(): Promise<BluetoothDevice> {
  if (!import.meta.env.DEV) {
    throw new Error('Diagnóstico BLE solo disponible en desarrollo.')
  }
  if (!isWebBluetoothSupported() || !navigator.bluetooth) {
    throw new Error('Web Bluetooth no está disponible.')
  }

  return navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [CARDMED_SERVICE_UUID],
  })
}

/** Repite requestDevice (sin caché de BluetoothDevice). Mismo filtro namePrefix. */
export async function requestDeviceByBleName(_bleName: string): Promise<BluetoothDevice> {
  return requestCardmedBleDevice()
}

/** @deprecated Usar requestDeviceByBleName o requestCardmedBleDevice */
export async function requestDeviceByName(name: string): Promise<BluetoothDevice> {
  return requestDeviceByBleName(name)
}

export function cardmedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotFoundError') return 'No se seleccionó ningún dispositivo.'
    if (error.name === 'SecurityError') return 'Permiso Bluetooth denegado.'
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
