import { clinicalPatientService } from './clinical-patient.service'
import { monitoringSessionService } from './monitoring-session.service'
import { patientService } from './patient.service'
import type { MonitoringSession } from '@/types/monitoring-session'
import type { PatientProfile, PatientProfileInput, PatientUser } from '@/types'

function profileNeedsSync(user: PatientUser, input: PatientProfileInput): boolean {
  const p = user.patient_profile
  return (
    input.type_patient !== p.type_patient ||
    (input.node_id ?? null) !== (p.node_id ?? null) ||
    (input.medical_record_number ?? '') !== (p.medical_record_number ?? '') ||
    (input.room ?? '') !== (p.room ?? '') ||
    (input.bed ?? '') !== (p.bed ?? '') ||
    (input.notes ?? '') !== (p.notes ?? '')
  )
}

/**
 * Monitorización: lifecycle vía `POST /users/{id}/monitoring/start|stop`.
 * No crear sesión con `POST /sessions` + UUID desde el toggle.
 */
export const patientMonitoringService = {
  async resolveActiveSession(
    _userId: string,
    profile: Pick<PatientProfile, 'monitoring_active' | 'active_session_id'>,
  ): Promise<MonitoringSession | null> {
    if (!profile.monitoring_active) return null

    if (profile.active_session_id) {
      try {
        const session = await monitoringSessionService.get(profile.active_session_id)
        if (session.status === 'active') return session
      } catch {
        return null
      }
    }

    return null
  },

  async start(
    user: PatientUser,
    profileInput: PatientProfileInput,
  ): Promise<{ user: PatientUser; session: MonitoringSession }> {
    const clinical = await clinicalPatientService.resolveByUserId(user.id)
    if (!clinical) {
      throw Object.assign(new Error('No clinical patient'), { code: 'NO_CLINICAL_PATIENT' as const })
    }

    let currentUser = user
    if (profileNeedsSync(user, profileInput)) {
      currentUser = await patientService.update(user.id, {
        patient_profile: {
          ...profileInput,
          monitoring_active: user.patient_profile.monitoring_active,
        },
      })
    }

    if (currentUser.patient_profile.monitoring_active && currentUser.patient_profile.active_session_id) {
      try {
        const session = await monitoringSessionService.get(currentUser.patient_profile.active_session_id)
        if (session.status === 'active') {
          return { user: currentUser, session }
        }
      } catch {
        /* continuar con start */
      }
    }

    const { user: startedUser, session } = await patientService.monitoringStart(user.id)
    return { user: startedUser, session }
  },

  async stop(
    user: PatientUser,
    profileInput: PatientProfileInput,
    _hints: { activeSessionId?: string | null } = {},
  ): Promise<PatientUser> {
    const stoppedUser = await patientService.monitoringStop(user.id)

    if (!profileNeedsSync(stoppedUser, profileInput)) {
      return stoppedUser
    }

    return patientService.update(user.id, {
      patient_profile: {
        ...profileInput,
        monitoring_active: false,
      },
    })
  },
}