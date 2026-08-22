import { CARDMED_SERVICE_UUID } from './constants'

export const CARDMED_REQUEST_DEVICE_FILTERS: BluetoothLEScanFilter[] = [
  { namePrefix: 'Nilo' },
  { namePrefix: 'Cardmed' },
  { services: [CARDMED_SERVICE_UUID] },
]

/** Filtros para requestLEScan (solo anuncios Nilo/Cardmed, mucho más rápido que acceptAll). */
export const CARDMED_LE_SCAN_FILTERS: BluetoothLEScanFilter[] = CARDMED_REQUEST_DEVICE_FILTERS

export const CARDMED_SCAN_DEFAULTS = {
  /** Tiempo máximo de escaneo si no aparece nada. */
  maxDurationMs: 7_000,
  /** Mínimo antes de poder parar tras el primer hallazgo. */
  minDurationMs: 1_200,
  /** Tras ver el primer dispositivo, esperar un poco por RSSI/nombre y parar. */
  settleAfterFindMs: 900,
} as const

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
  minDurationMs?: number
  settleAfterFindMs?: number
  knownNames?: Map<string, string>
  onUpdate?: (devices: ScannedBleDevice[]) => void
  signal?: AbortSignal
}): Promise<ScannedBleDevice[]> {
  const bluetooth = navigator.bluetooth
  if (!bluetooth?.requestLEScan) {
    throw new Error('SCAN_NOT_SUPPORTED')
  }

  const maxDurationMs = options?.timeoutMs ?? CARDMED_SCAN_DEFAULTS.maxDurationMs
  const minDurationMs = options?.minDurationMs ?? CARDMED_SCAN_DEFAULTS.minDurationMs
  const settleAfterFindMs = options?.settleAfterFindMs ?? CARDMED_SCAN_DEFAULTS.settleAfterFindMs
  const knownNames = options?.knownNames ?? new Map<string, string>()

  const found = new Map<string, ScannedBleDevice>()
  const scanStartedAt = Date.now()
  let earlyStopTimer: number | undefined
  let maxTimer: number | undefined
  let finishScan: (() => void) | undefined

  const publish = () => {
    const list = Array.from(found.values()).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
    options?.onUpdate?.(list)
  }

  const resolveLabel = (event: BluetoothAdvertisingEvent): string => {
    const direct = event.device.name ?? event.name
    if (direct && isCardmedDeviceName(direct)) return direct
    const saved = knownNames.get(event.device.id)
    if (saved) return saved
    if (direct) return direct
    return 'NiloCardmed'
  }

  const scheduleEarlyStop = () => {
    if (earlyStopTimer || !finishScan) return
    const elapsed = Date.now() - scanStartedAt
    const waitMs = Math.max(minDurationMs - elapsed, settleAfterFindMs)
    earlyStopTimer = window.setTimeout(() => finishScan?.(), Math.max(waitMs, 0))
  }

  const onAdvertisement = (event: BluetoothAdvertisingEvent) => {
    const label = resolveLabel(event)
    if (!isCardmedDeviceName(label) && !knownNames.has(event.device.id)) return

    found.set(event.device.id, {
      id: event.device.id,
      name: label,
      device: event.device,
      rssi: event.rssi,
    })
    publish()
    scheduleEarlyStop()
  }

  let scan: BluetoothLEScan
  try {
    scan = await bluetooth.requestLEScan({
      filters: CARDMED_LE_SCAN_FILTERS,
      keepRepeatedDevices: true,
    })
  } catch {
    scan = await bluetooth.requestLEScan({
      acceptAllAdvertisements: true,
      keepRepeatedDevices: true,
    })
  }

  bluetooth.addEventListener('advertisementreceived', onAdvertisement)

  try {
    await new Promise<void>((resolve, reject) => {
      finishScan = () => {
        if (maxTimer) window.clearTimeout(maxTimer)
        if (earlyStopTimer) window.clearTimeout(earlyStopTimer)
        resolve()
      }

      maxTimer = window.setTimeout(() => finishScan?.(), maxDurationMs)

      if (options?.signal) {
        if (options.signal.aborted) {
          reject(new DOMException('Escaneo cancelado.', 'AbortError'))
          return
        }
        options.signal.addEventListener(
          'abort',
          () => {
            reject(new DOMException('Escaneo cancelado.', 'AbortError'))
          },
          { once: true },
        )
      }
    })
  } finally {
    scan.stop()
    bluetooth.removeEventListener('advertisementreceived', onAdvertisement)
    if (maxTimer) window.clearTimeout(maxTimer)
    if (earlyStopTimer) window.clearTimeout(earlyStopTimer)
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
