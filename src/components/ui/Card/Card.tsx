import type { HTMLAttributes, ReactNode } from 'react'
import './Card.css'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  padded?: boolean
}

export function Card({
  title,
  subtitle,
  actions,
  padded = true,
  className = '',
  children,
  ...props
}: CardProps) {
  const hasHeader = title || subtitle || actions
  return (
    <section className={`nilo-card ${className}`} {...props}>
      {hasHeader && (
        <header className="nilo-card__header">
          <div>
            {title && <h3 className="nilo-card__title">{title}</h3>}
            {subtitle && <p className="nilo-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="nilo-card__actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'nilo-card__body' : ''}>{children}</div>
    </section>
  )
}
