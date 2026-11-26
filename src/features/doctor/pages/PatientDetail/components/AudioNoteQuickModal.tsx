import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import {
  fetchClinicalAudioPlaybackUrl,
  revokeClinicalAudioPlaybackUrl,
} from '@/lib/fetch-clinical-audio-url'
import {
  normalizeTranscriptionStatus,
  requestVoiceTranscription,
} from '@/lib/voice-note-transcription'
import {
  deviceLabel,
  ensureMediaPermission,
  listMediaInputDevices,
} from '@/lib/media-devices'
import { audioRecordingService } from '@/services/audio-recording.service'
import { ApiError } from '@/services/api'
import type { AudioRecording, MonitoringSession } from '@/types/monitoring-session'
import { formatExploreSessionLabel } from '../tabs/explore/ExploreSessionPicker'
import { useClinicalPatientResolution } from './condata/useClinicalPatientResolution'
import { VoiceNoteTranscriptBlock } from './VoiceNoteTranscriptBlock'
import './AudioNoteQuickModal.css'
import './VoiceNoteTranscriptBlock.css'

interface AudioNoteQuickModalProps {
  open: boolean
  patientName: string
  userPatientId: string
  nodeId?: string | null
  session: MonitoringSession | null
  sessionIdFallback?: string | null
  sessionLoading?: boolean
  monitoringActive: boolean
  onClose: () => void
}

function formatRecordingElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = m.toString().padStart(2, '0')
  const ss = sec.toString().padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function AudioNoteQuickModal({
  open,
  patientName,
  userPatientId,
  nodeId,
  session,
  sessionIdFallback,
  sessionLoading,
  monitoringActive,
  onClose,
}: AudioNoteQuickModalProps) {
  const { clinicalPatient, loading: resolvingPatient } = useClinicalPatientResolution(userPatientId)

  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [micDeviceId, setMicDeviceId] = useState('')
  const [micsLoading, setMicsLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [savedClip, setSavedClip] = useState<AudioRecording | null>(null)
  const [playUrl, setPlayUrl] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef<Date | null>(null)

  const sessionId = session?.id ?? sessionIdFallback ?? null
  const sessionActive = monitoringActive && session?.status === 'active'
  const busy = recording || uploading || transcribing

  const sessionLabel = session
    ? formatExploreSessionLabel(session)
    : sessionId
      ? `Sesión …${sessionId.slice(-8)}`
      : null

  function resetRecordingHardware() {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    chunksRef.current = []
    startedAtRef.current = null
    setRecording(false)
    setRecordingElapsedSec(0)
  }

  function resetAll() {
    resetRecordingHardware()
    setSavedClip(null)
    setPlayUrl((prev) => {
      revokeClinicalAudioPlaybackUrl(prev)
      return null
    })
    setUploading(false)
    setTranscribing(false)
  }

  useEffect(() => {
    if (!open) {
      resetAll()
      return
    }
    resetAll()
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      setMicsLoading(true)
      try {
        await ensureMediaPermission('audioinput')
        const list = await listMediaInputDevices('audioinput')
        if (cancelled) return
        setMicDevices(list)
        setMicDeviceId((prev) => {
          if (prev && list.some((d) => d.deviceId === prev)) return prev
          return list[0]?.deviceId ?? ''
        })
      } catch {
        if (!cancelled) toast.error('No se pudo acceder a los micrófonos.')
      } finally {
        if (!cancelled) setMicsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!recording) {
      setRecordingElapsedSec(0)
      return
    }
    const startedMs = startedAtRef.current?.getTime() ?? Date.now()
    const tick = () => setRecordingElapsedSec((Date.now() - startedMs) / 1000)
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [recording])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    return () => {
      resetRecordingHardware()
      revokeClinicalAudioPlaybackUrl(playUrl)
    }
  }, [playUrl])

  if (!open) return null

  async function startRecording() {
    if (!sessionActive || !clinicalPatient?.id || !sessionId) {
      toast.info('Inicia la monitorización con sesión activa para grabar.')
      return
    }
    try {
      const audio: MediaTrackConstraints | boolean = micDeviceId
        ? { deviceId: { exact: micDeviceId } }
        : true
      const stream = await navigator.mediaDevices.getUserMedia({ audio })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      mediaRecorderRef.current = recorder
      mediaStreamRef.current = stream
      startedAtRef.current = new Date()
      recorder.start()
      setRecording(true)
      setSavedClip(null)
      setPlayUrl((prev) => {
        revokeClinicalAudioPlaybackUrl(prev)
        return null
      })
    } catch {
      toast.error('No se pudo iniciar la grabación.')
    }
  }

  async function stopAndUpload() {
    const recorder = mediaRecorderRef.current
    const startedAt = startedAtRef.current
    if (!recorder || !startedAt || !clinicalPatient?.id || !sessionId) {
      resetRecordingHardware()
      return
    }

    const endedAt = new Date()
    setRecording(false)
    setUploading(true)

    await new Promise<void>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
          mediaStreamRef.current = null
          resolve()
        },
        { once: true },
      )
      recorder.stop()
    })

    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
    const fileExtension = blob.type.includes('webm') ? 'webm' : 'wav'
    const format = fileExtension

    try {
      const created = await audioRecordingService.uploadVoiceNote({
        session_id: sessionId,
        patient_id: clinicalPatient.id,
        node_id: nodeId || undefined,
        blob,
        startedAt,
        endedAt,
        format,
        fileExtension,
        contentType: blob.type || 'audio/webm',
      })
      setSavedClip(created)
      const url = await fetchClinicalAudioPlaybackUrl(created.id, sessionId)
      if (url) setPlayUrl(url)
      else toast.error('Nota subida, pero no se pudo cargar la reproducción.')
      toast.success('Nota de audio guardada.')

      if (normalizeTranscriptionStatus(created.transcription_status) !== 'done') {
        setTranscribing(true)
        try {
          const updated = await requestVoiceTranscription(created.id)
          setSavedClip(updated)
        } catch (err) {
          const detail = err instanceof ApiError && err.message ? err.message : null
          toast.error(
            detail && detail !== 'No se pudo conectar con el servidor.'
              ? `Transcripción: ${detail}`
              : 'No se pudo transcribir automáticamente. Usa «Generar transcripción» o escríbela abajo.',
          )
        } finally {
          setTranscribing(false)
        }
      }
    } catch {
      toast.error('Error al subir la nota de audio.')
    } finally {
      setUploading(false)
      mediaRecorderRef.current = null
      chunksRef.current = []
      startedAtRef.current = null
    }
  }

  const canRecord = sessionActive && Boolean(clinicalPatient?.id) && Boolean(sessionId) && !resolvingPatient

  const dialog = (
    <div className="nilo-anote-modal m3" role="dialog" aria-modal="true" aria-labelledby="nilo-anote-modal-title">
      <div className="nilo-anote-modal__backdrop" onClick={() => !busy && onClose()} />
      <div className="nilo-anote-modal__panel">
        <header className="nilo-anote-modal__head">
          <span className="nilo-anote-modal__head-icon" aria-hidden>
            <MaterialIcon name="mic" size={22} />
          </span>
          <div>
            <h2 id="nilo-anote-modal-title" className="nilo-anote-modal__title">
              Nueva nota de audio
            </h2>
            <p className="nilo-anote-modal__subtitle">Grabación de voz asociada a la sesión activa.</p>
          </div>
          <button
            type="button"
            className="nilo-anote-modal__close"
            aria-label="Cerrar"
            disabled={busy}
            onClick={onClose}
          >
            <MaterialIcon name="close" size={22} />
          </button>
        </header>

        <div className="nilo-anote-modal__meta">
          <div className="nilo-anote-modal__meta-row">
            <MaterialIcon name="person" size={20} />
            <div>
              <span className="nilo-anote-modal__meta-k">Paciente</span>
              <span className="nilo-anote-modal__meta-v">{patientName}</span>
            </div>
          </div>
          <div className="nilo-anote-modal__meta-row">
            <MaterialIcon name="history" size={20} />
            <div>
              <span className="nilo-anote-modal__meta-k">Sesión</span>
              <span className="nilo-anote-modal__meta-v">
                {sessionLoading || resolvingPatient
                  ? 'Cargando…'
                  : sessionLabel ?? 'Sin sesión activa'}
              </span>
            </div>
          </div>
        </div>

        {!canRecord && !sessionLoading && !resolvingPatient ? (
          <p className="nilo-anote-modal__warn">
            <MaterialIcon name="info" size={18} />
            Activa la monitorización del paciente para grabar (la sesión debe estar <strong>activa</strong>).
          </p>
        ) : null}

        {micDevices.length > 1 ? (
          <label className="nilo-anote-modal__field">
            <span className="nilo-anote-modal__field-label">Micrófono</span>
            <select
              className="nilo-anote-modal__select"
              value={micDeviceId}
              disabled={recording || uploading || micsLoading}
              onChange={(e) => setMicDeviceId(e.target.value)}
            >
              {micDevices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {deviceLabel(d, i)}
                </option>
              ))}
            </select>
          </label>
        ) : micsLoading ? (
          <p className="nilo-anote-modal__hint">Detectando micrófonos…</p>
        ) : null}

        <div className="nilo-anote-modal__rec">
          {recording ? (
            <button
              type="button"
              className="nilo-anote-modal__rec-btn nilo-anote-modal__rec-btn--stop"
              onClick={() => void stopAndUpload()}
              disabled={uploading}
            >
              <MaterialIcon name="stop_circle" size={22} />
              {uploading ? 'Subiendo…' : 'Parar y guardar'}
            </button>
          ) : (
            <button
              type="button"
              className="nilo-anote-modal__rec-btn"
              onClick={() => void startRecording()}
              disabled={!canRecord || uploading || transcribing}
            >
              <MaterialIcon name="mic" size={22} />
              Iniciar grabación
            </button>
          )}
          {recording ? (
            <span className="nilo-anote-modal__rec-live" aria-live="polite">
              <span className="nilo-anote-modal__rec-dot" />
              Grabando…
              <time className="nilo-anote-modal__rec-time" dateTime={`PT${Math.floor(recordingElapsedSec)}S`}>
                {formatRecordingElapsed(recordingElapsedSec)}
              </time>
            </span>
          ) : null}
        </div>

        {savedClip && playUrl ? (
          <div className="nilo-anote-modal__review">
            <span className="nilo-anote-modal__field-label">Reproducción</span>
            <audio controls className="nilo-anote-modal__player" src={playUrl} preload="metadata">
              Tu navegador no puede reproducir este audio.
            </audio>
          </div>
        ) : null}

        {savedClip ? (
          <VoiceNoteTranscriptBlock
            clip={savedClip}
            editable
            busy={transcribing}
            onClipChange={setSavedClip}
          />
        ) : null}

        <footer className="nilo-anote-modal__actions">
          <button type="button" className="nilo-anote-modal__btn nilo-anote-modal__btn--ghost" onClick={onClose} disabled={busy}>
            {savedClip ? 'Cerrar' : 'Cancelar'}
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}