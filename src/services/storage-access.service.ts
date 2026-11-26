import { api } from './api'
import type { PresignedDownload } from '@/types/monitoring-session'

export type ClinicalStorageKind = 'landmarks' | 'audio' | 'video' | 'document' | 'pain'

export const storageAccessService = {
  /** GET /storage/access?kind=…&resource_id=…&expires_in=… → PresignedDownload (no binario). */
  getDownloadUrl(
    kind: ClinicalStorageKind,
    resourceId: string,
    expiresIn = 3600,
  ): Promise<PresignedDownload> {
    const q = new URLSearchParams({
      kind,
      resource_id: resourceId,
      expires_in: String(expiresIn),
    })
    return api.get<PresignedDownload>(`/storage/access?${q.toString()}`)
  },
}