export type ClinicianType = 'doctor' | 'nurse' | 'other'

/** Perfil clínico anidado (`clinician_profile` en UserOut). */
export interface ClinicianProfile {
  type_clinician: ClinicianType
  institution?: string | null
  location?: string | null
  phone_work?: string | null
}

export interface ClinicianUser {
  id: string
  name: string
  lastname: string
  type_user: 'clinician'
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
  clinician_profile: ClinicianProfile
}

export interface ClinicianProfileInput {
  type_clinician: ClinicianType
  institution?: string
  location?: string
  phone_work?: string
}

export interface AdminClinicianCreate {
  name: string
  lastname: string
  email: string
  password: string
  country?: string
  is_active?: boolean
  clinician_profile: ClinicianProfileInput
}

export interface AdminClinicianUpdate {
  name?: string
  lastname?: string
  email?: string
  password?: string
  country?: string
  is_active?: boolean
  clinician_profile?: ClinicianProfileInput
}

export function clinicianProfileToInput(profile: ClinicianProfile): ClinicianProfileInput {
  return {
    type_clinician: profile.type_clinician,
    institution: profile.institution ?? undefined,
    location: profile.location ?? undefined,
    phone_work: profile.phone_work ?? undefined,
  }
}

export function clinicianDisplayName(c: Pick<ClinicianUser, 'name' | 'lastname'>): string {
  return [c.name, c.lastname].filter(Boolean).join(' ')
}
