import { buildLandmarksZip } from '@/lib/landmarks-zip'
import { api, ApiError } from './api'
import type { PresignedDownload } from '@/types/monitoring-session'
import { putPresignedObject } from '@/lib/presigned-upload'
import { buildQueryString } from '@/types/admin-common'

export type LandmarkSource = 'mediapipe' | 'yolo' | 'other'

export type LandmarksCaptureKind = 'face' | 'pose'

export interface LandmarksUploadRequest {
  session_id: string
  patient_id: string
  node_id?: string
  video_segment_id?: string
  source: LandmarkSource
  model_name?: string
  start_ts: string
  end_ts?: string
  frame_count?: number
  file_extension?: string
  /** Ruta MinIO: `face_landmarks` vs `pose` (default backend: face). */
  capture_kind?: LandmarksCaptureKind
}

export interface LandmarksOut {
  id: string
  session_id: string
  patient_id: string
  object_key: string
  status: string
  size_bytes?: number | null
  /** face → face_landmarks/; pose → pose/ (API puede omitir en registros legacy). */
  capture_kind?: LandmarksCaptureKind | null
}

/** Respuesta del flujo presignado (nilo-node). */
export interface LandmarksPresignResponse extends LandmarksOut {
  upload_url: string
  upload_expires_in: number
}

function appendLandmarksFormFields(form: FormData, body: LandmarksUploadRequest): void {
  form.append('session_id', body.session_id)
  form.append('patient_id', body.patient_id)
  form.append('start_ts', body.start_ts)
  form.append('source', body.source)
  if (body.node_id) form.append('node_id', body.node_id)
  if (body.video_segment_id) form.append('video_segment_id', body.video_segment_id)
  if (body.model_name) form.append('model_name', body.model_name)
  if (body.end_ts) form.append('end_ts', body.end_ts)
  if (body.frame_count != null) form.append('frame_count', String(body.frame_count))
  form.append('file_extension', body.file_extension ?? 'json')
  form.append('capture_kind', body.capture_kind ?? 'face')
}

export const landmarksService = {
  /** Presign + PUT (nilo-node / herramientas). */
  requestUpload(body: LandmarksUploadRequest): Promise<LandmarksPresignResponse> {
    return api.post<LandmarksPresignResponse>('/landmarks', body)
  },

  confirm(landmarksId: string): Promise<LandmarksOut> {
    return api.post<LandmarksOut>(`/landmarks/${landmarksId}/confirm`, {})
  },

  /**
   * Navegador HTTPS: multipart ZIP (un `landmarks.json` dentro) vía API — sin PUT a MinIO.
   */
  uploadMultipart(body: LandmarksUploadRequest, jsonPayload: object): Promise<LandmarksOut> {
    const form = new FormData()
    appendLandmarksFormFields(form, body)
    const zip = buildLandmarksZip(jsonPayload)
    form.append('file', zip, 'landmarks.zip')
    return api.postFormData<LandmarksOut>('/landmarks/upload', form)
  },

  async uploadJsonBatch(body: LandmarksUploadRequest, jsonPayload: object): Promise<LandmarksOut> {
    try {
      return await this.uploadMultipart(body, jsonPayload)
    } catch (err) {
      if (!(err instanceof ApiError) || (err.status !== 404 && err.status !== 405)) {
        throw err
      }
      const meta = await this.requestUpload(body)
      const json = JSON.stringify(jsonPayload)
      await putPresignedObject(meta.upload_url, json, 'application/json')
      return this.confirm(meta.id)
    }
  },

  list(params: {
    patient_id: string
    session_id?: string
    node_id?: string
    capture_kind?: LandmarksCaptureKind
    /** Default recomendado: solo lotes con objeto en MinIO */
    storage_ready?: boolean
  }): Promise<LandmarksOut[]> {
    return api.get<LandmarksOut[]>(
      `/landmarks${buildQueryString({ storage_ready: true, ...params })}`,
    )
  },

  /**
   * Presign JSON (no binario): luego `fetch(download_url)` en el navegador.
   * @see docs/17.mensaje_frontend_media_download.md
   */
  getDownloadUrl(landmarksId: string, expiresIn = 3600): Promise<PresignedDownload> {
    const q = new URLSearchParams({ expires_in: String(expiresIn) })
    return api.get<PresignedDownload>(`/landmarks/${landmarksId}/download?${q}`)
  },

  /** Stream del fichero vía API + JWT (fallback si presign/CORS falla). */
  downloadFile(landmarksId: string): Promise<Blob> {
    return api.getBlob(`/landmarks/${landmarksId}/file`, { silent: true })
  },

  remove(landmarksId: string): Promise<void> {
    return api.delete<void>(`/landmarks/${landmarksId}`)
  },
}