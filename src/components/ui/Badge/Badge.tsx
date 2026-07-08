import type { ReactNode } from 'react'
import './Badge.css'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return <span className={`nilo-badge nilo-badge--${tone} ${className}`}>{children}</span>
}
