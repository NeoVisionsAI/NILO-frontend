import { CARDMED_STORAGE_KEY } from './constants'
import type { CardmedDeviceLocation, LegacySavedCardmedDevice, SavedCardmedDevice } from './types'

function isCardmedBleName(name: string): boolean {
  const normalized = name.toLowerCase()
  return normalized.includes('nilo') || normalized.includes('cardmed')
}

function normalizeDevice(raw: unknown): SavedCardmedDevice | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<SavedCardmedDevice & LegacySavedCardmedDevice>
  const id = item.id?.trim()
  const bleName = (item.bleName ?? item.name)?.trim()
  if (!id || !bleName || !isCardmedBleName(bleName)) return null

  return {
    id,
    bleName,
    displayName: item.displayName?.trim() || undefined,
    password: item.password || undefined,
    pairedAt: item.pairedAt ?? item.lastConnected ?? new Date().toISOString(),
    lastConnected: item.lastConnected,
    location: item.location,
  }
}

export function loadPairedDevices(): SavedCardmedDevice[] {
  try {
    const raw = localStorage.getItem(CARDMED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeDevice).filter((item): item is SavedCardmedDevice => item != null)
  } catch {
    return []
  }
}

function persistDevices(list: SavedCardmedDevice[]) {
  localStorage.setItem(CARDMED_STORAGE_KEY, JSON.stringify(list.slice(0, 30)))
}

export function getPairedDevice(deviceId: string): SavedCardmedDevice | undefined {
  return loadPairedDevices().find((item) => item.id === deviceId)
}

export function pairDevice(input: {
  id: string
  bleName: string
  password: string
  displayName?: string
  location?: CardmedDeviceLocation
}) {
  const existing = getPairedDevice(input.id)
  const entry: SavedCardmedDevice = {
    id: input.id,
    bleName: input.bleName,
    password: input.password,
    displayName: input.displayName ?? existing?.displayName,
    pairedAt: existing?.pairedAt ?? new Date().toISOString(),
    lastConnected: new Date().toISOString(),
    location: input.location ?? existing?.location,
  }

  const list = loadPairedDevices().filter((item) => item.id !== input.id)
  list.unshift(entry)
  persistDevices(list)
  return entry
}

export function updatePairedDevice(
  deviceId: string,
  patch: Partial<Pick<SavedCardmedDevice, 'displayName' | 'location'>>,
): SavedCardmedDevice | null {
  const list = loadPairedDevices()
  const index = list.findIndex((item) => item.id === deviceId)
  if (index < 0) return null

  list[index] = {
    ...list[index],
    ...patch,
    displayName: patch.displayName?.trim() || undefined,
    location: patch.location ?? list[index].location,
  }
  persistDevices(list)
  return list[index]
}

export function touchPairedDevice(deviceId: string) {
  const list = loadPairedDevices()
  const index = list.findIndex((item) => item.id === deviceId)
  if (index < 0) return
  list[index].lastConnected = new Date().toISOString()
  persistDevices(list)
}

export function unpairDevice(deviceId: string) {
  persistDevices(loadPairedDevices().filter((item) => item.id !== deviceId))
}

export function deviceDisplayLabel(device: SavedCardmedDevice): string {
  return device.displayName?.trim() || device.bleName
}

export function formatDeviceLocation(device: SavedCardmedDevice): string | null {
  const loc = device.location
  if (!loc) return null
  const parts = [loc.address, loc.zip, loc.city].filter(Boolean)
  const base = parts.join(', ')
  if (loc.additionalNotes) {
    return base ? `${base} · ${loc.additionalNotes}` : loc.additionalNotes
  }
  return base || null
}
