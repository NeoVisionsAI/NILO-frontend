import { clinicalPatientService } from './clinical-patient.service'
import { monitoringSessionService } from './monitoring-session.service'
import { patientService } from './patient.service'
import type { MonitoringSession } from '@/types/monitoring-session'
import type { PatientProfile, PatientProfileInput, PatientUser } from '@/types'

async function findActiveSessionForClinicalPatient(
  clinicalPatientId: string,
): Promise<MonitoringSession | null> {
  const list = await monitoringSessionService.list({
    patient_id: clinicalPatientId,
    status_filter: 'active',
    limit: 5,
  })
  return list.find((s) => s.status === 'active') ?? list[0] ?? null
}

/**
 * Al activar monitorización: crea sesión (`POST /sessions`) y luego `monitoring_active: true`.
 * Al desactivar: cierra la sesión activa (`POST …/end`) y apaga el flag.
 *
 * Cuando el backend exponga `patient_profile.active_session_id`, se usará como fuente de verdad.
 */
export const patientMonitoringService = {
  async resolveActiveSession(
    userId: string,
    profile: Pick<PatientProfile, 'monitoring_active' | 'active_session_id'>,
  ): Promise<MonitoringSession | null> {
    if (!profile.monitoring_active) return null

    if (profile.active_session_id) {
      try {
        const session = await monitoringSessionService.get(profile.active_session_id)
        if (session.status === 'active') return session
      } catch {
        /* seguir con listado */
      }
    }

    const clinical = await clinicalPatientService.resolveByUserId(userId)
    if (!clinical) return null
    return findActiveSessionForClinicalPatient(clinical.id)
  },

  async start(
    user: PatientUser,
    profileInput: PatientProfileInput,
  ): Promise<{ user: PatientUser; session: MonitoringSession }> {
    const clinical = await clinicalPatientService.resolveByUserId(user.id)
    if (!clinical) {
      throw Object.assign(new Error('No clinical patient'), { code: 'NO_CLINICAL_PATIENT' as const })
    }

    const existing = await findActiveSessionForClinicalPatient(clinical.id)
    if (existing) {
      const updated = await patientService.update(user.id, {
        patient_profile: { ...profileInput, monitoring_active: true },
      })
      return { user: updated, session: existing }
    }

    const external_session_id = crypto.randomUUID()
    const nodeId = profileInput.node_id ?? clinical.node_id ?? undefined
    const session = await monitoringSessionService.create({
      patient_id: clinical.id,
      node_id: nodeId,
      external_session_id,
    })

    const updated = await patientService.update(user.id, {
      patient_profile: { ...profileInput, monitoring_active: true },
    })

    return { user: updated, session }
  },

  async stop(
    user: PatientUser,
    profileInput: PatientProfileInput,
    hints: { activeSessionId?: string | null } = {},
  ): Promise<PatientUser> {
    let sessionId = hints.activeSessionId ?? user.patient_profile.active_session_id ?? null

    if (sessionId) {
      try {
        await monitoringSessionService.end(sessionId)
      } catch {
        /* ya cerrada o inexistente */
      }
    } else {
      const clinical = await clinicalPatientService.resolveByUserId(user.id)
      if (clinical) {
        const active = await findActiveSessionForClinicalPatient(clinical.id)
        if (active) await monitoringSessionService.end(active.id)
      }
    }

    return patientService.update(user.id, {
      patient_profile: { ...profileInput, monitoring_active: false },
    })
  },
}