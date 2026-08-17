import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/lib/toast'
import { patientDisplayName, patientProfileToInput } from '@/types'
import { useClinicalData } from '../../context/ClinicalDataContext'
import { ROOT_PATHS } from '@/router/paths'
import { RecordFormPanel } from './components/RecordFormPanel'
import { CondataPanel } from './components/CondataPanel'
import {
  PainEpisodeCondata,
  type PainEpisodeCondataView,
} from './components/condata/PainEpisodeCondata'
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
import './PatientDetailPage.css'
import './components/CondataPanel.css'

const AVATAR_COLORS = ['#0369a1', '#0f766e', '#7c3aed', '#be123c', '#b45309', '#4338ca', '#0891b2']

type CondataMode = 'live' | 'section' | 'module'

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
  const { patients, nodes, updatePatient, assignPatientNode, deletePatient } = useClinicalData()
  const patient = patients.find((p) => p.id === patientId)

  const sections = useMemo(() => (patient ? resolvePatientSections(patient) : []), [patient])
  const recordSections = useMemo(() => sections.filter((section) => section.mode !== 'live'), [sections])

  const [condataMode, setCondataMode] = useState<CondataMode>('live')
  const [activeSectionId, setActiveSectionId] = useState<PatientSectionId>('clinical-results')
  const [sectionViewMode, setSectionViewMode] = useState<SectionViewMode>('browse')
  const [activeModule, setActiveModule] = useState<PatientQuickAction | null>(null)
  const [moduleView, setModuleView] = useState<PainEpisodeCondataView>('list')
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null)
  const [painEpisodes, setPainEpisodes] = useState<PainEpisode[]>([])
  const [assigningNode, setAssigningNode] = useState(false)
  const [togglingMonitor, setTogglingMonitor] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const activeSection = findPatientSection(recordSections, activeSectionId) ?? recordSections[0]

  useEffect(() => {
    setCondataMode('live')
    setActiveSectionId(recordSections[0]?.id ?? 'clinical-results')
    setSectionViewMode('browse')
    setActiveModule(null)
    setModuleView('list')
    setSelectedEpisodeId(null)
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
  const assignedNodeId = p.patient_profile?.node_id ?? ''

  function openLive() {
    setCondataMode('live')
    setActiveModule(null)
    setModuleView('list')
    setSelectedEpisodeId(null)
    setSectionViewMode('browse')
  }

  function openSection(sectionId: PatientSectionId, action?: PatientQuickAction) {
    setCondataMode('section')
    setActiveSectionId(sectionId)
    setSectionViewMode('browse')
    setActiveModule(action ?? null)
    setModuleView('list')
    setSelectedEpisodeId(null)
  }

  function openPainEpisodeModule(action: PatientQuickAction) {
    setCondataMode('module')
    setActiveModule(action)
    setModuleView('list')
    setSelectedEpisodeId(null)
    setSectionViewMode('browse')
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

    toast.info(`«${action.label}»: pendiente de implementar.`)
  }

  function handlePainEpisodeViewChange(view: PainEpisodeCondataView, episodeId?: string | null) {
    setModuleView(view)
    setSelectedEpisodeId(episodeId ?? null)
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
      await updatePatient(p.id, {
        patient_profile: {
          ...patientProfileToInput(p.patient_profile),
          monitoring_active: next,
        },
      })
      toast.success(next ? 'Monitoring activated.' : 'Monitoring deactivated.')
    } catch {
      /* toast de error del cliente API */
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
    if (condataMode === 'live') {
      return <LiveTab embedded />
    }

    if (condataMode === 'module' && activeModule?.actionKey === 'pain-episode') {
      return (
        <PainEpisodeCondata
          patientId={p.id}
          patientName={fullName}
          episodes={painEpisodes}
          view={moduleView}
          selectedEpisodeId={selectedEpisodeId}
          onViewChange={handlePainEpisodeViewChange}
          onEpisodeCreated={(episode) => setPainEpisodes((prev) => [episode, ...prev])}
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
    if (activeModule) return activeModule.label
    if (condataMode === 'section' && activeSection) return activeSection.label
    return 'Live'
  }

  function condataIcon() {
    if (condataMode === 'live') return 'monitor_heart'
    if (activeModule) return activeModule.icon
    if (condataMode === 'section' && activeSection) return activeSection.icon
    return 'monitor_heart'
  }

  function condataSubtitle() {
    if (condataMode === 'live') return 'Monitorización en tiempo real'
    if (condataMode === 'module' && activeModule?.actionKey === 'pain-episode') {
      if (moduleView === 'add') return 'Captura de landmarks faciales'
      if (moduleView === 'detail') return 'Revisión del episodio'
      return 'Buscar y registrar episodios'
    }
    if (condataMode === 'section') {
      if (sectionViewMode === 'add') return 'Nuevo registro'
      return 'Buscar y registrar'
    }
    return undefined
  }

  function condataBackHandler() {
    if (condataMode === 'module' && activeModule?.actionKey === 'pain-episode' && moduleView !== 'list') {
      return () => handlePainEpisodeViewChange('list')
    }
    if (condataMode === 'section' && sectionViewMode === 'add') {
      return () => setSectionViewMode('browse')
    }
    return undefined
  }

  function condataBackLabel() {
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

  return (
    <div className="nilo-pdetail">
      <header className="nilo-pdetail__header">
        <div className="nilo-pdetail__identity">
          {p.photo ? (
            <img className="nilo-pdetail__avatar" src={p.photo} alt={fullName} />
          ) : (
            <span
              className="nilo-pdetail__avatar nilo-pdetail__avatar--initials"
              style={{ backgroundColor: colorForName(fullName) }}
            >
              {getInitials(fullName)}
            </span>
          )}

          <div className="nilo-pdetail__info">
            <h1 className="nilo-pdetail__name">{fullName}</h1>
            <div className="nilo-pdetail__meta-row">
              <label className="nilo-pdetail__monitor">
                <button
                  type="button"
                  role="switch"
                  className={`nilo-pdetail__toggle${monitoring ? ' nilo-pdetail__toggle--on' : ''}`}
                  aria-checked={monitoring}
                  disabled={togglingMonitor}
                  onClick={handleMonitoringToggle}
                >
                  <span className="nilo-pdetail__toggle-thumb" />
                </button>
                <span className="nilo-pdetail__monitor-label">
                  {monitoring ? 'Monitoring active' : 'Monitoring inactive'}
                </span>
              </label>

              <button
                type="button"
                className={`nilo-pdetail__live-btn${condataMode === 'live' ? ' nilo-pdetail__live-btn--active' : ''}`}
                onClick={openLive}
                aria-pressed={condataMode === 'live'}
              >
                <span className="nilo-pdetail__live-dot" aria-hidden="true" />
                <MaterialIcon name="monitor_heart" size={18} />
                <span>Live</span>
              </button>
            </div>
          </div>
        </div>

        <div className="nilo-pdetail__actions">
          <div className="nilo-pdetail__node-select">
            <MaterialIcon name="hub" size={20} className="nilo-pdetail__node-icon" />
            <select
              value={assignedNodeId}
              onChange={handleNodeChange}
              disabled={assigningNode}
              aria-label="Select node"
            >
              <option value="">Select node</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="nilo-pdetail__btn nilo-pdetail__btn--outlined"
            onClick={() => toast.info('Patient edit view coming soon.')}
          >
            <MaterialIcon name="edit" size={18} />
            <span>Edit</span>
          </button>

          <button
            type="button"
            className="nilo-pdetail__btn nilo-pdetail__btn--danger"
            onClick={() => setConfirmDelete(true)}
          >
            <MaterialIcon name="delete" size={18} />
            <span>Delete</span>
          </button>
        </div>
      </header>

      <div className="nilo-pdetail__workspace">
        <div className="nilo-pdetail__content">
          <CondataPanel
            icon={condataIcon()}
            title={condataTitle()}
            subtitle={condataSubtitle()}
            onBack={condataBackHandler()}
            backLabel={condataBackLabel()}
            headerAction={condataHeaderAction()}
          >
            {renderCondataBody()}
          </CondataPanel>
        </div>
      </div>

      <PatientQuickActionsFab onSelect={openModule} />

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
