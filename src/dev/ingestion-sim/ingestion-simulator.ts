import { ApiError } from '@/services/api'
import { audioRecordingService } from '@/services/audio-recording.service'
import { landmarksService } from '@/services/landmarks.service'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import { physiologicalService } from '@/services/physiological.service'
import { videoSegmentService } from '@/services/video-segment.service'
import type { SessionOverview } from '@/types/monitoring-session'
import {
  generateFaceLandmarksJson,
  generatePhysiologicalBulk,
  generatePlaceholderMp4Bytes,
  generatePoseLandmarksJson,
} from './synthetic-data'

export interface IngestionTarget {
  sessionId: string
  clinicalPatientId: string
  nodeId?: string | null
}

export interface SimResult {
  label: string
  detail: string
  ok: boolean
  overview?: SessionOverview
  /** Si la ingestión fue bien pero GET overview falló (p. ej. 500 en backend). */
  overviewWarning?: string
}

function timeWindow(durationSeconds: number): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date(end.getTime() - durationSeconds * 1000)
  return { start, end }
}

async function withOverview(
  sessionId: string,
  label: string,
  detail: string,
): Promise<SimResult> {
  let overview: SessionOverview | undefined
  let overviewWarning: string | undefined
  try {
    overview = await monitoringSessionService.overview(sessionId, { silent: true })
  } catch (err) {
    const hint =
      err instanceof ApiError
        ? `(${err.status}) ${err.message}`
        : 'error de red'
    overviewWarning = `Datos enviados; el resumen de sesión falló: ${hint}`
  }
  return { label, detail, ok: true, overview, overviewWarning }
}

