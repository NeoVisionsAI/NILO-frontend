import { CARDMED_SERVICE_UUID } from './constants'

/** Filtro preferido cuando Chrome lo respeta (lista ya filtrada). */
export const CARDMED_DEVICE_FILTER: BluetoothLEScanFilter = { namePrefix: 'NiloCardmed' }

export const CARDMED_FILTERED_REQUEST_OPTIONS: RequestDeviceOptions = {
  filters: [CARDMED_DEVICE_FILTER],
  optionalServices: [CARDMED_SERVICE_UUID],
}

/** Selector del sistema sin filtro: muestra todos los BLE cercanos (como Ajustes → Bluetooth). */
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

function assertBluetoothAvailable(): Bluetooth {
  if (!isWebBluetoothSupported() || !navigator.bluetooth) {
    throw new Error('Web Bluetooth no está disponible en este navegador.')
  }
  return navigator.bluetooth
}

function validateCardmedSelection(device: BluetoothDevice): BluetoothDevice {
  if (!isCardmedDeviceName(device.name)) {
    throw new Error(
      `«${device.name ?? 'Dispositivo sin nombre'}» no es un NiloCardmed. En el selector elige uno cuyo nombre empiece por «NiloCardmed».`,
    )
  }
  return device
}

/**
 * Abre el selector Bluetooth del sistema (diálogo nativo de Chrome/Android).
 * Usa acceptAllDevices para listar todos los BLE cercanos; validamos el nombre tras elegir.
 * Requiere gesto de usuario (tap en botón).
 */
export async function requestCardmedBleDevice(): Promise<BluetoothDevice> {
  const bluetooth = assertBluetoothAvailable()
  const device = await bluetooth.requestDevice(CARDMED_SYSTEM_PICKER_OPTIONS)
  return validateCardmedSelection(device)
}

/**
 * Mismo selector con filtro namePrefix (lista más corta). Si sale vacía en tu tablet, usa requestCardmedBleDevice().
 */
export async function requestCardmedBleDeviceFiltered(): Promise<BluetoothDevice> {
  const bluetooth = assertBluetoothAvailable()
  const device = await bluetooth.requestDevice(CARDMED_FILTERED_REQUEST_OPTIONS)
  return validateCardmedSelection(device)
}

/** @deprecated Alias de requestCardmedBleDevice */
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
      return 'No se seleccionó ningún dispositivo. Si la lista estaba vacía, comprueba Bluetooth activo y que el NiloCardmed esté encendido.'
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
