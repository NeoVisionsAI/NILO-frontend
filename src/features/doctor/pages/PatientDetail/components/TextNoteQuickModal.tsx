import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { formatExploreSessionLabel } from '../tabs/explore/ExploreSessionPicker'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { MonitoringSession } from '@/types/monitoring-session'
import { useClinicalPatientResolution } from './condata/useClinicalPatientResolution'
import './TextNoteQuickModal.css'

interface TextNoteQuickModalProps {
  open: boolean
  patientName: string
  userPatientId: string
  nodeId?: string | null
  session: MonitoringSession | null
  sessionIdFallback?: string | null
  sessionLoading?: boolean
  onClose: () => void
}

export function TextNoteQuickModal({
  open,
  patientName,
  userPatientId,
  nodeId,
  session,
  sessionIdFallback,
  sessionLoading,
  onClose,
}: TextNoteQuickModalProps) {
  const { clinicalPatient, loading: resolvingPatient } = useClinicalPatientResolution(userPatientId)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const sessionId = session?.id ?? sessionIdFallback ?? null

  const sessionLabel = session
    ? formatExploreSessionLabel(session)
    : sessionId
      ? `Sesión …${sessionId.slice(-8)}`
      : null

  useEffect(() => {
    if (!open) return
    setBody('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, saving, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  async function handleSave() {
    const text = body.trim()
    if (!text) {
      toast.info('Escribe el texto de la nota.')
      return
    }
    if (!clinicalPatient?.id || !sessionId) {
      toast.error('No hay paciente clínico o sesión activa para guardar la nota.')
      return
    }
    setSaving(true)
    try {
      await monitoringSessionService.createTextNote(sessionId, {
        patient_id: clinicalPatient.id,
        node_id: nodeId || undefined,
        body: text,
      })
      toast.success('Nota de texto guardada.')
      onClose()
    } catch {
      toast.error('No se pudo guardar la nota.')
    } finally {
      setSaving(false)
    }
  }

  const dialog = (
    <div className="nilo-tnote-modal m3" role="dialog" aria-modal="true" aria-labelledby="nilo-tnote-modal-title">
      <div className="nilo-tnote-modal__backdrop" onClick={() => !saving && onClose()} />
      <div className="nilo-tnote-modal__panel">
        <header className="nilo-tnote-modal__head">
          <span className="nilo-tnote-modal__head-icon" aria-hidden>
            <MaterialIcon name="edit_note" size={22} />
          </span>
          <div>
            <h2 id="nilo-tnote-modal-title" className="nilo-tnote-modal__title">
              Nueva nota de texto
            </h2>
            <p className="nilo-tnote-modal__subtitle">Se asocia al paciente y la sesión actuales.</p>
          </div>
          <button
            type="button"
            className="nilo-tnote-modal__close"
            aria-label="Cerrar"
            disabled={saving}
            onClick={onClose}
          >
            <MaterialIcon name="close" size={22} />
          </button>
        </header>

        <div className="nilo-tnote-modal__meta">
          <div className="nilo-tnote-modal__meta-row">
            <MaterialIcon name="person" size={20} />
            <div>
              <span className="nilo-tnote-modal__meta-k">Paciente</span>
              <span className="nilo-tnote-modal__meta-v">{patientName}</span>
            </div>
          </div>
          <div className="nilo-tnote-modal__meta-row">
            <MaterialIcon name="history" size={20} />
            <div>
              <span className="nilo-tnote-modal__meta-k">Sesión</span>
              <span className="nilo-tnote-modal__meta-v">
                {sessionLoading || resolvingPatient
                  ? 'Cargando…'
                  : sessionLabel ?? 'Sin sesión activa (inicia monitorización)'}
              </span>
            </div>
          </div>
        </div>

        <label className="nilo-tnote-modal__field">
          <span className="nilo-tnote-modal__field-label">Texto de la nota</span>
          <textarea
            className="nilo-tnote-modal__textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe la observación clínica…"
            rows={6}
            disabled={saving || !sessionId || resolvingPatient}
            autoFocus
          />
        </label>

        <footer className="nilo-tnote-modal__actions">
          <button type="button" className="nilo-tnote-modal__btn nilo-tnote-modal__btn--ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="nilo-tnote-modal__btn nilo-tnote-modal__btn--primary"
            onClick={() => void handleSave()}
            disabled={saving || !sessionId || resolvingPatient || !clinicalPatient}
          >
            {saving ? 'Guardando…' : 'Guardar nota'}
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}