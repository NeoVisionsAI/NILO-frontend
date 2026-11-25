import { useCallback, useEffect, useMemo, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { SessionTextNote } from '@/types/monitoring-session'
import { CondataModuleLayout, type CondataModuleView } from './CondataModuleLayout'
import { SessionPickerBar } from './SessionPickerBar'
import { useClinicalPatientResolution } from './useClinicalPatientResolution'
import { useMonitoringSessions } from './useMonitoringSessions'

interface TextNoteCondataProps {
  userPatientId: string
  nodeId?: string | null
  preferredSessionId?: string | null
  view: CondataModuleView
  selectedNoteId: string | null
  onViewChange: (view: CondataModuleView, noteId?: string | null) => void
}

function formatNoteWhen(note: SessionTextNote): string {
  const ref = new Date(note.recorded_at || note.created_at)
  return Number.isNaN(ref.getTime())
    ? note.recorded_at
    : ref.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export function TextNoteCondata({
  userPatientId,
  nodeId,
  preferredSessionId,
  view,
  selectedNoteId,
  onViewChange,
}: TextNoteCondataProps) {
  const { clinicalPatient, loading: resolving, error: resolveError } = useClinicalPatientResolution(userPatientId)
  const {
    sessions,
    selectedSession,
    selectedSessionId,
    setSelectedSessionId,
    loading: sessionsLoading,
    createSession,
  } = useMonitoringSessions(clinicalPatient?.id ?? null, nodeId, preferredSessionId, userPatientId)

  const [notes, setNotes] = useState<SessionTextNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [editBody, setEditBody] = useState('')

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null

  const loadNotes = useCallback(async () => {
    if (!selectedSessionId) {
      setNotes([])
      return
    }
    setNotesLoading(true)
    try {
      const list = await monitoringSessionService.listTextNotes(selectedSessionId)
      setNotes(list)
    } catch {
      toast.error('No se pudieron cargar las notas.')
    } finally {
      setNotesLoading(false)
    }
  }, [selectedSessionId])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  useEffect(() => {
    if (view === 'detail' && selectedNote) {
      setEditBody(selectedNote.body)
    }
  }, [view, selectedNote])

  useEffect(() => {
    if (view === 'detail' && !selectedNote) {
      onViewChange('list')
    }
  }, [view, selectedNote, onViewChange])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter((n) => n.body.toLowerCase().includes(q) || formatNoteWhen(n).toLowerCase().includes(q))
  }, [notes, query])

  async function handleCreateSession() {
    setCreatingSession(true)
    try {
      await createSession()
    } finally {
      setCreatingSession(false)
    }
  }

  async function handleSaveNote() {
    const body = draft.trim()
    if (!body) {
      toast.info('Escribe el texto de la nota.')
      return
    }
    if (!clinicalPatient || !selectedSessionId) {
      toast.error('Selecciona o crea una sesión.')
      return
    }
    setSaving(true)
    try {
      await monitoringSessionService.createTextNote(selectedSessionId, {
        patient_id: clinicalPatient.id,
        node_id: nodeId || undefined,
        body,
      })
      toast.success('Nota guardada.')
      setDraft('')
      await loadNotes()
      onViewChange('list')
    } catch {
      toast.error('No se pudo guardar la nota.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateNote() {
    if (!selectedNote || !selectedSessionId) return
    const body = editBody.trim()
    if (!body) {
      toast.info('El texto no puede estar vacío.')
      return
    }
    setSaving(true)
    try {
      const updated = await monitoringSessionService.updateTextNote(selectedSessionId, selectedNote.id, body)
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      toast.success('Nota actualizada.')
    } catch {
      toast.error('No se pudo actualizar la nota.')
    } finally {
      setSaving(false)
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
        <MaterialIcon name="event_note" size={40} />
        <p>Crea una sesión para registrar notas de texto.</p>
      </div>
    ) : notesLoading ? (
      <div className="nilo-cmodule__empty">
        <p>Cargando notas…</p>
      </div>
    ) : filtered.length === 0 ? (
      <div className="nilo-cmodule__empty">
        <MaterialIcon name="edit_note" size={40} />
        <p>{notes.length === 0 ? 'No hay notas en esta sesión.' : 'Ninguna nota coincide con la búsqueda.'}</p>
        {notes.length === 0 && (
          <button type="button" className="nilo-cmodule__add-btn" onClick={() => onViewChange('add')}>
            <MaterialIcon name="add" size={20} />
            <span>Añadir primera nota</span>
          </button>
        )}
      </div>
    ) : (
      filtered.map((note) => (
        <button
          key={note.id}
          type="button"
          className="nilo-cmodule__item"
          onClick={() => onViewChange('detail', note.id)}
        >
          <span className="nilo-cmodule__item-icon">
            <MaterialIcon name="edit_note" size={22} />
          </span>
          <span className="nilo-cmodule__item-text">
            <strong>{formatNoteWhen(note)}</strong>
            <span className="nilo-cmodule__item-preview">{note.body.slice(0, 120)}{note.body.length > 120 ? '…' : ''}</span>
          </span>
          <MaterialIcon name="chevron_right" size={22} className="nilo-cmodule__item-chevron" />
        </button>
      ))
    )

  const addContent = (
    <div className="nilo-cmodule__note-form">
      {sessionBar}
      {!selectedSession && (
        <p className="nilo-cmodule__hint">Necesitas una sesión activa o cerrada para asociar la nota.</p>
      )}
      <label className="nilo-cmodule__textarea-label">
        <span>Texto clínico</span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          maxLength={20000}
          placeholder="Observaciones, evolución, incidencias…"
          disabled={!selectedSessionId || saving}
        />
      </label>
      <div className="nilo-cmodule__form-actions">
        <button type="button" className="nilo-cmodule__action-btn nilo-cmodule__action-btn--secondary" onClick={() => onViewChange('list')}>
          Cancelar
        </button>
        <button
          type="button"
          className="nilo-cmodule__action-btn"
          onClick={handleSaveNote}
          disabled={!selectedSessionId || saving}
        >
          <MaterialIcon name="save" size={18} />
          {saving ? 'Guardando…' : 'Guardar nota'}
        </button>
      </div>
    </div>
  )

  const detailContent = selectedNote ? (
    <>
      <div className="nilo-cmodule__detail-meta">
        <span className="nilo-cmodule__detail-label">Registrada</span>
        <strong>{formatNoteWhen(selectedNote)}</strong>
        {selectedSession && (
          <span className="nilo-cmodule__badge">{selectedSession.status === 'active' ? 'Sesión activa' : 'Sesión cerrada'}</span>
        )}
      </div>
      <label className="nilo-cmodule__textarea-label">
        <span>Contenido</span>
        <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={12} maxLength={20000} />
      </label>
    </>
  ) : null

  const detailFooter = selectedNote ? (
    <button
      type="button"
      className="nilo-cmodule__action-btn"
      onClick={handleUpdateNote}
      disabled={saving}
    >
      <MaterialIcon name="save" size={18} />
      {saving ? 'Guardando…' : 'Guardar cambios'}
    </button>
  ) : null

  return (
    <CondataModuleLayout
      view={view}
      searchQuery={query}
      onSearchChange={setQuery}
      searchPlaceholder="Buscar en notas…"
      addLabel="Nueva nota"
      onAdd={() => onViewChange('add')}
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