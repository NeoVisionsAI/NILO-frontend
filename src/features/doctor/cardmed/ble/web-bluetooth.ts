import { CARDMED_SERVICE_UUID } from './constants'

export const CARDMED_REQUEST_DEVICE_FILTERS: BluetoothLEScanFilter[] = [
  { namePrefix: 'NiloCardmed' },
  { namePrefix: 'Nilo' },
  { namePrefix: 'Cardmed' },
  { namePrefix: 'cardmed' },
  { services: [CARDMED_SERVICE_UUID] },
]

/** Filtros para requestDevice (selector del sistema). requestLEScan usa acceptAll sin filtrar. */
export const CARDMED_LE_SCAN_FILTERS: BluetoothLEScanFilter[] = CARDMED_REQUEST_DEVICE_FILTERS

export const CARDMED_SCAN_DEFAULTS = {
  /** Tiempo máximo de escaneo si no aparece nada. */
  maxDurationMs: 3_000,
  /** Tras ver dispositivos, breve pausa por nombres repetidos y parar. */
  settleAfterFindMs: 350,
} as const

export interface ScannedBleDevice {
  id: string
  name: string
  device: BluetoothDevice
  rssi?: number
  /** true si el nombre/servicio/emparejado sugiere NiloCardmed */
  isLikelyCardmed?: boolean
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

function normalizeBleUuid(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase()
}

const CARDMED_SERVICE_NORM = normalizeBleUuid(CARDMED_SERVICE_UUID)

function eventAdvertisesCardmedService(event: BluetoothAdvertisingEvent): boolean {
  const uuids = event.uuids ?? []
  return uuids.some((uuid) => normalizeBleUuid(String(uuid)) === CARDMED_SERVICE_NORM)
}

function isLikelyCardmedAdvertisement(
  event: BluetoothAdvertisingEvent,
  knownNames: Map<string, string>,
): boolean {
  const name = event.device.name ?? event.name
  if (isCardmedDeviceName(name)) return true
  if (knownNames.has(event.device.id)) return true
  if (eventAdvertisesCardmedService(event)) return true
  return false
}

function resolveAdvertisementLabel(
  event: BluetoothAdvertisingEvent,
  knownNames: Map<string, string>,
): string {
  const direct = event.device.name ?? event.name
  if (direct?.trim()) return direct.trim()
  const saved = knownNames.get(event.device.id)
  if (saved) return saved
  const shortId = event.device.id.length > 12 ? `${event.device.id.slice(0, 12)}…` : event.device.id
  return `Sin nombre (${shortId})`
}

function sortScannedDevices(list: ScannedBleDevice[]): ScannedBleDevice[] {
  return [...list].sort((a, b) => {
    const aCardmed = a.isLikelyCardmed ? 1 : 0
    const bCardmed = b.isLikelyCardmed ? 1 : 0
    if (aCardmed !== bCardmed) return bCardmed - aCardmed
    return (b.rssi ?? -999) - (a.rssi ?? -999)
  })
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

/** Escaneo BLE en la app: muestra todos los dispositivos detectados (sin filtrar). */
export async function scanCardmedDevices(options?: {
  timeoutMs?: number
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
  const settleAfterFindMs = options?.settleAfterFindMs ?? CARDMED_SCAN_DEFAULTS.settleAfterFindMs
  const knownNames = options?.knownNames ?? new Map<string, string>()

  const found = new Map<string, ScannedBleDevice>()
  let earlyStopTimer: number | undefined
  let maxTimer: number | undefined
  let finishScan: (() => void) | undefined

  const publish = () => {
    options?.onUpdate?.(sortScannedDevices(Array.from(found.values())))
  }

  const scheduleEarlyStop = () => {
    if (earlyStopTimer || !finishScan) return
    earlyStopTimer = window.setTimeout(() => finishScan?.(), settleAfterFindMs)
  }

  const onAdvertisement = (event: BluetoothAdvertisingEvent) => {
    const likelyCardmed = isLikelyCardmedAdvertisement(event, knownNames)
    const label = resolveAdvertisementLabel(event, knownNames)
    const existing = found.get(event.device.id)

    found.set(event.device.id, {
      id: event.device.id,
      name: label,
      device: event.device,
      rssi: event.rssi ?? existing?.rssi,
      isLikelyCardmed: likelyCardmed || existing?.isLikelyCardmed,
    })
    publish()
    scheduleEarlyStop()
  }

  const scan = await bluetooth.requestLEScan({
    acceptAllAdvertisements: true,
    keepRepeatedDevices: true,
  })

  bluetooth.addEventListener('advertisementreceived', onAdvertisement)

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false
      finishScan = () => {
        if (settled) return
        settled = true
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
            finishScan?.()
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

  return sortScannedDevices(Array.from(found.values()))
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
      return 'Tiempo de espera agotado en el dispositivo.'
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
