import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { CardmedConnectionPhase } from '../ble/types'
import './CardmedDeviceStatusBar.css'

interface CardmedDeviceStatusBarProps {
  phase: CardmedConnectionPhase
  busy: boolean
  bleSupported: boolean
  hasCachedDevice: boolean
  blockingCommand: string | null
  lastError: string | null
  onConnect: () => void
  onReconnect: () => void
  onDisconnect: () => void
  onUnpair: () => void
}

export function CardmedDeviceStatusBar({
  phase,
  busy,
  bleSupported,
  hasCachedDevice,
  blockingCommand,
  lastError,
  onConnect,
  onReconnect,
  onDisconnect,
  onUnpair,
}: CardmedDeviceStatusBarProps) {
  const isConnected = phase === 'connected'
  const isConnecting = phase === 'connecting' || phase === 'authenticating'
  const canReconnect = hasCachedDevice && (phase === 'disconnected' || phase === 'error')

  let statusClass = 'cardmed-status--disconnected'
  let statusLabel = 'Sin conexión BLE'
  let statusDetail = 'Pulsa Conectar para emparejar con el dispositivo.'

  if (isConnected) {
    statusClass = 'cardmed-status--connected'
    statusLabel = 'Emparejado y conectado'
    statusDetail = blockingCommand
      ? `Operación en curso: ${blockingCommand}…`
      : 'Conexión Bluetooth activa con el NiloCardmed.'
  } else if (isConnecting) {
    statusClass = 'cardmed-status--connecting'
    statusLabel = canReconnect ? 'Reconectando…' : 'Emparejando…'
    statusDetail = 'Estableciendo conexión Bluetooth.'
  } else if (phase === 'disconnected') {
    statusClass = 'cardmed-status--disconnected'
    statusLabel = 'Desconectado'
    statusDetail = lastError ?? 'La conexión se perdió. Pulsa Reconectar (no se reintenta solo).'
  } else if (phase === 'error') {
    statusClass = 'cardmed-status--disconnected'
    statusLabel = 'Error de conexión'
    statusDetail = lastError ?? 'No se pudo conectar.'
  }

  const connectHandler = canReconnect ? onReconnect : onConnect
  const connectLabel = isConnecting
    ? canReconnect
      ? 'Reconectando…'
      : 'Conectando…'
    : canReconnect
      ? 'Reconectar'
      : 'Conectar'

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
          <button type="button" className="cardmed-status__btn" onClick={onDisconnect} disabled={busy || Boolean(blockingCommand)}>
            <MaterialIcon name="bluetooth_disabled" size={18} />
            Desconectar
          </button>
        ) : (
          <button
            type="button"
            className="cardmed-status__btn cardmed-status__btn--primary"
            onClick={connectHandler}
            disabled={busy || !bleSupported || isConnecting}
          >
            <MaterialIcon name={isConnecting ? 'sync' : 'bluetooth_connected'} size={18} />
            {connectLabel}
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
