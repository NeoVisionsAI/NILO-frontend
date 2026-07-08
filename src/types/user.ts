/**
 * Roles de usuario de la plataforma NILO.
 * Cada rol tiene su propio conjunto de vistas y layout.
 */
export const UserRole = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  NURSE: 'nurse',
  PATIENT: 'patient',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  avatarUrl?: string
}

/** Etiqueta legible por humanos para cada rol (ES). */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.DOCTOR]: 'Médico',
  [UserRole.NURSE]: 'Enfermería',
  [UserRole.PATIENT]: 'Paciente',
}

/**
 * Convierte el rol que devuelve el backend (`root` | `clinician` | `patient`)
 * al rol interno de la aplicación.
 */
export function roleFromApi(apiRole: string | undefined): UserRole {
  switch (apiRole) {
    case 'root':
      return UserRole.ADMIN
    case 'clinician':
      return UserRole.DOCTOR
    case 'patient':
      return UserRole.PATIENT
    default:
      return UserRole.PATIENT
  }
}
