import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatSessionElapsed } from '@/lib/format-session-elapsed'
import { resolveSessionDisplayName, sessionDisplayNameCache } from '@/lib/session-display-name-cache'
import { toast } from '@/lib/toast'
import { canonicalSessionId } from '@/lib/session-id'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { MonitoringSession } from '@/types/monitoring-session'

interface ActiveSessionInfoProps {
  session: MonitoringSession
  /** `patient_profile.active_session_id` — fuente de verdad MinIO/Mongo. */
  profileActiveSessionId?: string | null
  loading?: boolean
  onSessionUpdated?: (session: MonitoringSession) => void
}

export function ActiveSessionInfo({
  session,
  profileActiveSessionId,
  loading,
  onSessionUpdated,
}: ActiveSessionInfoProps) {
  const [elapsed, setElapsed] = useState(() => formatSessionElapsed(session.started_at))
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [localNameOverride, setLocalNameOverride] = useState<string | null>(
    () => sessionDisplayNameCache.get(session.id),
  )

  const displayName =
    session.display_name?.trim() ||
    localNameOverride ||
    resolveSessionDisplayName(session) ||
    null

  const sessionId = canonicalSessionId(session, profileActiveSessionId) ?? session.id
  const sessionIdForApi = sessionId

  useEffect(() => {
    if (session.status !== 'active') return
    const tick = () => setElapsed(formatSessionElapsed(session.started_at))
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [session.started_at, session.status])

  useEffect(() => {
    setLocalNameOverride(sessionDisplayNameCache.get(session.id))
  }, [session.id, session.display_name])

  const copySessionId = useCallback(() => {
    void navigator.clipboard.writeText(sessionId).then(() => {
      toast.success('Id de sesión copiado (mismo que en MinIO).')
    })
  }, [sessionId])

  const openRename = useCallback(() => {
    setNameDraft(displayName ?? '')
    setEditingName(true)
  }, [displayName])

  const saveName = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      const trimmed = nameDraft.trim()
      if (!trimmed) {
        toast.info('Escribe un nombre para la sesión.')
        return
      }
      setSavingName(true)
      try {
        const updated = await monitoringSessionService.update(sessionIdForApi, {
          display_name: trimmed,
        })
        sessionDisplayNameCache.set(sessionIdForApi, trimmed)
        setLocalNameOverride(trimmed)
        onSessionUpdated?.(updated)
        setEditingName(false)
        toast.success('Nombre de sesión guardado.')
      } catch {
        sessionDisplayNameCache.set(sessionIdForApi, trimmed)
        setLocalNameOverride(trimmed)
        onSessionUpdated?.({
          ...session,
          display_name: trimmed,
        })
        setEditingName(false)
        toast.info('Nombre guardado en este navegador. Despliega el PATCH en backend para persistir en servidor.')
      } finally {
        setSavingName(false)
      }
    },
    [nameDraft, onSessionUpdated, session, sessionIdForApi],
  )

  if (loading) {
    return <span className="nilo-pdetail__session-loading">Cargando sesión…</span>
  }

  return (
    <div className="nilo-pdetail__session-block">
      <div className="nilo-pdetail__session-title-row">
        <span className="nilo-pdetail__session-label">Sesión activa</span>
        {session.status === 'active' && (
          <span className="nilo-pdetail__session-elapsed" title="Tiempo desde el inicio de la sesión">
            <MaterialIcon name="timer" size={16} />
            {elapsed}
          </span>
        )}
      </div>

      {displayName ? (
        <p className="nilo-pdetail__session-friendly" title="Nombre para el equipo clínico">
          {displayName}
        </p>
      ) : (
        <p className="nilo-pdetail__session-friendly nilo-pdetail__session-friendly--muted">
          Sin nombre — puedes asignar uno
        </p>
      )}

      <div className="nilo-pdetail__session-tech-row">
        <code
          className="nilo-pdetail__session-id"
          title="Id de sesión (MongoDB / MinIO)"
          aria-label={`Id de sesión (MongoDB / MinIO): ${sessionId}`}
        >
          {sessionId}
        </code>
        <button
          type="button"
          className="nilo-pdetail__session-copy"
          onClick={copySessionId}
          aria-label="Copiar id de sesión"
        >
          <MaterialIcon name="content_copy" size={16} />
        </button>
        <button
          type="button"
          className="nilo-pdetail__session-copy"
          onClick={openRename}
          aria-label="Cambiar nombre de la sesión"
        >
          <MaterialIcon name="edit" size={16} />
        </button>
      </div>

      {editingName && (
        <form className="nilo-pdetail__session-rename" onSubmit={(ev) => void saveName(ev)}>
          <input
            type="text"
            value={nameDraft}
            maxLength={120}
            placeholder="Ej. Turno noche UCI, Post-op 24h…"
            onChange={(ev) => setNameDraft(ev.target.value)}
            autoFocus
          />
          <button type="submit" className="nilo-pdetail__session-rename-save" disabled={savingName}>
            {savingName ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            className="nilo-pdetail__session-rename-cancel"
            onClick={() => setEditingName(false)}
          >
            Cancelar
          </button>
        </form>
      )}
    </div>
  )
}