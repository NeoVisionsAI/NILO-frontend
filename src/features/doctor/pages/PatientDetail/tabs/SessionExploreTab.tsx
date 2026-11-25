import { useCallback, useEffect, useMemo, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { audioRecordingService } from '@/services/audio-recording.service'
import { landmarksService } from '@/services/landmarks.service'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import { physiologicalService } from '@/services/physiological.service'
import type {
  AudioRecording,
  MonitoringSession,
  SessionMediaAccessItem,
  SessionOverview,
  SessionTextNote,
} from '@/types/monitoring-session'
import type { LandmarksOut } from '@/services/landmarks.service'
import { useClinicalPatientResolution } from '../components/condata/useClinicalPatientResolution'
import './SessionExploreTab.css'

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
  { id: 'face', label: 'Expresión facial', icon: 'face', hint: 'Landmarks MediaPipe (cara)' },
  { id: 'pose', label: 'Esqueleto / postura', icon: 'accessibility_new', hint: 'Landmarks corporales' },
  { id: 'audio', label: 'Audio', icon: 'mic', hint: 'Notas de voz', countKey: 'audio_clips' },
  { id: 'video', label: 'Vídeo', icon: 'videocam', hint: 'Segmentos', countKey: 'video_segments' },
  { id: 'text', label: 'Notas texto', icon: 'edit_note', hint: 'Anotaciones', countKey: 'text_notes' },
  { id: 'physio', label: 'Fisiológicos', icon: 'monitor_heart', hint: 'Sensores', countKey: 'physiological_readings' },
  { id: 'pain', label: 'Episodios dolor', icon: 'healing', hint: 'Eventos de dolor', countKey: 'pain_events' },
]

function formatSessionLabel(session: MonitoringSession): string {
  const started = new Date(session.started_at)
  const when = Number.isNaN(started.getTime())
    ? session.started_at
    : started.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
  const name = session.display_name?.trim()
  const status = session.status === 'active' ? ' · activa' : ''
  return name ? `${name} — ${when}${status}` : `${when}${status}`
}

function landmarkKind(key: string): 'face' | 'pose' | 'other' {
  const k = key.toLowerCase()
  if (k.includes('face_landmark')) return 'face'
  if (k.includes('/pose/') || k.includes('pose_land')) return 'pose'
  return 'other'
}

