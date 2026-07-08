import { NavLink } from 'react-router-dom'
import { Brand } from '@/components/layout/Brand'
import type { NavItem } from '@/types'
import './Sidebar.css'

interface SidebarProps {
  items: NavItem[]
  /** Texto que identifica el área (p. ej. "Panel médico"). */
  sectionLabel?: string
  open?: boolean
  onClose?: () => void
}

/**
 * Barra lateral de navegación reutilizable.
 * Cada rol le pasa su propia lista de `items`, de modo que el mismo componente
 * sirve para admin, médico, enfermería y paciente.
 */
export function Sidebar({ items, sectionLabel, open = false, onClose }: SidebarProps) {
  return (
    <>
      <div
        className={open ? 'nilo-sidebar__overlay nilo-sidebar__overlay--visible' : 'nilo-sidebar__overlay'}
        onClick={onClose}
      />
      <aside className={open ? 'nilo-sidebar nilo-sidebar--open' : 'nilo-sidebar'}>
        <div className="nilo-sidebar__brand">
          <Brand />
        </div>

        {sectionLabel && <p className="nilo-sidebar__section">{sectionLabel}</p>}

        <nav className="nilo-sidebar__nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                isActive ? 'nilo-sidebar__link nilo-sidebar__link--active' : 'nilo-sidebar__link'
              }
            >
              {item.icon && <span className="nilo-sidebar__icon">{item.icon}</span>}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
