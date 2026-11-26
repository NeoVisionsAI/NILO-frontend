import { unzipSync } from 'fflate'
import { landmarksService } from '@/services/landmarks.service'
import { storageAccessService } from '@/services/storage-access.service'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { LandmarksOut } from '@/services/landmarks.service'
import { ApiError } from '@/services/api'
import { parseLandmarksJson, type ParsedLandmarks } from './landmarks-json'

const PRESIGN_EXPIRES_SEC = 3600

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

async function fetchPresignedBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Descarga fallida (${res.status}).`)
  return new Uint8Array(await res.arrayBuffer())
}

async function presignThenFetch(getPresign: () => Promise<{ download_url: string }>): Promise<Uint8Array | null> {
  try {
    const presign = await getPresign()
    if (!presign.download_url) return null
    return await fetchPresignedBytes(presign.download_url)
  } catch {
    return null
  }
}

function normalizeKey(key: string | null | undefined): string {
  return (key ?? '').toLowerCase().replace(/^\/+/, '')
}

function mediaItemMatches(landmark: LandmarksOut, item: { id: string; kind: string; object_key?: string | null }): boolean {
  if (item.id === landmark.id) return true
  const lk = normalizeKey(landmark.object_key)
  const ok = normalizeKey(item.object_key)
  if (lk && ok && (ok === lk || ok.endsWith(lk) || lk.endsWith(ok))) return true
  const kind = item.kind.toLowerCase()
  if (
    (kind.includes('landmark') || kind.includes('face') || kind.includes('pose') || kind.includes('json')) &&
    ok &&
    lk &&
    ok.includes(lk.split('/').pop() ?? '___')
  ) {
    return true
  }
  return false
}

async function downloadLandmarkBytes(landmark: LandmarksOut, sessionId: string): Promise<Uint8Array> {
  // 1) GET /landmarks/{id}/download?expires_in=… → JSON → fetch(download_url)
  const fromLandmarkPresign = await presignThenFetch(() =>
    landmarksService.getDownloadUrl(landmark.id, PRESIGN_EXPIRES_SEC),
  )
  if (fromLandmarkPresign) return fromLandmarkPresign

  // 2) GET /landmarks/{id}/file (stream API, JWT)
  try {
    const blob = await landmarksService.downloadFile(landmark.id)
    return new Uint8Array(await blob.arrayBuffer())
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      /* seguir */
    }
  }

  // 3) GET /storage/access?kind=landmarks&resource_id=…
  const fromStorage = await presignThenFetch(() =>
    storageAccessService.getDownloadUrl('landmarks', landmark.id, PRESIGN_EXPIRES_SEC),
  )
  if (fromStorage) return fromStorage

  // 4) GET /sessions/{id}/media-access (legado)
  try {
    const access = await monitoringSessionService.mediaAccess(sessionId, PRESIGN_EXPIRES_SEC, { silent: true })
    const match = access.items.find((item) => mediaItemMatches(landmark, item))
    if (match?.download_url) return await fetchPresignedBytes(match.download_url)
  } catch {
    /* fallthrough */
  }

  throw new Error(
    'No se pudo descargar el lote de landmarks. Comprueba GET /landmarks/{id}/download (JSON) y /landmarks/{id}/file.',
  )
}

export async function fetchLandmarksDocument(
  sessionId: string,
  landmark: LandmarksOut,
): Promise<ParsedLandmarks> {
  const bytes = await downloadLandmarkBytes(landmark, sessionId)
  const raw = await bytesToJson(bytes)
  return parseLandmarksJson(raw)
}