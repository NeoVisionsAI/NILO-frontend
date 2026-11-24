import { api } from './api'
import type { ClinicalPatient } from '@/types/monitoring-session'

export interface ListClinicalPatientsParams {
  node_id?: string
  skip?: number
  limit?: number
  active_only?: boolean
}

/** Paciente clínico (`/patients`) — distinto del `User` en `/users`. */
export const clinicalPatientService = {
  list(params: ListClinicalPatientsParams = {}): Promise<ClinicalPatient[]> {
    const q = new URLSearchParams()
    if (params.node_id) q.set('node_id', params.node_id)
    if (params.skip != null) q.set('skip', String(params.skip))
    if (params.limit != null) q.set('limit', String(params.limit))
    if (params.active_only != null) q.set('active_only', String(params.active_only))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return api.get<ClinicalPatient[]>(`/patients${suffix}`)
  },

  get(id: string): Promise<ClinicalPatient> {
    return api.get<ClinicalPatient>(`/patients/${id}`)
  },

  /** Resuelve el `Patient` clínico vinculado a un usuario paciente (`/users` id). */
  async resolveByUserId(userId: string): Promise<ClinicalPatient | null> {
    const list = await this.list({ limit: 500, active_only: false })
    return list.find((p) => p.user_id === userId) ?? null
  },
}