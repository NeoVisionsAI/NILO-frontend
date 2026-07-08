import { Outlet } from 'react-router-dom'
import { Brand } from '@/components/layout/Brand'
import './AuthLayout.css'

/** Layout para páginas públicas de autenticación (login, recuperar, etc.). */
export function AuthLayout() {
  return (
    <div className="nilo-auth">
      <div className="nilo-auth__panel">
        <div className="nilo-auth__brand">
          <Brand />
        </div>
        <Outlet />
      </div>
      <aside className="nilo-auth__aside">
        <div className="nilo-auth__aside-content">
          <h2>Monitorización médica integral</h2>
          <p>
            NILO centraliza las constantes vitales, alertas y el seguimiento clínico de tus
            pacientes en una única plataforma.
          </p>
        </div>
      </aside>
    </div>
  )
}