export function SessionExploreTab({ userPatientId, nodeId, preferredSessionId }: SessionExploreTabProps) {
  const { clinicalPatient, loading: resolving } = useClinicalPatientResolution(userPatientId)
  const [sessions, setSessions] = useState<MonitoringSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<'all' | 'active'>('all')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [overview, setOverview] = useState<SessionOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [category, setCategory] = useState<ExploreCategory | null>(null)
  const [query, setQuery] = useState('')
  const [landmarks, setLandmarks] = useState<LandmarksOut[]>([])
  const [audioClips, setAudioClips] = useState<AudioRecording[]>([])
  const [textNotes, setTextNotes] = useState<SessionTextNote[]>([])
  const [mediaItems, setMediaItems] = useState<SessionMediaAccessItem[]>([])
  const [physioCount, setPhysioCount] = useState(0)
  const [detailLoading, setDetailLoading] = useState(false)
  const [playUrl, setPlayUrl] = useState<string | null>(null)

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
    if (sessionFilter === 'active') return sessions.filter((s) => s.status === 'active')
    return sessions
  }, [sessionFilter, sessions])

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null

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
  }, [selectedSessionId])

  const loadCategory = useCallback(
    async (cat: ExploreCategory) => {
      if (!clinicalPatient?.id || !selectedSessionId) return
      setCategory(cat)
      setDetailLoading(true)
      setPlayUrl(null)
      try {
        if (cat === 'face' || cat === 'pose') {
          const all = await landmarksService.list({
            patient_id: clinicalPatient.id,
            session_id: selectedSessionId,
          })
          const kind = cat === 'face' ? 'face' : 'pose'
          setLandmarks(all.filter((row) => landmarkKind(row.object_key) === kind))
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
          const notes = await monitoringSessionService.listTextNotes(selectedSessionId)
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
            limit: 50,
          })
          setPhysioCount(readings.length)
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

  const q = query.trim().toLowerCase()

  function filterText(text: string): boolean {
    if (!q) return true
    return text.toLowerCase().includes(q)
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

  return (
    <div className="nilo-explore">
      <header className="nilo-explore__toolbar">
        <div className="nilo-explore__filters">
          <button
            type="button"
            className={`nilo-explore__filter${sessionFilter === 'all' ? ' nilo-explore__filter--on' : ''}`}
            onClick={() => setSessionFilter('all')}
          >
            Todas las sesiones
          </button>
          <button
            type="button"
            className={`nilo-explore__filter${sessionFilter === 'active' ? ' nilo-explore__filter--on' : ''}`}
            onClick={() => setSessionFilter('active')}
          >
            Solo activas
          </button>
        </div>
        <label className="nilo-explore__session-pick">
          <span>Sesión</span>
          <select
            value={selectedSessionId ?? ''}
            disabled={sessionsLoading || filteredSessions.length === 0}
            onChange={(e) => setSelectedSessionId(e.target.value || null)}
          >
            {filteredSessions.length === 0 ? (
              <option value="">Sin sesiones</option>
            ) : (
              filteredSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatSessionLabel(s)}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="nilo-explore__search">
          <MaterialIcon name="search" size={18} />
          <input
            type="search"
            placeholder="Buscar en resultados…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      {selectedSession && (
        <div className="nilo-explore__session-meta">
          <code title="Id MinIO">{selectedSession.id}</code>
          <span className={`nilo-explore__status nilo-explore__status--${selectedSession.status}`}>
            {selectedSession.status}
          </span>
          {overviewLoading && <span className="nilo-explore__loading">Actualizando conteos…</span>}
        </div>
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
            Elige una categoría para ver lotes de esta sesión (o cambia de sesión arriba).
          </p>
        )}
        {category && detailLoading && <p className="nilo-explore__placeholder">Cargando…</p>}

        {category === 'face' || category === 'pose' ? (
          <ul className="nilo-explore__list">
            {landmarks
              .filter((row) => filterText(row.object_key))
              .map((row) => (
                <li key={row.id} className="nilo-explore__row">
                  <MaterialIcon name={category === 'face' ? 'face' : 'accessibility_new'} size={22} />
                  <div className="nilo-explore__row-text">
                    <strong>{row.id.slice(-8)}</strong>
                    <span title={row.object_key}>{row.object_key.split('/').slice(-2).join('/')}</span>
                    <span>{row.size_bytes != null ? `${Math.round(row.size_bytes / 1024)} KB` : row.status}</span>
                  </div>
                </li>
              ))}
            {!detailLoading && landmarks.length === 0 && (
              <p className="nilo-explore__placeholder">Sin lotes en esta sesión.</p>
            )}
          </ul>
        ) : null}

        {category === 'audio' ? (
          <>
            {playUrl && (
              <audio controls className="nilo-explore__audio" src={playUrl}>
                Tu navegador no puede reproducir este audio.
              </audio>
            )}
            <ul className="nilo-explore__list">
              {audioClips
                .filter((c) => filterText(`${c.start_ts} ${c.transcription ?? ''}`))
                .map((clip) => (
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
            {textNotes
              .filter((n) => filterText(n.body))
              .map((note) => (
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
              <p className="nilo-explore__placeholder">Sin vídeo indexado (prueba media-access).</p>
            )}
          </ul>
        ) : null}

        {category === 'physio' ? (
          <p className="nilo-explore__placeholder">
            {physioCount > 0
              ? `${physioCount} lecturas recientes en esta sesión (listado completo en API fisiológicos).`
              : 'Sin lecturas fisiológicas en esta sesión.'}
          </p>
        ) : null}

        {category === 'pain' ? (
          <p className="nilo-explore__placeholder">
            {overview?.pain_events
              ? `${overview.pain_events} episodios registrados — detalle desde módulo «Episodio de dolor».`
              : 'Sin episodios de dolor en el resumen de sesión.'}
          </p>
        ) : null}
      </section>
    </div>
  )
}