import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface LiveTabProps {
  embedded?: boolean
}

export function LiveTab({ embedded = false }: LiveTabProps) {
  return (
    <div className={`nilo-pdetail-tab nilo-pdetail-tab--live${embedded ? ' nilo-pdetail-tab--embedded' : ''}`}>
      <div className="nilo-pdetail-tab__live-pulse" aria-hidden="true" />
      <MaterialIcon name="monitor_heart" size={40} />
      <h2>Live</h2>
      <p>Monitorización en tiempo real y alertas activas. Contenido pendiente de definir.</p>
    </div>
  )
}
