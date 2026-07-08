import { UserRole } from '@/types'

/** Rutas raíz de cada área. Punto único de verdad para las URLs base. */
export const ROOT_PATHS = {
  login: '/login',
  admin: '/admin',
  doctor: '/doctor',
  nurse: '/nurse',
  patient: '/patient',
} as const

/** Devuelve la ruta de inicio (home) correspondiente al rol del usuario. */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return ROOT_PATHS.admin
    case UserRole.DOCTOR:
      return ROOT_PATHS.doctor
    case UserRole.NURSE:
      return ROOT_PATHS.nurse
    case UserRole.PATIENT:
      return ROOT_PATHS.patient
    default:
      return ROOT_PATHS.login
  }
}
