import { api } from './api'
import type { Node, NodeCreate, NodeUpdate } from '@/types'

export interface ListNodesParams {
  skip?: number
  limit?: number
}

export const nodeService = {
  list({ skip = 0, limit = 100 }: ListNodesParams = {}, silent = false): Promise<Node[]> {
    const q = new URLSearchParams({ skip: String(skip), limit: String(limit) })
    return api.get<Node[]>(`/nodes?${q.toString()}`, { silent })
  },

  get(id: string): Promise<Node> {
    return api.get<Node>(`/nodes/${id}`)
  },

  create(body: NodeCreate): Promise<Node> {
    return api.post<Node>('/nodes', body)
  },

  update(id: string, body: NodeUpdate): Promise<Node> {
    return api.patch<Node>(`/nodes/${id}`, body)
  },

  remove(id: string): Promise<void> {
    return api.delete<void>(`/nodes/${id}`)
  },
}
