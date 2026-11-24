import { api } from './api'
import { putPresignedObject } from '@/lib/presigned-upload'

export interface VideoSegmentUploadRequest {
  node_id?: string
  seq?: number
  kind?: 'live' | 'archive'
  fmt?: 'fmp4' | 'mp4' | 'hls_ts' | 'hls_fmp4'
  start_ts: string
  end_ts?: string
  duration_seconds?: number
  codec?: string
  width?: number
  height?: number
  fps?: number
  file_extension?: string
}

export interface VideoSegmentUploadResponse {
  segment: { id: string; object_key: string; session_id: string }
  upload: { upload_url: string; object_key: string }
}

export const videoSegmentService = {
  requestUpload(sessionId: string, body: VideoSegmentUploadRequest): Promise<VideoSegmentUploadResponse> {
    return api.post<VideoSegmentUploadResponse>(`/sessions/${sessionId}/video-segments`, body)
  },

  confirm(segmentId: string): Promise<unknown> {
    return api.post(`/sessions/video-segments/${segmentId}/confirm`, {})
  },

  async uploadPlaceholder(sessionId: string, body: VideoSegmentUploadRequest, bytes: ArrayBuffer): Promise<string> {
    const { segment, upload } = await this.requestUpload(sessionId, body)
    await putPresignedObject(upload.upload_url, bytes, 'video/mp4')
    await this.confirm(segment.id)
    return segment.id
  },
}