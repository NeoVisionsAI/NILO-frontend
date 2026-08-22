import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { CameraDevice } from '../../ble/types'
import './CardmedWifiCameraTab.css'

interface CardmedWifiCameraTabProps {
  busy: boolean
  cameras: CameraDevice[]
  selectedDevice: string
  savedDevice?: string
  captureUrl: string | null
  onRefreshList: () => void
  onSelectDevice: (path: string) => void
  onSaveDevice: () => void
  onCapture: () => void
}

export function CardmedWifiCameraTab({
  busy,
  cameras,
  selectedDevice,
  savedDevice,
  captureUrl,
  onRefreshList,
  onSelectDevice,
  onSaveDevice,
  onCapture,
}: CardmedWifiCameraTabProps) {
  return (
    <div className="wifi-camera-tab">
      <div className="wifi-camera-tab__toolbar">
        <button type="button" onClick={onRefreshList} disabled={busy}>
          Listar cámaras
        </button>
        <button type="button" onClick={onSaveDevice} disabled={busy || !selectedDevice}>
          Guardar selección
        </button>
        <button type="button" className="nilo-cardmed__primary" onClick={onCapture} disabled={busy || !selectedDevice}>
          <MaterialIcon name="photo_camera" size={18} />
          Foto de prueba
        </button>
      </div>

      <div className="wifi-config-tab__grid">
        <label className="wifi-config-tab__field wifi-config-tab__field--wide">
          <span>Cámara activa</span>
          <select value={selectedDevice} onChange={(e) => onSelectDevice(e.target.value)} disabled={busy}>
            <option value="">Seleccionar…</option>
            {cameras.map((cam) => (
              <option key={cam.path} value={cam.path}>
                {cam.name} ({cam.path})
              </option>
            ))}
          </select>
        </label>
      </div>

      {savedDevice && (
        <p className="wifi-camera-tab__saved">
          Guardada en Pi: <code>{savedDevice}</code>
        </p>
      )}

      {captureUrl && (
        <img src={captureUrl} alt="Captura de prueba" className="nilo-cardmed__capture wifi-camera-tab__preview" />
      )}
    </div>
  )
}
