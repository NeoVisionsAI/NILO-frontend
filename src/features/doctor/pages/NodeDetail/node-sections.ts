import type { Node } from '@/types'

/** Identificador abierto para secciones del nodo (ampliable desde backend). */
export type NodeSectionId = string

export type NodeSectionKind = 'data' | 'devices'

export interface NodeSectionConfig {
  id: NodeSectionId
  label: string
  icon: string
  kind: NodeSectionKind
  /** Clave para órdenes WebSocket vía servidor (ej. monitoring-cameras, physiological-cameras, bluetooth-microns). */
  commandKey?: string
  description: string
}

export function resolveNodeSections(_node: Node): NodeSectionConfig[] {
  return DEFAULT_NODE_SECTIONS
}

export const DEFAULT_NODE_SECTIONS: NodeSectionConfig[] = [
  {
    id: 'node-data',
    label: 'Datos del nodo',
    icon: 'settings',
    kind: 'data',
    description: 'Modificar nombre, ubicación, conectividad y credenciales del nodo.',
  },
  {
    id: 'monitoring-camera',
    label: 'Cámara de monitorización',
    icon: 'videocam',
    kind: 'devices',
    commandKey: 'monitoring-cameras',
    description: 'Añadir, gestionar y consultar el estado en tiempo real de las cámaras de monitorización.',
  },
  {
    id: 'physiological-camera',
    label: 'Cámara fisiológica',
    icon: 'sensors',
    kind: 'devices',
    commandKey: 'physiological-cameras',
    description: 'Dispositivos conectados para extraer parámetros fisiológicos en tiempo real.',
  },
  {
    id: 'bluetooth-microns',
    label: 'Micronos Bluetooth',
    icon: 'bluetooth',
    kind: 'devices',
    commandKey: 'bluetooth-microns',
    description: 'Sensores micronos detectados por el nodo vía Bluetooth o USB.',
  },
]

export function sectionHasSearch(section: NodeSectionConfig): boolean {
  return section.kind === 'devices'
}

export function findNodeSection(
  sections: NodeSectionConfig[],
  id: NodeSectionId,
): NodeSectionConfig | undefined {
  return sections.find((s) => s.id === id)
}
