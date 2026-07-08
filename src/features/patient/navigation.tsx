import type { NavItem } from '@/types'
import { ROOT_PATHS } from '@/router/paths'
import { IconDashboard, IconActivity, IconCalendar, IconPill } from '@/components/icons'

/** Navegación de la barra lateral del rol Paciente. */
export const patientNav: NavItem[] = [
  { to: ROOT_PATHS.patient, label: 'Mi salud', icon: <IconDashboard />, end: true },
  { to: `${ROOT_PATHS.patient}/constantes`, label: 'Mis constantes', icon: <IconActivity /> },
  { to: `${ROOT_PATHS.patient}/citas`, label: 'Citas', icon: <IconCalendar /> },
  { to: `${ROOT_PATHS.patient}/medicacion`, label: 'Medicación', icon: <IconPill /> },
]
