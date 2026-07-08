import { MaterialIcon } from '@/components/ui/MaterialIcon'

export function ClinicalResultsTab() {
  return (
    <div className="nilo-pdetail-tab nilo-pdetail-tab--empty">
      <MaterialIcon name="biotech" size={40} />
      <h2>Resultados clínicos</h2>
      <p>Aún no hay resultados registrados. Pulsa «Añadir registro» para crear una entrada.</p>
    </div>
  )
}
