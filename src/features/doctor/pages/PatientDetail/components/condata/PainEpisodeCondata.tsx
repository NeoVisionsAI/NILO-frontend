import { useEffect, useMemo, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/lib/toast'
import { PainEpisodeCapturePanel } from '../../pain-episode/PainEpisodeModal'
import { formatPainScaleValue, findPainScaleDefinition } from '../../pain-episode/pain-scales'
import {
  formatPainEpisodeDate,
  formatPainEpisodeElapsed,
  type PainEpisode,
  type PainEpisodeSessionData,
} from '../../pain-episode/types'
import { CondataModuleLayout } from './CondataModuleLayout'

export type PainEpisodeCondataView = 'list' | 'add' | 'detail'
export type PainEpisodeCapturePhase = 'capture' | 'summary'

interface PainEpisodeCondataProps {
  patientId: string
  episodes: PainEpisode[]
  view: PainEpisodeCondataView
  selectedEpisodeId: string | null
  onViewChange: (view: PainEpisodeCondataView, episodeId?: string | null) => void
  onEpisodeCreated: (episode: PainEpisode) => void
  onEpisodeDelete: (episodeId: string) => void
  onCapturePhaseChange?: (phase: PainEpisodeCapturePhase) => void
  summaryBackSignal?: number
}

function sessionToEpisode(session: PainEpisodeSessionData): PainEpisode {
  return {
    ...session,
    id: crypto.randomUUID(),
  }
}

export function PainEpisodeCondata({
  patientId,
  episodes,
  view,
  selectedEpisodeId,
  onViewChange,
  onEpisodeCreated,
  onEpisodeDelete,
  onCapturePhaseChange,
  summaryBackSignal = 0,
}: PainEpisodeCondataProps) {
  const [query, setQuery] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const selectedEpisode = episodes.find((item) => item.id === selectedEpisodeId) ?? null

  useEffect(() => {
    if (view === 'detail' && !selectedEpisode) {
      onViewChange('list')
    }
  }, [view, selectedEpisode, onViewChange])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return episodes

    return episodes.filter((episode) => {
      const haystack = [
        formatPainEpisodeDate(episode.startedAt),
        formatPainEpisodeDate(episode.endedAt),
        String(episode.frames.length),
        formatPainEpisodeElapsed(episode.durationMs),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [episodes, query])

  const listContent =
    filtered.length === 0 ? (
      <div className="nilo-cmodule__empty">
        <MaterialIcon name="sick" size={40} />
        <p>
          {episodes.length === 0
            ? 'No hay episodios de dolor registrados.'
            : 'Ningún episodio coincide con la búsqueda.'}
        </p>
        {episodes.length === 0 && (
          <button type="button" className="nilo-cmodule__add-btn" onClick={() => onViewChange('add')}>
            <MaterialIcon name="add" size={20} />
            <span>Registrar primer episodio</span>
          </button>
        )}
      </div>
    ) : (
      filtered.map((episode) => (
        <button
          key={episode.id}
          type="button"
          className="nilo-cmodule__item"
          onClick={() => onViewChange('detail', episode.id)}
        >
          <span className="nilo-cmodule__item-icon">
            <MaterialIcon name="sick" size={22} />
          </span>
          <span className="nilo-cmodule__item-text">
            <strong>{formatPainEpisodeDate(episode.startedAt)}</strong>
            <span>
              {formatPainEpisodeElapsed(episode.durationMs)} · {episode.frames.length} frames
              {episode.scales.length > 0 ? ` · ${episode.scales.length} escalas` : ''}
            </span>
          </span>
          <MaterialIcon name="chevron_right" size={22} className="nilo-cmodule__item-chevron" />
        </button>
      ))
    )

  const detailContent = selectedEpisode ? (
    <>
      <div className="nilo-cmodule__detail-grid">
        <div>
          <span className="nilo-cmodule__detail-label">Inicio</span>
          <strong>{formatPainEpisodeDate(selectedEpisode.startedAt)}</strong>
        </div>
        <div>
          <span className="nilo-cmodule__detail-label">Fin</span>
          <strong>{formatPainEpisodeDate(selectedEpisode.endedAt)}</strong>
        </div>
        <div>
          <span className="nilo-cmodule__detail-label">Duración</span>
          <strong>{formatPainEpisodeElapsed(selectedEpisode.durationMs)}</strong>
        </div>
        <div>
          <span className="nilo-cmodule__detail-label">Frames</span>
          <strong>{selectedEpisode.frames.length}</strong>
        </div>
      </div>
      {selectedEpisode.scales.length > 0 && (
        <div className="nilo-cmodule__detail-scales">
          <p className="nilo-cmodule__detail-label">Escalas de dolor</p>
          <ul className="nilo-cmodule__scale-list">
            {selectedEpisode.scales.map((scale) => (
              <li key={scale.id} className="nilo-cmodule__scale-item">
                <strong>{scale.scaleName}</strong>
                <span>
                  {formatPainScaleValue(scale.value, findPainScaleDefinition(scale.scaleId)?.step ?? 1)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="nilo-cmodule__detail-note">
        Revisión detallada del episodio (landmarks, reproducción, etc.) pendiente de API.
      </p>
    </>
  ) : null

  const detailFooter = selectedEpisode ? (
    <>
      <button
        type="button"
        className="nilo-cmodule__action-btn nilo-cmodule__action-btn--secondary"
        onClick={() => toast.info('Edición del episodio pendiente de API.')}
      >
        <MaterialIcon name="edit" size={18} />
        Editar
      </button>
      <button
        type="button"
        className="nilo-cmodule__action-btn nilo-cmodule__action-btn--danger"
        onClick={() => setConfirmDeleteId(selectedEpisode.id)}
      >
        <MaterialIcon name="delete" size={18} />
        Eliminar
      </button>
    </>
  ) : null

  return (
    <>
      <CondataModuleLayout
        view={view}
        searchQuery={query}
        onSearchChange={setQuery}
        searchPlaceholder="Buscar episodios…"
        addLabel="Nuevo episodio"
        onAdd={() => onViewChange('add')}
        listContent={listContent}
        addContent={
          <PainEpisodeCapturePanel
            patientId={patientId}
            summaryBackSignal={summaryBackSignal}
            onPhaseChange={onCapturePhaseChange}
            onComplete={(session) => {
              onEpisodeCreated(sessionToEpisode(session))
              onCapturePhaseChange?.('capture')
              onViewChange('list')
            }}
          />
        }
        detailContent={detailContent}
        detailFooter={detailFooter}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Eliminar episodio"
        message="¿Seguro que quieres eliminar este episodio de dolor? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        tone="danger"
        onConfirm={() => {
          if (confirmDeleteId) {
            onEpisodeDelete(confirmDeleteId)
            setConfirmDeleteId(null)
            onViewChange('list')
            toast.success('Episodio eliminado.')
          }
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  )
}
