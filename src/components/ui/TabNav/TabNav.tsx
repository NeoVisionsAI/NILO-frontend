import { NavLink } from 'react-router-dom'
import './TabNav.css'

export interface TabItem {
  to: string
  label: string
  end?: boolean
}

interface TabNavProps {
  items: TabItem[]
  className?: string
}

/**
 * Pestañas de navegación basadas en rutas.
 *
 * Se combina con un <Outlet /> interno para intercambiar subvistas dentro de
 * un mismo contenedor sin recargar el resto de la página. Ejemplo de uso en
 * features/doctor/pages/PatientDetail/PatientDetailPage.tsx.
 */
export function TabNav({ items, className = '' }: TabNavProps) {
  return (
    <nav className={`nilo-tabnav ${className}`}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            isActive ? 'nilo-tabnav__link nilo-tabnav__link--active' : 'nilo-tabnav__link'
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
