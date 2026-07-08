import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import './StatCard.css'

interface StatCardProps {
  label: string
  value: ReactNode
  unit?: string
  icon?: ReactNode
  trend?: { value: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
}

/** Tarjeta de métrica: reutilizable en cualquier dashboard. */
export function StatCard({ label, value, unit, icon, trend }: StatCardProps) {
  return (
    <article className="nilo-stat">
      <div className="nilo-stat__top">
        <span className="nilo-stat__label">{label}</span>
        {icon && <span className="nilo-stat__icon">{icon}</span>}
      </div>
      <div className="nilo-stat__value">
        {value}
        {unit && <span className="nilo-stat__unit">{unit}</span>}
      </div>
      {trend && (
        <Badge tone={trend.tone} className="nilo-stat__trend">
          {trend.value}
        </Badge>
      )}
    </article>
  )
}
