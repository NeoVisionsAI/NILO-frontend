import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { ROOT_PATHS } from '@/router/paths'
import type { WifiNetwork } from '../ble/types'
import { CARDMED_WIFI_AP_PREFIX, CARDMED_WIFI_API_BASE } from '../wifi/constants'
import { cardmedWifiErrorMessage } from '../wifi/wifi-errors'
import { useCardmedWifiConnection } from '../hooks/useCardmedWifiConnection'
import './CardmedDevicePage.css'
import './CardmedWifiProvisionPage.css'

type ConfigTab = 'dashboard' | 'wifi' | 'cardmed' | 'system'

function JsonBlock({ data }: { data: unknown }) {
  return <pre className="nilo-cardmed__json m3-scroll">{JSON.stringify(data, null, 2)}</pre>
}

export function CardmedWifiProvisionPage() {
  const conn = useCardmedWifiConnection()
  const [tab, setTab] = useState<ConfigTab>('wifi')
  const [busy, setBusy] = useState(false)
  const [apSuffix, setApSuffix] = useState('')
  const [password, setPassword] = useState('')
  const [useIframePanel, setUseIframePanel] = useState(false)
  const [configDone, setConfigDone] = useState(false)

  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null)
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([])
  const [wifiStatus, setWifiStatus] = useState<Record<string, unknown> | null>(null)
  const [selectedSsid, setSelectedSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [cardmedConfig, setCardmedConfig] = useState<Record<string, unknown> | null>(null)
  const [systemInfo, setSystemInfo] = useState<Record<string, unknown> | null>(null)

  const [configForm, setConfigForm] = useState({
    site_id: '',
    device_label: '',
    location: '',
    operator_id: '',
  })

  const runChainRef = useRef(Promise.resolve())

  const run = useCallback(async (action: () => Promise<void>) => {
    const execute = async () => {
      setBusy(true)
      try {
        await action()
      } catch (err) {
        toast.error(cardmedWifiErrorMessage(err))
      } finally {
        setBusy(false)
      }
    }
    runChainRef.current = runChainRef.current.then(execute, execute)
    await runChainRef.current
  }, [])

  const apHint = apSuffix.trim() ? `${CARDMED_WIFI_AP_PREFIX}${apSuffix.trim().toLowerCase()}` : `${CARDMED_WIFI_AP_PREFIX}xxxx`

  async function handleCheckConnection() {
    const ok = await conn.checkConnection()
    if (ok) {
      toast.success('Dispositivo detectado en la red local.')
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return
    await run(async () => {
      await conn.authenticate(password.trim())
      toast.success('Sesión abierta con el Nilocardmed.')
      setTab('wifi')
    })
  }

  async function refreshDashboard() {
    await run(async () => {
      const health = await conn.runCommand('health_status')
      const battery = await conn.runCommand('battery_status')
      const wifi = await conn.runCommand('wifi_status', { check_connectivity: true })
      setDashboard({
        health: health.data,
        battery: battery.data,
        wifi: wifi.data,
      })
    })
  }

  async function handleWifiScan() {
    await run(async () => {
      toast.info('Escaneando WiFi (~60 s)…')
      const resp = await conn.runCommand<{ networks: WifiNetwork[] }>('wifi_scan')
      setWifiNetworks(resp.data?.networks ?? [])
      toast.success('Escaneo completado.')
    })
  }

  async function handleWifiConnect() {
    if (!selectedSsid) {
      toast.error('Selecciona una red WiFi.')
      return
    }
    await run(async () => {
      const resp = await conn.runCommand('wifi_connect', {
        ssid: selectedSsid,
        password: wifiPassword,
        persist: true,
      })
      setWifiStatus(resp.data as Record<string, unknown>)
      toast.success('WiFi del dispositivo configurado.')
    })
  }

  async function loadCardmedConfig() {
    await run(async () => {
      const resp = await conn.runCommand('cardmed_get')
      const data = (resp.data ?? {}) as Record<string, unknown>
      setCardmedConfig(data)
      setConfigForm({
        site_id: String(data.site_id ?? ''),
        device_label: String(data.device_label ?? ''),
        location: String(data.location ?? ''),
        operator_id: String(data.operator_id ?? ''),
      })
    })
  }

  async function saveCardmedConfig() {
    await run(async () => {
      const resp = await conn.runCommand('cardmed_configure', { ...configForm })
      setCardmedConfig(resp.data as Record<string, unknown>)
      toast.success('Configuración guardada.')
    })
  }

  async function loadSystem() {
    await run(async () => {
      const info = await conn.runCommand('system_info')
      const time = await conn.runCommand('time_get')
      setSystemInfo({ system: info.data, time: time.data })
    })
  }

  async function handlePing() {
    await run(async () => {
      const resp = await conn.runCommand('ping')
      toast.success(`Ping OK · v${(resp.data as { version?: string })?.version ?? '?'}`)
    })
  }

  const tabs: { id: ConfigTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Estado', icon: 'monitor_heart' },
    { id: 'wifi', label: 'WiFi', icon: 'wifi' },
    { id: 'cardmed', label: 'CardMed', icon: 'medical_information' },
    { id: 'system', label: 'Sistema', icon: 'memory' },
  ]

  const showConfigPanel = conn.isAuthenticated
  const showAuthForm = conn.isReachable && !conn.isAuthenticated && conn.phase !== 'checking'

  return (
    <div className="nilo-cardmed nilo-cardmed-wifi">
      <header className="nilo-cardmed__header">
        <Link to={ROOT_PATHS.doctor} className="nilo-cardmed__back">
          <MaterialIcon name="arrow_back" size={20} />
          <span>Volver</span>
        </Link>
        <div className="nilo-cardmed__header-main">
          <h1>Emparejar con Nilocardmed</h1>
          <p>
            {conn.isAuthenticated
              ? `Configurando · ${conn.deviceLabel ?? conn.deviceStatus?.device_name ?? 'Nilocardmed'}`
              : conn.isReachable
                ? `${conn.deviceLabel ?? 'Nilocardmed'} · red local (${CARDMED_WIFI_API_BASE})`
                : 'Aprovisionamiento vía WiFi del dispositivo'}
          </p>
        </div>
        {conn.phase !== 'idle' && (
          <button type="button" className="nilo-cardmed__back-list" onClick={conn.disconnect} disabled={busy}>
            <MaterialIcon name="restart_alt" size={18} />
            Reiniciar
          </button>
        )}
      </header>

      {conn.lastError && (conn.phase === 'unreachable' || conn.phase === 'error') && (
        <div className="nilo-cardmed__alert nilo-cardmed__alert--error">{conn.lastError}</div>
      )}

      {conn.phase === 'idle' && (
        <section className="nilo-cardmed-wifi__idle">
          <div className="nilo-cardmed__connect-hero">
            <div className="nilo-cardmed__connect-hero-icon" aria-hidden="true">
              <MaterialIcon name="wifi_tethering" size={32} />
            </div>
            <div className="nilo-cardmed__connect-hero-copy">
              <h2>Conectar al punto de acceso del Pi</h2>
              <p>
                Para configurar este Nilocardmed, conecta la tablet a la red WiFi{' '}
                <strong>{apHint}</strong> (xxxx = últimos 4 caracteres hex de la MAC; visible en la lista WiFi
                del dispositivo).
              </p>
              <p className="nilo-cardmed__connect-note">
                Luego vuelve a esta app y pulsa <strong>Comprobar conexión</strong>. No hace falta Bluetooth.
                Mientras estés en el AP no tendrás internet — es normal.
              </p>
            </div>
            <div className="nilo-cardmed__connect-actions">
              <button
                type="button"
                className="nilo-cardmed__primary"
                onClick={() => void handleCheckConnection()}
                disabled={busy}
              >
                <MaterialIcon name="network_check" size={22} />
                Comprobar conexión
              </button>
            </div>
          </div>

          <div className="nilo-cardmed__connect-by-name">
            <h3>Sufijo del AP (opcional)</h3>
            <p>Si conoces los últimos 4 hex de la MAC, escríbelos para ver el nombre exacto de la red.</p>
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

      {conn.phase === 'checking' && (
        <div className="nilo-cardmed-wifi__checking" role="status" aria-live="polite">
          <MaterialIcon name="sync" size={32} className="nilo-cardmed-wifi__spin" />
          <strong>Comprobando conexión…</strong>
          <p>Contactando con {CARDMED_WIFI_API_BASE}/api/status</p>
        </div>
      )}

      {conn.phase === 'unreachable' && (
        <section className="nilo-cardmed-wifi__unreachable">
          <MaterialIcon name="wifi_off" size={48} />
          <h2>No se detectó el dispositivo</h2>
          <p>
            Conecta la tablet a <strong>{apHint}</strong>, vuelve a Chrome y comprueba de nuevo. Timeout: 8 s.
          </p>
          <div className="nilo-cardmed-wifi__actions">
            <button type="button" className="nilo-cardmed__primary" onClick={() => void handleCheckConnection()} disabled={busy}>
              Reintentar
            </button>
            <button type="button" className="nilo-cardmed__secondary-scan" onClick={conn.resetUnreachable}>
              Ver instrucciones
            </button>
          </div>
        </section>
      )}

      {showAuthForm && (
        <section className="nilo-cardmed-wifi__auth">
          <div className="nilo-cardmed-wifi__auth-card">
            <MaterialIcon name="lock" size={28} />
            <h2>Autenticación</h2>
            <p>
              Dispositivo detectado: <strong>{conn.deviceStatus?.device_name ?? conn.deviceStatus?.device ?? 'Nilocardmed'}</strong>
              {conn.deviceStatus?.version ? ` · v${conn.deviceStatus.version}` : ''}
            </p>
            <form onSubmit={(e) => void handleAuth(e)}>
              <label className="nilo-cardmed__field">
                Contraseña del dispositivo
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="NILOCARDMED_CONNECTION_PASSWORD"
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <button type="submit" className="nilo-cardmed__primary" disabled={busy || !password.trim()}>
                <MaterialIcon name="login" size={18} />
                Iniciar sesión
              </button>
            </form>
          </div>
        </section>
      )}

      {conn.phase === 'authenticating' && (
        <div className="nilo-cardmed-wifi__checking" role="status">
          <MaterialIcon name="sync" size={32} className="nilo-cardmed-wifi__spin" />
          <strong>Autenticando…</strong>
        </div>
      )}

      {showConfigPanel && (
        <>
          {configDone ? (
            <section className="nilo-cardmed-wifi__done">
              <MaterialIcon name="check_circle" size={48} />
              <h2>Configuración guardada</h2>
              <p>
                Vuelve a la WiFi con internet (oficina / MiniPC) para seguir usando NILO. Fuera del AP no podrás
                alterar la configuración del dispositivo.
              </p>
              <button type="button" className="nilo-cardmed__primary" onClick={() => setConfigDone(false)}>
                Seguir configurando
              </button>
            </section>
          ) : (
            <>
              <div className="nilo-cardmed-wifi__toolbar">
                <label className="nilo-cardmed-wifi__iframe-toggle">
                  <input
                    type="checkbox"
                    checked={useIframePanel}
                    onChange={(e) => setUseIframePanel(e.target.checked)}
                  />
                  Panel web del Pi (iframe)
                </label>
                <button
                  type="button"
                  className="nilo-cardmed__secondary-scan"
                  onClick={() => setConfigDone(true)}
                >
                  Finalizar
                </button>
              </div>

              {useIframePanel ? (
                <iframe
                  className="nilo-cardmed-wifi__iframe"
                  src={`${CARDMED_WIFI_API_BASE}/`}
                  title="Configuración NiloCardmed"
                />
              ) : (
                <>
                  <nav className="nilo-cardmed__tabs" aria-label="Configuración Nilocardmed">
                    {tabs.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`nilo-cardmed__tab${tab === item.id ? ' nilo-cardmed__tab--active' : ''}`}
                        onClick={() => setTab(item.id)}
                      >
                        <MaterialIcon name={item.icon} size={18} />
                        {item.label}
                      </button>
                    ))}
                  </nav>

                  <div className="nilo-cardmed__panel m3-scroll">
                    {tab === 'dashboard' && (
                      <div className="nilo-cardmed__section">
                        <div className="nilo-cardmed__row">
                          <button type="button" onClick={() => void refreshDashboard()} disabled={busy || Boolean(conn.blockingCommand)}>
                            Actualizar
                          </button>
                          <button type="button" onClick={() => void handlePing()} disabled={busy || Boolean(conn.blockingCommand)}>
                            Ping
                          </button>
                        </div>
                        {dashboard ? <JsonBlock data={dashboard} /> : <p>Pulsa Actualizar para cargar el estado.</p>}
                      </div>
                    )}

                    {tab === 'wifi' && (
                      <div className="nilo-cardmed__section">
                        {conn.blockingCommand === 'wifi_scan' && (
                          <p className="nilo-cardmed__hint">Escaneo WiFi en curso… (~60 s)</p>
                        )}
                        <div className="nilo-cardmed__row">
                          <button type="button" onClick={() => void handleWifiScan()} disabled={busy || Boolean(conn.blockingCommand)}>
                            Escanear redes
                          </button>
                        </div>
                        <label className="nilo-cardmed__field">
                          Red destino (WiFi con internet para el Pi)
                          <select value={selectedSsid} onChange={(e) => setSelectedSsid(e.target.value)}>
                            <option value="">Seleccionar SSID…</option>
                            {wifiNetworks.map((net) => (
                              <option key={`${net.ssid}-${net.bssid ?? ''}`} value={net.ssid}>
                                {net.ssid} ({net.signal} dBm · {net.security ?? '?'})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="nilo-cardmed__field">
                          Contraseña WiFi
                          <input
                            type="password"
                            value={wifiPassword}
                            onChange={(e) => setWifiPassword(e.target.value)}
                            autoComplete="off"
                          />
                        </label>
                        <button type="button" className="nilo-cardmed__primary" onClick={() => void handleWifiConnect()} disabled={busy}>
                          Conectar WiFi del Pi
                        </button>
                        {wifiStatus && (
                          <>
                            <h3>Último resultado</h3>
                            <JsonBlock data={wifiStatus} />
                          </>
                        )}
                      </div>
                    )}

                    {tab === 'cardmed' && (
                      <div className="nilo-cardmed__section">
                        <div className="nilo-cardmed__row">
                          <button type="button" onClick={() => void loadCardmedConfig()} disabled={busy}>
                            Leer config
                          </button>
                        </div>
                        <label className="nilo-cardmed__field">
                          Site ID
                          <input value={configForm.site_id} onChange={(e) => setConfigForm((f) => ({ ...f, site_id: e.target.value }))} />
                        </label>
                        <label className="nilo-cardmed__field">
                          Etiqueta
                          <input value={configForm.device_label} onChange={(e) => setConfigForm((f) => ({ ...f, device_label: e.target.value }))} />
                        </label>
                        <label className="nilo-cardmed__field">
                          Ubicación
                          <input value={configForm.location} onChange={(e) => setConfigForm((f) => ({ ...f, location: e.target.value }))} />
                        </label>
                        <label className="nilo-cardmed__field">
                          Operador
                          <input value={configForm.operator_id} onChange={(e) => setConfigForm((f) => ({ ...f, operator_id: e.target.value }))} />
                        </label>
                        <button type="button" className="nilo-cardmed__primary" onClick={() => void saveCardmedConfig()} disabled={busy}>
                          Guardar configuración
                        </button>
                        {cardmedConfig && <JsonBlock data={cardmedConfig} />}
                      </div>
                    )}

                    {tab === 'system' && (
                      <div className="nilo-cardmed__section">
                        <button type="button" onClick={() => void loadSystem()} disabled={busy}>
                          Cargar sistema
                        </button>
                        {systemInfo && <JsonBlock data={systemInfo} />}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
