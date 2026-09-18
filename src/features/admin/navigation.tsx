import type { NavItem } from '@/types'
import { ROOT_PATHS } from '@/router/paths'
import { IconDashboard, IconHeart, IconStethoscope, IconActivity } from '@/components/icons'

/** Navegación del panel root admin. */
export const adminNav: NavItem[] = [
  { to: ROOT_PATHS.admin, label: 'Panel', icon: <IconDashboard />, end: true },
  { to: `${ROOT_PATHS.admin}/pacientes`, label: 'Pacientes', icon: <IconHeart /> },
  { to: `${ROOT_PATHS.admin}/medicos`, label: 'Médicos', icon: <IconStethoscope /> },
  { to: `${ROOT_PATHS.admin}/nodos`, label: 'NILO Nodes', icon: <IconActivity /> },
]
