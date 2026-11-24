import { api } from './api'
import type {
  MonitoringSession,
  SessionMediaAccess,
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

  update(sessionId: string, body: { display_name: string | null }): Promise<MonitoringSession> {
    return api.patch<MonitoringSession>(`/sessions/${sessionId}`, body)
  },

  overview(sessionId: string, options?: { silent?: boolean }): Promise<SessionOverview> {
    return api.get<SessionOverview>(`/sessions/${sessionId}/overview`, { silent: options?.silent })
  },

  mediaAccess(
    sessionId: string,
    expiresIn = 86_400,
    options?: { silent?: boolean },
  ): Promise<SessionMediaAccess> {
    const q = new URLSearchParams({ expires_in: String(expiresIn) })
    return api.get<SessionMediaAccess>(`/sessions/${sessionId}/media-access?${q}`, {
      silent: options?.silent,
    })
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