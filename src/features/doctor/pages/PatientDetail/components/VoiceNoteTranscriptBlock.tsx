import { useCallback, useEffect, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import {
  normalizeTranscriptionStatus,
  pollTranscriptionUntilSettled,
  requestVoiceTranscription,
  transcriptionStatusLabel,
} from '@/lib/voice-note-transcription'
import { audioRecordingService } from '@/services/audio-recording.service'
import type { AudioRecording } from '@/types/monitoring-session'
import './VoiceNoteTranscriptBlock.css'

interface VoiceNoteTranscriptBlockProps {
  clip: AudioRecording
  /** Permite editar y PATCH manual (módulo nota de audio). */
  editable?: boolean
  /** Spinner local además de transcription_status pending. */
  busy?: boolean
  onClipChange?: (clip: AudioRecording) => void
  /** Texto multilínea en explorar; una línea en listados compactos. */
  compact?: boolean
}

export function VoiceNoteTranscriptBlock({
  clip,
  editable = false,
  busy = false,
  onClipChange,
  compact = false,
}: VoiceNoteTranscriptBlockProps) {
  const [localBusy, setLocalBusy] = useState(false)
  const [draft, setDraft] = useState(clip.transcription ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(clip.transcription ?? '')
  }, [clip.id, clip.transcription])

  const status = normalizeTranscriptionStatus(clip.transcription_status)
  const pending = busy || localBusy || status === 'pending'
  const hasText = Boolean(clip.transcription?.trim())
  const showGenerate = !pending && (status === 'none' || status === 'failed' || (!hasText && status !== 'done'))

  const mergeClip = useCallback(
    (next: AudioRecording) => {
      onClipChange?.(next)
      if (next.transcription != null) setDraft(next.transcription)
    },
    [onClipChange],
  )

  async function runTranscribe(force = false) {
    setLocalBusy(true)
    try {
      let updated = await requestVoiceTranscription(clip.id, force ? { force: true } : undefined)
      mergeClip(updated)
      if (normalizeTranscriptionStatus(updated.transcription_status) === 'pending') {
        updated = await pollTranscriptionUntilSettled(clip.id, { onTick: mergeClip })
        mergeClip(updated)
      }
      if (normalizeTranscriptionStatus(updated.transcription_status) === 'done') {
        toast.success('Transcripción lista.')
      } else if (normalizeTranscriptionStatus(updated.transcription_status) === 'failed') {
        toast.error('No se pudo transcribir la nota de voz.')
      }
    } catch {
      toast.error('Error al solicitar la transcripción.')
      try {
        const fresh = await audioRecordingService.get(clip.id)
        mergeClip(fresh)
      } catch {
        /* estado desconocido */
      }
    } finally {
      setLocalBusy(false)
    }
  }

  async function saveManual() {
    const text = draft.trim()
    if (!text) {
      toast.info('Escribe el texto de la transcripción.')
      return
    }
    setSaving(true)
    try {
      const updated = await audioRecordingService.updateTranscription(clip.id, text, 'done')
      mergeClip(updated)
      toast.success('Transcripción guardada.')
    } catch {
      toast.error('No se pudo guardar la transcripción.')
    } finally {
      setSaving(false)
    }
  }

  if (compact && !editable) {
    if (pending) {
      return (
        <p className="nilo-vtrans nilo-vtrans--compact" aria-live="polite">
          <MaterialIcon name="progress_activity" size={14} className="nilo-vtrans__spin" />
          Transcribiendo…
        </p>
      )
    }
    if (hasText) {
      return (
        <p className="nilo-vtrans nilo-vtrans--compact" title={clip.transcription ?? undefined}>
          {clip.transcription}
        </p>
      )
    }
    if (status === 'failed') {
      return (
        <div className="nilo-vtrans nilo-vtrans--compact nilo-vtrans--row">
          <span className="nilo-vtrans--fail">Transcripción fallida</span>
          {onClipChange ? (
            <button type="button" className="nilo-vtrans__link" onClick={() => void runTranscribe(true)}>
              Reintentar
            </button>
          ) : null}
        </div>
      )
    }
    if (!hasText && showGenerate && onClipChange) {
      return (
        <button type="button" className="nilo-vtrans__link" onClick={() => void runTranscribe()}>
          Generar transcripción
        </button>
      )
    }
    return null
  }

  return (
    <div className="nilo-vtrans">
      <div className="nilo-vtrans__head">
        <span className="nilo-vtrans__label">Transcripción</span>
        <span
          className={`nilo-vtrans__badge nilo-vtrans__badge--${status === 'failed' ? 'fail' : status === 'done' ? 'ok' : 'muted'}`}
        >
          {transcriptionStatusLabel(pending ? 'pending' : status)}
        </span>
      </div>

      {pending ? (
        <p className="nilo-vtrans__pending" aria-live="polite">
          <MaterialIcon name="progress_activity" size={20} className="nilo-vtrans__spin" />
          Generando transcripción (puede tardar hasta un minuto)…
        </p>
      ) : editable ? (
        <label className="nilo-vtrans__field">
          <textarea
            className="nilo-vtrans__textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            placeholder={
              status === 'failed'
                ? 'La transcripción automática falló. Escribe o corrige el texto…'
                : 'Texto transcrito o corrección manual…'
            }
          />
        </label>
      ) : hasText ? (
        <p className="nilo-vtrans__text">{clip.transcription}</p>
      ) : (
        <p className="nilo-vtrans__empty">Aún no hay texto transcrito para esta nota.</p>
      )}

      <div className="nilo-vtrans__actions">
        {showGenerate && onClipChange ? (
          <button
            type="button"
            className="nilo-vtrans__btn"
            disabled={pending || saving}
            onClick={() => void runTranscribe(status === 'failed')}
          >
            <MaterialIcon name="transcribe" size={18} />
            {status === 'failed' ? 'Reintentar transcripción' : 'Generar transcripción'}
          </button>
        ) : null}
        {editable && !pending ? (
          <button
            type="button"
            className="nilo-vtrans__btn nilo-vtrans__btn--primary"
            disabled={saving}
            onClick={() => void saveManual()}
          >
            <MaterialIcon name="save" size={18} />
            {saving ? 'Guardando…' : 'Guardar corrección'}
          </button>
        ) : null}
      </div>
    </div>
  )
}