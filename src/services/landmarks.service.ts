import { api } from './api'
import { putPresignedObject } from '@/lib/presigned-upload'
import { buildQueryString } from '@/types/admin-common'

export type LandmarkSource = 'mediapipe' | 'yolo' | 'other'

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
}

export interface LandmarksUploadResponse {
  id: string
  session_id: string
  patient_id: string
  object_key: string
  upload_url: string
  upload_expires_in: number
  status: string
}

export const landmarksService = {
  requestUpload(body: LandmarksUploadRequest): Promise<LandmarksUploadResponse> {
    return api.post<LandmarksUploadResponse>('/landmarks', body)
  },

  confirm(landmarksId: string): Promise<LandmarksUploadResponse> {
    return api.post<LandmarksUploadResponse>(`/landmarks/${landmarksId}/confirm`, {})
  },

  async uploadJsonBatch(body: LandmarksUploadRequest, jsonPayload: object): Promise<LandmarksUploadResponse> {
    const meta = await this.requestUpload(body)
    const json = JSON.stringify(jsonPayload)
    await putPresignedObject(meta.upload_url, json, 'application/json')
    return this.confirm(meta.id)
  },

  list(params: { patient_id: string; session_id?: string; node_id?: string }): Promise<LandmarksUploadResponse[]> {
    return api.get<LandmarksUploadResponse[]>(`/landmarks${buildQueryString(params)}`)
  },
}