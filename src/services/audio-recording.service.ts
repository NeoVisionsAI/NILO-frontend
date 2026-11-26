import { api, ApiError } from './api'
import type {
  AudioRecording,
  AudioUploadRequest,
  AudioUploadResponse,
  PresignedDownload,
} from '@/types/monitoring-session'
import { buildQueryString } from '@/types/admin-common'
import { putPresignedObject } from '@/lib/presigned-upload'

export const audioRecordingService = {
  requestUpload(body: AudioUploadRequest): Promise<AudioUploadResponse> {
    return api.post<AudioUploadResponse>('/audio', body)
  },

  list(params: { patient_id: string; session_id?: string; node_id?: string; skip?: number; limit?: number }): Promise<AudioRecording[]> {
    return api.get<AudioRecording[]>(`/audio${buildQueryString(params)}`)
  },

  get(audioId: string): Promise<AudioRecording> {
    return api.get<AudioRecording>(`/audio/${audioId}`)
  },

  confirm(audioId: string): Promise<AudioRecording> {
    return api.post<AudioRecording>(`/audio/${audioId}/confirm`, {})
  },

  updateTranscription(
    audioId: string,
    transcription: string,
    transcription_status: 'done' | 'pending' | 'failed' = 'done',
  ): Promise<AudioRecording> {
    return api.patch<AudioRecording>(`/audio/${audioId}/transcription`, {
      transcription,
      transcription_status,
    })
  },

  transcribe(
    audioId: string,
    opts?: { force?: boolean; language?: string },
  ): Promise<AudioRecording> {
    const body = new URLSearchParams()
    if (opts?.force) body.set('force', 'true')
    if (opts?.language) body.set('language', opts.language)
    return api.postUrlEncoded<AudioRecording>(
      `/audio/${audioId}/transcribe`,
      body.size > 0 ? body : undefined,
      { silent: true },
    )
  },

  getDownloadUrl(audioId: string, expiresIn = 3600): Promise<PresignedDownload> {
    const q = new URLSearchParams({ expires_in: String(expiresIn) })
    return api.get<PresignedDownload>(`/audio/${audioId}/download?${q}`)
  },

  /** Stream vía API + JWT (nilomed.eu si presign HTTP). */
  downloadFile(audioId: string): Promise<Blob> {
    return api.getBlob(`/audio/${audioId}/file`, { silent: true })
  },

  remove(audioId: string): Promise<void> {
    return api.delete<void>(`/audio/${audioId}`)
  },

  /** Multipart vía API (navegador HTTPS). */
  uploadMultipart(params: {
    session_id: string
    patient_id: string
    node_id?: string
    kind?: 'voice_note' | 'ambient'
    startedAt: Date
    endedAt: Date
    duration_seconds?: number
    format: string
    fileExtension: string
    blob: Blob
    contentType: string
  }): Promise<AudioRecording> {
    const form = new FormData()
    form.append('session_id', params.session_id)
    form.append('patient_id', params.patient_id)
    form.append('start_ts', params.startedAt.toISOString())
    form.append('end_ts', params.endedAt.toISOString())
    form.append('kind', params.kind ?? 'voice_note')
    if (params.node_id) form.append('node_id', params.node_id)
    if (params.duration_seconds != null) {
      form.append('duration_seconds', String(params.duration_seconds))
    }
    form.append('file_extension', params.fileExtension)
    if (params.format) form.append('format', params.format)
    form.append('file', params.blob, `audio.${params.fileExtension}`)
    return api.postFormData<AudioRecording>('/audio/upload', form)
  },

  async uploadVoiceNote(params: {
    session_id: string
    patient_id: string
    node_id?: string
    blob: Blob
    startedAt: Date
    endedAt: Date
    format: string
    fileExtension: string
    contentType: string
  }): Promise<AudioRecording> {
    const durationSeconds = Math.max(0.1, (params.endedAt.getTime() - params.startedAt.getTime()) / 1000)
    const uploadParams = { ...params, duration_seconds: durationSeconds, kind: 'voice_note' as const }

    try {
      return await this.uploadMultipart(uploadParams)
    } catch (err) {
      if (!(err instanceof ApiError) || (err.status !== 404 && err.status !== 405)) {
        throw err
      }
      const meta = await this.requestUpload({
        session_id: params.session_id,
        patient_id: params.patient_id,
        node_id: params.node_id,
        kind: 'voice_note',
        start_ts: params.startedAt.toISOString(),
        end_ts: params.endedAt.toISOString(),
        duration_seconds: durationSeconds,
        format: params.format,
        file_extension: params.fileExtension,
      })
      await putPresignedObject(meta.upload_url, params.blob, params.contentType)
      return this.confirm(meta.id)
    }
  },
}