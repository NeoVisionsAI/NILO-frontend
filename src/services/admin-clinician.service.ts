import { api } from './api'
import type {
  AdminClinicianCreate,
  AdminClinicianUpdate,
  AdminUserListParams,
  ClinicianUser,
} from '@/types'
import { buildQueryString } from '@/types/admin-common'

export const adminClinicianService = {
  list(params: AdminUserListParams = {}): Promise<ClinicianUser[]> {
    return api.get<ClinicianUser[]>(`/admin/clinicians${buildQueryString(params)}`)
  },

  get(id: string): Promise<ClinicianUser> {
    return api.get<ClinicianUser>(`/admin/clinicians/${id}`)
  },

  create(body: AdminClinicianCreate): Promise<ClinicianUser> {
    return api.post<ClinicianUser>('/admin/clinicians', body)
  },

  update(id: string, body: AdminClinicianUpdate): Promise<ClinicianUser> {
    return api.patch<ClinicianUser>(`/admin/clinicians/${id}`, body)
  },

  remove(id: string): Promise<void> {
    return api.delete<void>(`/admin/clinicians/${id}`)
  },
}
