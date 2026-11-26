import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import {
  aggregatePatientExploreStats,
  emptyPatientStats,
  type PatientExploreStats,
} from '@/lib/explore-patient-stats'
import { isoInRange, sessionBounds } from '@/lib/explore-time'
import { matchesLandmarkCaptureKind } from '@/lib/landmark-capture-kind'
import { formatLandmarkChipLabel, landmarkRecordedAtMs } from '@/lib/landmark-object-key-datetime'
import { isVoiceNoteClip } from '@/lib/audio-waveform'
import { audioRecordingService } from '@/services/audio-recording.service'
import { landmarksService, type LandmarksCaptureKind, type LandmarksOut } from '@/services/landmarks.service'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import { painEventService, type PainEventOut } from '@/services/pain-event.service'
import { physiologicalService, type PhysiologicalReading } from '@/services/physiological.service'
import { videoSegmentService } from '@/services/video-segment.service'
import type {
  AudioRecording,
  MonitoringSession,
  SessionMediaAccessItem,
  SessionOverview,
  SessionTextNote,
} from '@/types/monitoring-session'
import { useClinicalPatientResolution } from '../components/condata/useClinicalPatientResolution'
import { ExploreSideNav, type ExploreSection } from './explore/ExploreSideNav'
import { ExploreLandmarksPanel } from './explore/ExploreLandmarksPanel'
import { PatientExploreSummary } from './explore/PatientExploreSummary'
import { PhysioExplorePanel } from './explore/PhysioExplorePanel'
import { ExploreAudioPanel } from './explore/ExploreAudioPanel'
import { ExploreSessionHeaderActions } from './explore/ExploreSessionPicker'
import { ExploreDeleteButton } from './explore/ExploreDeleteButton'
import type { ExploreDeleteAction } from './explore/explore-delete-types'
import { SessionTimeRangeBar } from './explore/SessionTimeRangeBar'
import './SessionExploreTab.css'
import './explore/ExploreSideNav.css'
import './explore/ExploreAudioPanel.css'
import './explore/PatientExploreSummary.css'
import './explore/ExploreSessionPicker.css'
import './explore/ExploreDeleteButton.css'
import './explore/SessionTimeRangeBar.css'

const SECTION_TITLES: Record<ExploreSection, string> = {
  summary: 'Resumen del paciente',
  face: 'Expresión facial',
  pose: 'Postura / esqueleto',
  voice: 'Notas de voz',
  audio: 'Audio ambiente',
  video: 'Vídeo',
  text: 'Notas de texto',
  physio: 'Datos fisiológicos',
  pain: 'Episodios de dolor',
}

type ExploreCategory = 'face' | 'pose' | 'voice' | 'audio' | 'video' | 'text' | 'physio' | 'pain'

interface SessionExploreTabProps {
  userPatientId: string
  nodeId?: string | null
  preferredSessionId?: string | null
}

