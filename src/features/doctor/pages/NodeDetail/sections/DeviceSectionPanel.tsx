import { useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import type { NodeSectionConfig } from '../node-sections'

type SearchState = 'idle' | 'searching' | 'done'

interface DeviceSectionPanelProps {
  section: NodeSectionConfig
}

/**
 * Panel reutilizable para dispositivos gestionados remotamente por el nodo.
 * «Search» enviará una petición al servidor → WebSocket al nodo (pendiente de API).
 */
export function DeviceSectionPanel({ section }: DeviceSectionPanelProps) {
  const [searchState, setSearchState] = useState<SearchState>('idle')

  function handleSearch() {
    setSearchState('searching')
    toast.info(`Búsqueda solicitada al nodo (${section.commandKey ?? section.id}). Pendiente de API.`)

    window.setTimeout(() => {
      setSearchState('done')
    }, 1200)
  }

  return (
    <div className="nilo-ndetail-section nilo-ndetail-section--devices">
      <div className="nilo-ndetail-section__intro">
        <MaterialIcon name={section.icon} size={32} />
        <div>
          <h2>{section.label}</h2>
          <p>{section.description}</p>
        </div>
      </div>

      <div className="nilo-ndetail-status">
        <div className="nilo-ndetail-status__indicator" aria-hidden="true" />
        <div>
          <p className="nilo-ndetail-status__label">Estado en tiempo real</p>
          <p className="nilo-ndetail-status__value">
            {searchState === 'searching'
              ? 'Consultando al nodo…'
              : searchState === 'done'
                ? 'Sin dispositivos detectados'
                : 'Pulsa Search para consultar al nodo'}
          </p>
        </div>
      </div>

      <div className="nilo-ndetail-devices">
        <div className="nilo-ndetail-devices__head">
          <h3>Dispositivos</h3>
          <div className="nilo-ndetail-devices__actions">
            <button
              type="button"
              className="nilo-ndetail__btn nilo-ndetail__btn--search"
              onClick={handleSearch}
              disabled={searchState === 'searching'}
            >
              <MaterialIcon name={searchState === 'searching' ? 'progress_activity' : 'search'} size={18} />
              <span>{searchState === 'searching' ? 'Searching…' : 'Search'}</span>
            </button>
            <button
              type="button"
              className="nilo-ndetail__btn nilo-ndetail__btn--ghost"
              onClick={() => toast.info('Añadir dispositivo: pendiente de API.')}
            >
              <MaterialIcon name="add" size={18} />
              <span>Añadir</span>
            </button>
            <button
              type="button"
              className="nilo-ndetail__btn nilo-ndetail__btn--ghost"
              onClick={() => toast.info('Gestión de dispositivos: pendiente de API.')}
            >
              <MaterialIcon name="tune" size={18} />
              <span>Gestionar</span>
            </button>
          </div>
        </div>

        <div className="nilo-ndetail-devices__list">
          {searchState === 'idle' ? (
            <p className="nilo-ndetail-devices__empty">
              No se ha buscado todavía. El nodo reportará los dispositivos conectados al pulsar Search.
            </p>
          ) : searchState === 'searching' ? (
            <p className="nilo-ndetail-devices__empty nilo-ndetail-devices__empty--loading">
              Enviando orden al servidor → WebSocket al nodo…
            </p>
          ) : (
            <p className="nilo-ndetail-devices__empty">
              La búsqueda no devolvió dispositivos. Vuelve a pulsar Search cuando el nodo esté en línea.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
