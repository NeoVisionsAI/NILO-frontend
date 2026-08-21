import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { ROOT_PATHS } from '@/router/paths'
import { CARDMED_TIMEOUTS } from '../ble/constants'
import { blobToObjectUrl, chunksToBlob } from '../ble/camera-utils'
import type { CameraDevice, SavedCardmedDevice, WifiNetwork } from '../ble/types'
import { isWebBluetoothSupported, removeSavedDevice } from '../ble/web-bluetooth'
import { useCardmedConnection } from '../hooks/useCardmedConnection'
import './CardmedDevicePage.css'

type CardmedTab = 'dashboard' | 'wifi' | 'camera' | 'cardmed' | 'sampling' | 'system'

interface PasswordTarget {
  kind: 'scan' | 'saved'
  device?: BluetoothDevice
  saved?: SavedCardmedDevice
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="nilo-cardmed__json m3-scroll">{JSON.stringify(data, null, 2)}</pre>
  )
}

export function CardmedDevicePage() {
  const conn = useCardmedConnection()
  const [tab, setTab] = useState<CardmedTab>('dashboard')
  const [busy, setBusy] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState<PasswordTarget | null>(null)
  const [password, setPassword] = useState('')

  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null)
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([])
  const [wifiStatus, setWifiStatus] = useState<Record<string, unknown> | null>(null)
  const [selectedSsid, setSelectedSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [captureUrl, setCaptureUrl] = useState<string | null>(null)
  const [cardmedConfig, setCardmedConfig] = useState<Record<string, unknown> | null>(null)
  const [samplingConfig, setSamplingConfig] = useState<Record<string, unknown> | null>(null)
  const [systemInfo, setSystemInfo] = useState<Record<string, unknown> | null>(null)
  const [commands, setCommands] = useState<string[]>([])

  const [configForm, setConfigForm] = useState({
    site_id: '',
    device_label: '',
    location: '',
    operator_id: '',
  })
  const [intervalSeconds, setIntervalSeconds] = useState('120')
  const [monitorStart, setMonitorStart] = useState('')
  const [monitorEnd, setMonitorEnd] = useState('-1')

  const bleSupported = useMemo(() => isWebBluetoothSupported(), [])

  useEffect(() => {
    return () => {
      if (captureUrl) URL.revokeObjectURL(captureUrl)
    }
  }, [captureUrl])

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true)
      try {
        await action()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error en el dispositivo'
        if (msg === 'unauthorized' || msg === 'privileged_auth_required') {
          toast.error('Sesión expirada. Vuelve a conectar con contraseña.')
          conn.disconnect()
        } else {
          toast.error(msg)
        }
      } finally {
        setBusy(false)
      }
    },
    [conn],
  )

  const refreshDashboard = useCallback(async () => {
    await run(async () => {
      const [health, battery, wifi, storage] = await Promise.all([
        conn.runCommand('health_status'),
        conn.runCommand('battery_status'),
        conn.runCommand('wifi_status', { check_connectivity: true }),
        conn.runCommand('storage_status'),
      ])
      setDashboard({
        health: health.data,
        battery: battery.data,
        wifi: wifi.data,
        storage: storage.data,
      })
    })
  }, [conn, run])

  useEffect(() => {
    if (conn.phase === 'connected') {
      void refreshDashboard()
    }
  }, [conn.phase, refreshDashboard])

  async function handleScan() {
    await run(async () => {
      const device = await conn.scanDevice()
      setPasswordTarget({ kind: 'scan', device })
      setPassword('')
      toast.success(`Dispositivo «${device.name}» detectado. Introduce la contraseña.`)
    })
  }

  function openSavedConnect(saved: SavedCardmedDevice) {
    setPasswordTarget({ kind: 'saved', saved })
    setPassword('')
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordTarget || !password.trim()) return

    await run(async () => {
      if (passwordTarget.kind === 'scan' && passwordTarget.device) {
        await conn.connect(passwordTarget.device, password.trim())
      } else if (passwordTarget.kind === 'saved' && passwordTarget.saved) {
        await conn.connectBySavedName(passwordTarget.saved, password.trim())
      }
      setPasswordTarget(null)
      setPassword('')
      toast.success('Dispositivo conectado.')
      setTab('dashboard')
    })
  }

  async function handleWifiScan() {
    await run(async () => {
      const resp = await conn.runCommand<{ networks: WifiNetwork[] }>(
        'wifi_scan',
        {},
        CARDMED_TIMEOUTS.wifiScan,
      )
      setWifiNetworks(resp.data?.networks ?? [])
    })
  }

  async function handleWifiConnect() {
    if (!selectedSsid) {
      toast.error('Selecciona una red WiFi.')
      return
    }
    await run(async () => {
      const resp = await conn.runCommand(
        'wifi_connect',
        { ssid: selectedSsid, password: wifiPassword, persist: true },
        CARDMED_TIMEOUTS.wifiConnect,
      )
      setWifiStatus(resp.data as Record<string, unknown>)
      toast.success('WiFi configurado.')
      await refreshDashboard()
    })
  }

  async function handleWifiDisconnect() {
    await run(async () => {
      await conn.runCommand('wifi_disconnect')
      toast.success('WiFi desconectado.')
      await refreshDashboard()
    })
  }

  async function handleWifiTest() {
    await run(async () => {
      const resp = await conn.runCommand('wifi_test', {}, CARDMED_TIMEOUTS.wifiConnect)
      toast.info(JSON.stringify(resp.data))
    })
  }

  async function handleCameraList() {
    await run(async () => {
      const resp = await conn.runCommand<{ cameras: CameraDevice[] }>('camera_list')
      const list = resp.data?.cameras ?? []
      setCameras(list)
      if (list[0]) setSelectedCamera(list[0].path)
    })
  }

  async function handleCapture() {
    if (!selectedCamera) {
      toast.error('Selecciona una cámara.')
      return
    }
    await run(async () => {
      const meta = await conn.runCommand<{
        capture_id: string
        total_chunks: number
        mode: string
      }>('camera_capture_test', { device: selectedCamera, mode: 'chunked' }, CARDMED_TIMEOUTS.imageDownload)

      const captureId = meta.data?.capture_id
      const total = meta.data?.total_chunks ?? 0
      if (!captureId || total <= 0) throw new Error('Captura inválida.')

      const chunks = []
      for (let index = 0; index < total; index += 1) {
        const chunk = await conn.runCommand(
          'camera_capture_chunk',
          { capture_id: captureId, index },
          CARDMED_TIMEOUTS.imageDownload,
        )
        chunks.push(chunk)
      }

      const blob = chunksToBlob(chunks)
      if (captureUrl) URL.revokeObjectURL(captureUrl)
      setCaptureUrl(blobToObjectUrl(blob))
      toast.success('Imagen capturada.')
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
      toast.success('Configuración CardMed guardada.')
    })
  }

  async function testCardmed() {
    await run(async () => {
      const resp = await conn.runCommand('cardmed_test', {}, CARDMED_TIMEOUTS.wifiConnect)
      toast.info('Prueba CardMed completada.')
      setCardmedConfig((prev) => ({ ...prev, last_test: resp.data }))
    })
  }

  async function loadSampling() {
    await run(async () => {
      const resp = await conn.runCommand('sampling_get')
      setSamplingConfig(resp.data as Record<string, unknown>)
    })
  }

  async function saveSamplingInterval() {
    await run(async () => {
      const resp = await conn.runCommand('sampling_set_interval', {
        interval_seconds: Number(intervalSeconds),
      })
      setSamplingConfig(resp.data as Record<string, unknown>)
      toast.success('Intervalo actualizado.')
    })
  }

  async function saveSamplingWindow() {
    await run(async () => {
      const resp = await conn.runCommand('sampling_set_window', {
        monitor_start: monitorStart ? Number(monitorStart) : 0,
        monitor_end: Number(monitorEnd),
      })
      setSamplingConfig(resp.data as Record<string, unknown>)
      toast.success('Ventana de monitorización actualizada.')
    })
  }

  async function loadSystem() {
    await run(async () => {
      const [info, time, events, history, list] = await Promise.all([
        conn.runCommand('system_info'),
        conn.runCommand('time_get'),
        conn.runCommand('events_list'),
        conn.runCommand('sampler_history'),
        conn.runCommand<{ commands: string[] }>('commands_list'),
      ])
      setSystemInfo({
        system: info.data,
        time: time.data,
        events: events.data,
        history: history.data,
      })
      setCommands(list.data?.commands ?? [])
    })
  }

  async function syncTime() {
    await run(async () => {
      const now = Math.floor(Date.now() / 1000)
      await conn.runCommand('time_sync', { unix_time: now })
      toast.success('Hora sincronizada.')
      await loadSystem()
    })
  }

  async function handlePing() {
    await run(async () => {
      const resp = await conn.runCommand('ping')
      toast.success(`Ping OK · v${(resp.data as { version?: string })?.version ?? '?'}`)
    })
  }

  const tabs: { id: CardmedTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Estado', icon: 'monitor_heart' },
    { id: 'wifi', label: 'WiFi', icon: 'wifi' },
    { id: 'camera', label: 'Cámara', icon: 'photo_camera' },
    { id: 'cardmed', label: 'CardMed', icon: 'medical_information' },
    { id: 'sampling', label: 'Muestreo', icon: 'schedule' },
    { id: 'system', label: 'Sistema', icon: 'memory' },
  ]

  return (
    <div className="nilo-cardmed">
      <header className="nilo-cardmed__header">
        <Link to={ROOT_PATHS.doctor} className="nilo-cardmed__back">
          <MaterialIcon name="arrow_back" size={20} />
          <span>Volver</span>
        </Link>
        <div className="nilo-cardmed__header-main">
          <h1>Cardmed Device</h1>
          <p>
            {conn.phase === 'connected'
              ? `Conectado · ${conn.deviceLabel}`
              : 'Configura un NiloCardmed vía Bluetooth'}
          </p>
        </div>
        {conn.phase === 'connected' && (
          <button type="button" className="nilo-cardmed__disconnect" onClick={conn.disconnect} disabled={busy}>
            <MaterialIcon name="bluetooth_disabled" size={18} />
            Desconectar
          </button>
        )}
      </header>

      {!bleSupported && (
        <div className="nilo-cardmed__alert nilo-cardmed__alert--warn">
          <MaterialIcon name="warning" size={20} />
          Web Bluetooth no está disponible. Usa Chrome/Edge en Android con HTTPS.
        </div>
      )}

      {conn.lastError && conn.phase === 'error' && (
        <div className="nilo-cardmed__alert nilo-cardmed__alert--error">{conn.lastError}</div>
      )}

      {conn.phase !== 'connected' ? (
        <section className="nilo-cardmed__connect">
          <div className="nilo-cardmed__connect-actions">
            <button type="button" className="nilo-cardmed__primary" onClick={() => void handleScan()} disabled={busy || !bleSupported}>
              <MaterialIcon name="bluetooth_searching" size={22} />
              Buscar dispositivos BLE
            </button>
            <p className="nilo-cardmed__hint">
              Se abrirá el diálogo del sistema. Solo se aceptan dispositivos cuyo nombre contenga «nilo» o
              «cardmed».
            </p>
          </div>

          <div className="nilo-cardmed__saved">
            <h2>Dispositivos conocidos</h2>
            {conn.savedDevices.length === 0 ? (
              <p className="nilo-cardmed__empty">Aún no hay dispositivos guardados.</p>
            ) : (
              <ul className="nilo-cardmed__device-list">
                {conn.savedDevices.map((item) => (
                  <li key={item.id} className="nilo-cardmed__device-item">
                    <div>
                      <strong>{item.name}</strong>
                      {item.lastConnected && (
                        <span>Última conexión: {new Date(item.lastConnected).toLocaleString('es-ES')}</span>
                      )}
                    </div>
                    <div className="nilo-cardmed__device-actions">
                      <button type="button" onClick={() => openSavedConnect(item)} disabled={busy}>
                        Conectar
                      </button>
                      <button
                        type="button"
                        className="nilo-cardmed__danger-btn"
                        onClick={() => {
                          removeSavedDevice(item.id)
                          conn.refreshSaved()
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : (
        <>
          <nav className="nilo-cardmed__tabs" aria-label="Secciones Cardmed">
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
                  <button type="button" onClick={() => void refreshDashboard()} disabled={busy}>
                    Actualizar
                  </button>
                  <button type="button" onClick={() => void handlePing()} disabled={busy}>
                    Ping
                  </button>
                </div>
                {dashboard ? <JsonBlock data={dashboard} /> : <p>Cargando estado…</p>}
              </div>
            )}

            {tab === 'wifi' && (
              <div className="nilo-cardmed__section">
                <div className="nilo-cardmed__row">
                  <button type="button" onClick={() => void handleWifiScan()} disabled={busy}>
                    Escanear redes
                  </button>
                  <button type="button" onClick={() => void handleWifiTest()} disabled={busy}>
                    Probar Internet
                  </button>
                  <button type="button" onClick={() => void handleWifiDisconnect()} disabled={busy}>
                    Desconectar WiFi
                  </button>
                </div>
                <label className="nilo-cardmed__field">
                  Red
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
                  Conectar WiFi
                </button>
                {wifiStatus && (
                  <>
                    <h3>Último resultado</h3>
                    <JsonBlock data={wifiStatus} />
                  </>
                )}
              </div>
            )}

            {tab === 'camera' && (
              <div className="nilo-cardmed__section">
                <div className="nilo-cardmed__row">
                  <button type="button" onClick={() => void handleCameraList()} disabled={busy}>
                    Listar cámaras
                  </button>
                  <button type="button" className="nilo-cardmed__primary" onClick={() => void handleCapture()} disabled={busy}>
                    Capturar imagen
                  </button>
                </div>
                <label className="nilo-cardmed__field">
                  Cámara
                  <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {cameras.map((cam) => (
                      <option key={cam.path} value={cam.path}>
                        {cam.name} ({cam.path})
                      </option>
                    ))}
                  </select>
                </label>
                {captureUrl && (
                  <img src={captureUrl} alt="Captura Cardmed" className="nilo-cardmed__capture" />
                )}
              </div>
            )}

            {tab === 'cardmed' && (
              <div className="nilo-cardmed__section">
                <div className="nilo-cardmed__row">
                  <button type="button" onClick={() => void loadCardmedConfig()} disabled={busy}>
                    Leer config
                  </button>
                  <button type="button" onClick={() => void testCardmed()} disabled={busy}>
                    Probar CardMed
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

            {tab === 'sampling' && (
              <div className="nilo-cardmed__section">
                <button type="button" onClick={() => void loadSampling()} disabled={busy}>
                  Leer muestreo
                </button>
                <label className="nilo-cardmed__field">
                  Intervalo (s)
                  <input value={intervalSeconds} onChange={(e) => setIntervalSeconds(e.target.value)} />
                </label>
                <button type="button" onClick={() => void saveSamplingInterval()} disabled={busy}>
                  Guardar intervalo
                </button>
                <label className="nilo-cardmed__field">
                  Inicio ventana (unix)
                  <input value={monitorStart} onChange={(e) => setMonitorStart(e.target.value)} />
                </label>
                <label className="nilo-cardmed__field">
                  Fin ventana (-1 = sin límite)
                  <input value={monitorEnd} onChange={(e) => setMonitorEnd(e.target.value)} />
                </label>
                <button type="button" onClick={() => void saveSamplingWindow()} disabled={busy}>
                  Guardar ventana
                </button>
                {samplingConfig && <JsonBlock data={samplingConfig} />}
              </div>
            )}

            {tab === 'system' && (
              <div className="nilo-cardmed__section">
                <div className="nilo-cardmed__row">
                  <button type="button" onClick={() => void loadSystem()} disabled={busy}>
                    Cargar sistema
                  </button>
                  <button type="button" onClick={() => void syncTime()} disabled={busy}>
                    Sincronizar hora
                  </button>
                </div>
                {systemInfo && <JsonBlock data={systemInfo} />}
                {commands.length > 0 && (
                  <>
                    <h3>Comandos disponibles ({commands.length})</h3>
                    <pre className="nilo-cardmed__json m3-scroll">{commands.join('\n')}</pre>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {passwordTarget && (
        <div className="nilo-cardmed__modal-backdrop">
          <form className="nilo-cardmed__modal" onSubmit={(e) => void submitPassword(e)}>
            <h2>Contraseña del dispositivo</h2>
            <p>Introduce la contraseña BLE del NiloCardmed.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="off"
            />
            <div className="nilo-cardmed__modal-actions">
              <button type="button" onClick={() => setPasswordTarget(null)}>
                Cancelar
              </button>
              <button type="submit" className="nilo-cardmed__primary" disabled={busy || !password.trim()}>
                Conectar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
