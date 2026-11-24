import { useCallback, useEffect, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { clinicalPatientService } from '@/services/clinical-patient.service'
import { ApiError } from '@/services/api'
import { waitCountdown } from '@/dev/ingestion-sim/countdown'
import { ingestionSimulator, type IngestionTarget, type SimResult } from '@/dev/ingestion-sim/ingestion-simulator'
import type { SessionOverview } from '@/types/monitoring-session'
import { IngestionCaptureModal, type CaptureMode } from './IngestionCaptureModal'
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
  { key: 'face', label: 'Landmarks faciales', icon: 'face', hint: 'Cámara + MediaPipe → MinIO' },
  { key: 'text', label: 'Nota de texto', icon: 'edit_note', hint: 'MongoDB' },
  { key: 'audio', label: 'Nota de audio', icon: 'mic', hint: 'Micrófono real → MinIO' },
  { key: 'video', label: 'Chunk de vídeo', icon: 'videocam', hint: 'Cámara real (webm)' },
  { key: 'overview', label: 'Ver resumen', icon: 'analytics', hint: 'GET …/overview' },
]

const ACTION_LABELS: Record<ActionKey, string> = Object.fromEntries(
  ACTIONS.map((a) => [a.key, a.label]),
) as Record<ActionKey, string>

type ProgressPhase = 'idle' | 'capture' | 'upload' | 'done' | 'error'

interface ProgressState {
  phase: ProgressPhase
  actionKey: ActionKey | null
  secondsLeft: number
  message: string
}

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

function usesCaptureCountdown(key: ActionKey): boolean {
  return key !== 'text' && key !== 'overview'
}

const REAL_CAPTURE_KEYS = new Set<ActionKey>(['audio', 'video', 'face'])

function actionToCaptureMode(key: ActionKey): CaptureMode | null {
  if (key === 'audio' || key === 'video' || key === 'face') return key
  return null
}

