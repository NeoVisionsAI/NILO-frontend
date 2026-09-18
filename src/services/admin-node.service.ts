import { api } from './api'
import type { AdminNode, AdminNodeCreate, AdminNodeListParams, AdminNodeUpdate } from '@/types'
import { buildQueryString } from '@/types/admin-common'

export const adminNodeService = {
  list(params: AdminNodeListParams = {}): Promise<AdminNode[]> {
    return api.get<AdminNode[]>(`/admin/nodes${buildQueryString(params)}`)
  },

  get(id: string): Promise<AdminNode> {
    return api.get<AdminNode>(`/admin/nodes/${id}`)
  },

  create(body: AdminNodeCreate): Promise<AdminNode> {
    return api.post<AdminNode>('/admin/nodes', body)
  },

  update(id: string, body: AdminNodeUpdate): Promise<AdminNode> {
    return api.patch<AdminNode>(`/admin/nodes/${id}`, body)
  },

  remove(id: string): Promise<void> {
    return api.delete<void>(`/admin/nodes/${id}`)
  },
}
