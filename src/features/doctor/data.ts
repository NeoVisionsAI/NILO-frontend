/** Datos simulados de pacientes para el área médica. */
export interface PatientSummary {
  id: string
  name: string
  age: number
  room: string
  status: 'stable' | 'attention' | 'critical'
  heartRate: number
  spo2: number
  temperature: number
}

export const MOCK_PATIENTS: PatientSummary[] = [
  { id: 'p-1001', name: 'María López', age: 67, room: '204-A', status: 'critical', heartRate: 118, spo2: 89, temperature: 38.4 },
  { id: 'p-1002', name: 'Juan Torres', age: 54, room: '210-B', status: 'attention', heartRate: 96, spo2: 94, temperature: 37.6 },
  { id: 'p-1003', name: 'Carmen Ruiz', age: 72, room: '215-A', status: 'stable', heartRate: 74, spo2: 98, temperature: 36.7 },
  { id: 'p-1004', name: 'Andrés Gil', age: 45, room: '221-C', status: 'stable', heartRate: 68, spo2: 99, temperature: 36.5 },
]

export function getPatient(id: string): PatientSummary | undefined {
  return MOCK_PATIENTS.find((p) => p.id === id)
}

export const STATUS_META: Record<PatientSummary['status'], { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  stable: { label: 'Estable', tone: 'success' },
  attention: { label: 'Atención', tone: 'warning' },
  critical: { label: 'Crítico', tone: 'danger' },
}
