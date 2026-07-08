import { env } from '@/config/env'
import './AppFooter.css'

const APP_VERSION = '0.1.0'

/** Pie de página reutilizable. */
export function AppFooter() {
  return (
    <footer className="nilo-footer">
      <span>
        © {new Date().getFullYear()} {env.appName} · Monitorización médica integral
      </span>
      <span className="nilo-footer__meta">v{APP_VERSION}</span>
    </footer>
  )
}