export function SessionExploreTab({ userPatientId, nodeId, preferredSessionId }: SessionExploreTabProps) {
  const { clinicalPatient, loading: resolving } = useClinicalPatientResolution(userPatientId)
  const [sessions, setSessions] = useState<MonitoringSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [overview, setOverview] = useState<SessionOverview | null>(null)
  const [patientStats, setPatientStats] = useState<PatientExploreStats>(emptyPatientStats(true))
  const [exploreSection, setExploreSection] = useState<ExploreSection>('summary')
  const [category, setCategory] = useState<ExploreCategory | null>(null)
  const [landmarks, setLandmarks] = useState<LandmarksOut[]>([])
  const [audioClips, setAudioClips] = useState<AudioRecording[]>([])
  const [textNotes, setTextNotes] = useState<SessionTextNote[]>([])
  const [mediaItems, setMediaItems] = useState<SessionMediaAccessItem[]>([])
  const [physioReadings, setPhysioReadings] = useState<PhysiologicalReading[]>([])
  const [painEvents, setPainEvents] = useState<PainEventOut[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [textSearch, setTextSearch] = useState('')
  const [timeFilterOn, setTimeFilterOn] = useState(false)
  const [timeRangePct, setTimeRangePct] = useState<[number, number]>([0, 100])
  const [audioClipCounts, setAudioClipCounts] = useState<{ voice: number | null; ambient: number | null }>({
    voice: null,
    ambient: null,
  })
  const [pendingDelete, setPendingDelete] = useState<ExploreDeleteAction | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const promptDelete = useCallback((action: ExploreDeleteAction) => {
    setPendingDelete(action)
  }, [])

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
    void monitoringSessionService
      .overview(selectedSessionId, { silent: true })
      .then((o) => {
        if (!cancelled) setOverview(o)
      })
      .catch(() => {
        if (!cancelled) setOverview(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedSessionId])

  useEffect(() => {
    if (!clinicalPatient?.id || !selectedSessionId) {
      setAudioClipCounts({ voice: null, ambient: null })
      return
    }
    let cancelled = false
    void audioRecordingService
      .list({
        patient_id: clinicalPatient.id,
        session_id: selectedSessionId,
        node_id: nodeId || undefined,
        limit: 500,
      })
      .then((list) => {
        if (cancelled) return
        setAudioClipCounts({
          voice: list.filter((c) => isVoiceNoteClip(c.kind)).length,
          ambient: list.filter((c) => !isVoiceNoteClip(c.kind)).length,
        })
      })
      .catch(() => {
        if (!cancelled) setAudioClipCounts({ voice: null, ambient: null })
      })
    return () => {
      cancelled = true
    }
  }, [clinicalPatient?.id, nodeId, selectedSessionId])

  const loadCategory = useCallback(
    async (cat: ExploreCategory) => {
      if (!clinicalPatient?.id || !selectedSessionId) return
      setCategory(cat)
      setDetailLoading(true)
      try {
        if (cat === 'face' || cat === 'pose') {
          const captureKind: LandmarksCaptureKind = cat === 'pose' ? 'pose' : 'face'
          const all = await landmarksService.list({
            patient_id: clinicalPatient.id,
            session_id: selectedSessionId,
            capture_kind: captureKind,
            storage_ready: true,
          })
          setLandmarks(all.filter((row) => matchesLandmarkCaptureKind(row, captureKind)))
          setPainEvents([])
          setAudioClips([])
          setTextNotes([])
          setMediaItems([])
          setPhysioReadings([])
        } else if (cat === 'pain') {
          setLandmarks([])
          const events = await painEventService.list({
            patient_id: clinicalPatient.id,
            session_id: selectedSessionId,
            limit: 500,
          })
          setPainEvents(events)
          setAudioClips([])
          setTextNotes([])
          setMediaItems([])
          setPhysioReadings([])
        } else if (cat === 'audio' || cat === 'voice') {
          setLandmarks([])
          const list = await audioRecordingService.list({
            patient_id: clinicalPatient.id,
            session_id: selectedSessionId,
            node_id: nodeId || undefined,
            limit: 500,
          })
          setAudioClips(list)
          setAudioClipCounts({
            voice: list.filter((c) => isVoiceNoteClip(c.kind)).length,
            ambient: list.filter((c) => !isVoiceNoteClip(c.kind)).length,
          })
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

  const refreshAfterDelete = useCallback(async () => {
    if (!selectedSessionId || exploreSection === 'summary') return
    await loadCategory(exploreSection as ExploreCategory)
    try {
      const o = await monitoringSessionService.overview(selectedSessionId, { silent: true })
      setOverview(o)
    } catch {
      /* overview opcional */
    }
  }, [exploreSection, loadCategory, selectedSessionId])

  useEffect(() => {
    setTimeFilterOn(false)
    setTimeRangePct([0, 100])
  }, [selectedSessionId])

  useEffect(() => {
    if (!selectedSessionId) return
    if (exploreSection === 'summary') return
    void loadCategory(exploreSection as ExploreCategory)
  }, [exploreSection, loadCategory, selectedSessionId])

  const selectExploreSection = useCallback((section: ExploreSection) => {
    setExploreSection(section)
  }, [])

  const filteredLandmarks = useMemo(() => {
    return landmarks.filter((row) => {
      const ms = landmarkRecordedAtMs(row.object_key)
      if (Number.isNaN(ms)) return true
      return inSessionRange(new Date(ms).toISOString())
    })
  }, [inSessionRange, landmarks])

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

  const filteredAudio = audioClips.filter((c) => inSessionRange(c.start_ts))
  const filteredVoiceNotes = filteredAudio.filter((c) => isVoiceNoteClip(c.kind))
  const filteredAmbientAudio = filteredAudio.filter((c) => !isVoiceNoteClip(c.kind))
  const textQuery = textSearch.trim().toLowerCase()
  const filteredText = textNotes
    .filter((n) => inSessionRange(n.recorded_at))
    .filter((n) => !textQuery || n.body.toLowerCase().includes(textQuery))
  const filteredPhysio = physioReadings.filter((r) => inSessionRange(r.timestamp))

  const showDataPane = exploreSection !== 'summary' && Boolean(selectedSessionId)
  const showSessionTimeBar = exploreSection !== 'summary' && Boolean(selectedSession)

  const isLandmarkSection = exploreSection === 'face' || exploreSection === 'pose'
  const landmarkSectionReady = category === exploreSection
  const landmarkPanelRows = landmarkSectionReady ? filteredLandmarks : []
  const landmarkPanelLoading = !landmarkSectionReady || detailLoading

  return (
    <div className="nilo-explore nilo-explore--shell">
      <ExploreSideNav
        active={exploreSection}
        onSelect={selectExploreSection}
        overview={overview}
        sessionSelected={Boolean(selectedSessionId)}
        audioClipCounts={audioClipCounts}
      />

      <div className="nilo-explore__main">
        <header className="nilo-explore__pane-head">
          <h2 className="nilo-explore__pane-title">{SECTION_TITLES[exploreSection]}</h2>
          <ExploreSessionHeaderActions
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            sessionsLoading={sessionsLoading}
            onSessionChange={setSelectedSessionId}
            onViewAll={() => toast.info('«Ver todo»: próximamente. Puede ser costoso en sesiones largas.')}
          />
        </header>

        <div className="nilo-explore__pane-scroll">
          {exploreSection === 'summary' && <PatientExploreSummary stats={patientStats} />}

          {showSessionTimeBar && selectedSession && (
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

          {showDataPane && (
            <section
              className={`nilo-explore__detail${isLandmarkSection ? ' nilo-explore__detail--landmarks' : ''}`}
            >
              {detailLoading && !isLandmarkSection && <p className="nilo-explore__placeholder">Cargando…</p>}

        {isLandmarkSection && selectedSessionId ? (
          <ExploreLandmarksPanel
            sessionId={selectedSessionId}
            rows={landmarkPanelRows}
            loading={landmarkPanelLoading}
            onDeleteLandmark={(row) => {
              promptDelete({
                itemLabel: formatLandmarkChipLabel(row.object_key),
                entityLabel: 'lote de landmarks',
                run: async () => {
                  await landmarksService.remove(row.id)
                  await refreshAfterDelete()
                },
              })
            }}
          />
        ) : null}

        {category === 'pain' ? (
          <ul className="nilo-explore__list">
            {painEvents.map((ev) => (
              <li key={ev.id} className="nilo-explore__row nilo-explore__row--action">
                <div className="nilo-explore__row-leading">
                  <MaterialIcon name="healing" size={22} />
                  <ExploreDeleteButton
                    entityLabel="episodio de dolor"
                    onDelete={() =>
                      promptDelete({
                        itemLabel: new Date(ev.start_ts).toLocaleString('es-ES'),
                        entityLabel: 'episodio de dolor',
                        run: async () => {
                          await painEventService.remove(ev.id)
                          await refreshAfterDelete()
                        },
                      })
                    }
                  />
                </div>
                <div className="nilo-explore__row-text">
                  <strong>{new Date(ev.start_ts).toLocaleString('es-ES')}</strong>
                  <span>
                    {ev.severity != null ? `Intensidad ${ev.severity}` : 'Episodio'}
                    {ev.notes ? ` · ${ev.notes}` : ''}
                  </span>
                </div>
              </li>
            ))}
            {!detailLoading && painEvents.length === 0 && (
              <p className="nilo-explore__placeholder">Sin episodios de dolor en esta sesión.</p>
            )}
          </ul>
        ) : null}

        {category === 'voice' && selectedSessionId ? (
          <ExploreAudioPanel
            clips={filteredVoiceNotes}
            sessionId={selectedSessionId}
            variant="voice"
            onDeleteClip={(clip) => {
              const label = new Date(clip.start_ts).toLocaleString('es-ES', {
                dateStyle: 'short',
                timeStyle: 'short',
              })
              promptDelete({
                itemLabel: label,
                entityLabel: 'clip de audio',
                run: async () => {
                  await audioRecordingService.remove(clip.id)
                  await refreshAfterDelete()
                },
              })
            }}
          />
        ) : null}

        {category === 'audio' && selectedSessionId ? (
          <ExploreAudioPanel
            clips={filteredAmbientAudio}
            sessionId={selectedSessionId}
            variant="ambient"
            onDeleteClip={(clip) => {
              const label = new Date(clip.start_ts).toLocaleString('es-ES', {
                dateStyle: 'short',
                timeStyle: 'short',
              })
              promptDelete({
                itemLabel: label,
                entityLabel: 'clip de audio',
                run: async () => {
                  await audioRecordingService.remove(clip.id)
                  await refreshAfterDelete()
                },
              })
            }}
          />
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
              <li key={note.id} className="nilo-explore__row nilo-explore__row--action">
                <div className="nilo-explore__row-leading">
                  <MaterialIcon name="edit_note" size={22} />
                  {selectedSessionId ? (
                    <ExploreDeleteButton
                      entityLabel="nota de texto"
                      onDelete={() =>
                        promptDelete({
                          itemLabel: note.body.slice(0, 48) + (note.body.length > 48 ? '…' : ''),
                          entityLabel: 'nota de texto',
                          run: async () => {
                            await monitoringSessionService.deleteTextNote(selectedSessionId, note.id)
                            await refreshAfterDelete()
                          },
                        })
                      }
                    />
                  ) : null}
                </div>
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
                <div className="nilo-explore__row-leading">
                  <MaterialIcon name="videocam" size={22} />
                  <ExploreDeleteButton
                    entityLabel="segmento de vídeo"
                    onDelete={() =>
                      promptDelete({
                        itemLabel: item.object_key?.split('/').pop() ?? item.id.slice(-8),
                        entityLabel: 'segmento de vídeo',
                        run: async () => {
                          await videoSegmentService.remove(item.id)
                          await refreshAfterDelete()
                        },
                      })
                    }
                  />
                </div>
                <div className="nilo-explore__row-text">
                  <strong>{item.id.slice(-8)}</strong>
                  <span>{item.object_key ?? 'segmento de vídeo'}</span>
                </div>
                <div className="nilo-explore__row-actions">
                  {item.download_url && (
                    <a className="nilo-explore__play" href={item.download_url} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  )}
                </div>
              </li>
            ))}
            {!detailLoading && mediaItems.length === 0 && (
              <p className="nilo-explore__placeholder">Sin vídeo indexado.</p>
            )}
          </ul>
        ) : null}

              {category === 'physio' && !detailLoading ? (
                <PhysioExplorePanel
                  readings={filteredPhysio}
                  onDeleteReading={(r) => {
                    promptDelete({
                      itemLabel: new Date(r.timestamp).toLocaleString('es-ES'),
                      entityLabel: 'lectura fisiológica',
                      run: async () => {
                        await physiologicalService.remove(r.id)
                        await refreshAfterDelete()
                      },
                    })
                  }}
                />
              ) : null}
            </section>
          )}

          {exploreSection !== 'summary' && !selectedSessionId && (
            <p className="nilo-explore__placeholder">Elige una sesión en el selector de la cabecera.</p>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={pendingDelete != null}
        title={pendingDelete ? `Eliminar ${pendingDelete.entityLabel}` : 'Eliminar'}
        message={
          pendingDelete
            ? `¿Eliminar «${pendingDelete.itemLabel}»? Esta operación no se puede deshacer. Se borrará el registro en el sistema y el fichero asociado en almacenamiento (MinIO), si existe.`
            : ''
        }
        confirmLabel="Eliminar"
        tone="danger"
        busy={deleteBusy}
        onCancel={() => !deleteBusy && setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          setDeleteBusy(true)
          void pendingDelete
            .run()
            .then(() => {
              toast.success(`${pendingDelete.entityLabel} eliminado.`)
              setPendingDelete(null)
            })
            .catch(() => {
              toast.error(`No se pudo eliminar el ${pendingDelete.entityLabel.toLowerCase()}.`)
            })
            .finally(() => setDeleteBusy(false))
        }}
      />
    </div>
  )
}