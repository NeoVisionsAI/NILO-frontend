import './SummaryPage.css'

/**
 * Vista "Summary" (Contenedor B por defecto).
 *
 * Contenedor muy versátil: aquí se mostrará toda la información. Cuando no hay
 * ningún elemento seleccionado, mostrará un resumen del uso de la plataforma.
 * De momento se deja vacío (a la espera de definir el contenido del resumen).
 */
export function SummaryPage() {
  return (
    <div className="nilo-summary">
      {/* Fondo de puntos sutil (tema "precisión médica") */}
      <h1>Summary</h1>
      <div className="nilo-summary__dots" aria-hidden="true" >
        
      </div>
    </div>
  )
}
