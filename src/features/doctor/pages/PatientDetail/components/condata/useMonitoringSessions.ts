import { useCallback, useEffect, useState } from 'react'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { MonitoringSession } from '@/types/monitoring-session'
import { toast } from '@/lib/toast'

function pickDefaultSession(sessions: MonitoringSession[]): MonitoringSession | null {
  if (sessions.length === 0) return null
  const active = sessions.find((s) => s.status === 'active')
  if (active) return active
  return sessions[0]
}

export function useMonitoringSessions(
  clinicalPatientId: string | null,
  nodeId?: string | null,
  preferredSessionId?: string | null,
) {
  const [sessions, setSessions] = useState<MonitoringSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!clinicalPatientId) {
      setSessions([])
      setSelectedSessionId(null)
      return
    }
    setLoading(true)
    try {
      const list = await monitoringSessionService.list({
        patient_id: clinicalPatientId,
        limit: 100,
      })
      setSessions(list)
      setSelectedSessionId((prev) => {
        if (preferredSessionId && list.some((s) => s.id === preferredSessionId)) {
          return preferredSessionId
        }
        if (prev && list.some((s) => s.id === prev)) return prev
        return pickDefaultSession(list)?.id ?? null
      })
    } catch {
      toast.error('No se pudieron cargar las sesiones.')
    } finally {
      setLoading(false)
    }
  }, [clinicalPatientId, preferredSessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (preferredSessionId && sessions.some((s) => s.id === preferredSessionId)) {
      setSelectedSessionId(preferredSessionId)
    }
  }, [preferredSessionId, sessions])

  const createSession = useCallback(async () => {
    if (!clinicalPatientId) return null
    try {
      const created = await monitoringSessionService.create({
        patient_id: clinicalPatientId,
        node_id: nodeId || undefined,
      })
      setSessions((prev) => [created, ...prev])
      setSelectedSessionId(created.id)
      toast.success('Sesión de monitorización iniciada.')
      return created
    } catch {
      toast.error('No se pudo crear la sesión.')
      return null
    }
  }, [clinicalPatientId, nodeId])

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null

  return {
    sessions,
    selectedSession,
    selectedSessionId,
    setSelectedSessionId,
    loading,
    refresh,
    createSession,
  }
}