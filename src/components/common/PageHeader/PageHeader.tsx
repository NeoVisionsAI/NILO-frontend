import type { ReactNode } from 'react'
import './PageHeader.css'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

/** Cabecera de página reutilizable dentro del área de contenido. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="nilo-page-header">
      <div>
        <h2 className="nilo-page-header__title">{title}</h2>
        {description && <p className="nilo-page-header__desc">{description}</p>}
      </div>
      {actions && <div className="nilo-page-header__actions">{actions}</div>}
    </div>
  )
}
