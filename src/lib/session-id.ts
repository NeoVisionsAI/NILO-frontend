import type { MonitoringSession } from '@/types/monitoring-session'

/** Id MongoDB (24 hex) — mismo segmento que en rutas MinIO `.../sessions/<id>/...`. */
export function isMongoSessionId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value)
}

/**
 * Id que debe mostrarse, copiarse y enviarse en ingestión.
 * Prioriza `patient_profile.active_session_id` y evita confundir con `external_session_id` (UUID).
 */
export function canonicalSessionId(
  session: Pick<MonitoringSession, 'id' | 'external_session_id'> | null | undefined,
  profileActiveSessionId?: string | null,
): string | null {
  if (profileActiveSessionId && isMongoSessionId(profileActiveSessionId)) {
    return profileActiveSessionId
  }
  const primary = session?.id
  if (primary && isMongoSessionId(primary)) return primary
  if (primary && !isMongoSessionId(primary)) {
    return profileActiveSessionId ?? null
  }
  return profileActiveSessionId ?? primary ?? null
}