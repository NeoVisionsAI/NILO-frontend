import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { ROOT_PATHS } from '@/router/paths'
import { CardmedBleProgress } from '../components/CardmedBleProgress'
import { CardmedDeviceRegistryPanel } from '../components/CardmedDeviceRegistryPanel'
import { CardmedDeviceStatusBar } from '../components/CardmedDeviceStatusBar'
import { deviceDisplayLabel, formatDeviceLocation } from '../ble/device-registry'
import { blobToObjectUrl, chunksToBlob } from '../ble/camera-utils'
import type { CameraDevice, SavedCardmedDevice, WifiNetwork } from '../ble/types'
import {
  cardmedErrorMessage,
  isWebBluetoothSupported,
  requestCardmedBleDevice,
  requestCardmedBleDeviceAcceptAll,
  requestCardmedBleDeviceByExactName,
} from '../ble/web-bluetooth'
import { useCardmedConnection } from '../hooks/useCardmedConnection'
import './CardmedDevicePage.css'

type CardmedTab = 'registry' | 'dashboard' | 'wifi' | 'camera' | 'cardmed' | 'sampling' | 'system'

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

  const [activePairedId, setActivePairedId] = useState<string | null>(null)
  const dashboardLoadedRef = useRef(false)

  const bleSupported = useMemo(() => isWebBluetoothSupported(), [])

  useEffect(() => {
    return () => {
      if (captureUrl) URL.revokeObjectURL(captureUrl)
    }
  }, [captureUrl])

  const runChainRef = useRef(Promise.resolve())

  const run = useCallback(
    async (action: () => Promise<void>) => {
      const execute = async () => {
        setBusy(true)
        try {
          await action()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error en el dispositivo'
          if (msg === 'unauthorized' || msg === 'privileged_auth_required') {
            toast.error('Sesión expirada. Pulsa Reconectar.')
          } else if (conn.phase === 'disconnected') {
            toast.error(msg || 'Conexión perdida. Pulsa Reconectar.')
          } else if (msg.startsWith('Espera a que termine') || msg.startsWith('Comando BLE en curso')) {
            toast.info(msg)
          } else if (msg.startsWith('timeout BLE')) {
            toast.error(`${msg}. Si persiste, pulsa Reconectar sin reintentar en bucle.`)
          } else {
            toast.error(msg)
          }
        } finally {
          setBusy(false)
        }
      }

      runChainRef.current = runChainRef.current.then(execute, execute)
      await runChainRef.current
    },
    [conn.phase],
  )

  const refreshDashboard = useCallback(async () => {
    if (conn.blockingCommand) return
    await run(async () => {
      const health = await conn.runCommand('health_status')
      const battery = await conn.runCommand('battery_status')
      const wifi = await conn.runCommand('wifi_status', { check_connectivity: true })
      const storage = await conn.runCommand('storage_status')
      setDashboard({
        health: health.data,
        battery: battery.data,
        wifi: wifi.data,
        storage: storage.data,
      })
    })
  }, [conn, run])

  useEffect(() => {
    if (conn.phase === 'connected' && !dashboardLoadedRef.current && !conn.blockingCommand) {
      dashboardLoadedRef.current = true
      void refreshDashboard()
    }
    if (conn.phase !== 'connected') {
      dashboardLoadedRef.current = false
      if (conn.phase === 'disconnected' || conn.phase === 'idle') {
        setDashboard(null)
      }
    }
  }, [conn.phase, conn.blockingCommand, refreshDashboard])

  function knownBleNames(): string[] {
    return conn.pairedDevices.map((item) => item.bleName)
  }

  function openPasswordForDevice(device: BluetoothDevice, label?: string, unnamed = false) {
    setPasswordTarget({ kind: 'scan', device })
    setPassword('')
    if (unnamed || !device.name) {
      toast.info(
        'Dispositivo sin nombre en el selector. Si es tu NiloCardmed, introduce la contraseña — se validará al conectar.',
      )
    } else {
      toast.success(`«${label ?? device.name}» seleccionado. Introduce la contraseña.`)
    }
  }

  /** requestDevice() en el mismo gesto del tap (Chrome/Android). */
  function handleConnectDevice(mode: 'filtered' | 'acceptAll' = 'filtered') {
    void (async () => {
      try {
        const device =
          mode === 'acceptAll'
            ? await requestCardmedBleDeviceAcceptAll()
            : await requestCardmedBleDevice(knownBleNames())
        openPasswordForDevice(device, device.name, mode === 'acceptAll' && !device.name)
      } catch (err) {
        toast.error(cardmedErrorMessage(err))
      }
    })()
  }

  /** Emparejado conocido: filtro por nombre exacto (mejor en tablet). */
  function handleConnectKnownPaired(saved: SavedCardmedDevice) {
    void (async () => {
      try {
        const device = await requestCardmedBleDeviceByExactName(saved.bleName)
        setActivePairedId(saved.id)
        setTab('registry')
        if (saved.password) {
          await run(async () => {
            await conn.connectPaired(saved, undefined, device)
            toast.success('Dispositivo conectado.')
          })
          return
        }
        setPasswordTarget({ kind: 'saved', saved, device })
        setPassword('')
        toast.success(`«${saved.bleName}» seleccionado. Introduce la contraseña.`)
      } catch (err) {
        toast.error(cardmedErrorMessage(err))
      }
    })()
  }

  function handleConnectSaved(saved: SavedCardmedDevice) {
    handleConnectKnownPaired(saved)
  }

  function openPairedDevice(item: SavedCardmedDevice) {
    setActivePairedId(item.id)
    setTab('registry')
  }

  function handleReconnectActive() {
    if (!activePaired) return
    void (async () => {
      try {
        let picked: BluetoothDevice | undefined
        if (!conn.hasCachedDevice) {
          picked = await requestCardmedBleDeviceByExactName(activePaired.bleName)
        }
        await run(async () => {
          await conn.reconnect(picked)
          toast.success('Dispositivo reconectado.')
        })
      } catch (err) {
        toast.error(cardmedErrorMessage(err))
      }
    })()
  }

  function closeDeviceView() {
    setActivePairedId(null)
    if (conn.phase === 'connected') {
      conn.disconnect()
    }
  }

  function handleUnpairActive() {
    if (!activePairedId) return
    conn.removePairing(activePairedId)
    setActivePairedId(null)
    toast.success('Dispositivo desemparejado.')
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordTarget || !password.trim()) return

    await run(async () => {
      if (passwordTarget.kind === 'scan' && passwordTarget.device) {
        await conn.connect(passwordTarget.device, password.trim())
      } else if (passwordTarget.kind === 'saved' && passwordTarget.saved) {
        await conn.connectPaired(passwordTarget.saved, password.trim(), passwordTarget.device)
      }
      setPasswordTarget(null)
      setPassword('')
      if (passwordTarget.kind === 'scan' && passwordTarget.device) {
        setActivePairedId(passwordTarget.device.id)
      } else if (passwordTarget.kind === 'saved' && passwordTarget.saved) {
        setActivePairedId(passwordTarget.saved.id)
      }
      toast.success('Dispositivo conectado y emparejado.')
      setTab('registry')
    })
  }

  async function handleWifiScan() {
    await run(async () => {
      toast.info('Escaneando WiFi (~60 s). No se enviarán otros comandos BLE.')
      const resp = await conn.runCommand<{ networks: WifiNetwork[] }>('wifi_scan')
      setWifiNetworks(resp.data?.networks ?? [])
      toast.success('Escaneo WiFi completado.')
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
      const resp = await conn.runCommand('wifi_test')
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
      }>('camera_capture_test', { device: selectedCamera, mode: 'chunked' })

      const captureId = meta.data?.capture_id
      const total = meta.data?.total_chunks ?? 0
      if (!captureId || total <= 0) throw new Error('Captura inválida.')

      const chunks = []
      for (let index = 0; index < total; index += 1) {
        const chunk = await conn.runCommand(
          'camera_capture_chunk',
          { capture_id: captureId, index },
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
      const resp = await conn.runCommand('cardmed_test')
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
      const info = await conn.runCommand('system_info')
      const time = await conn.runCommand('time_get')
      const events = await conn.runCommand('events_list')
      const history = await conn.runCommand('sampler_history')
      const list = await conn.runCommand<{ commands: string[] }>('commands_list')
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
    if (conn.blockingCommand) {
      toast.info(`Espera a que termine «${conn.blockingCommand}».`)
      return
    }
    await run(async () => {
      const resp = await conn.runCommand('ping')
      toast.success(`Ping OK · v${(resp.data as { version?: string })?.version ?? '?'}`)
    })
  }

  const commandsBlocked = Boolean(conn.blockingCommand)

  const tabs: { id: CardmedTab; label: string; icon: string }[] = [
    { id: 'registry', label: 'Registro', icon: 'bookmark' },
    { id: 'dashboard', label: 'Estado', icon: 'monitor_heart' },
    { id: 'wifi', label: 'WiFi', icon: 'wifi' },
    { id: 'camera', label: 'Cámara', icon: 'photo_camera' },
    { id: 'cardmed', label: 'CardMed', icon: 'medical_information' },
    { id: 'sampling', label: 'Muestreo', icon: 'schedule' },
    { id: 'system', label: 'Sistema', icon: 'memory' },
  ]

  const activePaired = activePairedId
    ? conn.pairedDevices.find((item) => item.id === activePairedId)
    : undefined
  const isBleConnected = conn.phase === 'connected'
  const isBleConnecting = conn.phase === 'connecting' || conn.phase === 'authenticating'
  const showDeviceView = Boolean(activePaired)
  const visibleTabs = isBleConnected ? tabs : tabs.filter((item) => item.id === 'registry')

  useEffect(() => {
    if (conn.connectedDeviceId) {
      setActivePairedId(conn.connectedDeviceId)
    }
  }, [conn.connectedDeviceId])

  useEffect(() => {
    if (!isBleConnected && tab !== 'registry') {
      setTab('registry')
    }
  }, [isBleConnected, tab])

  return (
    <div className="nilo-cardmed">
      <header className="nilo-cardmed__header">
        <Link to={ROOT_PATHS.doctor} className="nilo-cardmed__back">
          <MaterialIcon name="arrow_back" size={20} />
          <span>Volver</span>
        </Link>
        <div className="nilo-cardmed__header-main">
          <h1>{showDeviceView && activePaired ? deviceDisplayLabel(activePaired) : 'Cardmed Device'}</h1>
          <p>
            {isBleConnected
              ? `Conectado · ${conn.deviceLabel ?? activePaired?.bleName}`
              : showDeviceView && activePaired
                ? `${activePaired.bleName} · sin conexión BLE`
                : 'Configura un NiloCardmed vía Bluetooth'}
          </p>
        </div>
        {showDeviceView && (
          <button type="button" className="nilo-cardmed__back-list" onClick={closeDeviceView} disabled={busy}>
            <MaterialIcon name="list" size={18} />
            Lista
          </button>
        )}
      </header>

      {!bleSupported && (
        <div className="nilo-cardmed__alert nilo-cardmed__alert--warn">
          <MaterialIcon name="warning" size={20} />
          Web Bluetooth no está disponible. Usa Chrome/Edge en Android con HTTPS.
        </div>
      )}

      {conn.lastError && (conn.phase === 'error' || conn.phase === 'disconnected') && (
        <div className="nilo-cardmed__alert nilo-cardmed__alert--error">{conn.lastError}</div>
      )}

      {isBleConnecting && (
        <CardmedBleProgress
          phase={conn.phase === 'authenticating' ? 'authenticating' : 'connecting'}
          variant="page"
        />
      )}

      {showDeviceView && activePaired ? (
        <>
          <CardmedDeviceStatusBar
            phase={conn.phase}
            busy={busy}
            bleSupported={bleSupported}
            hasCachedDevice={conn.hasCachedDevice}
            blockingCommand={conn.blockingCommand}
            lastError={conn.lastError}
            onConnect={() => void handleConnectSaved(activePaired)}
            onReconnect={() => void handleReconnectActive()}
            onDisconnect={conn.disconnect}
            onUnpair={handleUnpairActive}
          />

          <nav className="nilo-cardmed__tabs" aria-label="Secciones Cardmed">
            {visibleTabs.map((item) => (
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
            {tab === 'registry' && (
              <CardmedDeviceRegistryPanel
                device={activePaired}
                busy={busy}
                onSave={(patch) => {
                  conn.saveDeviceMetadata(activePaired.id, patch)
                  toast.success('Registro guardado.')
                }}
              />
            )}

            {tab === 'dashboard' && isBleConnected && (
              <div className="nilo-cardmed__section">
                {commandsBlocked && (
                  <p className="nilo-cardmed__hint">
                    Comando en curso: {conn.blockingCommand}. Ping y actualizar deshabilitados temporalmente.
                  </p>
                )}
                <div className="nilo-cardmed__row">
                  <button type="button" onClick={() => void refreshDashboard()} disabled={busy || commandsBlocked}>
                    Actualizar
                  </button>
                  <button type="button" onClick={() => void handlePing()} disabled={busy || commandsBlocked}>
                    Ping
                  </button>
                </div>
                {dashboard ? <JsonBlock data={dashboard} /> : <p>Cargando estado…</p>}
              </div>
            )}

            {tab === 'wifi' && isBleConnected && (
              <div className="nilo-cardmed__section">
                {commandsBlocked && conn.blockingCommand === 'wifi_scan' && (
                  <p className="nilo-cardmed__hint">Escaneo WiFi en curso… (~30 s)</p>
                )}
                <div className="nilo-cardmed__row">
                  <button type="button" onClick={() => void handleWifiScan()} disabled={busy || commandsBlocked}>
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

            {tab === 'camera' && isBleConnected && (
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

            {tab === 'cardmed' && isBleConnected && (
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

            {tab === 'sampling' && isBleConnected && (
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

            {tab === 'system' && isBleConnected && (
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
      ) : (
        <section className="nilo-cardmed__connect">
          <div className="nilo-cardmed__connect-hero">
            <div className="nilo-cardmed__connect-hero-icon" aria-hidden="true">
              <MaterialIcon name="medical_information" size={32} />
            </div>
            <div className="nilo-cardmed__connect-hero-copy">
              <h2>Emparejar NiloCardmed</h2>
              <p>
                Pulsa <strong>Conectar NiloCardmed</strong> y elige tu dispositivo en el diálogo de Chrome.
                Si ya emparejaste antes, usa <strong>Conectar</strong> en la lista de abajo (filtro por nombre exacto).
              </p>
              <p className="nilo-cardmed__connect-note">
                <strong>Tablet:</strong> si no aparece en el selector, prueba <strong>Modo tablet (sin filtro)</strong>
                y elige el dispositivo «desconocido» más cercano al Pi; la contraseña BLE confirma que es el correcto.
                Usa Chrome (pestaña del navegador, no WebView), HTTPS y permiso «Dispositivos cercanos».
                <strong> No emparejes</strong> el Pi en Ajustes del tablet; si ya lo hiciste, olvídalo allí.
              </p>
            </div>
            <div className="nilo-cardmed__connect-actions">
              <button
                type="button"
                className="nilo-cardmed__primary"
                onClick={() => handleConnectDevice('filtered')}
                disabled={busy || !bleSupported || isBleConnecting}
              >
                <MaterialIcon name="bluetooth" size={22} />
                Conectar NiloCardmed
              </button>
              <button
                type="button"
                className="nilo-cardmed__secondary-scan"
                onClick={() => handleConnectDevice('acceptAll')}
                disabled={busy || !bleSupported || isBleConnecting}
              >
                <MaterialIcon name="bluetooth_searching" size={20} />
                Modo tablet (sin filtro)
              </button>
            </div>
          </div>

          <div className="nilo-cardmed__saved">
            <div className="nilo-cardmed__saved-header">
              <h2>Dispositivos emparejados</h2>
              <span className="nilo-cardmed__saved-count">{conn.pairedDevices.length}</span>
            </div>
            {conn.pairedDevices.length === 0 ? (
              <div className="nilo-cardmed__empty-state">
                <MaterialIcon name="devices_other" size={40} />
                <p>Aún no hay dispositivos emparejados.</p>
                <span>Usa «Conectar NiloCardmed» para añadir el primero.</span>
              </div>
            ) : (
              <ul className="nilo-cardmed__device-list">
                {conn.pairedDevices.map((item) => {
                  const locationLabel = formatDeviceLocation(item)
                  const isLive = isBleConnected && conn.connectedDeviceId === item.id
                  return (
                    <li key={item.id} className="nilo-cardmed__device-item">
                      <div className="nilo-cardmed__device-row">
                        <button
                          type="button"
                          className="nilo-cardmed__device-main"
                          onClick={() => openPairedDevice(item)}
                          disabled={busy}
                        >
                          <span className={`nilo-cardmed__device-icon-wrap${isLive ? ' nilo-cardmed__device-icon-wrap--live' : ''}`}>
                            <span
                              className={`nilo-cardmed__device-dot${isLive ? ' nilo-cardmed__device-dot--live' : ''}`}
                              aria-hidden="true"
                            />
                            <MaterialIcon name="medical_information" size={22} />
                          </span>
                          <span className="nilo-cardmed__device-copy">
                            <strong>{deviceDisplayLabel(item)}</strong>
                            <span>{item.bleName}</span>
                            <span>Emparejado: {new Date(item.pairedAt).toLocaleString('es-ES')}</span>
                            {locationLabel && <span>{locationLabel}</span>}
                          </span>
                          <MaterialIcon name="chevron_right" size={24} className="nilo-cardmed__device-chevron" />
                        </button>
                        <div className="nilo-cardmed__device-actions">
                          <button
                            type="button"
                            onClick={() => handleConnectKnownPaired(item)}
                            disabled={busy || !bleSupported || isBleConnecting}
                          >
                            Conectar
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {passwordTarget && (
        <div className="nilo-cardmed__modal-backdrop nilo-cardmed__modal-backdrop--visible">
          <form className="nilo-cardmed__modal nilo-cardmed__modal--visible" onSubmit={(e) => void submitPassword(e)}>
            {isBleConnecting ? (
              <CardmedBleProgress
                phase={conn.phase === 'authenticating' ? 'authenticating' : 'connecting'}
                variant="modal"
              />
            ) : (
              <>
                <div className="nilo-cardmed__modal-icon">
                  <MaterialIcon name="lock" size={26} />
                </div>
                <h2>Contraseña del dispositivo</h2>
                <p>
                  {passwordTarget.kind === 'saved' && passwordTarget.saved
                    ? `Conectar con «${deviceDisplayLabel(passwordTarget.saved)}»`
                    : 'Introduce la contraseña BLE del NiloCardmed seleccionado. Se guardará el emparejamiento.'}
                </p>
                <label className="nilo-cardmed__modal-field">
                  Contraseña
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    placeholder="Contraseña BLE"
                  />
                </label>
                <div className="nilo-cardmed__modal-actions">
                  <button type="button" className="nilo-cardmed__modal-cancel" onClick={() => setPasswordTarget(null)}>
                    Cancelar
                  </button>
                  <button type="submit" className="nilo-cardmed__primary" disabled={busy || !password.trim()}>
                    <MaterialIcon name="bluetooth_connected" size={18} />
                    Conectar
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
