import type { NavItem } from '@/types'
import { ROOT_PATHS } from '@/router/paths'
import { IconDashboard, IconClipboard, IconHeart } from '@/components/icons'

/** Navegación de la barra lateral del rol Enfermería. */
export const nurseNav: NavItem[] = [
  { to: ROOT_PATHS.nurse, label: 'Panel', icon: <IconDashboard />, end: true },
  { to: `${ROOT_PATHS.nurse}/rondas`, label: 'Rondas', icon: <IconHeart /> },
  { to: `${ROOT_PATHS.nurse}/tareas`, label: 'Tareas', icon: <IconClipboard /> },
]
