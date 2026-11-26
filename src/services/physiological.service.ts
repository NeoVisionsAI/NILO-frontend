import { api } from './api'
import type { PhysiologicalSample } from '@/dev/ingestion-sim/synthetic-data'
import { buildQueryString } from '@/types/admin-common'

export interface PhysiologicalReading extends PhysiologicalSample {
  id: string
}

export const physiologicalService = {
  create(body: PhysiologicalSample): Promise<PhysiologicalReading> {
    return api.post<PhysiologicalReading>('/physiological', body)
  },

  createBulk(items: PhysiologicalSample[]): Promise<PhysiologicalReading[]> {
    return api.post<PhysiologicalReading[]>('/physiological/bulk', items)
  },

  list(params: {
    patient_id: string
    session_id?: string
    node_id?: string
    skip?: number
    limit?: number
  }): Promise<PhysiologicalReading[]> {
    return api.get<PhysiologicalReading[]>(`/physiological${buildQueryString(params)}`)
  },

  remove(readingId: string): Promise<void> {
    return api.delete<void>(`/physiological/${readingId}`)
  },
}