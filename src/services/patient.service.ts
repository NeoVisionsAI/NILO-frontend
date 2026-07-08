import { api } from './api'
import type { MonitoringActivePatient, PatientUser, PatientUserCreate, PatientUserUpdate } from '@/types'

export interface ListPatientUsersParams {
  skip?: number
  limit?: number
}

/**
 * Pacientes del dashboard vía `/users` (NO `/patients`).
 * El clínico solo ve los que registró; root ve todos.
 */
export const patientService = {
  list({ skip = 0, limit = 100 }: ListPatientUsersParams = {}): Promise<PatientUser[]> {
    const q = new URLSearchParams({
      type_user: 'patient',
      skip: String(skip),
      limit: String(limit),
    })
    return api.get<PatientUser[]>(`/users?${q.toString()}`)
  },

  get(id: string): Promise<PatientUser> {
    return api.get<PatientUser>(`/users/${id}`)
  },

  create(body: PatientUserCreate): Promise<PatientUser> {
    return api.post<PatientUser>('/users', body)
  },

  update(id: string, body: PatientUserUpdate): Promise<PatientUser> {
    return api.patch<PatientUser>(`/users/${id}`, body)
  },

  remove(id: string): Promise<void> {
    return api.delete<void>(`/users/${id}`)
  },

  /** Asignar o quitar nodo — PATCH /users/{id}/node */
  assignNode(patientId: string, nodeId: string | null): Promise<PatientUser> {
    return api.patch<PatientUser>(`/users/${patientId}/node`, { node_id: nodeId })
  },

  /** Pacientes con monitorización activa — GET /users/monitoring-active */
  listMonitoringActive(): Promise<MonitoringActivePatient[]> {
    return api.get<MonitoringActivePatient[]>('/users/monitoring-active')
  },

  /** Opción B: subir foto como multipart (el backend la convierte a base64). */
  uploadPhoto(id: string, file: File): Promise<PatientUser> {
    const form = new FormData()
    form.append('file', file)
    return api.postFormData<PatientUser>(`/users/${id}/photo`, form)
  },
}
