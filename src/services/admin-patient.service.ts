import { api } from './api'
import type { AdminPatientCreate, AdminPatientUpdate, AdminUserListParams, PatientUser } from '@/types'
import { buildQueryString } from '@/types/admin-common'

export const adminPatientService = {
  list(params: AdminUserListParams = {}): Promise<PatientUser[]> {
    return api.get<PatientUser[]>(`/admin/patients${buildQueryString(params)}`)
  },

  get(id: string): Promise<PatientUser> {
    return api.get<PatientUser>(`/admin/patients/${id}`)
  },

  create(body: AdminPatientCreate): Promise<PatientUser> {
    return api.post<PatientUser>('/admin/patients', body)
  },

  update(id: string, body: AdminPatientUpdate): Promise<PatientUser> {
    return api.patch<PatientUser>(`/admin/patients/${id}`, body)
  },

  remove(id: string): Promise<void> {
    return api.delete<void>(`/admin/patients/${id}`)
  },
}
