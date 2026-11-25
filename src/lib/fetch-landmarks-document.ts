import { unzipSync } from 'fflate'
import { landmarksService } from '@/services/landmarks.service'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { LandmarksOut } from '@/services/landmarks.service'
import { ApiError } from '@/services/api'
import { parseLandmarksJson, type ParsedLandmarks } from './landmarks-json'

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

export async function resolveLandmarkDownloadUrl(
  sessionId: string,
  landmark: LandmarksOut,
): Promise<string | null> {
  try {
    const presign = await landmarksService.getDownloadUrl(landmark.id)
    if (presign.download_url?.startsWith('https://')) return presign.download_url
    if (presign.download_url) return presign.download_url
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      /* seguir con media-access */
    }
  }

  const access = await monitoringSessionService.mediaAccess(sessionId, 7200, { silent: true })
  const match = access.items.find((item) => mediaItemMatches(landmark, item))
  return match?.download_url ?? null
}

async function downloadLandmarkBytes(landmark: LandmarksOut, sessionId: string): Promise<Uint8Array> {
  try {
    const presign = await landmarksService.getDownloadUrl(landmark.id)
    if (presign.download_url) return await fetchPresignedBytes(presign.download_url)
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      /* intentar proxy o media-access */
    }
  }

  try {
    const blob = await landmarksService.downloadBlob(landmark.id)
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
    if (head[0] === 0x7b || head[0] === 0x50 || head[0] === 0x5b) {
      return new Uint8Array(await blob.arrayBuffer())
    }
  } catch {
    /* media-access */
  }

  const url = await resolveLandmarkDownloadUrl(sessionId, landmark)
  if (url) {
    try {
      return await fetchPresignedBytes(url)
    } catch {
      throw new Error('No se pudo descargar el fichero (revisa CORS/HTTPS de MinIO).')
    }
  }

  throw new Error(
    'No hay URL de descarga para este lote. ¿El backend expone GET /landmarks/{id}/download o media-access?',
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