import { api } from './api'
import { buildQueryString } from '@/types/admin-common'

export interface PainEventOut {
  id: string
  session_id: string
  patient_id: string
  start_ts: string
  end_ts?: string | null
  duration_seconds?: number | null
  severity?: number | null
  notes?: string | null
  status: string
}

export const painEventService = {
  list(params: { patient_id: string; session_id?: string; limit?: number }): Promise<PainEventOut[]> {
    return api.get<PainEventOut[]>(`/pain-events${buildQueryString(params)}`)
  },

  remove(id: string): Promise<void> {
    return api.delete<void>(`/pain-events/${id}`)
  },
}