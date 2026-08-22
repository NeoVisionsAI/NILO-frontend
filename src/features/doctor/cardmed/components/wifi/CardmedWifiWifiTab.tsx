import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { WifiNetwork } from '../../ble/types'
import './CardmedWifiWifiTab.css'

interface CardmedWifiWifiTabProps {
  busy: boolean
  scanning: boolean
  scanPending: boolean
  scanMode: string | null
  networks: WifiNetwork[]
  selectedSsid: string
  wifiPassword: string
  lastResult: Record<string, unknown> | null
  onScan: () => void
  onSsidChange: (ssid: string) => void
  onPasswordChange: (password: string) => void
  onConnect: () => void
}

export function CardmedWifiWifiTab({
  busy,
  scanning,
  scanPending,
  scanMode,
  networks,
  selectedSsid,
  wifiPassword,
  lastResult,
  onScan,
  onSsidChange,
  onPasswordChange,
  onConnect,
}: CardmedWifiWifiTabProps) {
  const scanActive = scanning || scanPending
  const showEmpty = !scanActive && networks.length === 0

  return (
    <div className="wifi-config-tab">
      <div className="wifi-config-tab__toolbar">
        <button type="button" onClick={onScan} disabled={busy || scanActive}>
          <MaterialIcon name="wifi_find" size={18} />
          {scanActive ? 'Escaneando…' : 'Escanear redes'}
        </button>
        {scanMode && <span className="wifi-status-tab__meta">{scanMode}</span>}
      </div>

      {scanActive && (
        <p className="nilo-cardmed__hint">El rescan en el Pi puede tardar unos segundos. Espera antes de concluir que no hay redes.</p>
      )}

      {showEmpty && (
        <p className="nilo-cardmed__hint">Pulsa «Escanear redes» para listar WiFi disponibles cerca del dispositivo.</p>
      )}

      <div className="wifi-config-tab__grid">
        <label className="wifi-config-tab__field">
          <span>SSID</span>
          <select value={selectedSsid} onChange={(e) => onSsidChange(e.target.value)} disabled={busy}>
            <option value="">Seleccionar…</option>
            {networks.map((net) => (
              <option key={`${net.ssid}-${net.bssid ?? ''}`} value={net.ssid}>
                {net.ssid} ({net.signal} dBm)
              </option>
            ))}
          </select>
        </label>

        <label className="wifi-config-tab__field">
          <span>Contraseña</span>
          <input
            type="password"
            value={wifiPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            autoComplete="off"
            disabled={busy}
          />
        </label>

        <button type="button" className="nilo-cardmed__primary wifi-config-tab__connect" onClick={onConnect} disabled={busy || !selectedSsid}>
          Conectar
        </button>
      </div>

      {lastResult && (
        <pre className="nilo-cardmed__json m3-scroll">{JSON.stringify(lastResult, null, 2)}</pre>
      )}
    </div>
  )
}
