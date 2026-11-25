import { useCallback, useEffect, useMemo, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import {
  aggregatePatientExploreStats,
  emptyPatientStats,
  type PatientExploreStats,
} from '@/lib/explore-patient-stats'
import { fetchLandmarksDocument } from '@/lib/fetch-landmarks-document'
import { isoInRange, sessionBounds, sessionOverlapsInterval } from '@/lib/explore-time'
import { parseApiDateMs } from '@/lib/parse-api-datetime'
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
import { ExploreSideNav, type ExploreSection } from './explore/ExploreSideNav'
import { LandmarksMeshViewer } from './explore/LandmarksMeshViewer'
import { PatientExploreSummary } from './explore/PatientExploreSummary'
import { PhysioExplorePanel } from './explore/PhysioExplorePanel'
import { ExploreAudioPanel } from './explore/ExploreAudioPanel'
import { SessionTimeRangeBar } from './explore/SessionTimeRangeBar'
import './SessionExploreTab.css'
import './explore/ExploreSideNav.css'
import './explore/ExploreAudioPanel.css'
import './explore/PatientExploreSummary.css'
import './explore/SessionTimeRangeBar.css'

const SECTION_TITLES: Record<ExploreSection, string> = {
  summary: 'Resumen del paciente',
  session: 'Sesión y filtros',
  face: 'Expresión facial',
  pose: 'Postura / esqueleto',
  audio: 'Audio',
  video: 'Vídeo',
  text: 'Notas de texto',
  physio: 'Datos fisiológicos',
  pain: 'Episodios de dolor',
}

type ExploreCategory = 'face' | 'pose' | 'audio' | 'video' | 'text' | 'physio' | 'pain'

interface SessionExploreTabProps {
  userPatientId: string
  nodeId?: string | null
  preferredSessionId?: string | null
}

function formatDt(iso: string): string {
  const ms = parseApiDateMs(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
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

export function SessionExploreTab({ userPatientId, nodeId, preferredSessionId }: SessionExploreTabProps) {
  const { clinicalPatient, loading: resolving } = useClinicalPatientResolution(userPatientId)
  const [sessions, setSessions] = useState<MonitoringSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionFilterStart, setSessionFilterStart] = useState('')
  const [sessionFilterEnd, setSessionFilterEnd] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [overview, setOverview] = useState<SessionOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [patientStats, setPatientStats] = useState<PatientExploreStats>(emptyPatientStats(true))
  const [exploreSection, setExploreSection] = useState<ExploreSection>('summary')
  const [category, setCategory] = useState<ExploreCategory | null>(null)
  const [landmarks, setLandmarks] = useState<LandmarksOut[]>([])
  const [audioClips, setAudioClips] = useState<AudioRecording[]>([])
  const [textNotes, setTextNotes] = useState<SessionTextNote[]>([])
  const [mediaItems, setMediaItems] = useState<SessionMediaAccessItem[]>([])
  const [physioReadings, setPhysioReadings] = useState<PhysiologicalReading[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [textSearch, setTextSearch] = useState('')
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
    if (sessions.length === 0) return
    setSelectedSessionId((cur) => {
      if (cur && sessions.some((s) => s.id === cur)) return cur
      if (preferredSessionId && sessions.some((s) => s.id === preferredSessionId)) return preferredSessionId
      const active = sessions.find((s) => s.status === 'active')
      return active?.id ?? sessions[0].id
    })
  }, [sessions, preferredSessionId])

  const intervalFilterOn = Boolean(sessionFilterStart && sessionFilterEnd)

  const filteredSessions = useMemo(() => {
    if (!intervalFilterOn) return sessions
    return sessions.filter((s) => sessionOverlapsInterval(s, sessionFilterStart, sessionFilterEnd))
  }, [intervalFilterOn, sessionFilterEnd, sessionFilterStart, sessions])

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

  const loadCategory = useCallback(
    async (cat: ExploreCategory) => {
      if (!clinicalPatient?.id || !selectedSessionId) return
      setCategory(cat)
      setDetailLoading(true)
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

  useEffect(() => {
    setLandmarkPreview(null)
    setTimeFilterOn(false)
    setTimeRangePct([0, 100])
  }, [selectedSessionId])

  useEffect(() => {
    if (!selectedSessionId) return
    if (exploreSection === 'summary' || exploreSection === 'session') return
    void loadCategory(exploreSection as ExploreCategory)
  }, [exploreSection, loadCategory, selectedSessionId])

  const selectExploreSection = useCallback((section: ExploreSection) => {
    setExploreSection(section)
  }, [])

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
  const textQuery = textSearch.trim().toLowerCase()
  const filteredText = textNotes
    .filter((n) => inSessionRange(n.recorded_at))
    .filter((n) => !textQuery || n.body.toLowerCase().includes(textQuery))
  const filteredPhysio = physioReadings.filter((r) => inSessionRange(r.timestamp))

  const showDataPane =
    exploreSection !== 'summary' && exploreSection !== 'session' && Boolean(selectedSessionId)

  return (
    <div className="nilo-explore nilo-explore--shell">
      <ExploreSideNav
        active={exploreSection}
        onSelect={selectExploreSection}
        overview={overview}
        sessionSelected={Boolean(selectedSessionId)}
      />

      <div className="nilo-explore__main">
        <header className="nilo-explore__pane-head">
          <h2 className="nilo-explore__pane-title">{SECTION_TITLES[exploreSection]}</h2>
          {selectedSession && (
            <button
              type="button"
              className="nilo-explore__pane-session"
              title={`Copiar id: ${selectedSession.id}`}
              onClick={() => {
                void navigator.clipboard.writeText(selectedSession.id).then(() => toast.success('Id de sesión copiado.'))
              }}
            >
              {selectedSession.status === 'active' && <span className="nilo-explore__pane-session-dot" aria-hidden />}
              <span className="nilo-explore__pane-session-label">
                {selectedSession.display_name?.trim() || formatDt(selectedSession.started_at)}
              </span>
              <code className="nilo-explore__pane-session-id">{selectedSession.id.slice(-10)}</code>
            </button>
          )}
        </header>

        <div className="nilo-explore__pane-scroll" aria-live="polite">
          {exploreSection === 'summary' && <PatientExploreSummary stats={patientStats} />}

          {exploreSection === 'session' && (
            <div className="nilo-explore__session-pane">
              <header className="nilo-explore__toolbar">
                <div className="nilo-explore__interval">
                  <label className="nilo-explore__session-dt">
                    <span>Inicio</span>
                    <input
                      type="datetime-local"
                      value={sessionFilterStart}
                      onChange={(e) => setSessionFilterStart(e.target.value)}
                    />
                  </label>
                  <label className="nilo-explore__session-dt">
                    <span>Fin</span>
                    <input
                      type="datetime-local"
                      value={sessionFilterEnd}
                      onChange={(e) => setSessionFilterEnd(e.target.value)}
                    />
                  </label>
                </div>
                {(sessionFilterStart || sessionFilterEnd) && (
                  <button
                    type="button"
                    className="nilo-explore__filter-clear"
                    onClick={() => {
                      setSessionFilterStart('')
                      setSessionFilterEnd('')
                    }}
                  >
                    Limpiar intervalo
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
                      <option value="">
                        {intervalFilterOn ? 'Sin sesiones en ese intervalo' : 'Sin sesiones'}
                      </option>
                    ) : (
                      filteredSessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {formatSessionOption(s)}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {!intervalFilterOn && (sessionFilterStart || sessionFilterEnd) && (
                  <p className="nilo-explore__interval-hint">Indica inicio y fin para filtrar sesiones.</p>
                )}
              </header>

              {selectedSession?.status !== 'active' && selectedSession && (
                <div className="nilo-explore__session-card">
                  <div className="nilo-explore__session-card-main">
                    <h3 className="nilo-explore__session-title">
                      {selectedSession.display_name?.trim() || 'Sesión archivada'}
                    </h3>
                    <p className="nilo-explore__session-dates">
                      <MaterialIcon name="event" size={16} />
                      {formatDt(selectedSession.started_at)}
                      {selectedSession.ended_at ? ` → ${formatDt(selectedSession.ended_at)}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="nilo-explore__id-pill"
                    title="Id sesión (Mongo / MinIO)"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(selectedSession.id)
                        .then(() => toast.success('Id copiado.'))
                    }}
                  >
                    <code>{selectedSession.id}</code>
                    <MaterialIcon name="content_copy" size={16} />
                  </button>
                  {overviewLoading && <span className="nilo-explore__loading">Actualizando conteos…</span>}
                </div>
              )}

              {selectedSession && (
                <SessionTimeRangeBar
                  session={selectedSession}
                  enabled={timeFilterOn}
                  onEnabledChange={setTimeFilterOn}
                  rangePct={timeRangePct}
                  onRangePctChange={setTimeRangePct}
                  fromMs={fromMs}
                  toMs={toMs}
                />
              )}

              {!selectedSession && (
                <p className="nilo-explore__placeholder">Selecciona o filtra una sesión para explorar sus datos.</p>
              )}
            </div>
          )}

          {showDataPane && (
            <section className="nilo-explore__detail">
              {detailLoading && <p className="nilo-explore__placeholder">Cargando…</p>}

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

        {category === 'audio' && selectedSessionId ? (
          <ExploreAudioPanel clips={filteredAudio} sessionId={selectedSessionId} />
        ) : null}

        {category === 'text' ? (
          <>
            <label className="nilo-explore__text-search">
              <MaterialIcon name="search" size={18} />
              <input
                type="search"
                placeholder="Buscar en notas (p. ej. llorar)…"
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
              />
            </label>
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
          </>
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

              {category === 'physio' && !detailLoading ? (
                <PhysioExplorePanel readings={filteredPhysio} />
              ) : null}
            </section>
          )}

          {exploreSection !== 'summary' &&
            exploreSection !== 'session' &&
            !showDataPane &&
            !selectedSessionId && (
              <p className="nilo-explore__placeholder">Primero elige una sesión en «Sesión y filtros».</p>
            )}
        </div>
      </div>
    </div>
  )
}