export function SessionIngestionDevPanel({
  userPatientId,
  nodeId,
  sessionId,
  monitoringActive,
  onClose,
}: SessionIngestionDevPanelProps) {
  const [clinicalPatientId, setClinicalPatientId] = useState<string | null>(null)
  const [duration, setDuration] = useState(5)
  const [busy, setBusy] = useState<ActionKey | null>(null)
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null)
  const [progress, setProgress] = useState<ProgressState>({
    phase: 'idle',
    actionKey: null,
    secondsLeft: 0,
    message: '',
  })
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

  const applySimResult = useCallback((result: SimResult) => {
    setLog((prev) => [result, ...prev].slice(0, 8))
    if (result.overview) setOverview(result.overview)
  }, [])

  const onRealCaptureSuccess = useCallback(
    (mode: CaptureMode, result: SimResult) => {
      const key = mode as ActionKey
      applySimResult(result)
      setProgress({
        phase: 'done',
        actionKey: key,
        secondsLeft: 0,
        message: result.overviewWarning
          ? `✓ Subida correcta: ${result.detail}. ${result.overviewWarning}`
          : `✓ Subida correcta: ${result.detail}`,
      })
      if (result.overviewWarning) {
        toast.info(result.overviewWarning)
        toast.success(`${result.label}: ${result.detail}`)
      } else {
        toast.success(`${result.label}: ${result.detail}`)
      }
      setBusy(null)
      setCaptureMode(null)
    },
    [applySimResult],
  )

  const openRealCapture = useCallback(
    (key: ActionKey) => {
      if (!sessionId || !clinicalPatientId) {
        toast.error('Activa monitorización y asegúrate de que hay sesión y paciente clínico.')
        return
      }
      if (!monitoringActive) {
        toast.error('La sesión debe estar activa para ingestión.')
        return
      }
      const mode = actionToCaptureMode(key)
      if (!mode) return
      setBusy(key)
      setProgress({
        phase: 'idle',
        actionKey: key,
        secondsLeft: 0,
        message: '',
      })
      setCaptureMode(mode)
    },
    [clinicalPatientId, monitoringActive, sessionId],
  )

  const captureTarget: IngestionTarget | null =
    sessionId && clinicalPatientId
      ? { sessionId, clinicalPatientId, nodeId }
      : null

  const executeSim = useCallback(
    async (key: ActionKey, target: { sessionId: string; clinicalPatientId: string; nodeId?: string | null }) => {
      switch (key) {
        case 'pose':
          return ingestionSimulator.sendPoseLandmarks(target, duration)
        case 'physio':
          return ingestionSimulator.sendPhysiological(target, duration)
        case 'face':
          return ingestionSimulator.sendFaceLandmarks(target, duration)
        case 'text':
          return ingestionSimulator.sendTextNote(target)
        case 'audio':
          return ingestionSimulator.sendAudioNote(target, Math.min(duration, 15))
        case 'video':
          return ingestionSimulator.sendVideoChunk(target, duration)
        case 'overview':
          return ingestionSimulator.fetchOverview(target.sessionId)
        default:
          throw new Error('Acción desconocida')
      }
    },
    [duration],
  )

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

      const label = ACTION_LABELS[key]
      setBusy(key)
      setProgress({
        phase: key === 'overview' ? 'upload' : usesCaptureCountdown(key) ? 'capture' : 'upload',
        actionKey: key,
        secondsLeft: usesCaptureCountdown(key) ? duration : 0,
        message: usesCaptureCountdown(key)
          ? `Capturando «${label}» (${duration} s)…`
          : key === 'text'
            ? 'Enviando nota de texto…'
            : 'Consultando resumen de sesión…',
      })

      try {
        if (usesCaptureCountdown(key)) {
          await waitCountdown(duration, (remaining) => {
            setProgress((p) => ({
              ...p,
              secondsLeft: remaining,
              message:
                remaining > 0
                  ? `Capturando «${label}» — ${remaining} s restantes…`
                  : `Captura completa. Subiendo al backend…`,
            }))
          })
        }

        setProgress((p) => ({
          ...p,
          phase: 'upload',
          secondsLeft: 0,
          message: `Subiendo «${label}» (API + MinIO si aplica)…`,
        }))

        const result = await executeSim(key, target)

        applySimResult(result)

        const successDetail = result.overviewWarning
          ? `${result.detail}. ${result.overviewWarning}`
          : result.detail

        setProgress({
          phase: 'done',
          actionKey: key,
          secondsLeft: 0,
          message: `✓ Subida correcta: ${successDetail}`,
        })

        if (result.overviewWarning) {
          toast.info(result.overviewWarning)
          toast.success(`${result.label}: ${result.detail}`)
        } else {
          toast.success(`${result.label}: ${result.detail}`)
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? `${err.status ? `[${err.status}] ` : ''}${err.message}`
            : err instanceof Error
              ? err.message
              : 'Error desconocido'

        setProgress({
          phase: 'error',
          actionKey: key,
          secondsLeft: 0,
          message: `✗ Falló «${label}»: ${message}`,
        })
        setLog((prev) => [
          { label, detail: message, ok: false },
          ...prev,
        ].slice(0, 8))
        toast.error(`No se pudo enviar «${label}»: ${message}`)
      } finally {
        setBusy(null)
      }
    },
    [applySimResult, clinicalPatientId, duration, executeSim, monitoringActive, nodeId, sessionId],
  )

  return (
    <aside className="nilo-ingest-dev" aria-label="Panel de pruebas de ingestión">
      <header className="nilo-ingest-dev__head">
        <div>
          <strong>Simulador de ingestión (DEV)</strong>
          <p>
            Audio, vídeo y cara con captura real; postura/fisiológicos siguen siendo sintéticos hasta conectar sensores.
          </p>
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
        <span>Duración captura / simulación (s)</span>
        <input
          type="number"
          min={1}
          max={120}
          value={duration}
          disabled={busy !== null}
          onChange={(e) => setDuration(Number(e.target.value) || 10)}
        />
      </label>

      {progress.phase !== 'idle' && (
        <div
          className={`nilo-ingest-dev__progress nilo-ingest-dev__progress--${progress.phase}`}
          role="status"
          aria-live="polite"
        >
          <div className="nilo-ingest-dev__progress-row">
            {progress.phase === 'capture' && (
              <span className="nilo-ingest-dev__countdown" aria-hidden="true">
                {progress.secondsLeft}
              </span>
            )}
            {progress.phase === 'upload' && (
              <MaterialIcon name="cloud_upload" size={28} className="nilo-ingest-dev__spin" />
            )}
            {progress.phase === 'done' && <MaterialIcon name="check_circle" size={28} />}
            {progress.phase === 'error' && <MaterialIcon name="error" size={28} />}
            <p className="nilo-ingest-dev__progress-msg">{progress.message}</p>
          </div>
          {progress.phase === 'capture' && duration > 0 && (
            <div className="nilo-ingest-dev__bar" aria-hidden="true">
              <span
                style={{
                  width: `${100 - (progress.secondsLeft / duration) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="nilo-ingest-dev__grid">
        {ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            className="nilo-ingest-dev__btn"
            disabled={(!ready && action.key !== 'overview') || busy !== null}
            title={action.hint}
            onClick={() =>
              REAL_CAPTURE_KEYS.has(action.key) ? openRealCapture(action.key) : void run(action.key)
            }
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

      {captureMode && captureTarget && (
        <IngestionCaptureModal
          mode={captureMode}
          durationSeconds={Math.min(Math.max(duration, 1), 120)}
          target={captureTarget}
          onClose={() => {
            setCaptureMode(null)
            setBusy(null)
            setProgress((p) => (p.phase === 'idle' ? p : { phase: 'idle', actionKey: null, secondsLeft: 0, message: '' }))
          }}
          onSuccess={(result) => onRealCaptureSuccess(captureMode, result)}
        />
      )}

      {log.length > 0 && (
        <ul className="nilo-ingest-dev__log">
          {log.map((entry, i) => (
            <li
              key={`${entry.label}-${i}`}
              className={entry.ok === false ? 'nilo-ingest-dev__log-item--err' : undefined}
            >
              <strong>{entry.ok === false ? 'Error' : entry.label}</strong>
              <span>{entry.detail}</span>
              {entry.overviewWarning && <span className="nilo-ingest-dev__log-warn">{entry.overviewWarning}</span>}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}