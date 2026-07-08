export type PatientSex = 'male' | 'female' | 'other' | 'unknown'
export type PatientType = 'adult' | 'child' | 'neonate' | 'other'

/** Perfil clínico anidado (`patient_profile` en UserOut). */
export interface PatientProfile {
  type_patient: PatientType
  monitoring_active: boolean
  node_id?: string | null
  medical_record_number?: string | null
  sex?: PatientSex | null
  room?: string | null
  bed?: string | null
  notes?: string | null
  relative_name?: string | null
  relative_contact?: string | null
  relative_address?: string | null
}

/**
 * Paciente del dashboard: usuario con `type_user = "patient"` (UserOut).
 * La foto viene como data URI base64 en `photo`.
 */
export interface PatientUser {
  id: string
  name: string
  lastname: string
  type_user: 'patient'
  email: string
  birthdate?: string | null
  photo?: string | null
  address?: string | null
  zip?: string | null
  country?: string | null
  phone?: string | null
  register_date?: string
  is_active?: boolean
  registered_by?: string | null
  patient_profile: PatientProfile
}

/** Perfil clínico para alta/actualización (objeto completo en PATCH). */
export interface PatientProfileInput {
  type_patient: PatientType
  monitoring_active: boolean
  medical_record_number?: string
  sex?: PatientSex
  room?: string
  bed?: string
  notes?: string
  relative_name?: string
  relative_contact?: string
  relative_address?: string
  node_id?: string | null
}

/** Cuerpo para crear un paciente — POST /users. */
export interface PatientUserCreate {
  name: string
  lastname: string
  type_user: 'patient'
  email: string
  password: string
  birthdate?: string
  photo?: string
  address?: string
  zip?: string
  country?: string
  phone?: string
  patient_profile: PatientProfileInput
}

/** Cuerpo para actualizar un paciente — PATCH /users/{id}. */
export interface PatientUserUpdate {
  name?: string
  lastname?: string
  email?: string
  password?: string
  birthdate?: string
  photo?: string
  address?: string
  zip?: string
  country?: string
  phone?: string
  is_active?: boolean
  /** Si se envía, debe ir el objeto completo (el backend lo reemplaza entero). */
  patient_profile?: PatientProfileInput
}

/** Convierte el perfil de respuesta al input requerido en PATCH (objeto completo). */
export function patientProfileToInput(profile: PatientProfile): PatientProfileInput {
  return {
    type_patient: profile.type_patient,
    monitoring_active: profile.monitoring_active,
    medical_record_number: profile.medical_record_number ?? undefined,
    sex: profile.sex ?? undefined,
    room: profile.room ?? undefined,
    bed: profile.bed ?? undefined,
    notes: profile.notes ?? undefined,
    relative_name: profile.relative_name ?? undefined,
    relative_contact: profile.relative_contact ?? undefined,
    relative_address: profile.relative_address ?? undefined,
    node_id: profile.node_id ?? undefined,
  }
}

/** Nombre completo legible para la UI. */
export function patientDisplayName(p: Pick<PatientUser, 'name' | 'lastname'>): string {
  return [p.name, p.lastname].filter(Boolean).join(' ')
}

/** Resumen de paciente con monitorización activa — GET /users/monitoring-active. */
export interface MonitoringActivePatient {
  id: string
  name: string
  lastname: string
  photo?: string | null
}
