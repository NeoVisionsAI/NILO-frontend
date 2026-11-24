import { useCallback, useEffect, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { clinicalPatientService } from '@/services/clinical-patient.service'
import { ingestionSimulator, type SimResult } from '@/dev/ingestion-sim/ingestion-simulator'
import type { SessionOverview } from '@/types/monitoring-session'
import './SessionIngestionDevPanel.css'

interface SessionIngestionDevPanelProps {
  userPatientId: string
  nodeId?: string | null
  sessionId: string | null
  monitoringActive: boolean
  onClose?: () => void
}

type ActionKey =
  | 'pose'
  | 'physio'
  | 'face'
  | 'text'
  | 'audio'
  | 'video'
  | 'overview'

const ACTIONS: { key: ActionKey; label: string; icon: string; hint: string }[] = [
  { key: 'pose', label: 'Datos posturales', icon: 'accessibility_new', hint: 'Landmarks pose → MinIO' },
  { key: 'physio', label: 'Datos fisiológicos', icon: 'monitor_heart', hint: 'Bulk → MongoDB' },
  { key: 'face', label: 'Landmarks faciales', icon: 'face', hint: 'JSON → MinIO' },
  { key: 'text', label: 'Nota de texto', icon: 'edit_note', hint: 'MongoDB' },
  { key: 'audio', label: 'Nota de audio', icon: 'mic', hint: 'MinIO + MongoDB' },
  { key: 'video', label: 'Chunk de vídeo', icon: 'videocam', hint: 'Placeholder MP4' },
  { key: 'overview', label: 'Ver resumen', icon: 'analytics', hint: 'GET …/overview' },
]

function formatOverview(o: SessionOverview): string {
  return [
    `vídeo: ${o.video_segments}`,
    `audio: ${o.audio_clips}`,
    `vitales: ${o.physiological_readings}`,
    `landmarks: ${o.landmarks_batches}`,
    `dolor: ${o.pain_events}`,
    `notas: ${o.text_notes}`,
  ].join(' · ')
}

export function SessionIngestionDevPanel({
  userPatientId,
  nodeId,
  sessionId,
  monitoringActive,
  onClose,
}: SessionIngestionDevPanelProps) {
  const [clinicalPatientId, setClinicalPatientId] = useState<string | null>(null)
  const [duration, setDuration] = useState(10)
  const [busy, setBusy] = useState<ActionKey | null>(null)
  const [log, setLog] = useState<SimResult[]>([])
  const [overview, setOverview] = useState<SessionOverview | null>(null)

  useEffect(() => {
    let cancelled = false
    clinicalPatientService.resolveByUserId(userPatientId).then((row) => {
      if (!cancelled) setClinicalPatientId(row?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [userPatientId])

  const ready = Boolean(clinicalPatientId && sessionId && monitoringActive)

  const run = useCallback(
    async (key: ActionKey) => {
      if (!sessionId || !clinicalPatientId) {
        toast.error('Activa monitorización y asegúrate de que hay sesión y paciente clínico.')
        return
      }
      if (key !== 'overview' && !monitoringActive) {
        toast.error('La sesión debe estar activa para ingestión.')
        return
      }

      const target = {
        sessionId,
        clinicalPatientId,
        nodeId,
      }

      setBusy(key)
      try {
        let result: SimResult
        switch (key) {
          case 'pose':
            result = await ingestionSimulator.sendPoseLandmarks(target, duration)
            break
          case 'physio':
            result = await ingestionSimulator.sendPhysiological(target, duration)
            break
          case 'face':
            result = await ingestionSimulator.sendFaceLandmarks(target, duration)
            break
          case 'text':
            result = await ingestionSimulator.sendTextNote(target)
            break
          case 'audio':
            result = await ingestionSimulator.sendAudioNote(target, Math.min(duration, 15))
            break
          case 'video':
            result = await ingestionSimulator.sendVideoChunk(target, duration)
            break
          case 'overview':
            result = await ingestionSimulator.fetchOverview(sessionId)
            break
          default:
            return
        }
        setLog((prev) => [result, ...prev].slice(0, 8))
        if (result.overview) setOverview(result.overview)
        toast.success(`${result.label}: ${result.detail}`)
      } catch {
        toast.error('Falló el envío de prueba. Revisa consola/red/API.')
      } finally {
        setBusy(null)
      }
    },
    [clinicalPatientId, duration, monitoringActive, nodeId, sessionId],
  )

  return (
    <aside className="nilo-ingest-dev" aria-label="Panel de pruebas de ingestión">
      <header className="nilo-ingest-dev__head">
        <div>
          <strong>Simulador de ingestión (DEV)</strong>
          <p>Envía datos sintéticos a la sesión activa — mismo flujo que nilo-node.</p>
        </div>
        {onClose && (
          <button type="button" className="nilo-ingest-dev__close" onClick={onClose} aria-label="Cerrar panel">
            <MaterialIcon name="close" size={20} />
          </button>
        )}
      </header>

      {!ready && (
        <p className="nilo-ingest-dev__warn">
          <MaterialIcon name="warning" size={18} />
          Activa monitorización y espera a que aparezca la sesión (y paciente clínico vinculado).
        </p>
      )}

      <label className="nilo-ingest-dev__duration">
        <span>Duración simulada (s)</span>
        <input
          type="number"
          min={1}
          max={120}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value) || 10)}
        />
      </label>

      <div className="nilo-ingest-dev__grid">
        {ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            className="nilo-ingest-dev__btn"
            disabled={!ready && action.key !== 'overview' ? true : busy !== null}
            title={action.hint}
            onClick={() => void run(action.key)}
          >
            <MaterialIcon name={action.icon} size={22} />
            <span>{action.label}</span>
            {busy === action.key ? <span className="nilo-ingest-dev__busy">…</span> : null}
          </button>
        ))}
      </div>

      {overview && (
        <div className="nilo-ingest-dev__overview">
          <span className="nilo-ingest-dev__overview-title">Último resumen de sesión</span>
          <code>{formatOverview(overview)}</code>
        </div>
      )}

      {log.length > 0 && (
        <ul className="nilo-ingest-dev__log">
          {log.map((entry, i) => (
            <li key={`${entry.label}-${i}`}>
              <strong>{entry.label}</strong>
              <span>{entry.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}