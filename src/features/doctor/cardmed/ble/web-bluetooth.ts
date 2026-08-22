import { CARDMED_SERVICE_UUID } from './constants'

export const CARDMED_REQUEST_DEVICE_FILTERS: BluetoothLEScanFilter[] = [
  { namePrefix: 'Nilo' },
  { namePrefix: 'Cardmed' },
  { services: [CARDMED_SERVICE_UUID] },
]

export interface ScannedBleDevice {
  id: string
  name: string
  device: BluetoothDevice
  rssi?: number
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export function isLeScanSupported(): boolean {
  return (
    isWebBluetoothSupported() &&
    typeof navigator.bluetooth?.requestLEScan === 'function'
  )
}

export function isCardmedDeviceName(name: string | undefined | null): boolean {
  if (!name) return false
  const normalized = name.toLowerCase()
  return normalized.includes('nilo') || normalized.includes('cardmed')
}

export async function requestCardmedBleDevice(): Promise<BluetoothDevice> {
  if (!isWebBluetoothSupported() || !navigator.bluetooth) {
    throw new Error('Web Bluetooth no está disponible en este navegador.')
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: CARDMED_REQUEST_DEVICE_FILTERS,
    optionalServices: [CARDMED_SERVICE_UUID],
  })

  if (!isCardmedDeviceName(device.name)) {
    throw new Error(
      `«${device.name ?? 'Dispositivo sin nombre'}» no parece un NiloCardmed. Busca un nombre con «nilo» o «cardmed».`,
    )
  }

  return device
}

export async function scanCardmedDevices(options?: {
  timeoutMs?: number
  onUpdate?: (devices: ScannedBleDevice[]) => void
  signal?: AbortSignal
}): Promise<ScannedBleDevice[]> {
  const bluetooth = navigator.bluetooth
  if (!bluetooth?.requestLEScan) {
    throw new Error('SCAN_NOT_SUPPORTED')
  }

  const timeoutMs = options?.timeoutMs ?? 12_000
  const found = new Map<string, ScannedBleDevice>()

  const publish = () => {
    const list = Array.from(found.values()).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
    options?.onUpdate?.(list)
  }

  const scan = await bluetooth.requestLEScan({
    acceptAllAdvertisements: true,
    keepRepeatedDevices: true,
  })

  const onAdvertisement = (event: BluetoothAdvertisingEvent) => {
    const label = event.device.name ?? event.name
    if (!isCardmedDeviceName(label)) return

    found.set(event.device.id, {
      id: event.device.id,
      name: label ?? 'Dispositivo sin nombre',
      device: event.device,
      rssi: event.rssi,
    })
    publish()
  }

  bluetooth.addEventListener('advertisementreceived', onAdvertisement)

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, timeoutMs)

      if (options?.signal) {
        if (options.signal.aborted) {
          window.clearTimeout(timer)
          reject(new DOMException('Escaneo cancelado.', 'AbortError'))
          return
        }
        options.signal.addEventListener(
          'abort',
          () => {
            window.clearTimeout(timer)
            reject(new DOMException('Escaneo cancelado.', 'AbortError'))
          },
          { once: true },
        )
      }
    })
  } finally {
    scan.stop()
    bluetooth.removeEventListener('advertisementreceived', onAdvertisement)
  }

  return Array.from(found.values()).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
}

export async function requestDeviceByBleName(bleName: string): Promise<BluetoothDevice> {
  if (!isWebBluetoothSupported() || !navigator.bluetooth) {
    throw new Error('Web Bluetooth no está disponible.')
  }

  if (!isCardmedDeviceName(bleName)) {
    throw new Error('El dispositivo guardado no coincide con un NiloCardmed.')
  }

  return navigator.bluetooth.requestDevice({
    filters: [{ name: bleName }],
    optionalServices: [CARDMED_SERVICE_UUID],
  })
}

/** @deprecated Usar requestDeviceByBleName */
export async function requestDeviceByName(name: string): Promise<BluetoothDevice> {
  return requestDeviceByBleName(name)
}

export function cardmedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotFoundError') return 'No se seleccionó ningún dispositivo.'
    if (error.name === 'SecurityError') return 'Permiso Bluetooth denegado.'
    if (error.name === 'AbortError') return 'Escaneo cancelado.'
    if (error.message === 'timeout' || error.message.startsWith('timeout BLE')) {
      return 'Tiempo de espera agotado.'
    }
    if (error.message === 'SCAN_NOT_SUPPORTED') {
      return 'Escaneo en segundo plano no disponible; usa el selector del sistema.'
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
