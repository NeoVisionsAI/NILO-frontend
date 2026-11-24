import { api } from './api'
import type {
  MonitoringSession,
  SessionOverview,
  SessionTextNote,
  SessionTextNoteCreate,
} from '@/types/monitoring-session'
import { buildQueryString } from '@/types/admin-common'

export interface ListSessionsParams {
  patient_id?: string
  node_id?: string
  status_filter?: string
  skip?: number
  limit?: number
}

export const monitoringSessionService = {
  list(params: ListSessionsParams = {}): Promise<MonitoringSession[]> {
    return api.get<MonitoringSession[]>(`/sessions${buildQueryString(params)}`)
  },

  get(sessionId: string): Promise<MonitoringSession> {
    return api.get<MonitoringSession>(`/sessions/${sessionId}`)
  },

  overview(sessionId: string): Promise<SessionOverview> {
    return api.get<SessionOverview>(`/sessions/${sessionId}/overview`)
  },

  create(body: {
    patient_id: string
    node_id?: string
    external_session_id?: string
  }): Promise<MonitoringSession> {
    return api.post<MonitoringSession>('/sessions', body)
  },

  end(sessionId: string): Promise<MonitoringSession> {
    return api.post<MonitoringSession>(`/sessions/${sessionId}/end`, {})
  },

  listTextNotes(sessionId: string, skip = 0, limit = 100): Promise<SessionTextNote[]> {
    const q = new URLSearchParams({ skip: String(skip), limit: String(limit) })
    return api.get<SessionTextNote[]>(`/sessions/${sessionId}/text-notes?${q.toString()}`)
  },

  getTextNote(sessionId: string, noteId: string): Promise<SessionTextNote> {
    return api.get<SessionTextNote>(`/sessions/${sessionId}/text-notes/${noteId}`)
  },

  createTextNote(sessionId: string, body: SessionTextNoteCreate): Promise<SessionTextNote> {
    return api.post<SessionTextNote>(`/sessions/${sessionId}/text-notes`, body)
  },

  updateTextNote(sessionId: string, noteId: string, body: string): Promise<SessionTextNote> {
    return api.patch<SessionTextNote>(`/sessions/${sessionId}/text-notes/${noteId}`, { body })
  },
}