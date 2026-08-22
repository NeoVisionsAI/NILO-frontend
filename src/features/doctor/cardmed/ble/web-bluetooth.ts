import { CARDMED_SERVICE_UUID } from './constants'

export type CardmedDiscoveryMode = 'filtered' | 'acceptAll'

/** Filtro principal. NO usar { services: [UUID] } — el UUID no va en advertising. */
export const CARDMED_DEVICE_FILTER: BluetoothLEScanFilter = { namePrefix: 'NiloCardmed' }

const OPTIONAL_SERVICES: RequestDeviceOptions['optionalServices'] = [CARDMED_SERVICE_UUID]

export function buildCardmedDiscoveryFilters(knownBleNames: string[] = []): BluetoothLEScanFilter[] {
  const filters: BluetoothLEScanFilter[] = [CARDMED_DEVICE_FILTER]
  const seen = new Set<string>()

  for (const name of knownBleNames) {
    const trimmed = name?.trim()
    if (!trimmed || !isCardmedDeviceName(trimmed) || seen.has(trimmed)) continue
    seen.add(trimmed)
    filters.push({ name: trimmed })
  }

  return filters
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export function isCardmedDeviceName(name: string | undefined | null): boolean {
  if (!name) return false
  return name.startsWith('NiloCardmed')
}

export const CARDMED_BLE_NAME_PREFIX = 'NiloCardmed-'

/** Quita el prefijo si el usuario pega el nombre completo. */
export function normalizeCardmedBleSuffix(input: string): string {
  return input.trim().replace(/^NiloCardmed-?/i, '')
}

export function formatCardmedBleNameFromSuffix(suffix: string): string {
  const normalized = normalizeCardmedBleSuffix(suffix)
  if (!normalized) return ''
  return `${CARDMED_BLE_NAME_PREFIX}${normalized}`
}

export function isValidCardmedBleSuffix(suffix: string): boolean {
  const normalized = normalizeCardmedBleSuffix(suffix)
  return /^[a-f0-9-]+$/i.test(normalized) && normalized.length >= 4
}

/** @deprecated Usar formatCardmedBleNameFromSuffix */
export function normalizeCardmedBleName(input: string): string {
  return formatCardmedBleNameFromSuffix(input)
}

/** Intenta abrir Ajustes → Bluetooth en Android (solo precalentar escaneo; no emparejar). */
export function tryOpenAndroidBluetoothSettings(): void {
  const intent = 'intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end'
  const anchor = document.createElement('a')
  anchor.href = intent
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
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

/** En algunas tablets Android el stack escanea mejor tras comprobar disponibilidad. */
export async function warmUpBluetoothStack(): Promise<void> {
  const bluetooth = navigator.bluetooth
  if (bluetooth?.getAvailability) {
    try {
      await bluetooth.getAvailability()
    } catch {
      // ignorar
    }
  }
}

/** Selector filtrado: namePrefix + nombres exactos de emparejados (OR). Requiere gesto de usuario. */
export async function requestCardmedBleDevice(knownBleNames: string[] = []): Promise<BluetoothDevice> {
  const bluetooth = assertBluetoothAvailable()
  await warmUpBluetoothStack()

  const device = await bluetooth.requestDevice({
    filters: buildCardmedDiscoveryFilters(knownBleNames),
    optionalServices: OPTIONAL_SERVICES,
  })

  if (!isCardmedDeviceName(device.name)) {
    throw new Error(
      `«${formatBleDeviceLabel(device)}» no es un NiloCardmed. Elige uno cuyo nombre empiece por «NiloCardmed».`,
    )
  }

  return device
}

/**
 * Modo tablet: sin filtro de nombre. El NiloCardmed puede aparecer como «desconocido»;
 * se valida con la contraseña BLE tras conectar.
 */
export async function requestCardmedBleDeviceAcceptAll(): Promise<BluetoothDevice> {
  const bluetooth = assertBluetoothAvailable()
  await warmUpBluetoothStack()
  return bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: OPTIONAL_SERVICES,
  })
}

export async function requestCardmedBleDeviceWithMode(
  mode: CardmedDiscoveryMode,
  knownBleNames: string[] = [],
): Promise<BluetoothDevice> {
  return mode === 'acceptAll' ? requestCardmedBleDeviceAcceptAll() : requestCardmedBleDevice(knownBleNames)
}

/** Reconexión: filtro por nombre exacto del emparejado (suele funcionar en tablet cuando namePrefix falla). */
export async function requestCardmedBleDeviceByExactName(bleName: string): Promise<BluetoothDevice> {
  if (!isCardmedDeviceName(bleName)) {
    return requestCardmedBleDevice()
  }

  const bluetooth = assertBluetoothAvailable()
  await warmUpBluetoothStack()

  const device = await bluetooth.requestDevice({
    filters: [{ name: bleName }],
    optionalServices: OPTIONAL_SERVICES,
  })

  if (device.name && !isCardmedDeviceName(device.name)) {
    throw new Error(`Selecciona «${bleName}» en el selector.`)
  }

  return device
}

export async function requestDeviceByBleName(bleName: string): Promise<BluetoothDevice> {
  return requestCardmedBleDeviceByExactName(bleName)
}

/** @deprecated Usar requestDeviceByBleName */
export async function requestDeviceByName(name: string): Promise<BluetoothDevice> {
  return requestDeviceByBleName(name)
}

export function cardmedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotFoundError') {
      return (
        'No apareció ese NiloCardmed. Comprueba el ID (p. ej. d212bd98), abre Bluetooth del sistema unos segundos y vuelve a intentar. No emparejes el Pi en Ajustes.'
      )
    }
    if (error.name === 'SecurityError') {
      return 'Permiso Bluetooth denegado. Usa HTTPS y concede permiso de dispositivos cercanos y ubicación (Android).'
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
