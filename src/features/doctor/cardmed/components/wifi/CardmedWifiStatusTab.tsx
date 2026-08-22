import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { CardmedDashboard } from '../../wifi/types'
import { buildDashboardStatusView, formatIsoDate } from './dashboard-utils'
import './CardmedWifiStatusTab.css'

interface CardmedWifiStatusTabProps {
  dashboard: CardmedDashboard | null
  busy: boolean
  error?: string | null
  onRefresh: () => void
}

function StatCard({
  icon,
  title,
  children,
  muted,
}: {
  icon: string
  title: string
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <article className={`wifi-stat-card${muted ? ' wifi-stat-card--muted' : ''}`}>
      <header className="wifi-stat-card__head">
        <MaterialIcon name={icon} size={20} />
        <h3>{title}</h3>
      </header>
      <div className="wifi-stat-card__body">{children}</div>
    </article>
  )
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="wifi-stat-card__label">{label}</span>{' '}
      <strong>{value}</strong>
    </p>
  )
}

export function CardmedWifiStatusTab({ dashboard, busy, error, onRefresh }: CardmedWifiStatusTabProps) {
  const view = buildDashboardStatusView(dashboard)
  const noData = !dashboard

  return (
    <div className="wifi-status-tab">
      <div className="wifi-status-tab__toolbar">
        <button type="button" className="nilo-cardmed__primary" onClick={onRefresh} disabled={busy}>
          <MaterialIcon name="refresh" size={18} />
          {busy ? 'Refrescando…' : 'Refrescar'}
        </button>
        {view.refreshedAt ? (
          <span className="wifi-status-tab__meta">Actualizado: {formatIsoDate(view.refreshedAt)}</span>
        ) : (
          <span className="wifi-status-tab__meta">Sin datos cargados — pulsa Refrescar</span>
        )}
      </div>

      {error && (
        <div className="nilo-cardmed__alert nilo-cardmed__alert--error wifi-status-tab__error" role="alert">
          {error}
        </div>
      )}

      {noData && !error && (
        <p className="nilo-cardmed__hint wifi-status-tab__hint">
          No se pudo cargar el panel todavía. Los campos muestran «—» hasta obtener datos del Pi.
        </p>
      )}

      <div className={`wifi-stat-grid${busy ? ' wifi-stat-grid--loading' : ''}`} aria-busy={busy}>
        <StatCard icon="wifi" title="WiFi" muted={noData}>
          <StatLine label="Activo" value={view.wifi.active} />
          <StatLine label="SSID" value={view.wifi.ssid} />
          <StatLine label="IP" value={view.wifi.ip} />
          <StatLine label="Señal" value={view.wifi.signal} />
          <StatLine label="Internet" value={view.wifi.internet} />
        </StatCard>

        <StatCard icon="battery_charging_full" title="Alimentación" muted={noData}>
          <StatLine label="Fuente" value={view.power.label} />
          <StatLine label="Nivel" value={view.power.percent} />
        </StatCard>

        <StatCard icon="schedule" title="Muestreo" muted={noData}>
          <StatLine label="Intervalo" value={view.sampling.interval} />
          <StatLine label="Estado" value={view.sampling.state} />
        </StatCard>

        <StatCard icon="photo_camera" title="Cámara" muted={noData}>
          <StatLine label="Conectada" value={view.camera.connected} />
          <StatLine label="Detectadas" value={view.camera.count} />
          <StatLine label="Guardada en Pi" value={view.camera.savedPresent} />
          <StatLine label="Dispositivo" value={view.camera.savedDevice} />
        </StatCard>

        <StatCard icon="history" title="Última config" muted={noData}>
          <StatLine label="Guardada" value={view.lastConfig} />
        </StatCard>

        <StatCard icon="collections" title="Capturas" muted={noData}>
          <StatLine label="Ciclos OK" value={view.captures.cyclesOk} />
          <StatLine label="Imágenes en disco" value={view.captures.imagesOnDisk} />
        </StatCard>
      </div>
    </div>
  )
}
