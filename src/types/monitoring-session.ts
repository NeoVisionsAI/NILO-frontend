export type MonitoringSessionStatus = 'active' | 'completed' | 'cancelled'

export interface ClinicalPatient {
  id: string
  full_name: string
  user_id?: string | null
  node_id?: string | null
  monitoring_active?: boolean
  medical_record_number?: string | null
}

export interface MonitoringSession {
  id: string
  patient_id: string
  node_id?: string | null
  external_session_id?: string | null
  /** Nombre legible para el clínico (no sustituye al id). */
  display_name?: string | null
  started_at: string
  ended_at?: string | null
  status: MonitoringSessionStatus
  archive_chunk_seconds?: number
  hls_segment_seconds?: number
  created_at?: string
  updated_at?: string
}

export interface SessionOverview {
  session: MonitoringSession
  video_segments: number
  audio_clips: number
  physiological_readings: number
  landmarks_batches: number
  pain_events: number
  text_notes: number
}

export interface SessionTextNote {
  id: string
  session_id: string
  patient_id: string
  node_id?: string | null
  body: string
  recorded_at: string
  author_id?: string | null
  created_at: string
  updated_at: string
}

export interface SessionTextNoteCreate {
  patient_id: string
  node_id?: string
  body: string
  recorded_at?: string
}

export interface AudioUploadResponse {
  id: string
  bucket: string
  object_key: string
  upload_url: string
  expires_in: number
}

export type AudioKind = 'voice_note' | 'ambient'
export type ProcessingStatus = 'pending_upload' | 'uploaded' | 'processing' | 'ready' | 'failed' | string
export type TranscriptionStatus = 'pending' | 'done' | 'failed' | string

export interface AudioRecording {
  id: string
  session_id: string
  patient_id: string
  node_id?: string | null
  kind: AudioKind
  start_ts: string
  end_ts?: string | null
  duration_seconds?: number | null
  format?: string | null
  status: ProcessingStatus
  transcription?: string | null
  transcription_status?: TranscriptionStatus
}

export interface AudioUploadRequest {
  session_id: string
  patient_id: string
  node_id?: string
  kind: AudioKind
  start_ts: string
  end_ts?: string
  duration_seconds?: number
  format: string
  file_extension: string
}

export interface PresignedDownload {
  download_url: string
  expires_in: number
}