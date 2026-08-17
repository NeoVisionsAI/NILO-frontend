import { useMemo, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { PainEpisodeCapturePanel } from '../../pain-episode/PainEpisodeModal'
import {
  formatPainEpisodeDate,
  formatPainEpisodeElapsed,
  type PainEpisode,
  type PainEpisodeSessionData,
} from '../../pain-episode/types'
import './PainEpisodeCondata.css'

export type PainEpisodeCondataView = 'list' | 'add' | 'detail'

interface PainEpisodeCondataProps {
  patientId: string
  patientName: string
  episodes: PainEpisode[]
  view: PainEpisodeCondataView
  selectedEpisodeId: string | null
  onViewChange: (view: PainEpisodeCondataView, episodeId?: string | null) => void
  onEpisodeCreated: (episode: PainEpisode) => void
}

function sessionToEpisode(session: PainEpisodeSessionData): PainEpisode {
  return {
    ...session,
    id: crypto.randomUUID(),
  }
}

export function PainEpisodeCondata({
  patientId,
  patientName,
  episodes,
  view,
  selectedEpisodeId,
  onViewChange,
  onEpisodeCreated,
}: PainEpisodeCondataProps) {
  const [query, setQuery] = useState('')

  const selectedEpisode = episodes.find((item) => item.id === selectedEpisodeId) ?? null

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

  if (view === 'add') {
    return (
      <PainEpisodeCapturePanel
        embedded
        patientId={patientId}
        patientName={patientName}
        onClose={() => onViewChange('list')}
        onComplete={(session) => {
          onEpisodeCreated(sessionToEpisode(session))
          onViewChange('list')
        }}
      />
    )
  }

  if (view === 'detail' && selectedEpisode) {
    return (
      <div className="nilo-condata-module">
        <div className="nilo-condata-module__detail">
          <div className="nilo-condata-module__detail-grid">
            <div>
              <span className="nilo-condata-module__detail-label">Inicio</span>
              <strong>{formatPainEpisodeDate(selectedEpisode.startedAt)}</strong>
            </div>
            <div>
              <span className="nilo-condata-module__detail-label">Fin</span>
              <strong>{formatPainEpisodeDate(selectedEpisode.endedAt)}</strong>
            </div>
            <div>
              <span className="nilo-condata-module__detail-label">Duración</span>
              <strong>{formatPainEpisodeElapsed(selectedEpisode.durationMs)}</strong>
            </div>
            <div>
              <span className="nilo-condata-module__detail-label">Frames</span>
              <strong>{selectedEpisode.frames.length}</strong>
            </div>
          </div>
          <p className="nilo-condata-module__detail-note">
            Revisión detallada del episodio (landmarks, reproducción, etc.) pendiente de API.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="nilo-condata-module">
      <div className="nilo-condata-module__toolbar">
        <label className="nilo-condata-module__search">
          <MaterialIcon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar episodios…"
          />
          {query && (
            <button type="button" className="nilo-condata-module__search-clear" onClick={() => setQuery('')}>
              <MaterialIcon name="close" size={16} />
            </button>
          )}
        </label>

        <button
          type="button"
          className="nilo-condata-module__add-btn"
          onClick={() => onViewChange('add')}
        >
          <MaterialIcon name="add" size={20} />
          <span>Nuevo episodio</span>
        </button>
      </div>

      <div className="nilo-condata-module__list m3-scroll">
        {filtered.length === 0 ? (
          <div className="nilo-condata-module__empty">
            <MaterialIcon name="sick" size={40} />
            <p>{episodes.length === 0 ? 'No hay episodios de dolor registrados.' : 'Ningún episodio coincide con la búsqueda.'}</p>
            {episodes.length === 0 && (
              <button type="button" className="nilo-condata-module__add-btn" onClick={() => onViewChange('add')}>
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
              className="nilo-condata-module__item"
              onClick={() => onViewChange('detail', episode.id)}
            >
              <span className="nilo-condata-module__item-icon">
                <MaterialIcon name="sick" size={22} />
              </span>
              <span className="nilo-condata-module__item-text">
                <strong>{formatPainEpisodeDate(episode.startedAt)}</strong>
                <span>
                  {formatPainEpisodeElapsed(episode.durationMs)} · {episode.frames.length} frames
                </span>
              </span>
              <MaterialIcon name="chevron_right" size={22} className="nilo-condata-module__item-chevron" />
            </button>
          ))
        )}
      </div>
    </div>
  )
}