export const ingestionSimulator = {
  async sendPoseLandmarks(target: IngestionTarget, durationSeconds: number): Promise<SimResult> {
    const { start, end } = timeWindow(durationSeconds)
    const payload = generatePoseLandmarksJson(durationSeconds)
    const doc = await landmarksService.uploadJsonBatch(
      {
        session_id: target.sessionId,
        patient_id: target.clinicalPatientId,
        node_id: target.nodeId ?? undefined,
        source: 'mediapipe',
        model_name: 'pose_landmarker',
        start_ts: start.toISOString(),
        end_ts: end.toISOString(),
        frame_count: payload.frame_count,
        file_extension: 'json',
        capture_kind: 'pose',
      },
      payload,
    )
    return withOverview(
      target.sessionId,
      'Landmarks posturales',
      `${payload.frame_count} frames → ${doc.object_key}`,
    )
  },

  async sendFaceLandmarks(target: IngestionTarget, durationSeconds: number): Promise<SimResult> {
    const { start, end } = timeWindow(durationSeconds)
    const payload = generateFaceLandmarksJson(durationSeconds)
    const doc = await landmarksService.uploadJsonBatch(
      {
        session_id: target.sessionId,
        patient_id: target.clinicalPatientId,
        node_id: target.nodeId ?? undefined,
        source: 'mediapipe',
        model_name: 'face_landmarker',
        start_ts: start.toISOString(),
        end_ts: end.toISOString(),
        frame_count: payload.frame_count,
        file_extension: 'json',
        capture_kind: 'face',
      },
      payload,
    )
    return withOverview(
      target.sessionId,
      'Landmarks faciales',
      `${payload.frame_count} frames → ${doc.object_key}`,
    )
  },

  async sendPhysiological(target: IngestionTarget, durationSeconds: number): Promise<SimResult> {
    const bulk = generatePhysiologicalBulk(
      durationSeconds,
      target.sessionId,
      target.clinicalPatientId,
      target.nodeId ?? undefined,
    )
    const created = await physiologicalService.createBulk(bulk)
    return withOverview(
      target.sessionId,
      'Datos fisiológicos',
      `${created.length} lecturas en MongoDB`,
    )
  },

  async sendTextNote(target: IngestionTarget): Promise<SimResult> {
    const body = `[DEV] Nota sintética ${new Date().toISOString()} — prueba de ingestión.`
    const note = await monitoringSessionService.createTextNote(target.sessionId, {
      patient_id: target.clinicalPatientId,
      node_id: target.nodeId ?? undefined,
      body,
    })
    return withOverview(target.sessionId, 'Nota de texto', `id ${note.id}`)
  },

  async sendAudioBlob(
    target: IngestionTarget,
    params: { blob: Blob; startedAt: Date; endedAt: Date; format: string; fileExtension: string; contentType: string },
  ): Promise<SimResult> {
    const rec = await audioRecordingService.uploadVoiceNote({
      session_id: target.sessionId,
      patient_id: target.clinicalPatientId,
      node_id: target.nodeId ?? undefined,
      blob: params.blob,
      startedAt: params.startedAt,
      endedAt: params.endedAt,
      format: params.format,
      fileExtension: params.fileExtension,
      contentType: params.contentType,
    })
    return withOverview(target.sessionId, 'Nota de audio', `id ${rec.id} (${params.blob.size} B)`)
  },

  async sendFaceLandmarksPayload(
    target: IngestionTarget,
    params: {
      payload: object
      frameCount: number
      startedAt: Date
      endedAt: Date
    },
  ): Promise<SimResult> {
    const doc = await landmarksService.uploadJsonBatch(
      {
        session_id: target.sessionId,
        patient_id: target.clinicalPatientId,
        node_id: target.nodeId ?? undefined,
        source: 'mediapipe',
        model_name: 'face_landmarker',
        start_ts: params.startedAt.toISOString(),
        end_ts: params.endedAt.toISOString(),
        frame_count: params.frameCount,
        file_extension: 'json',
        capture_kind: 'face',
      },
      params.payload,
    )
    return withOverview(
      target.sessionId,
      'Landmarks faciales',
      `${params.frameCount} frames reales → ${doc.object_key}`,
    )
  },

  async sendVideoBlob(
    target: IngestionTarget,
    params: {
      blob: Blob
      durationSeconds: number
      startedAt: Date
      endedAt: Date
      seq?: number
    },
  ): Promise<SimResult> {
    const bytes = await params.blob.arrayBuffer()
    const segmentId = await videoSegmentService.uploadPlaceholder(
      target.sessionId,
      {
        node_id: target.nodeId ?? undefined,
        seq: params.seq ?? 0,
        kind: 'archive',
        fmt: 'mp4',
        start_ts: params.startedAt.toISOString(),
        end_ts: params.endedAt.toISOString(),
        duration_seconds: params.durationSeconds,
        codec: 'vp9',
        width: 1280,
        height: 720,
        fps: 25,
        file_extension: 'webm',
      },
      bytes,
    )
    return withOverview(
      target.sessionId,
      'Chunk de vídeo',
      `segment ${segmentId} (${params.blob.size} B, webm real)`,
    )
  },

  async sendAudioNote(target: IngestionTarget, durationSeconds: number): Promise<SimResult> {
    const { start, end } = timeWindow(durationSeconds)
    const samples = Math.max(8000, Math.round(durationSeconds * 8000))
    const buffer = new ArrayBuffer(samples)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < samples; i += 1) {
      view[i] = 128 + Math.sin(i / 20) * 40
    }
    const blob = new Blob([buffer], { type: 'audio/wav' })
    const rec = await audioRecordingService.uploadVoiceNote({
      session_id: target.sessionId,
      patient_id: target.clinicalPatientId,
      node_id: target.nodeId ?? undefined,
      blob,
      startedAt: start,
      endedAt: end,
      format: 'wav',
      fileExtension: 'wav',
      contentType: 'audio/wav',
    })
    return withOverview(target.sessionId, 'Nota de audio', `id ${rec.id}`)
  },

  async sendVideoChunk(target: IngestionTarget, durationSeconds: number, seq = 0): Promise<SimResult> {
    const { start, end } = timeWindow(durationSeconds)
    const bytes = generatePlaceholderMp4Bytes()
    const segmentId = await videoSegmentService.uploadPlaceholder(target.sessionId, {
      node_id: target.nodeId ?? undefined,
      seq,
      kind: 'archive',
      fmt: 'mp4',
      start_ts: start.toISOString(),
      end_ts: end.toISOString(),
      duration_seconds: durationSeconds,
      codec: 'h264',
      width: 640,
      height: 480,
      fps: 25,
      file_extension: 'mp4',
    }, bytes)
    return withOverview(target.sessionId, 'Chunk de vídeo', `segment ${segmentId} (${bytes.byteLength} B)`)
  },

  async fetchOverview(sessionId: string): Promise<SimResult> {
    const overview = await monitoringSessionService.overview(sessionId, { silent: true })
    return { label: 'Resumen sesión', detail: 'Conteos actualizados', ok: true, overview }
  },
}