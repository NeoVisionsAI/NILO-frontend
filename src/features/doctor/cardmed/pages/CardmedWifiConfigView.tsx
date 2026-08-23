import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { ROOT_PATHS } from '@/router/paths'
import type { CameraDevice, WifiNetwork } from '../ble/types'
import { CardmedWifiCameraTab } from '../components/wifi/CardmedWifiCameraTab'
import { CardmedWifiCardmedTab } from '../components/wifi/CardmedWifiCardmedTab'
import { CardmedWifiLoginForm } from '../components/wifi/CardmedWifiLoginForm'
import { CardmedWifiStatusTab } from '../components/wifi/CardmedWifiStatusTab'
import { CardmedWifiWifiTab } from '../components/wifi/CardmedWifiWifiTab'
import type { useCardmedWifiConnection } from '../hooks/useCardmedWifiConnection'
import type { CameraCaptureMeta, CardmedCaptureBase64Data, CardmedDashboard, CardmedTestData } from '../wifi/types'
import { formatWifiScanMode, withWifiScanMinWait } from '../wifi/wifi-errors'
import '../components/wifi/CardmedWifiShared.css'
import './CardmedDevicePage.css'
import './CardmedWifiProvisionPage.css'

type ConfigTab = 'dashboard' | 'wifi' | 'camera' | 'cardmed'

interface CardmedWifiConfigViewProps {
  conn: ReturnType<typeof useCardmedWifiConnection>
  onBackToPair: () => void
}

