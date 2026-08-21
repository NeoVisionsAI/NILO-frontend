import { CARDMED_SERVICE_UUID, CARDMED_STORAGE_KEY } from './constants'
import type { SavedCardmedDevice } from './types'

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

export function loadSavedDevices(): SavedCardmedDevice[] {
  try {
    const raw = localStorage.getItem(CARDMED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedCardmedDevice[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => isCardmedDeviceName(item.name))
  } catch {
    return []
  }
}

export function saveDeviceEntry(entry: SavedCardmedDevice) {
  if (!isCardmedDeviceName(entry.name)) return

  const list = loadSavedDevices().filter((item) => item.id !== entry.id)
  list.unshift(entry)
  localStorage.setItem(CARDMED_STORAGE_KEY, JSON.stringify(list.slice(0, 20)))
}

export function removeSavedDevice(deviceId: string) {
  const list = loadSavedDevices().filter((item) => item.id !== deviceId)
  localStorage.setItem(CARDMED_STORAGE_KEY, JSON.stringify(list))
}

export async function requestDeviceByName(name: string): Promise<BluetoothDevice> {
  if (!isWebBluetoothSupported() || !navigator.bluetooth) {
    throw new Error('Web Bluetooth no está disponible.')
  }

  if (!isCardmedDeviceName(name)) {
    throw new Error('El dispositivo guardado no coincide con un NiloCardmed.')
  }

  return navigator.bluetooth.requestDevice({
    filters: [{ name }],
    optionalServices: [CARDMED_SERVICE_UUID],
  })
}

export function cardmedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotFoundError') return 'No se seleccionó ningún dispositivo.'
    if (error.name === 'SecurityError') return 'Permiso Bluetooth denegado.'
    if (error.name === 'AbortError') return 'Escaneo cancelado.'
    if (error.message === 'timeout') return 'Tiempo de espera agotado.'
    if (error.message === 'SCAN_NOT_SUPPORTED') {
      return 'Escaneo en segundo plano no disponible; usa el selector del sistema.'
    }
    return error.message
  }
  if (typeof error === 'object' && error && 'error' in error) {
    return String((error as { error: string }).error)
  }
  return 'Error desconocido'
}
