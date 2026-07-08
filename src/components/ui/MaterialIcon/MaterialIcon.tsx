import type { CSSProperties } from 'react'
import './MaterialIcon.css'

interface MaterialIconProps {
  /** Nombre del icono (ligadura de Material Symbols), p. ej. "lock". */
  name: string
  /** Tamaño en píxeles. */
  size?: number
  /** Relleno (0 contorno, 1 relleno). */
  filled?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * Icono de Material Symbols (Outlined) reutilizable.
 * Requiere la hoja de estilos de Material Symbols cargada en index.html.
 */
export function MaterialIcon({
  name,
  size = 24,
  filled = false,
  className = '',
  style,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined nilo-micon ${className}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        ...style,
      }}
    >
      {name}
    </span>
  )
}
