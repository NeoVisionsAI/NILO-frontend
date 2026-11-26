import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/lib/toast'
import { patientDisplayName } from '@/types'
import { useClinicalData } from '../../context/ClinicalDataContext'
import { ROOT_PATHS } from '@/router/paths'
import { RecordFormPanel } from './components/RecordFormPanel'
import { CondataPanel } from './components/CondataPanel'
import {
  PainEpisodeCondata,
  type PainEpisodeCapturePhase,
} from './components/condata/PainEpisodeCondata'
import { TextNoteCondata } from './components/condata/TextNoteCondata'
import { AudioNoteCondata } from './components/condata/AudioNoteCondata'
import type { CondataModuleView } from './components/condata/CondataModuleLayout'
import {
  findPatientSection,
  resolvePatientSections,
  sectionAllowsAdd,
  type PatientSectionId,
  type SectionViewMode,
} from './medical-sections'
import { SectionContent } from './SectionContent'
import { PatientQuickActionsFab } from './components/PatientQuickActionsFab'
import type { PatientQuickAction } from './patient-quick-actions'
import type { PainEpisode } from './pain-episode/types'
import { LiveTab } from './tabs/LiveTab'
import { canonicalSessionId } from '@/lib/session-id'
import { patientMonitoringService } from '@/services/patient-monitoring.service'
import type { MonitoringSession } from '@/types/monitoring-session'
import {
  ingestionDevPanelBuildEnabled,
  isIngestionDevPanelVisible,
  setIngestionDevPanelVisible,
} from '@/dev/ingestion-dev-panel'
import { SessionIngestionDevPanel } from './components/dev/SessionIngestionDevPanel'
import { TextNoteQuickModal } from './components/TextNoteQuickModal'
import './components/TextNoteQuickModal.css'
import { PatientDetailHeader, type PatientViewMode } from './components/PatientDetailHeader'
import { SessionExploreTab } from './tabs/SessionExploreTab'
import './PatientDetailPage.css'
import './components/PatientDetailHeader.css'
import './components/ActiveSessionInfo.css'
import './tabs/SessionExploreTab.css'
import './components/CondataPanel.css'
import './components/dev/SessionIngestionDevPanel.css'

const AVATAR_COLORS = ['#0369a1', '#0f766e', '#7c3aed', '#be123c', '#b45309', '#4338ca', '#0891b2']

type CondataMode = 'live' | 'explore' | 'section' | 'module'

function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toUpperCase()
}

