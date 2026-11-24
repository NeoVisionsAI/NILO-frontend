import { useEffect, useState } from 'react'
import { clinicalPatientService } from '@/services/clinical-patient.service'
import type { ClinicalPatient } from '@/types/monitoring-session'

export function useClinicalPatientResolution(userId: string) {
  const [clinicalPatient, setClinicalPatient] = useState<ClinicalPatient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    clinicalPatientService
      .resolveByUserId(userId)
      .then((row) => {
        if (cancelled) return
        if (!row) {
          setClinicalPatient(null)
          setError('No hay registro clínico vinculado a este usuario. Revise la sincronización en el backend.')
          return
        }
        setClinicalPatient(row)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el paciente clínico.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  return { clinicalPatient, loading, error }
}