import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const classes = [
    'nilo-btn',
    `nilo-btn--${variant}`,
    `nilo-btn--${size}`,
    fullWidth ? 'nilo-btn--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} {...props}>
      {leftIcon && <span className="nilo-btn__icon">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="nilo-btn__icon">{rightIcon}</span>}
    </button>
  )
}
