import type { NavItem } from '@/types'
import { ROOT_PATHS } from '@/router/paths'
import { IconDashboard, IconUsers, IconAlert } from '@/components/icons'

/** Navegación de la barra lateral del rol Médico. */
export const doctorNav: NavItem[] = [
  { to: ROOT_PATHS.doctor, label: 'Panel', icon: <IconDashboard />, end: true },
  { to: `${ROOT_PATHS.doctor}/pacientes`, label: 'Pacientes', icon: <IconUsers /> },
  { to: `${ROOT_PATHS.doctor}/alertas`, label: 'Alertas', icon: <IconAlert /> },
]
