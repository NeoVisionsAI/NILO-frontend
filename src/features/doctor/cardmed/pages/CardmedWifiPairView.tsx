import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { ROOT_PATHS } from '@/router/paths'
import type { useCardmedWifiConnection } from '../hooks/useCardmedWifiConnection'
import { CARDMED_WIFI_AP_PREFIX, CARDMED_WIFI_API_BASE } from '../wifi/constants'
import './CardmedDevicePage.css'
import './CardmedWifiProvisionPage.css'

interface CardmedWifiPairViewProps {
  conn: ReturnType<typeof useCardmedWifiConnection>
  onConnected: () => void
}

export function CardmedWifiPairView({ conn, onConnected }: CardmedWifiPairViewProps) {
  const [apSuffix, setApSuffix] = useState('')
  const [checking, setChecking] = useState(false)

  const apHint = apSuffix.trim()
    ? `${CARDMED_WIFI_AP_PREFIX}${apSuffix.trim().toLowerCase()}`
    : `${CARDMED_WIFI_AP_PREFIX}xxxx`

  async function handleCheckConnection() {
    setChecking(true)
    try {
      const ok = await conn.checkConnection()
      if (ok) {
        toast.success('Dispositivo detectado.')
        onConnected()
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="nilo-cardmed nilo-cardmed-wifi">
      <header className="nilo-cardmed__header">
        <Link to={ROOT_PATHS.doctor} className="nilo-cardmed__back">
          <MaterialIcon name="arrow_back" size={20} />
          <span>Volver</span>
        </Link>
        <div className="nilo-cardmed__header-main">
          <h1>Emparejar con Nilocardmed</h1>
          <p>Conecta la tablet al punto de acceso WiFi del dispositivo</p>
        </div>
      </header>

      {conn.lastError && conn.phase === 'unreachable' && (
        <div className="nilo-cardmed__alert nilo-cardmed__alert--error">{conn.lastError}</div>
      )}

      {(conn.phase === 'checking' || checking) && (
        <div className="nilo-cardmed-wifi__checking" role="status" aria-live="polite">
          <MaterialIcon name="sync" size={32} className="nilo-cardmed-wifi__spin" />
          <strong>Comprobando conexión…</strong>
          <p>{CARDMED_WIFI_API_BASE}/api/status</p>
        </div>
      )}

      {conn.phase === 'unreachable' && !checking && (
        <section className="nilo-cardmed-wifi__unreachable">
          <MaterialIcon name="wifi_off" size={48} />
          <h2>No se detectó el dispositivo</h2>
          <p>
            Conecta la tablet a <strong>{apHint}</strong> y vuelve a comprobar (timeout 8 s).
          </p>
          <div className="nilo-cardmed-wifi__actions">
            <button type="button" className="nilo-cardmed__primary" onClick={() => void handleCheckConnection()} disabled={checking}>
              Reintentar
            </button>
          </div>
        </section>
      )}

      {conn.phase === 'connected' && !checking && (
        <section className="nilo-cardmed-wifi__connected-banner">
          <MaterialIcon name="check_circle" size={24} />
          <div>
            <strong>Dispositivo detectado</strong>
            <p>{conn.deviceStatus?.device_name ?? conn.deviceStatus?.device ?? 'Nilocardmed'}</p>
          </div>
          <button type="button" className="nilo-cardmed__primary" onClick={onConnected}>
            Continuar
          </button>
        </section>
      )}

      {conn.phase === 'idle' && !checking && (
        <section className="nilo-cardmed-wifi__idle">
          <div className="nilo-cardmed__connect-hero">
            <div className="nilo-cardmed__connect-hero-icon" aria-hidden="true">
              <MaterialIcon name="wifi_tethering" size={32} />
            </div>
            <div className="nilo-cardmed__connect-hero-copy">
              <h2>Paso 1 — WiFi del Pi</h2>
              <p>
                Conecta la tablet a la red <strong>{apHint}</strong> (xxxx = últimos 4 hex de la MAC; visible en
                la lista WiFi del dispositivo).
              </p>
              <p className="nilo-cardmed__connect-note">
                Vuelve aquí y pulsa <strong>Comprobar conexión</strong>. Sin internet en el AP es normal.
              </p>
            </div>
            <div className="nilo-cardmed__connect-actions">
              <button
                type="button"
                className="nilo-cardmed__primary"
                onClick={() => void handleCheckConnection()}
                disabled={checking}
              >
                <MaterialIcon name="network_check" size={22} />
                Comprobar conexión
              </button>
            </div>
          </div>

          <div className="nilo-cardmed__connect-by-name">
            <h3>Sufijo del AP (opcional)</h3>
            <p>Últimos 4 caracteres hex de la MAC para ver el nombre exacto de la red.</p>
            <div className="nilo-cardmed__connect-by-name-row">
              <label className="nilo-cardmed__field nilo-cardmed__connect-by-name-field">
                Sufijo MAC
                <div className="nilo-cardmed__ble-name-input">
                  <span className="nilo-cardmed__ble-name-prefix">{CARDMED_WIFI_AP_PREFIX}</span>
                  <input
                    type="text"
                    value={apSuffix}
                    onChange={(e) => setApSuffix(e.target.value.replace(/[^a-fA-F0-9]/g, '').slice(0, 4))}
                    placeholder="a1b2"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={4}
                  />
                </div>
              </label>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
