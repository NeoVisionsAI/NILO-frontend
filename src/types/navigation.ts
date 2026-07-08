import type { ReactNode } from 'react'

/**
 * Descriptor de un elemento de navegación de la barra lateral.
 * Cada rol define su propia lista de NavItem (ver features/<rol>/navigation.ts).
 */
export interface NavItem {
  /** Ruta absoluta a la que navega. */
  to: string
  /** Texto visible. */
  label: string
  /** Icono opcional (cualquier nodo React, p. ej. un SVG). */
  icon?: ReactNode
  /** Si es true, la ruta debe coincidir exactamente para marcarse activa. */
  end?: boolean
}
