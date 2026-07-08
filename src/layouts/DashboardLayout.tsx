import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/layout/AppHeader'
import { AppFooter } from '@/components/layout/AppFooter'
import { Sidebar } from '@/components/layout/Sidebar'
import type { NavItem } from '@/types'
import './DashboardLayout.css'

interface DashboardLayoutProps {
  /** Elementos de navegación específicos del rol. */
  navItems: NavItem[]
  /** Etiqueta del área mostrada en la barra lateral. */
  sectionLabel: string
  /** Título mostrado en la cabecera. */
  headerTitle?: string
}

/**
 * Estructura base de la aplicación autenticada: barra lateral + cabecera +
 * área de contenido (<Outlet />) + pie.
 *
 * Es AGNÓSTICA al rol: cada rol le inyecta sus `navItems` y `sectionLabel`,
 * por lo que la misma carcasa se reutiliza en las 4 áreas de usuario.
 * El <Outlet /> renderiza la vista de la ruta hija activa.
 */
export function DashboardLayout({ navItems, sectionLabel, headerTitle }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="nilo-dashboard">
      <Sidebar
        items={navItems}
        sectionLabel={sectionLabel}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="nilo-dashboard__main">
        <AppHeader title={headerTitle} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="nilo-dashboard__content">
          <div className="nilo-dashboard__inner">
            <Outlet />
          </div>
        </main>
        <AppFooter />
      </div>
    </div>
  )
}
