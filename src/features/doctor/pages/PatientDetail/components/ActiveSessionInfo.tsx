import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatSessionElapsed } from '@/lib/format-session-elapsed'
import { resolveSessionDisplayName, sessionDisplayNameCache } from '@/lib/session-display-name-cache'
import { toast } from '@/lib/toast'
import { canonicalSessionId } from '@/lib/session-id'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { MonitoringSession } from '@/types/monitoring-session'
import './ActiveSessionInfo.css'

interface ActiveSessionInfoProps {
  session: MonitoringSession
  profileActiveSessionId?: string | null
  loading?: boolean
  onSessionUpdated?: (session: MonitoringSession) => void
  /** Variante más pequeña para la cabecera del paciente */
  compact?: boolean
  /** Oculta el cronómetro (se muestra junto a monitorización) */
  hideElapsed?: boolean
}

export function ActiveSessionInfo({
  session,
  profileActiveSessionId,
  loading,
  onSessionUpdated,
  compact,
  hideElapsed,
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
        onSessionUpdated?.({ ...session, display_name: trimmed })
        setEditingName(false)
        toast.info('Nombre guardado en este navegador. Despliega el PATCH en backend para persistir en servidor.')
      } finally {
        setSavingName(false)
      }
    },
    [nameDraft, onSessionUpdated, session, sessionIdForApi],
  )

  if (loading) {
    return <p className="nilo-session-card__loading">Cargando sesión…</p>
  }

  return (
    <div className={`nilo-session-card${compact ? ' nilo-session-card--compact' : ''}`}>
      <div className="nilo-session-card__row nilo-session-card__row--name">
        <div className="nilo-session-card__name-wrap">
          {editingName ? (
            <form className="nilo-session-card__rename" onSubmit={(ev) => void saveName(ev)}>
              <input
                type="text"
                value={nameDraft}
                maxLength={120}
                placeholder="Nombre de la sesión…"
                onChange={(ev) => setNameDraft(ev.target.value)}
                autoFocus
              />
              <button type="submit" disabled={savingName}>
                {savingName ? '…' : 'OK'}
              </button>
              <button type="button" onClick={() => setEditingName(false)}>
                ✕
              </button>
            </form>
          ) : (
            <>
              <span className={`nilo-session-card__name${displayName ? '' : ' nilo-session-card__name--muted'}`}>
                {displayName ?? 'Sesión sin nombre'}
              </span>
              <button
                type="button"
                className="nilo-session-card__icon-btn"
                onClick={openRename}
                aria-label="Editar nombre de sesión"
              >
                <MaterialIcon name="edit" size={18} />
              </button>
            </>
          )}
        </div>
        {session.status === 'active' && !hideElapsed && (
          <span className="nilo-session-card__elapsed" title="Tiempo desde el inicio">
            <MaterialIcon name="timer" size={16} />
            {elapsed}
          </span>
        )}
      </div>

      <div className="nilo-session-card__row nilo-session-card__row--id">
        <code className="nilo-session-card__id" title="Id MongoDB / MinIO">
          {sessionId}
        </code>
        <button
          type="button"
          className="nilo-session-card__icon-btn"
          onClick={copySessionId}
          aria-label="Copiar id de sesión"
        >
          <MaterialIcon name="content_copy" size={18} />
        </button>
      </div>
    </div>
  )
}