import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { audioRecordingService } from '@/services/audio-recording.service'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { AudioRecording } from '@/types/monitoring-session'
import { CondataModuleLayout, type CondataModuleView } from './CondataModuleLayout'
import { SessionPickerBar } from './SessionPickerBar'
import {
  deviceLabel,
  ensureMediaPermission,
  listMediaInputDevices,
} from '@/lib/media-devices'
import { useClinicalPatientResolution } from './useClinicalPatientResolution'
import { useMonitoringSessions } from './useMonitoringSessions'

interface AudioNoteCondataProps {
  userPatientId: string
  nodeId?: string | null
  preferredSessionId?: string | null
  view: CondataModuleView
  selectedAudioId: string | null
  onViewChange: (view: CondataModuleView, audioId?: string | null) => void
}

function formatWhen(ts: string): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

function recordingLabel(item: AudioRecording): string {
  const dur = item.duration_seconds != null ? `${Math.round(item.duration_seconds)} s` : '—'
  return `${formatWhen(item.start_ts)} · ${dur}`
}

export function AudioNoteCondata({
  userPatientId,
  nodeId,
  preferredSessionId,
  view,
  selectedAudioId,
  onViewChange,
}: AudioNoteCondataProps) {
  const { clinicalPatient, loading: resolving, error: resolveError } = useClinicalPatientResolution(userPatientId)
  const {
    sessions,
    selectedSession,
    selectedSessionId,
    setSelectedSessionId,
    loading: sessionsLoading,
    createSession,
  } = useMonitoringSessions(clinicalPatient?.id ?? null, nodeId, preferredSessionId, userPatientId)

  const [clips, setClips] = useState<AudioRecording[]>([])
  const [clipsLoading, setClipsLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [playUrl, setPlayUrl] = useState<string | null>(null)
  const [transcriptionDraft, setTranscriptionDraft] = useState('')
  const [savingTranscription, setSavingTranscription] = useState(false)
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [micDeviceId, setMicDeviceId] = useState('')
  const [micsLoading, setMicsLoading] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef<Date | null>(null)

  const selectedClip = clips.find((c) => c.id === selectedAudioId) ?? null
  const sessionActive = selectedSession?.status === 'active'

  const loadClips = useCallback(async () => {
    if (!clinicalPatient?.id || !selectedSessionId) {
      setClips([])
      return
    }
    setClipsLoading(true)
    try {
      const list = await audioRecordingService.list({
        patient_id: clinicalPatient.id,
        session_id: selectedSessionId,
      })
      setClips(list)
    } catch {
      toast.error('No se pudieron cargar las notas de audio.')
    } finally {
      setClipsLoading(false)
    }
  }, [clinicalPatient?.id, selectedSessionId])

  useEffect(() => {
    void loadClips()
  }, [loadClips])

  useEffect(() => {
    if (view === 'detail' && !selectedClip) {
      onViewChange('list')
    }
  }, [view, selectedClip, onViewChange])

  useEffect(() => {
    if (view !== 'add') return
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
        if (!cancelled) toast.error('No se pudo listar micrófonos.')
      } finally {
        if (!cancelled) setMicsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [view])

  useEffect(() => {
    if (view !== 'detail' || !selectedClip) {
      setPlayUrl(null)
      return
    }
    setTranscriptionDraft(selectedClip.transcription ?? '')
    let cancelled = false
    void (async () => {
      try {
        const access = await monitoringSessionService.mediaAccess(selectedClip.session_id, 86_400, {
          silent: true,
        })
        const fromBundle = access.items.find(
          (item) => item.kind === 'audio' && item.id === selectedClip.id,
        )
        if (!cancelled && fromBundle?.download_url) {
          setPlayUrl(fromBundle.download_url)
          return
        }
      } catch {
        /* media-access opcional */
      }
      try {
        const res = await audioRecordingService.getDownloadUrl(selectedClip.id)
        if (!cancelled) setPlayUrl(res.download_url)
      } catch {
        if (!cancelled) toast.error('No se pudo obtener la URL de reproducción.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [view, selectedClip])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clips
    return clips.filter(
      (c) =>
        recordingLabel(c).toLowerCase().includes(q) ||
        (c.transcription ?? '').toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q),
    )
  }, [clips, query])

  async function handleCreateSession() {
    setCreatingSession(true)
    try {
      await createSession()
    } finally {
      setCreatingSession(false)
    }
  }

  async function startRecording() {
    if (!sessionActive) {
      toast.info('La sesión debe estar activa para grabar audio.')
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
    } catch {
      toast.error('No se pudo acceder al micrófono.')
    }
  }

  async function stopAndUpload() {
    const recorder = mediaRecorderRef.current
    const startedAt = startedAtRef.current
    if (!recorder || !startedAt || !clinicalPatient || !selectedSessionId) {
      setRecording(false)
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
      await audioRecordingService.uploadVoiceNote({
        session_id: selectedSessionId,
        patient_id: clinicalPatient.id,
        node_id: nodeId || undefined,
        blob,
        startedAt,
        endedAt,
        format,
        fileExtension,
        contentType: blob.type || 'audio/webm',
      })
      toast.success('Nota de audio subida.')
      await loadClips()
      onViewChange('list')
    } catch {
      toast.error('Error al subir la nota de audio.')
    } finally {
      setUploading(false)
      mediaRecorderRef.current = null
      chunksRef.current = []
      startedAtRef.current = null
    }
  }

  async function saveTranscription() {
    if (!selectedClip) return
    setSavingTranscription(true)
    try {
      const updated = await audioRecordingService.updateTranscription(
        selectedClip.id,
        transcriptionDraft.trim(),
        'done',
      )
      setClips((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      toast.success('Transcripción guardada.')
    } catch {
      toast.error('No se pudo guardar la transcripción.')
    } finally {
      setSavingTranscription(false)
    }
  }

  if (resolving) {
    return (
      <div className="nilo-cmodule__empty">
        <MaterialIcon name="hourglass_empty" size={36} />
        <p>Cargando paciente clínico…</p>
      </div>
    )
  }

  if (resolveError || !clinicalPatient) {
    return (
      <div className="nilo-cmodule__empty">
        <MaterialIcon name="link_off" size={40} />
        <p>{resolveError ?? 'Paciente clínico no disponible.'}</p>
      </div>
    )
  }

  const sessionBar = (
    <SessionPickerBar
      sessions={sessions}
      selectedSessionId={selectedSessionId}
      onSelect={setSelectedSessionId}
      onCreate={handleCreateSession}
      loading={sessionsLoading}
      creating={creatingSession}
    />
  )

  const listContent =
    !selectedSessionId ? (
      <div className="nilo-cmodule__empty">
        <MaterialIcon name="mic" size={40} />
        <p>Crea una sesión activa para grabar notas de audio.</p>
      </div>
    ) : clipsLoading ? (
      <div className="nilo-cmodule__empty">
        <p>Cargando grabaciones…</p>
      </div>
    ) : filtered.length === 0 ? (
      <div className="nilo-cmodule__empty">
        <MaterialIcon name="mic" size={40} />
        <p>{clips.length === 0 ? 'No hay notas de audio en esta sesión.' : 'Ningún clip coincide con la búsqueda.'}</p>
        {clips.length === 0 && sessionActive && (
          <button type="button" className="nilo-cmodule__add-btn" onClick={() => onViewChange('add')}>
            <MaterialIcon name="add" size={20} />
            <span>Grabar primera nota</span>
          </button>
        )}
        {!sessionActive && selectedSession && (
          <p className="nilo-cmodule__hint">La sesión está cerrada: solo puedes consultar grabaciones existentes.</p>
        )}
      </div>
    ) : (
      filtered.map((clip) => (
        <button
          key={clip.id}
          type="button"
          className="nilo-cmodule__item"
          onClick={() => onViewChange('detail', clip.id)}
        >
          <span className="nilo-cmodule__item-icon">
            <MaterialIcon name="mic" size={22} />
          </span>
          <span className="nilo-cmodule__item-text">
            <strong>{recordingLabel(clip)}</strong>
            <span>
              {clip.status}
              {clip.transcription ? ` · ${clip.transcription.slice(0, 80)}${clip.transcription.length > 80 ? '…' : ''}` : ''}
            </span>
          </span>
          <MaterialIcon name="chevron_right" size={22} className="nilo-cmodule__item-chevron" />
        </button>
      ))
    )

  const addContent = (
    <div className="nilo-cmodule__note-form">
      {sessionBar}
      {!sessionActive && (
        <p className="nilo-cmodule__hint">
          Para ingestar audio la sesión debe estar <strong>activa</strong>. Inicia una nueva sesión si hace falta.
        </p>
      )}
      {micDevices.length > 1 && (
        <label className="nilo-cmodule__textarea-label">
          <span>Micrófono</span>
          <select
            className="nilo-cmodule__select"
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
      )}
      <div className="nilo-cmodule__recorder">
        {recording ? (
          <button type="button" className="nilo-cmodule__action-btn nilo-cmodule__action-btn--danger" onClick={stopAndUpload} disabled={uploading}>
            <MaterialIcon name="stop_circle" size={22} />
            {uploading ? 'Subiendo…' : 'Detener y subir'}
          </button>
        ) : (
          <button
            type="button"
            className="nilo-cmodule__action-btn"
            onClick={startRecording}
            disabled={!sessionActive || uploading}
          >
            <MaterialIcon name="mic" size={22} />
            Iniciar grabación
          </button>
        )}
        {recording && <span className="nilo-cmodule__rec-indicator" aria-live="polite">Grabando…</span>}
      </div>
    </div>
  )

  const detailContent = selectedClip ? (
    <>
      <div className="nilo-cmodule__detail-meta">
        <span className="nilo-cmodule__detail-label">Grabación</span>
        <strong>{recordingLabel(selectedClip)}</strong>
        <span className="nilo-cmodule__badge">{selectedClip.status}</span>
      </div>
      {playUrl ? (
        <audio controls className="nilo-cmodule__audio-player" src={playUrl}>
          Tu navegador no puede reproducir este audio.
        </audio>
      ) : (
        <p className="nilo-cmodule__hint">Preparando reproducción…</p>
      )}
      <label className="nilo-cmodule__textarea-label">
        <span>Transcripción (opcional)</span>
        <textarea
          value={transcriptionDraft}
          onChange={(e) => setTranscriptionDraft(e.target.value)}
          rows={6}
          placeholder="Texto transcrito o resumen clínico…"
        />
      </label>
    </>
  ) : null

  const detailFooter = selectedClip ? (
    <button
      type="button"
      className="nilo-cmodule__action-btn"
      onClick={saveTranscription}
      disabled={savingTranscription}
    >
      <MaterialIcon name="save" size={18} />
      {savingTranscription ? 'Guardando…' : 'Guardar transcripción'}
    </button>
  ) : null

  return (
    <CondataModuleLayout
      view={view}
      searchQuery={query}
      onSearchChange={setQuery}
      searchPlaceholder="Buscar grabaciones…"
      addLabel="Grabar nota"
      onAdd={() => {
        if (!sessionActive) {
          toast.info('Activa una sesión antes de grabar.')
          return
        }
        onViewChange('add')
      }}
      listContent={
        <>
          {sessionBar}
          {listContent}
        </>
      }
      addContent={addContent}
      detailContent={detailContent}
      detailFooter={detailFooter}
    />
  )
}