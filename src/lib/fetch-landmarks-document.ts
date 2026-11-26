import { unzipSync } from 'fflate'
import { landmarksService } from '@/services/landmarks.service'
import { storageAccessService } from '@/services/storage-access.service'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { LandmarksOut } from '@/services/landmarks.service'
import { ApiError } from '@/services/api'
import { parseLandmarksJson, type ParsedLandmarks } from './landmarks-json'
import {
  isBrowserSafeMediaUrl,
  MediaDownloadTracer,
  shouldPreferApiMediaProxy,
} from './media-download-trace'

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

async function presignThenFetch(
  tracer: MediaDownloadTracer,
  stepLabel: string,
  getPresign: () => Promise<{ download_url: string }>,
): Promise<Uint8Array | null> {
  try {
    const presign = await getPresign()
    if (!presign.download_url) {
      tracer.logSkip(stepLabel, 'sin download_url')
      return null
    }
    if (!isBrowserSafeMediaUrl(presign.download_url)) {
      tracer.logSkip(stepLabel, 'Mixed Content: URL no HTTPS (usar /file o presign público)')
      return null
    }
    tracer.log(stepLabel, 'fetch presign HTTPS')
    return await fetchPresignedBytes(presign.download_url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    tracer.log(`${stepLabel} falló`, msg)
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

async function tryLandmarkFile(landmarkId: string, tracer: MediaDownloadTracer): Promise<Uint8Array | null> {
  try {
    tracer.log('GET /landmarks/{id}/file', landmarkId)
    const blob = await landmarksService.downloadFile(landmarkId)
    tracer.log('GET /landmarks/{id}/file OK', `${blob.size} bytes`)
    return new Uint8Array(await blob.arrayBuffer())
  } catch (err) {
    if (err instanceof ApiError) {
      tracer.log('GET /landmarks/{id}/file falló', `${err.status} ${err.message}`)
    } else {
      const msg = err instanceof Error ? err.message : String(err)
      tracer.log('GET /landmarks/{id}/file falló', msg)
    }
    return null
  }
}

async function downloadLandmarkBytes(landmark: LandmarksOut, sessionId: string): Promise<Uint8Array> {
  const tracer = new MediaDownloadTracer()
  tracer.log('inicio descarga landmarks', landmark.id)

  const preferApi = shouldPreferApiMediaProxy()
  if (preferApi) {
    const fromFile = await tryLandmarkFile(landmark.id, tracer)
    if (fromFile) return fromFile
  }

  const fromLandmarkPresign = await presignThenFetch(tracer, 'GET /landmarks/{id}/download', () =>
    landmarksService.getDownloadUrl(landmark.id, PRESIGN_EXPIRES_SEC),
  )
  if (fromLandmarkPresign) return fromLandmarkPresign

  if (!preferApi) {
    const fromFile = await tryLandmarkFile(landmark.id, tracer)
    if (fromFile) return fromFile
  }

  const fromStorage = await presignThenFetch(tracer, 'GET /storage/access (landmarks)', () =>
    storageAccessService.getDownloadUrl('landmarks', landmark.id, PRESIGN_EXPIRES_SEC),
  )
  if (fromStorage) return fromStorage

  try {
    tracer.log('GET /sessions/{id}/media-access', sessionId)
    const access = await monitoringSessionService.mediaAccess(sessionId, PRESIGN_EXPIRES_SEC, { silent: true })
    const match = access.items.find((item) => mediaItemMatches(landmark, item))
    if (match?.download_url) {
      if (!isBrowserSafeMediaUrl(match.download_url)) {
        tracer.logSkip('media-access fetch', 'URL no HTTPS')
      } else {
        tracer.log('media-access fetch', match.id)
        return await fetchPresignedBytes(match.download_url)
      }
    } else {
      tracer.logSkip('media-access', 'sin ítem coincidente')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    tracer.log('GET /sessions/{id}/media-access falló', msg)
  }

  throw new Error(
    `No se pudo descargar el lote de landmarks. Traza: ${tracer.summary()}. ` +
      'En nilomed.eu activa VITE_DEBUG_MEDIA=true y mira la consola, o Red → /landmarks/…/file.',
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