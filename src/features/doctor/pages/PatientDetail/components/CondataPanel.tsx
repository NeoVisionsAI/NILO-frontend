import type { ReactNode } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import './CondataPanel.css'

interface CondataPanelProps {
  icon: string
  title: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
  children: ReactNode
}

/** Contenedor CONDATA: contexto visible + área de contenido. */
export function CondataPanel({
  icon,
  title,
  subtitle,
  onBack,
  backLabel = 'Volver',
  children,
}: CondataPanelProps) {
  return (
    <section className="nilo-condata" aria-label="CONDATA">
      <header className="nilo-condata__header">
        <div className="nilo-condata__context">
          <span className="nilo-condata__badge">CONDATA</span>
          <div className="nilo-condata__title-wrap">
            <span className="nilo-condata__icon">
              <MaterialIcon name={icon} size={20} />
            </span>
            <div>
              <h2 className="nilo-condata__title">{title}</h2>
              {subtitle && <p className="nilo-condata__subtitle">{subtitle}</p>}
            </div>
          </div>
        </div>

        {onBack && (
          <button type="button" className="nilo-condata__back" onClick={onBack}>
            <MaterialIcon name="arrow_back" size={18} />
            <span>{backLabel}</span>
          </button>
        )}
      </header>

      <div className="nilo-condata__body">{children}</div>
    </section>
  )
}
