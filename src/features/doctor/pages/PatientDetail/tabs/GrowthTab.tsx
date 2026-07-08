import { MaterialIcon } from '@/components/ui/MaterialIcon'

export function GrowthTab() {
  return (
    <div className="nilo-pdetail-tab nilo-pdetail-tab--empty">
      <MaterialIcon name="straighten" size={40} />
      <h2>Crecimiento</h2>
      <p>Aún no hay mediciones registradas. Pulsa «Añadir registro» para añadir una medición.</p>
    </div>
  )
}
