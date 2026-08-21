import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { CardmedConnectionPhase } from '../ble/types'
import './CardmedDeviceStatusBar.css'

interface CardmedDeviceStatusBarProps {
  phase: CardmedConnectionPhase
  busy: boolean
  bleSupported: boolean
  onConnect: () => void
  onDisconnect: () => void
  onUnpair: () => void
}

export function CardmedDeviceStatusBar({
  phase,
  busy,
  bleSupported,
  onConnect,
  onDisconnect,
  onUnpair,
}: CardmedDeviceStatusBarProps) {
  const isConnected = phase === 'connected'
  const isConnecting = phase === 'connecting' || phase === 'authenticating'

  let statusClass = 'cardmed-status--disconnected'
  let statusLabel = 'Sin conexión BLE'
  let statusDetail = 'Pulsa Conectar para emparejar con el dispositivo.'

  if (isConnected) {
    statusClass = 'cardmed-status--connected'
    statusLabel = 'Emparejado y conectado'
    statusDetail = 'Conexión Bluetooth activa con el NiloCardmed.'
  } else if (isConnecting) {
    statusClass = 'cardmed-status--connecting'
    statusLabel = 'Emparejando…'
    statusDetail = 'Estableciendo conexión Bluetooth.'
  } else if (phase === 'error') {
    statusClass = 'cardmed-status--disconnected'
    statusLabel = 'Error de conexión'
    statusDetail = 'No se pudo conectar. Inténtalo de nuevo.'
  }

  return (
    <div className={`cardmed-status ${statusClass}`} role="status" aria-live="polite">
      <div className="cardmed-status__indicator" aria-hidden="true">
        <span className="cardmed-status__dot" />
      </div>

      <div className="cardmed-status__text">
        <strong>{statusLabel}</strong>
        <p>{statusDetail}</p>
      </div>

      <div className="cardmed-status__actions">
        {isConnected ? (
          <button type="button" className="cardmed-status__btn" onClick={onDisconnect} disabled={busy}>
            <MaterialIcon name="bluetooth_disabled" size={18} />
            Desconectar
          </button>
        ) : (
          <button
            type="button"
            className="cardmed-status__btn cardmed-status__btn--primary"
            onClick={onConnect}
            disabled={busy || !bleSupported || isConnecting}
          >
            <MaterialIcon name={isConnecting ? 'sync' : 'bluetooth_connected'} size={18} />
            {isConnecting ? 'Conectando…' : 'Conectar'}
          </button>
        )}
        <button
          type="button"
          className="cardmed-status__btn cardmed-status__btn--danger"
          onClick={onUnpair}
          disabled={busy || isConnecting}
        >
          <MaterialIcon name="link_off" size={18} />
          Desemparejar
        </button>
      </div>
    </div>
  )
}
