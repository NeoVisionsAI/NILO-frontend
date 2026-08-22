import { CARDMED_SERVICE_UUID } from './constants'

/**
 * Descubrimiento Web Bluetooth (Android): solo namePrefix.
 * NO usar { services: [UUID] } en filters — el UUID no va en advertising.
 */
export const CARDMED_DEVICE_FILTER: BluetoothLEScanFilter = { namePrefix: 'NiloCardmed' }

export const CARDMED_REQUEST_DEVICE_OPTIONS: RequestDeviceOptions = {
  filters: [CARDMED_DEVICE_FILTER],
  optionalServices: [CARDMED_SERVICE_UUID],
}

export const CARDMED_DIAGNOSTIC_REQUEST_OPTIONS: RequestDeviceOptions = {
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

/** Selector nativo filtrado (recomendado). Requiere gesto de usuario (tap). */
export async function requestCardmedBleDevice(): Promise<BluetoothDevice> {
  const bluetooth = assertBluetoothAvailable()
  const device = await bluetooth.requestDevice(CARDMED_REQUEST_DEVICE_OPTIONS)

  if (!isCardmedDeviceName(device.name)) {
    throw new Error(
      `«${formatBleDeviceLabel(device)}» no es un NiloCardmed. Elige uno cuyo nombre empiece por «NiloCardmed».`,
    )
  }

  return device
}

/**
 * Diagnóstico: si aquí aparece NiloCardmed pero no con filtros, el bug eran los filters de la app.
 * Solo builds de desarrollo.
 */
export async function requestCardmedBleDeviceDiagnostic(): Promise<BluetoothDevice> {
  if (!import.meta.env.DEV) {
    throw new Error('Diagnóstico BLE solo en desarrollo.')
  }
  const bluetooth = assertBluetoothAvailable()
  return bluetooth.requestDevice(CARDMED_DIAGNOSTIC_REQUEST_OPTIONS)
}

export async function requestDeviceByBleName(_bleName: string): Promise<BluetoothDevice> {
  return requestCardmedBleDevice()
}

/** @deprecated Usar requestDeviceByBleName o requestCardmedBleDevice */
export async function requestDeviceByName(name: string): Promise<BluetoothDevice> {
  return requestDeviceByBleName(name)
}

export function cardmedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotFoundError') {
      return (
        'No apareció ningún NiloCardmed en el selector. Revisa filtros (namePrefix). ' +
        'En Android a veces el stack solo escanea tras abrir Ajustes → Bluetooth; eso es un workaround del SO, no la solución. ' +
        'No emparejes el Pi en Ajustes: conecta solo desde esta app.'
      )
    }
    if (error.name === 'SecurityError') {
      return 'Permiso Bluetooth denegado. Usa HTTPS y concede permiso de dispositivos cercanos.'
    }
    if (error.name === 'AbortError') return 'Selección cancelada.'
    if (error.message === 'timeout' || error.message.startsWith('timeout BLE')) {
      return error.message.includes('gatt.connect')
        ? `${error.message}. Acerca el tablet al Pi e inténtalo de nuevo (timeout 30 s).`
        : 'Tiempo de espera agotado en el dispositivo.'
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
