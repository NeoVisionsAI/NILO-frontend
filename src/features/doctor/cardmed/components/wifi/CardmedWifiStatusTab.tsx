import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { CardmedDashboard } from '../../wifi/types'
import { formatDashboardPower, formatIsoDate } from './dashboard-utils'
import './CardmedWifiStatusTab.css'

interface CardmedWifiStatusTabProps {
  dashboard: CardmedDashboard | null
  busy: boolean
  onRefresh: () => void
}

function StatCard({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children: React.ReactNode
}) {
  return (
    <article className="wifi-stat-card">
      <header className="wifi-stat-card__head">
        <MaterialIcon name={icon} size={20} />
        <h3>{title}</h3>
      </header>
      <div className="wifi-stat-card__body">{children}</div>
    </article>
  )
}

export function CardmedWifiStatusTab({ dashboard, busy, onRefresh }: CardmedWifiStatusTabProps) {
  const power = formatDashboardPower(dashboard?.power)
  const wifi = dashboard?.wifi
  const camera = dashboard?.camera
  const sampling = dashboard?.sampling
  const captures = dashboard?.captures

  return (
    <div className="wifi-status-tab">
      <div className="wifi-status-tab__toolbar">
        <button type="button" className="nilo-cardmed__primary" onClick={onRefresh} disabled={busy}>
          <MaterialIcon name="refresh" size={18} />
          Refrescar
        </button>
        {dashboard?.refreshed_at && (
          <span className="wifi-status-tab__meta">Actualizado: {formatIsoDate(dashboard.refreshed_at)}</span>
        )}
      </div>

      {!dashboard ? (
        <p className="nilo-cardmed__hint">Pulsa Refrescar para cargar el estado del dispositivo.</p>
      ) : (
        <div className="wifi-stat-grid">
          <StatCard icon="wifi" title="WiFi">
            {wifi?.connected ? (
              <>
                <p><strong>{wifi.ssid ?? 'Conectada'}</strong></p>
                <p>{wifi.ip_address ?? '—'}</p>
                <p>{wifi.signal != null ? `${wifi.signal} dBm` : '—'}</p>
                <p>{wifi.connectivity_ok ? 'Internet OK' : 'Sin internet'}</p>
              </>
            ) : (
              <p>Sin conexión WiFi configurada</p>
            )}
          </StatCard>

          <StatCard icon="battery_charging_full" title="Alimentación">
            <p><strong>{power.label}</strong></p>
            <p>{power.percent}</p>
          </StatCard>

          <StatCard icon="schedule" title="Muestreo">
            <p>
              Intervalo:{' '}
              <strong>
                {sampling?.interval_seconds != null ? `${sampling.interval_seconds} s` : '—'}
              </strong>
            </p>
            <p>{sampling?.enabled ? 'Activo' : 'Inactivo'}</p>
          </StatCard>

          <StatCard icon="photo_camera" title="Cámara">
            <p>{camera?.connected ? 'Conectada' : 'No detectada'}</p>
            <p>
              {camera?.cameras_count ?? 0} detectada(s)
              {camera?.saved_device_present ? ' · guardada OK' : camera?.saved_device ? ' · guardada ausente' : ''}
            </p>
            {camera?.saved_device && <p className="wifi-stat-card__mono">{camera.saved_device}</p>}
          </StatCard>

          <StatCard icon="history" title="Última config">
            <p>{formatIsoDate(dashboard.config_last_saved_at)}</p>
          </StatCard>

          <StatCard icon="collections" title="Capturas">
            <p>
              <strong>{captures?.cycles_successful ?? 0}</strong> ciclos OK
            </p>
            {captures?.images_on_disk != null && <p>{captures.images_on_disk} imágenes en disco</p>}
          </StatCard>
        </div>
      )}
    </div>
  )
}
