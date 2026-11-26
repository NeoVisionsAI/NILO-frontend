import { audioRecordingService } from '@/services/audio-recording.service'
import { storageAccessService } from '@/services/storage-access.service'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import {
  isBrowserSafeMediaUrl,
  MediaDownloadTracer,
  shouldPreferApiMediaProxy,
} from './media-download-trace'

const PRESIGN_EXPIRES_SEC = 3600

async function blobPlaybackUrl(blob: Blob): Promise<string> {
  return URL.createObjectURL(blob)
}

async function presignPlaybackUrl(
  tracer: MediaDownloadTracer,
  stepLabel: string,
  getPresign: () => Promise<{ download_url: string }>,
): Promise<string | null> {
  try {
    const presign = await getPresign()
    if (!presign.download_url) {
      tracer.logSkip(stepLabel, 'sin download_url')
      return null
    }
    if (!isBrowserSafeMediaUrl(presign.download_url)) {
      tracer.logSkip(stepLabel, 'URL no HTTPS')
      return null
    }
    tracer.log(stepLabel, 'URL presign HTTPS')
    return presign.download_url
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    tracer.log(`${stepLabel} falló`, msg)
    return null
  }
}

async function tryAudioFile(audioId: string, tracer: MediaDownloadTracer): Promise<string | null> {
  try {
    tracer.log('GET /audio/{id}/file', audioId)
    const blob = await audioRecordingService.downloadFile(audioId)
    tracer.log('GET /audio/{id}/file OK', `${blob.size} bytes`)
    return await blobPlaybackUrl(blob)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    tracer.log('GET /audio/{id}/file falló', msg)
    return null
  }
}

/**
 * URL reproducible en `<audio src>`: presign HTTPS o blob URL vía `/file`.
 * @see docs/17.mensaje_frontend_media_download.md
 */
export async function fetchClinicalAudioPlaybackUrl(
  audioId: string,
  sessionId: string,
): Promise<string | null> {
  const tracer = new MediaDownloadTracer()

  if (shouldPreferApiMediaProxy()) {
    const fromFile = await tryAudioFile(audioId, tracer)
    if (fromFile) return fromFile
  }

  const fromPresign = await presignPlaybackUrl(tracer, 'GET /audio/{id}/download', () =>
    audioRecordingService.getDownloadUrl(audioId, PRESIGN_EXPIRES_SEC),
  )
  if (fromPresign) return fromPresign

  if (!shouldPreferApiMediaProxy()) {
    const fromFile = await tryAudioFile(audioId, tracer)
    if (fromFile) return fromFile
  }

  const fromStorage = await presignPlaybackUrl(tracer, 'GET /storage/access (audio)', () =>
    storageAccessService.getDownloadUrl('audio', audioId, PRESIGN_EXPIRES_SEC),
  )
  if (fromStorage) return fromStorage

  try {
    tracer.log('GET /sessions/{id}/media-access', sessionId)
    const access = await monitoringSessionService.mediaAccess(sessionId, PRESIGN_EXPIRES_SEC, { silent: true })
    const match = access.items.find((i) => i.id === audioId)
    if (match?.download_url && isBrowserSafeMediaUrl(match.download_url)) {
      return match.download_url
    }
  } catch {
    /* fallthrough */
  }

  if (import.meta.env.DEV) {
    console.info('[nilo-media-download] audio sin URL', tracer.summary())
  }
  return null
}

export function revokeClinicalAudioPlaybackUrl(url: string | null | undefined): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}