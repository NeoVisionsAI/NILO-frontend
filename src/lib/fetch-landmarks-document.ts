import { unzipSync } from 'fflate'
import { parseLandmarksJson, type ParsedLandmarks } from './landmarks-json'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { LandmarksOut } from '@/services/landmarks.service'

async function bytesToJson(bytes: Uint8Array): Promise<unknown> {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes)
    const key = Object.keys(files).find((k) => k.endsWith('.json')) ?? Object.keys(files)[0]
    if (!key) throw new Error('ZIP sin JSON de landmarks.')
    const text = new TextDecoder().decode(files[key])
    return JSON.parse(text) as unknown
  }
  const text = new TextDecoder().decode(bytes)
  return JSON.parse(text) as unknown
}

export async function resolveLandmarkDownloadUrl(
  sessionId: string,
  landmark: LandmarksOut,
): Promise<string | null> {
  const access = await monitoringSessionService.mediaAccess(sessionId, 7200, { silent: true })
  const match = access.items.find(
    (item) =>
      item.id === landmark.id ||
      (item.object_key && landmark.object_key && item.object_key === landmark.object_key) ||
      (item.object_key && landmark.object_key && item.object_key.endsWith(landmark.object_key.split('/').pop() ?? '')),
  )
  return match?.download_url ?? null
}

export async function fetchLandmarksDocument(
  sessionId: string,
  landmark: LandmarksOut,
): Promise<ParsedLandmarks> {
  const url = await resolveLandmarkDownloadUrl(sessionId, landmark)
  if (!url) throw new Error('No hay URL de descarga para este lote.')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Descarga fallida (${res.status}).`)
  const buf = new Uint8Array(await res.arrayBuffer())
  const raw = await bytesToJson(buf)
  return parseLandmarksJson(raw)
}