export function PatientDetailPage() {
  const { patientId = '' } = useParams()
  const navigate = useNavigate()
  const { patients, nodes, setPatientMonitoring, assignPatientNode, deletePatient } = useClinicalData()
  const patient = patients.find((p) => p.id === patientId)

  const sections = useMemo(() => (patient ? resolvePatientSections(patient) : []), [patient])
  const recordSections = useMemo(() => sections.filter((section) => section.mode !== 'live'), [sections])

  const [condataMode, setCondataMode] = useState<CondataMode>('live')
  const [activeSectionId, setActiveSectionId] = useState<PatientSectionId>('clinical-results')
  const [sectionViewMode, setSectionViewMode] = useState<SectionViewMode>('browse')
  const [activeModule, setActiveModule] = useState<PatientQuickAction | null>(null)
  const [moduleView, setModuleView] = useState<CondataModuleView>('list')
  const [painCapturePhase, setPainCapturePhase] = useState<'capture' | 'summary'>('capture')
  const [painSummaryBackSignal, setPainSummaryBackSignal] = useState(0)
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null)
  const [selectedModuleRecordId, setSelectedModuleRecordId] = useState<string | null>(null)
  const [painEpisodes, setPainEpisodes] = useState<PainEpisode[]>([])
  const [assigningNode, setAssigningNode] = useState(false)
  const [togglingMonitor, setTogglingMonitor] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeMonitoringSession, setActiveMonitoringSession] = useState<MonitoringSession | null>(null)
  const [loadingActiveSession, setLoadingActiveSession] = useState(false)
  const [showIngestionDev, setShowIngestionDev] = useState(() => isIngestionDevPanelVisible())
  const [textNoteModalOpen, setTextNoteModalOpen] = useState(false)

  const activeSection = findPatientSection(recordSections, activeSectionId) ?? recordSections[0]

  useEffect(() => {
    if (!patient?.patient_profile?.monitoring_active) {
      setActiveMonitoringSession(null)
      return
    }
    let cancelled = false
    setLoadingActiveSession(true)
    patientMonitoringService
      .resolveActiveSession(patient.id, patient.patient_profile)
      .then((session) => {
        if (!cancelled) setActiveMonitoringSession(session)
      })
      .catch(() => {
        if (!cancelled) setActiveMonitoringSession(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingActiveSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [patient?.id, patient?.patient_profile?.monitoring_active, patient?.patient_profile?.active_session_id])

  useEffect(() => {
    if (!patient?.patient_profile?.monitoring_active && condataMode === 'live') {
      setCondataMode('explore')
    }
  }, [condataMode, patient?.patient_profile?.monitoring_active])

  useEffect(() => {
    setCondataMode('live')
    setActiveSectionId(recordSections[0]?.id ?? 'clinical-results')
    setSectionViewMode('browse')
    setActiveModule(null)
    setModuleView('list')
    setSelectedEpisodeId(null)
    setSelectedModuleRecordId(null)
    setPainCapturePhase('capture')
    setPainSummaryBackSignal(0)
  }, [patientId, recordSections])

  if (!patient) {
    return (
      <div className="nilo-pdetail">
        <div className="nilo-pdetail__empty">
          <MaterialIcon name="person_off" size={48} />
          <p>Patient not found.</p>
          <button className="nilo-pdetail__btn nilo-pdetail__btn--ghost" onClick={() => navigate(ROOT_PATHS.doctor)}>
            Back to summary
          </button>
        </div>
      </div>
    )
  }

  const p = patient
  const fullName = patientDisplayName(p)
  const monitoring = p.patient_profile?.monitoring_active ?? false
  const ingestionSessionId =
    activeMonitoringSession?.id ?? p.patient_profile?.active_session_id ?? null
  const assignedNodeId = p.patient_profile?.node_id ?? ''

  function resetPainCaptureState() {
    setPainCapturePhase('capture')
    setPainSummaryBackSignal(0)
  }

  function openLive() {
    setCondataMode('live')
    setActiveModule(null)
    setModuleView('list')
    setSelectedEpisodeId(null)
    setSelectedModuleRecordId(null)
    setSectionViewMode('browse')
    resetPainCaptureState()
  }

  function openExplore() {
    setCondataMode('explore')
    setActiveModule(null)
    setModuleView('list')
    setSelectedEpisodeId(null)
    setSelectedModuleRecordId(null)
    setSectionViewMode('browse')
    resetPainCaptureState()
  }

  function openSection(sectionId: PatientSectionId, action?: PatientQuickAction) {
    setCondataMode('section')
    setActiveSectionId(sectionId)
    setSectionViewMode('browse')
    setActiveModule(action ?? null)
    setModuleView('list')
    setSelectedEpisodeId(null)
    setSelectedModuleRecordId(null)
  }

  function openPainEpisodeModule(action: PatientQuickAction) {
    setCondataMode('module')
    setActiveModule(action)
    setModuleView('list')
    setSelectedEpisodeId(null)
    setSelectedModuleRecordId(null)
    setSectionViewMode('browse')
    resetPainCaptureState()
  }

  function openSessionNotesModule(action: PatientQuickAction) {
    setCondataMode('module')
    setActiveModule(action)
    setModuleView('list')
    setSelectedEpisodeId(null)
    setSelectedModuleRecordId(null)
    setSectionViewMode('browse')
    resetPainCaptureState()
  }

  function openModule(action: PatientQuickAction) {
    const section = findPatientSection(recordSections, action.actionKey)
    if (section) {
      openSection(section.id, action)
      return
    }

    if (action.actionKey === 'pain-episode') {
      openPainEpisodeModule(action)
      return
    }

    if (action.actionKey === 'text-note') {
      setTextNoteModalOpen(true)
      return
    }

    if (action.actionKey === 'audio-note') {
      openSessionNotesModule(action)
      return
    }

    toast.info(`«${action.label}»: pendiente de implementar.`)
  }

  function handlePainEpisodeViewChange(view: CondataModuleView, episodeId?: string | null) {
    setModuleView(view)
    setSelectedEpisodeId(episodeId ?? null)
    if (view === 'add') resetPainCaptureState()
  }

  function handleSessionNotesViewChange(view: CondataModuleView, recordId?: string | null) {
    setModuleView(view)
    setSelectedModuleRecordId(recordId ?? null)
  }

  function handlePainCapturePhaseChange(phase: PainEpisodeCapturePhase) {
    setPainCapturePhase(phase)
  }

  function handlePainEpisodeDelete(episodeId: string) {
    setPainEpisodes((prev) => prev.filter((episode) => episode.id !== episodeId))
    setSelectedEpisodeId(null)
  }

  async function handleNodeChange(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    const newNodeId = value || null
    const current = p.patient_profile?.node_id ?? null
    if (newNodeId === current) return

    setAssigningNode(true)
    try {
      await assignPatientNode(p.id, newNodeId)
    } catch {
      /* toast de error del cliente API */
    } finally {
      setAssigningNode(false)
    }
  }

  async function handleMonitoringToggle() {
    if (!p.patient_profile || togglingMonitor) return
    setTogglingMonitor(true)
    try {
      const next = !monitoring
      const { patient: updatedPatient, session } = await setPatientMonitoring(
        p,
        next,
        activeMonitoringSession?.id ?? p.patient_profile.active_session_id,
      )
      const mongoSessionId = canonicalSessionId(session, updatedPatient.patient_profile.active_session_id)
      setActiveMonitoringSession(
        session && mongoSessionId ? { ...session, id: mongoSessionId } : session,
      )
      if (next && session) {
        openLive()
        toast.success('Monitorización activa. Sesión iniciada.')
      } else if (next) {
        openLive()
        toast.success('Monitorización activada.')
      } else {
        openExplore()
        toast.success('Monitorización detenida. Sesión cerrada.')
        setActiveMonitoringSession(null)
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'NO_CLINICAL_PATIENT') {
        toast.error('No hay registro clínico vinculado. No se puede abrir una sesión.')
      }
      /* otros errores: toast del cliente API */
    } finally {
      setTogglingMonitor(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deletePatient(p.id)
      setConfirmDelete(false)
      navigate(ROOT_PATHS.doctor)
    } catch {
      /* toast de error del cliente API */
    } finally {
      setDeleting(false)
    }
  }

  function renderCondataBody() {
    if (condataMode === 'explore') {
      return (
        <SessionExploreTab
          userPatientId={p.id}
          nodeId={p.patient_profile?.node_id}
          preferredSessionId={ingestionSessionId}
        />
      )
    }

    if (condataMode === 'live') {
      return <LiveTab embedded />
    }

    if (condataMode === 'module' && activeModule?.actionKey === 'text-note') {
      return (
        <TextNoteCondata
          userPatientId={p.id}
          nodeId={p.patient_profile?.node_id}
          view={moduleView}
          selectedNoteId={selectedModuleRecordId}
          preferredSessionId={ingestionSessionId}
          onViewChange={handleSessionNotesViewChange}
        />
      )
    }

    if (condataMode === 'module' && activeModule?.actionKey === 'audio-note') {
      return (
        <AudioNoteCondata
          userPatientId={p.id}
          nodeId={p.patient_profile?.node_id}
          view={moduleView}
          selectedAudioId={selectedModuleRecordId}
          preferredSessionId={ingestionSessionId}
          onViewChange={handleSessionNotesViewChange}
        />
      )
    }

    if (condataMode === 'module' && activeModule?.actionKey === 'pain-episode') {
      return (
        <PainEpisodeCondata
          patientId={p.id}
          episodes={painEpisodes}
          view={moduleView}
          selectedEpisodeId={selectedEpisodeId}
          onViewChange={handlePainEpisodeViewChange}
          onEpisodeCreated={(episode) => setPainEpisodes((prev) => [episode, ...prev])}
          onEpisodeDelete={handlePainEpisodeDelete}
          onCapturePhaseChange={handlePainCapturePhaseChange}
          summaryBackSignal={painSummaryBackSignal}
        />
      )
    }

    if (condataMode === 'section' && activeSection) {
      if (sectionViewMode === 'add') {
        return <RecordFormPanel section={activeSection} onClose={() => setSectionViewMode('browse')} />
      }
      return <SectionContent section={activeSection} />
    }

    return <LiveTab embedded />
  }

  function condataTitle() {
    if (condataMode === 'live') return 'Live'
    if (condataMode === 'explore') return 'Explorar datos'
    if (activeModule) return activeModule.label
    if (condataMode === 'section' && activeSection) return activeSection.label
    return 'Live'
  }

  function condataIcon() {
    if (condataMode === 'live') return 'monitor_heart'
    if (condataMode === 'explore') return 'database_search'
    if (activeModule) return activeModule.icon
    if (condataMode === 'section' && activeSection) return activeSection.icon
    return 'monitor_heart'
  }

  function condataSubtitle() {
    if (condataMode === 'live') return 'Monitorización en tiempo real'
    if (condataMode === 'explore') return 'Audio, vídeo, landmarks y notas por sesión'
    if (condataMode === 'module' && activeModule?.actionKey === 'pain-episode') {
      if (moduleView === 'add' && painCapturePhase === 'summary') return 'Escalas de dolor y confirmación'
      if (moduleView === 'add') return 'Captura de landmarks faciales'
      if (moduleView === 'detail') return 'Revisión del episodio'
      return 'Buscar y registrar episodios'
    }
    if (condataMode === 'module' && activeModule?.actionKey === 'text-note') {
      if (moduleView === 'add') return 'Nueva nota de texto'
      if (moduleView === 'detail') return 'Detalle de la nota'
      return 'Notas por sesión de monitorización'
    }
    if (condataMode === 'module' && activeModule?.actionKey === 'audio-note') {
      if (moduleView === 'add') return 'Grabar nota de voz'
      if (moduleView === 'detail') return 'Reproducción y transcripción'
      return 'Notas de audio por sesión'
    }
    if (condataMode === 'section') {
      if (sectionViewMode === 'add') return 'Nuevo registro'
      return 'Buscar y registrar'
    }
    return undefined
  }

  function condataBackHandler() {
    if (condataMode === 'module' && activeModule?.actionKey === 'pain-episode' && moduleView === 'add') {
      if (painCapturePhase === 'summary') {
        return () => setPainSummaryBackSignal((signal) => signal + 1)
      }
      return () => handlePainEpisodeViewChange('list')
    }
    if (condataMode === 'module' && activeModule?.actionKey === 'pain-episode' && moduleView === 'detail') {
      return () => handlePainEpisodeViewChange('list')
    }
    if (
      condataMode === 'module' &&
      (activeModule?.actionKey === 'text-note' || activeModule?.actionKey === 'audio-note') &&
      (moduleView === 'add' || moduleView === 'detail')
    ) {
      return () => handleSessionNotesViewChange('list')
    }
    if (condataMode === 'section' && sectionViewMode === 'add') {
      return () => setSectionViewMode('browse')
    }
    return undefined
  }

  function condataBackLabel() {
    if (condataMode === 'module' && moduleView === 'add' && painCapturePhase === 'summary') {
      return 'Volver a captura'
    }
    if (condataMode === 'module' && moduleView === 'add') return 'Cancelar captura'
    if (condataMode === 'section' && sectionViewMode === 'add') return 'Volver a la lista'
    return 'Volver a la lista'
  }

  function condataHeaderAction(): ReactNode {
    if (
      condataMode === 'section' &&
      sectionViewMode === 'browse' &&
      activeSection &&
      sectionAllowsAdd(activeSection)
    ) {
      return (
        <button
          type="button"
          className="nilo-condata__add-btn"
          onClick={() => setSectionViewMode('add')}
        >
          <MaterialIcon name="add" size={18} />
          <span>Añadir registro</span>
        </button>
      )
    }
    return null
  }

  const headerViewMode: PatientViewMode = !monitoring || condataMode === 'explore' ? 'explore' : 'live'

  const avatarEl = p.photo ? (
    <img className="nilo-pdetail__avatar" src={p.photo} alt={fullName} />
  ) : (
    <span
      className="nilo-pdetail__avatar nilo-pdetail__avatar--initials"
      style={{ backgroundColor: colorForName(fullName) }}
    >
      {getInitials(fullName)}
    </span>
  )

  return (
    <div className="nilo-pdetail">
      <PatientDetailHeader
        patient={p}
        fullName={fullName}
        avatar={avatarEl}
        monitoring={monitoring}
        liveAvailable={monitoring && !!activeMonitoringSession}
        togglingMonitor={togglingMonitor}
        onMonitoringToggle={() => void handleMonitoringToggle()}
        activeSession={activeMonitoringSession}
        loadingSession={loadingActiveSession}
        onSessionUpdated={setActiveMonitoringSession}
        viewMode={headerViewMode}
        onViewModeChange={(mode) => {
          if (mode === 'live' && monitoring) openLive()
          else openExplore()
        }}
        assignedNodeId={assignedNodeId}
        nodes={nodes}
        assigningNode={assigningNode}
        onNodeChange={handleNodeChange}
        devToolsSlot={
          ingestionDevPanelBuildEnabled() ? (
            <button
              type="button"
              className={`nilo-pdetail__dev-toggle${showIngestionDev ? ' nilo-pdetail__dev-toggle--on' : ''}`}
              onClick={() => {
                const next = !showIngestionDev
                setShowIngestionDev(next)
                setIngestionDevPanelVisible(next)
              }}
            >
              <MaterialIcon name="science" size={18} />
              <span>{showIngestionDev ? 'Ocultar sim.' : 'Simulador'}</span>
            </button>
          ) : null
        }
        onEdit={() => toast.info('Edición de paciente próximamente.')}
        onDelete={() => setConfirmDelete(true)}
      />

      {showIngestionDev && ingestionDevPanelBuildEnabled() && (
        <SessionIngestionDevPanel
          userPatientId={p.id}
          nodeId={assignedNodeId || undefined}
          sessionId={ingestionSessionId}
          monitoringActive={monitoring}
          onClose={() => {
            setShowIngestionDev(false)
            setIngestionDevPanelVisible(false)
          }}
        />
      )}

      <div className="nilo-pdetail__workspace">
        <div
          className={`nilo-pdetail__content${condataMode === 'explore' ? ' nilo-pdetail__content--explore' : ''}`}
        >
          <CondataPanel
            icon={condataIcon()}
            title={condataTitle()}
            subtitle={condataSubtitle()}
            onBack={condataBackHandler()}
            backLabel={condataBackLabel()}
            headerAction={condataHeaderAction()}
            bodyClassName={
              condataMode === 'explore'
                ? 'nilo-condata__body--explore'
                : condataMode === 'module' &&
                    activeModule?.actionKey === 'pain-episode' &&
                    moduleView === 'add'
                  ? 'nilo-condata__body--fill'
                  : undefined
            }
          >
            {renderCondataBody()}
          </CondataPanel>
        </div>
      </div>

      <PatientQuickActionsFab onSelect={openModule} />

      <TextNoteQuickModal
        open={textNoteModalOpen}
        patientName={fullName}
        userPatientId={p.id}
        nodeId={assignedNodeId || undefined}
        session={activeMonitoringSession}
        sessionIdFallback={ingestionSessionId}
        sessionLoading={loadingActiveSession}
        onClose={() => setTextNoteModalOpen(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar paciente"
        message={`¿Seguro que quieres eliminar a «${fullName}»? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setConfirmDelete(false)}
      />
    </div>
  )
}
