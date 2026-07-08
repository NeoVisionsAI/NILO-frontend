import type { PatientUser } from '@/types'

/** Identificador abierto: el backend podrá devolver secciones distintas por tipo de paciente. */
export type PatientSectionId = string

export type PatientSectionMode = 'live' | 'record'

/**
 * Configuración de una sección del Contenedor B.
 * `recordKey` enlazará con el tipo de registro/formulario en el backend.
 */
export interface PatientSectionConfig {
  id: PatientSectionId
  label: string
  icon: string
  mode: PatientSectionMode
  /** Solo en mode=record. Clave para resolver formulario y API (ej. blood-analysis, neonatal-growth). */
  recordKey?: string
}

export type SectionViewMode = 'browse' | 'add'

/**
 * Secciones por defecto (mock local).
 * Más adelante: GET /patients/:id/sections o reglas por tipo de paciente en backend.
 */
export function resolvePatientSections(_patient: PatientUser): PatientSectionConfig[] {
  return DEFAULT_PATIENT_SECTIONS
}

export const DEFAULT_PATIENT_SECTIONS: PatientSectionConfig[] = [
  {
    id: 'live',
    label: 'Live',
    icon: 'monitor_heart',
    mode: 'live',
  },
  {
    id: 'clinical-results',
    label: 'Resultados clínicos',
    icon: 'biotech',
    mode: 'record',
    recordKey: 'clinical-results',
  },
  {
    id: 'growth',
    label: 'Crecimiento',
    icon: 'straighten',
    mode: 'record',
    recordKey: 'growth',
  },
]

export function sectionAllowsAdd(section: PatientSectionConfig): boolean {
  return section.mode === 'record'
}

export function findPatientSection(
  sections: PatientSectionConfig[],
  id: PatientSectionId,
): PatientSectionConfig | undefined {
  return sections.find((s) => s.id === id)
}
