import type { NavItem } from '@/types'
import { ROOT_PATHS } from '@/router/paths'
import { IconDashboard, IconUsers, IconSettings } from '@/components/icons'

/** Navegación de la barra lateral del rol Administrador. */
export const adminNav: NavItem[] = [
  { to: ROOT_PATHS.admin, label: 'Panel', icon: <IconDashboard />, end: true },
  { to: `${ROOT_PATHS.admin}/usuarios`, label: 'Usuarios', icon: <IconUsers /> },
  { to: `${ROOT_PATHS.admin}/configuracion`, label: 'Configuración', icon: <IconSettings /> },
]