export function CardmedWifiConfigView({ conn, onBackToPair }: CardmedWifiConfigViewProps) {
  const [tab, setTab] = useState<ConfigTab>('dashboard')
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [configDone, setConfigDone] = useState(false)

  const [dashboard, setDashboard] = useState<CardmedDashboard | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([])
  const [wifiScanMode, setWifiScanMode] = useState<string | null>(null)
  const [wifiScanPending, setWifiScanPending] = useState(false)
  const [wifiStatus, setWifiStatus] = useState<Record<string, unknown> | null>(null)
  const [selectedSsid, setSelectedSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')

  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [savedCamera, setSavedCamera] = useState<string | undefined>()
  const [captureUrl, setCaptureUrl] = useState<string | null>(null)
  const [captureMeta, setCaptureMeta] = useState<CameraCaptureMeta | null>(null)

  const [configCode, setConfigCode] = useState('')
  const [configJson, setConfigJson] = useState('')
  const [cardmedConfig, setCardmedConfig] = useState<Record<string, unknown> | null>(null)
  const [testResult, setTestResult] = useState<CardmedTestData | null>(null)

  const runChainRef = useRef(Promise.resolve())
  const dashboardLoadedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (captureUrl?.startsWith('data:')) return
      if (captureUrl) URL.revokeObjectURL(captureUrl)
    }
  }, [captureUrl])

  const run = useCallback(async (action: () => Promise<void>) => {
    const execute = async () => {
      setBusy(true)
      try {
        await action()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error en el dispositivo')
      } finally {
        setBusy(false)
      }
    }
    runChainRef.current = runChainRef.current.then(execute, execute)
    await runChainRef.current
  }, [])

  const refreshDashboard = useCallback(async () => {
    setDashboardError(null)
    await run(async () => {
      try {
        const data = await conn.fetchDashboard()
        setDashboard(data)
      } catch (err) {
        setDashboardError(err instanceof Error ? err.message : 'No se pudo cargar el panel.')
        throw err
      }
    })
  }, [conn, run])

  useEffect(() => {
    if (conn.isAuthenticated && !dashboardLoadedRef.current) {
      dashboardLoadedRef.current = true
      void refreshDashboard()
    }
    if (!conn.isAuthenticated) {
      dashboardLoadedRef.current = false
      setDashboard(null)
      setDashboardError(null)
      setWifiNetworks([])
      setWifiScanMode(null)
      setSelectedSsid('')
      setWifiPassword('')
    }
  }, [conn.isAuthenticated, refreshDashboard])

  async function handleAuth() {
    if (!password.trim()) return
    setLoginError(null)
    setBusy(true)
    try {
      await conn.authenticate(password.trim())
      toast.success('Sesión iniciada.')
      setTab('dashboard')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Contraseña incorrecta')
    } finally {
      setBusy(false)
    }
  }

  async function handleWifiScan() {
    setWifiNetworks([])
    setWifiScanMode(null)
    setWifiScanPending(true)
    try {
      await run(async () => {
        toast.info('Escaneando WiFi (rescan en el Pi, ~3–5 s mínimo)…')
        const resp = await withWifiScanMinWait(
          conn.runCommand<{ networks: WifiNetwork[]; scan_mode?: string }>('wifi_scan', { rescan: true }),
        )
        const networks = resp.data?.networks ?? []
        setWifiNetworks(networks)
        const modeHint = formatWifiScanMode(resp.data?.scan_mode)
        setWifiScanMode(modeHint)
        if (networks.length === 0) {
          toast.info('No se encontraron redes. Si el Pi ya está conectado, el escaneo AP+STA puede listar pocas redes.')
        } else {
          toast.success(`${networks.length} red(es) encontrada(s).`)
        }
      })
    } finally {
      setWifiScanPending(false)
    }
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
      toast.success('WiFi configurado.')
      await refreshDashboard()
    })
  }

  async function loadCameras() {
    await run(async () => {
      const listResp = await conn.runCommand<{ cameras: CameraDevice[] }>('camera_list')
      const savedResp = await conn.runCommand<{ device?: string }>('camera_get_device')
      const list = listResp.data?.cameras ?? []
      const saved = savedResp.data?.device
      setCameras(list)
      setSavedCamera(saved)
      setSelectedCamera(saved ?? list[0]?.path ?? '')
    })
  }

  async function saveCameraDevice() {
    if (!selectedCamera) return
    await run(async () => {
      await conn.runCommand('camera_set_device', { device: selectedCamera })
      setSavedCamera(selectedCamera)
      toast.success('Cámara guardada en el Pi.')
      await refreshDashboard()
    })
  }

  async function capturePhoto() {
    if (!selectedCamera) return
    await run(async () => {
      const resp = await conn.runCommand<CardmedCaptureBase64Data>('camera_capture_test', {
        device: selectedCamera,
        mode: 'base64',
      })
      const data = resp.data ?? {}
      const b64 = data.image_base64
      if (!b64) throw new Error('La captura no incluyó imagen.')
      setCaptureUrl(`data:image/jpeg;base64,${b64}`)
      setCaptureMeta({
        device: data.device_path ?? data.device ?? selectedCamera,
        sizeBytes:
          typeof data.size_bytes === 'number' ? data.size_bytes : Math.round((b64.length * 3) / 4),
        width: typeof data.width === 'number' ? data.width : undefined,
        height: typeof data.height === 'number' ? data.height : undefined,
        backend: typeof data.backend === 'string' ? data.backend : undefined,
        sha256: typeof data.sha256 === 'string' ? data.sha256 : undefined,
        mode: typeof data.mode === 'string' ? data.mode : 'base64',
      })
      toast.success('Foto de prueba capturada.')
    })
  }

  async function loadCardmedConfig() {
    await run(async () => {
      const resp = await conn.runCommand('cardmed_get')
      const data = (resp.data ?? {}) as Record<string, unknown>
      setCardmedConfig(data)
      setConfigJson(JSON.stringify(data, null, 2))
    })
  }

  async function saveConfigCode() {
    await run(async () => {
      const resp = await conn.runCommand('cardmed_configure', { config_code: configCode.trim() })
      setCardmedConfig(resp.data as Record<string, unknown>)
      toast.success('Configuración guardada.')
      await refreshDashboard()
    })
  }

  async function saveConfigJson() {
    await run(async () => {
      const resp = await conn.runCommand('cardmed_configure', { config_json: configJson.trim() })
      setCardmedConfig(resp.data as Record<string, unknown>)
      toast.success('JSON guardado.')
      await refreshDashboard()
    })
  }

  async function scanQr() {
    await run(async () => {
      toast.info('Escaneando QR con la cámara del Pi…')
      const resp = await conn.runCommand('cardmed_scan_qr', { apply: true })
      setCardmedConfig(resp.data as Record<string, unknown>)
      toast.success('QR aplicado.')
      await loadCardmedConfig()
      await refreshDashboard()
    })
  }

  async function testCardmed() {
    await run(async () => {
      const resp = await conn.runCommand<CardmedTestData>('cardmed_test', { skip_upload: true })
      setTestResult(resp.data ?? null)
      toast.info('Prueba CardMed completada.')
    })
  }

  const tabs: { id: ConfigTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Estado', icon: 'monitor_heart' },
    { id: 'wifi', label: 'WiFi', icon: 'wifi' },
    { id: 'camera', label: 'Cámara', icon: 'photo_camera' },
    { id: 'cardmed', label: 'CardMed', icon: 'medical_information' },
  ]

  const deviceName = conn.deviceLabel ?? conn.deviceStatus?.device_name ?? 'Nilocardmed'

  if (configDone) {
    return (
      <div className="nilo-cardmed nilo-cardmed-wifi">
        <section className="nilo-cardmed-wifi__done">
          <MaterialIcon name="check_circle" size={48} />
          <h2>Configuración completada</h2>
          <p>Vuelve a la WiFi con internet (oficina / MiniPC) para seguir usando NILO.</p>
          <div className="nilo-cardmed-wifi__actions">
            <button type="button" className="nilo-cardmed__primary" onClick={() => setConfigDone(false)}>
              Seguir configurando
            </button>
            <Link to={ROOT_PATHS.doctor} className="nilo-cardmed__secondary-scan">
              Volver al panel
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="nilo-cardmed nilo-cardmed-wifi nilo-cardmed-wifi--config">
      <header className="nilo-cardmed__header">
        <button type="button" className="nilo-cardmed__back" onClick={onBackToPair}>
          <MaterialIcon name="arrow_back" size={20} />
          <span>Emparejar</span>
        </button>
        <div className="nilo-cardmed__header-main">
          <h1>Configuración Nilocardmed</h1>
          <p>{conn.isAuthenticated ? deviceName : 'Inicia sesión para continuar'}</p>
        </div>
        {conn.isAuthenticated && (
          <button type="button" className="nilo-cardmed__back-list" onClick={() => setConfigDone(true)}>
            Finalizar
          </button>
        )}
      </header>

      {!conn.isAuthenticated ? (
        <>
          {conn.phase === 'authenticating' ? (
            <div className="nilo-cardmed-wifi__checking" role="status">
              <MaterialIcon name="sync" size={32} className="nilo-cardmed-wifi__spin" />
              <strong>Autenticando…</strong>
            </div>
          ) : (
            <CardmedWifiLoginForm
              deviceName={deviceName}
              version={conn.deviceStatus?.version}
              password={password}
              showPassword={showPassword}
              busy={busy}
              error={loginError}
              onPasswordChange={setPassword}
              onToggleShowPassword={() => setShowPassword((v) => !v)}
              onSubmit={() => void handleAuth()}
            />
          )}
        </>
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
              <CardmedWifiStatusTab
                dashboard={dashboard}
                busy={busy}
                error={dashboardError}
                onRefresh={() => void refreshDashboard()}
              />
            )}

            {tab === 'wifi' && (
              <CardmedWifiWifiTab
                busy={busy}
                scanning={conn.blockingCommand === 'wifi_scan'}
                scanPending={wifiScanPending}
                scanMode={wifiScanMode}
                networks={wifiNetworks}
                selectedSsid={selectedSsid}
                wifiPassword={wifiPassword}
                lastResult={wifiStatus}
                onScan={() => void handleWifiScan()}
                onSsidChange={setSelectedSsid}
                onPasswordChange={setWifiPassword}
                onConnect={() => void handleWifiConnect()}
              />
            )}

            {tab === 'camera' && (
              <CardmedWifiCameraTab
                busy={busy}
                cameras={cameras}
                selectedDevice={selectedCamera}
                savedDevice={savedCamera}
                captureUrl={captureUrl}
                captureMeta={captureMeta}
                onRefreshList={() => void loadCameras()}
                onSelectDevice={setSelectedCamera}
                onSaveDevice={() => void saveCameraDevice()}
                onCapture={() => void capturePhoto()}
              />
            )}

            {tab === 'cardmed' && (
              <CardmedWifiCardmedTab
                busy={busy}
                configCode={configCode}
                configJson={configJson}
                cardmedConfig={cardmedConfig}
                testResult={testResult}
                onConfigCodeChange={setConfigCode}
                onConfigJsonChange={setConfigJson}
                onLoad={() => void loadCardmedConfig()}
                onSaveCode={() => void saveConfigCode()}
                onSaveJson={() => void saveConfigJson()}
                onScanQr={() => void scanQr()}
                onTest={() => void testCardmed()}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
