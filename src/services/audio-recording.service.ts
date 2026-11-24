import { api } from './api'
import type {
  AudioRecording,
  AudioUploadRequest,
  AudioUploadResponse,
  PresignedDownload,
} from '@/types/monitoring-session'
import { buildQueryString } from '@/types/admin-common'

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

  getDownloadUrl(audioId: string): Promise<PresignedDownload> {
    return api.get<PresignedDownload>(`/audio/${audioId}/download`)
  },

  /** PUT directo a MinIO (sin Bearer NILO). */
  async uploadToPresignedUrl(uploadUrl: string, blob: Blob, contentType: string): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    })
    if (!res.ok) {
      throw new Error(`Error al subir audio a almacenamiento (${res.status}).`)
    }
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
    await this.uploadToPresignedUrl(meta.upload_url, params.blob, params.contentType)
    return this.confirm(meta.id)
  },
}