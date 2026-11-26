import { audioRecordingService } from '@/services/audio-recording.service'
import type { AudioRecording, TranscriptionStatus } from '@/types/monitoring-session'

export function normalizeTranscriptionStatus(
  status: TranscriptionStatus | null | undefined,
): TranscriptionStatus {
  if (!status || status === 'none') return 'none'
  return status
}

export function isTranscriptionSettled(status: TranscriptionStatus | null | undefined): boolean {
  const s = normalizeTranscriptionStatus(status)
  return s === 'done' || s === 'failed'
}

export function transcriptionStatusLabel(status: TranscriptionStatus | null | undefined): string {
  switch (normalizeTranscriptionStatus(status)) {
    case 'pending':
      return 'Transcribiendo…'
    case 'done':
      return 'Transcripción lista'
    case 'failed':
      return 'Transcripción fallida'
    default:
      return 'Sin transcripción'
  }
}

/** POST …/transcribe (puede tardar decenas de segundos en CPU). */
export async function requestVoiceTranscription(
  audioId: string,
  opts?: { force?: boolean; language?: string },
): Promise<AudioRecording> {
  return audioRecordingService.transcribe(audioId, opts)
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Si el servidor transcribe en background tras upload (AUTO_TRANSCRIBE). */
export async function pollTranscriptionUntilSettled(
  audioId: string,
  options?: {
    intervalMs?: number
    maxAttempts?: number
    onTick?: (clip: AudioRecording) => void
    signal?: AbortSignal
  },
): Promise<AudioRecording> {
  const intervalMs = options?.intervalMs ?? 2500
  const maxAttempts = options?.maxAttempts ?? 48

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options?.signal?.aborted) break
    const clip = await audioRecordingService.get(audioId)
    options?.onTick?.(clip)
    const status = normalizeTranscriptionStatus(clip.transcription_status)
    if (status !== 'pending') return clip
    await sleep(intervalMs)
  }
  return audioRecordingService.get(audioId)
}