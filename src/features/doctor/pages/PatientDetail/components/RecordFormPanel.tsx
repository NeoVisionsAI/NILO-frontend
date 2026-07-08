import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { PatientSectionConfig } from '../medical-sections'

interface RecordFormPanelProps {
  section: PatientSectionConfig
  onClose: () => void
}

/**
 * Placeholder del formulario de alta.
 * `section.recordKey` enlazará con el componente/API concreto más adelante.
 */
export function RecordFormPanel({ section, onClose }: RecordFormPanelProps) {
  return (
    <div className="nilo-pdetail-form">
      <div className="nilo-pdetail-form__head">
        <div>
          <p className="nilo-pdetail-form__eyebrow">Añadir registro</p>
          <h2 className="nilo-pdetail-form__title">{section.label}</h2>
          {section.recordKey && (
            <p className="nilo-pdetail-form__meta">
              Tipo: <code>{section.recordKey}</code>
            </p>
          )}
        </div>
        <button type="button" className="nilo-pdetail-form__close" onClick={onClose} aria-label="Cerrar formulario">
          <MaterialIcon name="close" size={22} />
        </button>
      </div>

      <div className="nilo-pdetail-form__body">
        <MaterialIcon name="edit_note" size={36} />
        <p>Formulario pendiente de definir para esta sección.</p>
        <span className="nilo-pdetail-form__hint">
          El backend indicará qué campos mostrar según el tipo de paciente y el tipo de registro.
        </span>
      </div>
    </div>
  )
}
