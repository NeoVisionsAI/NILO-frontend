import { useCallback, useEffect, useMemo, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import {
  aggregatePatientExploreStats,
  emptyPatientStats,
  type PatientExploreStats,
} from '@/lib/explore-patient-stats'
import { fetchLandmarksDocument } from '@/lib/fetch-landmarks-document'
import { isoInRange, sessionBounds, sessionContainsDateTime } from '@/lib/explore-time'
import type { ParsedLandmarks } from '@/lib/landmarks-json'
import { audioRecordingService } from '@/services/audio-recording.service'
import { landmarksService, type LandmarksOut } from '@/services/landmarks.service'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import { physiologicalService, type PhysiologicalReading } from '@/services/physiological.service'
import type {
  AudioRecording,
  MonitoringSession,
  SessionMediaAccessItem,
  SessionOverview,
  SessionTextNote,
} from '@/types/monitoring-session'
import { useClinicalPatientResolution } from '../components/condata/useClinicalPatientResolution'
import { LandmarksMeshViewer } from './explore/LandmarksMeshViewer'
import { PatientExploreSummary } from './explore/PatientExploreSummary'
import { PhysioExplorePanel } from './explore/PhysioExplorePanel'
import { SessionTimeRangeBar } from './explore/SessionTimeRangeBar'
import './SessionExploreTab.css'
import './explore/PatientExploreSummary.css'
import './explore/SessionTimeRangeBar.css'

type ExploreCategory = 'face' | 'pose' | 'audio' | 'video' | 'text' | 'physio' | 'pain'

interface SessionExploreTabProps {
  userPatientId: string
  nodeId?: string | null
  preferredSessionId?: string | null
}

interface CategoryDef {
  id: ExploreCategory
  label: string
  icon: string
  hint: string
  countKey?:
    | 'video_segments'
    | 'audio_clips'
    | 'physiological_readings'
    | 'landmarks_batches'
    | 'pain_events'
    | 'text_notes'
}

const CATEGORIES: CategoryDef[] = [
  { id: 'face', label: 'Expresión facial', icon: 'face', hint: 'Landmarks cara (malla)' },
  { id: 'pose', label: 'Esqueleto / postura', icon: 'accessibility_new', hint: 'Landmarks corporales' },
  { id: 'audio', label: 'Audio', icon: 'mic', hint: 'Notas de voz', countKey: 'audio_clips' },
  { id: 'video', label: 'Vídeo', icon: 'videocam', hint: 'Segmentos', countKey: 'video_segments' },
  { id: 'text', label: 'Notas texto', icon: 'edit_note', hint: 'Anotaciones', countKey: 'text_notes' },
  { id: 'physio', label: 'Fisiológicos', icon: 'monitor_heart', hint: 'Sensores', countKey: 'physiological_readings' },
  { id: 'pain', label: 'Episodios dolor', icon: 'healing', hint: 'Dolor + expresión facial', countKey: 'pain_events' },
]

function formatDt(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatSessionOption(session: MonitoringSession): string {
  const name = session.display_name?.trim()
  const start = formatDt(session.started_at)
  if (session.status === 'active') {
    const base = name ? `${name} · ${start}` : start
    return `${base} · en curso`
  }
  const end = session.ended_at ? formatDt(session.ended_at) : 'sin cierre'
  const base = name ? `${name}` : 'Sesión'
  return `${base} · ${start} → ${end}`
}

function landmarkKind(key: string): 'face' | 'pose' | 'other' {
  const k = key.toLowerCase()
  if (k.includes('face_landmark')) return 'face'
  if (k.includes('/pose/') || k.includes('pose_land')) return 'pose'
  return 'other'
}

function statusLabel(status: MonitoringSession['status']): string {
  if (status === 'active') return 'Activa'
  if (status === 'completed') return 'Completada'
  return 'Cancelada'
}

export function SessionExploreTab({ userPatientId, nodeId, preferredSessionId }: SessionExploreTabProps) {
  const { clinicalPatient, loading: resolving } = useClinicalPatientResolution(userPatientId)
  const [sessions, setSessions] = useState<MonitoringSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionDateFilter, setSessionDateFilter] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [overview, setOverview] = useState<SessionOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [patientStats, setPatientStats] = useState<PatientExploreStats>(emptyPatientStats(true))
  const [category, setCategory] = useState<ExploreCategory | null>(null)
  const [landmarks, setLandmarks] = useState<LandmarksOut[]>([])
  const [audioClips, setAudioClips] = useState<AudioRecording[]>([])
  const [textNotes, setTextNotes] = useState<SessionTextNote[]>([])
  const [mediaItems, setMediaItems] = useState<SessionMediaAccessItem[]>([])
  const [physioReadings, setPhysioReadings] = useState<PhysiologicalReading[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [playUrl, setPlayUrl] = useState<string | null>(null)
  const [timeFilterOn, setTimeFilterOn] = useState(false)
  const [timeRangePct, setTimeRangePct] = useState<[number, number]>([0, 100])
  const [landmarkPreview, setLandmarkPreview] = useState<ParsedLandmarks | null>(null)
  const [landmarkPreviewTitle, setLandmarkPreviewTitle] = useState('')
  const [landmarkPreviewLoading, setLandmarkPreviewLoading] = useState(false)

  const loadSessions = useCallback(async () => {
    if (!clinicalPatient?.id) {
      setSessions([])
      return
    }
    setSessionsLoading(true)
    try {
      const list = await monitoringSessionService.list({ patient_id: clinicalPatient.id, limit: 200 })
      const sorted = [...list].sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      )
      setSessions(sorted)
    } catch {
      toast.error('No se pudieron cargar las sesiones.')
    } finally {
      setSessionsLoading(false)
    }
  }, [clinicalPatient?.id])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!sessions.length) {
      setPatientStats(emptyPatientStats(false))
      return
    }
    let cancelled = false
    setPatientStats(emptyPatientStats(true))
    void Promise.all(
      sessions.map((s) => monitoringSessionService.overview(s.id, { silent: true }).catch(() => null)),
    ).then((overviews) => {
      if (!cancelled) setPatientStats(aggregatePatientExploreStats(sessions, overviews))
    })
    return () => {
      cancelled = true
    }
  }, [sessions])

  useEffect(() => {
    if (preferredSessionId && sessions.some((s) => s.id === preferredSessionId)) {
      setSelectedSessionId(preferredSessionId)
      return
    }
    if (!selectedSessionId && sessions.length > 0) {
      const active = sessions.find((s) => s.status === 'active')
      setSelectedSessionId(active?.id ?? sessions[0].id)
    }
  }, [preferredSessionId, selectedSessionId, sessions])

  const filteredSessions = useMemo(() => {
    if (!sessionDateFilter.trim()) return sessions
    return sessions.filter((s) => sessionContainsDateTime(s, sessionDateFilter))
  }, [sessionDateFilter, sessions])

  useEffect(() => {
    if (selectedSessionId && !filteredSessions.some((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(filteredSessions[0]?.id ?? null)
    }
  }, [filteredSessions, selectedSessionId])

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null

  const { fromMs, toMs } = useMemo(() => {
    if (!selectedSession) return { fromMs: 0, toMs: 0 }
    const { startMs, endMs } = sessionBounds(selectedSession)
    const span = Math.max(endMs - startMs, 1)
    const from = startMs + (timeRangePct[0] / 100) * span
    const to = startMs + (timeRangePct[1] / 100) * span
    return { fromMs: from, toMs: Math.max(from, to) }
  }, [selectedSession, timeRangePct])

  const inSessionRange = useCallback(
    (ts: string) => {
      if (!timeFilterOn) return true
      return isoInRange(ts, fromMs, toMs)
    },
    [fromMs, timeFilterOn, toMs],
  )

  useEffect(() => {
    if (!selectedSessionId) {
      setOverview(null)
      return
    }
    let cancelled = false
    setOverviewLoading(true)
    void monitoringSessionService
      .overview(selectedSessionId, { silent: true })
      .then((o) => {
        if (!cancelled) setOverview(o)
      })
      .catch(() => {
        if (!cancelled) setOverview(null)
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedSessionId])

  useEffect(() => {
    setCategory(null)
    setPlayUrl(null)
    setLandmarkPreview(null)
    setTimeFilterOn(false)
    setTimeRangePct([0, 100])
  }, [selectedSessionId])

  const loadCategory = useCallback(
    async (cat: ExploreCategory) => {
      if (!clinicalPatient?.id || !selectedSessionId) return
      setCategory(cat)
      setDetailLoading(true)
      setPlayUrl(null)
      setLandmarkPreview(null)
      try {
        if (cat === 'face' || cat === 'pose' || cat === 'pain') {
          const all = await landmarksService.list({
            patient_id: clinicalPatient.id,
            session_id: selectedSessionId,
          })
          let kind: 'face' | 'pose' = cat === 'pose' ? 'pose' : 'face'
          if (cat === 'pain') kind = 'face'
          setLandmarks(all.filter((row) => landmarkKind(row.object_key) === kind))
          setAudioClips([])
          setTextNotes([])
          setMediaItems([])
          setPhysioReadings([])
        } else if (cat === 'audio') {
          setLandmarks([])
          const list = await audioRecordingService.list({
            patient_id: clinicalPatient.id,
            session_id: selectedSessionId,
            node_id: nodeId || undefined,
          })
          setAudioClips(list)
        } else if (cat === 'text') {
          setLandmarks([])
          const notes = await monitoringSessionService.listTextNotes(selectedSessionId, 0, 500)
          setTextNotes(notes)
        } else if (cat === 'video') {
          setLandmarks([])
          const access = await monitoringSessionService.mediaAccess(selectedSessionId, 86_400, { silent: true })
          setMediaItems(access.items.filter((i) => i.kind === 'video' || i.kind.includes('video')))
        } else if (cat === 'physio') {
          setLandmarks([])
          const readings = await physiologicalService.list({
            patient_id: clinicalPatient.id,
            session_id: selectedSessionId,
            limit: 500,
          })
          setPhysioReadings(readings)
        } else {
          setLandmarks([])
        }
      } catch {
        toast.error('No se pudo cargar el detalle de esta categoría.')
      } finally {
        setDetailLoading(false)
      }
    },
    [clinicalPatient?.id, nodeId, selectedSessionId],
  )

  async function playAudio(clip: AudioRecording) {
    if (!selectedSessionId) return
    try {
      const res = await audioRecordingService.getDownloadUrl(clip.id)
      setPlayUrl(res.download_url)
    } catch {
      try {
        const access = await monitoringSessionService.mediaAccess(selectedSessionId, 86_400, { silent: true })
        const item = access.items.find((i) => i.kind === 'audio' && i.id === clip.id)
        if (item?.download_url) setPlayUrl(item.download_url)
        else toast.error('No hay URL de reproducción.')
      } catch {
        toast.error('No hay URL de reproducción.')
      }
    }
  }

  async function openLandmarkViewer(row: LandmarksOut) {
    if (!selectedSessionId) return
    setLandmarkPreviewLoading(true)
    setLandmarkPreview(null)
    try {
      const doc = await fetchLandmarksDocument(selectedSessionId, row)
      setLandmarkPreview(doc)
      setLandmarkPreviewTitle(row.object_key.split('/').slice(-2).join('/') || row.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir el JSON de landmarks.')
    } finally {
      setLandmarkPreviewLoading(false)
    }
  }

  if (resolving) {
    return (
      <div className="nilo-explore nilo-explore--empty">
        <MaterialIcon name="hourglass_empty" size={36} />
        <p>Resolviendo paciente clínico…</p>
      </div>
    )
  }

  if (!clinicalPatient) {
    return (
      <div className="nilo-explore nilo-explore--empty">
        <MaterialIcon name="link_off" size={40} />
        <p>No hay paciente clínico vinculado.</p>
      </div>
    )
  }

  const filteredLandmarks = landmarks
  const filteredAudio = audioClips.filter((c) => inSessionRange(c.start_ts))
  const filteredText = textNotes.filter((n) => inSessionRange(n.recorded_at))
  const filteredPhysio = physioReadings.filter((r) => inSessionRange(r.timestamp))

  return (
    <div className="nilo-explore">
      <PatientExploreSummary stats={patientStats} />

      <header className="nilo-explore__toolbar">
        <label className="nilo-explore__session-dt">
          <span>Fecha y hora</span>
          <input
            type="datetime-local"
            value={sessionDateFilter}
            onChange={(e) => setSessionDateFilter(e.target.value)}
          />
        </label>
        {sessionDateFilter && (
          <button type="button" className="nilo-explore__filter-clear" onClick={() => setSessionDateFilter('')}>
            Ver todas
          </button>
        )}
        <label className="nilo-explore__session-pick">
          <span>Sesión</span>
          <select
            value={selectedSessionId ?? ''}
            disabled={sessionsLoading || filteredSessions.length === 0}
            onChange={(e) => setSelectedSessionId(e.target.value || null)}
          >
            {filteredSessions.length === 0 ? (
              <option value="">Sin sesiones en ese momento</option>
            ) : (
              filteredSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatSessionOption(s)}
                </option>
              ))
            )}
          </select>
        </label>
      </header>

      {selectedSession && (
        <>
          <div className="nilo-explore__session-card">
            <div className="nilo-explore__session-card-main">
              <h3 className="nilo-explore__session-title">
                {selectedSession.display_name?.trim() || 'Sesión sin nombre'}
              </h3>
              <p className="nilo-explore__session-dates">
                <MaterialIcon name="event" size={16} />
                {formatDt(selectedSession.started_at)}
                {selectedSession.ended_at ? ` → ${formatDt(selectedSession.ended_at)}` : ' → en curso'}
              </p>
            </div>
            <div className="nilo-explore__session-badges">
              <span
                className={`nilo-explore__status-pill nilo-explore__status-pill--${selectedSession.status}`}
              >
                {selectedSession.status === 'active' && <span className="nilo-explore__pulse" aria-hidden />}
                {statusLabel(selectedSession.status)}
              </span>
              <button
                type="button"
                className="nilo-explore__id-pill"
                title="Id sesión (Mongo / MinIO)"
                onClick={() => {
                  void navigator.clipboard.writeText(selectedSession.id).then(() => toast.success('Id copiado.'))
                }}
              >
                <code>{selectedSession.id}</code>
                <MaterialIcon name="content_copy" size={16} />
              </button>
            </div>
            {overviewLoading && <span className="nilo-explore__loading">Actualizando conteos…</span>}
          </div>

          <SessionTimeRangeBar
            session={selectedSession}
            enabled={timeFilterOn}
            onEnabledChange={setTimeFilterOn}
            rangePct={timeRangePct}
            onRangePctChange={setTimeRangePct}
            fromMs={fromMs}
            toMs={toMs}
          />
        </>
      )}

      <div className="nilo-explore__categories">
        {CATEGORIES.map((cat) => {
          let count: number | string = '—'
          if (overview) {
            if (cat.countKey) count = overview[cat.countKey]
            else if (cat.id === 'face' || cat.id === 'pose') count = overview.landmarks_batches
          }
          return (
            <button
              key={cat.id}
              type="button"
              className={`nilo-explore__cat${category === cat.id ? ' nilo-explore__cat--active' : ''}`}
              onClick={() => void loadCategory(cat.id)}
            >
              <span className="nilo-explore__cat-icon">
                <MaterialIcon name={cat.icon} size={26} />
              </span>
              <span className="nilo-explore__cat-label">{cat.label}</span>
              <span className="nilo-explore__cat-hint">{cat.hint}</span>
              <strong className="nilo-explore__cat-count">{count}</strong>
            </button>
          )
        })}
      </div>

      <section className="nilo-explore__detail" aria-live="polite">
        {!category && (
          <p className="nilo-explore__placeholder">
            Elige una categoría para ver los datos de la sesión seleccionada.
          </p>
        )}
        {category && detailLoading && <p className="nilo-explore__placeholder">Cargando…</p>}

        {landmarkPreviewLoading && <p className="nilo-explore__placeholder">Descargando malla…</p>}
        {landmarkPreview && !landmarkPreviewLoading && (
          <LandmarksMeshViewer data={landmarkPreview} title={landmarkPreviewTitle} />
        )}

        {category === 'face' || category === 'pose' || category === 'pain' ? (
          <>
            {category === 'pain' && (
              <p className="nilo-explore__pain-hint">
                {overview?.pain_events ?? 0} episodios de dolor en resumen · la expresión facial comparte los mismos
                lotes de landmarks.
              </p>
            )}
            <ul className="nilo-explore__list">
              {filteredLandmarks.map((row) => (
                <li key={row.id} className="nilo-explore__row nilo-explore__row--action">
                  <MaterialIcon
                    name={category === 'pose' ? 'accessibility_new' : 'face'}
                    size={22}
                  />
                  <div className="nilo-explore__row-text">
                    <strong>{row.id.slice(-8)}</strong>
                    <span title={row.object_key}>{row.object_key.split('/').slice(-2).join('/')}</span>
                    <span>{row.size_bytes != null ? `${Math.round(row.size_bytes / 1024)} KB` : row.status}</span>
                  </div>
                  <button type="button" className="nilo-explore__play" onClick={() => void openLandmarkViewer(row)}>
                    Visualizar malla
                  </button>
                </li>
              ))}
              {!detailLoading && filteredLandmarks.length === 0 && (
                <p className="nilo-explore__placeholder">Sin lotes en esta sesión.</p>
              )}
            </ul>
          </>
        ) : null}

        {category === 'audio' ? (
          <>
            {playUrl && (
              <audio controls className="nilo-explore__audio" src={playUrl}>
                Tu navegador no puede reproducir este audio.
              </audio>
            )}
            <ul className="nilo-explore__list">
              {filteredAudio.map((clip) => (
                <li key={clip.id} className="nilo-explore__row nilo-explore__row--action">
                  <MaterialIcon name="mic" size={22} />
                  <div className="nilo-explore__row-text">
                    <strong>{new Date(clip.start_ts).toLocaleString('es-ES')}</strong>
                    <span>{clip.duration_seconds != null ? `${Math.round(clip.duration_seconds)} s` : clip.status}</span>
                    {clip.transcription && <span>{clip.transcription.slice(0, 120)}</span>}
                  </div>
                  <button type="button" className="nilo-explore__play" onClick={() => void playAudio(clip)}>
                    Reproducir
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {category === 'text' ? (
          <ul className="nilo-explore__list">
            {filteredText.map((note) => (
              <li key={note.id} className="nilo-explore__row">
                <MaterialIcon name="edit_note" size={22} />
                <div className="nilo-explore__row-text">
                  <strong>{new Date(note.recorded_at).toLocaleString('es-ES')}</strong>
                  <p>{note.body}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {category === 'video' ? (
          <ul className="nilo-explore__list">
            {mediaItems.map((item) => (
              <li key={item.id} className="nilo-explore__row nilo-explore__row--action">
                <MaterialIcon name="videocam" size={22} />
                <div className="nilo-explore__row-text">
                  <strong>{item.id.slice(-8)}</strong>
                  <span>{item.object_key ?? 'segmento de vídeo'}</span>
                </div>
                {item.download_url && (
                  <a className="nilo-explore__play" href={item.download_url} target="_blank" rel="noreferrer">
                    Abrir
                  </a>
                )}
              </li>
            ))}
            {!detailLoading && mediaItems.length === 0 && (
              <p className="nilo-explore__placeholder">Sin vídeo indexado.</p>
            )}
          </ul>
        ) : null}

        {category === 'physio' && !detailLoading ? <PhysioExplorePanel readings={filteredPhysio} /> : null}
      </section>
    </div>
  )
}