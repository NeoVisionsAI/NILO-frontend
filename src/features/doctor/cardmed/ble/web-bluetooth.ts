import { CARDMED_SERVICE_UUID, CARDMED_STORAGE_KEY } from './constants'
import type { SavedCardmedDevice } from './types'

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
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
    acceptAllDevices: true,
    optionalServices: [CARDMED_SERVICE_UUID],
  })

  if (!isCardmedDeviceName(device.name)) {
    throw new Error(
      `«${device.name ?? 'Dispositivo sin nombre'}» no parece un NiloCardmed. Busca un nombre con «nilo» o «cardmed».`,
    )
  }

  return device
}

export function loadSavedDevices(): SavedCardmedDevice[] {
  try {
    const raw = localStorage.getItem(CARDMED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedCardmedDevice[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveDeviceEntry(entry: SavedCardmedDevice) {
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

  return navigator.bluetooth.requestDevice({
    filters: [{ name }],
    optionalServices: [CARDMED_SERVICE_UUID],
  })
}

export function cardmedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotFoundError') return 'No se seleccionó ningún dispositivo.'
    if (error.name === 'SecurityError') return 'Permiso Bluetooth denegado.'
    if (error.message === 'timeout') return 'Tiempo de espera agotado.'
    return error.message
  }
  if (typeof error === 'object' && error && 'error' in error) {
    return String((error as { error: string }).error)
  }
  return 'Error desconocido'
}
