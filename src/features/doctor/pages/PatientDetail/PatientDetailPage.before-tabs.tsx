import { useState, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/lib/toast'
import { patientDisplayName, patientProfileToInput } from '@/types'
import { useClinicalData } from '../../context/ClinicalDataContext'
import { ROOT_PATHS } from '@/router/paths'
import './PatientDetailPage.css'

const AVATAR_COLORS = ['#0369a1', '#0f766e', '#7c3aed', '#be123c', '#b45309', '#4338ca', '#0891b2']

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

/**
 * Vista de detalle del paciente (Contenedor B).
 * Cabecera con foto, nombre, monitorización, nodo y acciones; zona de estadísticas vacía.
 */
export function PatientDetailPage() {
  const { patientId = '' } = useParams()
  const navigate = useNavigate()
  const { patients, nodes, updatePatient, assignPatientNode, deletePatient } = useClinicalData()
  const patient = patients.find((p) => p.id === patientId)

  const [assigningNode, setAssigningNode] = useState(false)
  const [togglingMonitor, setTogglingMonitor] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

      <section className="nilo-pdetail__stats" aria-label="Statistics">
        <span className="nilo-pdetail__stats-label">Statistics</span>
      </section>

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
