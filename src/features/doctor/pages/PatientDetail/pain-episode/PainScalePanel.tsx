import { useEffect, useMemo, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import {
  findPainScaleDefinition,
  formatPainScaleValue,
  PAIN_SCALE_DEFINITIONS,
  type RecordedPainScale,
} from './pain-scales'
import './PainScalePanel.css'

interface PainScalePanelProps {
  scales: RecordedPainScale[]
  onChange: (scales: RecordedPainScale[]) => void
}

function ScaleInfoTooltip({ text }: { text: string }) {
  return (
    <span className="nilo-pscale__info">
      <button type="button" className="nilo-pscale__info-btn" aria-label="Información de la escala">
        <MaterialIcon name="info" size={18} />
      </button>
      <span className="nilo-pscale__tooltip" role="tooltip">
        {text}
      </span>
    </span>
  )
}

export function PainScalePanel({ scales, onChange }: PainScalePanelProps) {
  const [selectedScaleId, setSelectedScaleId] = useState(PAIN_SCALE_DEFINITIONS[0]?.id ?? '')
  const [value, setValue] = useState(PAIN_SCALE_DEFINITIONS[0]?.min ?? 0)

  const selectedScale = useMemo(
    () => PAIN_SCALE_DEFINITIONS.find((scale) => scale.id === selectedScaleId) ?? PAIN_SCALE_DEFINITIONS[0],
    [selectedScaleId],
  )

  useEffect(() => {
    if (selectedScale) setValue(selectedScale.min)
  }, [selectedScale])

  if (!selectedScale) return null

  const step = selectedScale.step ?? 1

  function handleAddScale() {
    onChange([
      ...scales,
      {
        id: crypto.randomUUID(),
        scaleId: selectedScale.id,
        scaleName: selectedScale.name,
        value,
        timestamp: new Date().toISOString(),
      },
    ])
    toast.success('Escala añadida.')
  }

  function handleRemoveScale(id: string) {
    onChange(scales.filter((scale) => scale.id !== id))
  }

  return (
    <section className="nilo-pscale" aria-label="Escalas de dolor">
      <h3 className="nilo-pscale__title">Escalas de dolor</h3>

      <div className="nilo-pscale__field">
        <div className="nilo-pscale__label-row">
          <span className="nilo-pscale__label">Escala</span>
          <ScaleInfoTooltip text={selectedScale.description} />
        </div>
        <select
          className="nilo-pscale__select"
          value={selectedScaleId}
          onChange={(e) => setSelectedScaleId(e.target.value)}
        >
          {PAIN_SCALE_DEFINITIONS.map((scale) => (
            <option key={scale.id} value={scale.id}>
              {scale.name}
            </option>
          ))}
        </select>
      </div>

      <div className="nilo-pscale__slider-wrap">
        <div className="nilo-pscale__slider-meta">
          <span>
            Rango {selectedScale.min} – {selectedScale.max}
          </span>
          <span className="nilo-pscale__slider-value">{formatPainScaleValue(value, step)}</span>
        </div>
        <input
          type="range"
          className="nilo-pscale__slider"
          min={selectedScale.min}
          max={selectedScale.max}
          step={step}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-label={`Valor de ${selectedScale.name}`}
        />
      </div>

      <button type="button" className="nilo-pscale__add-btn" onClick={handleAddScale}>
        <MaterialIcon name="add" size={20} />
        Añadir escala
      </button>

      <div className="nilo-pscale__list">
        <p className="nilo-pscale__list-title">Registradas en esta sesión</p>
        {scales.length === 0 ? (
          <p className="nilo-pscale__empty">Aún no has añadido escalas a este episodio.</p>
        ) : (
          scales.map((scale) => (
            <div key={scale.id} className="nilo-pscale__item">
              <div className="nilo-pscale__item-text">
                <strong>{scale.scaleName}</strong>
                <span>Puntuación: {formatPainScaleValue(scale.value, findPainScaleDefinition(scale.scaleId)?.step ?? 1)}</span>
              </div>
              <button
                type="button"
                className="nilo-pscale__item-remove"
                onClick={() => handleRemoveScale(scale.id)}
                aria-label={`Quitar ${scale.scaleName}`}
              >
                <MaterialIcon name="close" size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
