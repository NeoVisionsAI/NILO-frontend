import { useEffect, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { CameraDevice } from '../../ble/types'
import type { CameraCaptureMeta } from '../../wifi/types'
import './CardmedWifiCameraTab.css'

interface CardmedWifiCameraTabProps {
  busy: boolean
  cameras: CameraDevice[]
  selectedDevice: string
  savedDevice?: string
  captureUrl: string | null
  captureMeta: CameraCaptureMeta | null
  onRefreshList: () => void
  onSelectDevice: (path: string) => void
  onSaveDevice: () => void
  onCapture: () => void
}

function formatBytes(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatResolution(width?: number, height?: number): string {
  if (width != null && height != null && width > 0 && height > 0) return `${width} × ${height} px`
  return '—'
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

export function CardmedWifiCameraTab({
  busy,
  cameras,
  selectedDevice,
  savedDevice,
  captureUrl,
  captureMeta,
  onRefreshList,
  onSelectDevice,
  onSaveDevice,
  onCapture,
}: CardmedWifiCameraTabProps) {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const selectedCamera = cameras.find((cam) => cam.path === selectedDevice)

  useEffect(() => {
    setImageSize(null)
  }, [captureUrl])

  const resolution = formatResolution(imageSize?.width ?? captureMeta?.width, imageSize?.height ?? captureMeta?.height)
  const savedLabel = savedDevice
    ? savedDevice === selectedDevice
      ? 'Sí (actual)'
      : `Sí · ${savedDevice}`
    : 'No'

  return (
    <div className="wifi-camera-tab">
      <div className="wifi-camera-tab__controls">
        <button
          type="button"
          className="nilo-cardmed__primary wifi-camera-tab__btn"
          onClick={onRefreshList}
          disabled={busy}
        >
          <MaterialIcon name="videocam" size={20} />
          Listar cámaras
        </button>

        <button
          type="button"
          className="nilo-cardmed__secondary-scan wifi-camera-tab__btn"
          onClick={onSaveDevice}
          disabled={busy || !selectedDevice}
        >
          <MaterialIcon name="save" size={20} />
          Guardar selección
        </button>

        <select
          className="wifi-camera-tab__select"
          value={selectedDevice}
          onChange={(e) => onSelectDevice(e.target.value)}
          disabled={busy}
          aria-label="Cámara activa"
        >
          <option value="">Seleccionar…</option>
          {cameras.map((cam) => (
            <option key={cam.path} value={cam.path}>
              {cam.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="nilo-cardmed__primary wifi-camera-tab__btn"
          onClick={onCapture}
          disabled={busy || !selectedDevice}
        >
          <MaterialIcon name="photo_camera" size={20} />
          Foto de prueba
        </button>
      </div>

      <div className="wifi-camera-tab__preview-row">
        <div className="wifi-camera-tab__preview-image">
          {captureUrl ? (
            <img
              src={captureUrl}
              alt="Captura de prueba"
              className="nilo-cardmed__capture wifi-camera-tab__preview"
              onLoad={(e) =>
                setImageSize({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                })
              }
            />
          ) : (
            <div className="wifi-camera-tab__preview-placeholder">
              <MaterialIcon name="image" size={36} />
              <span>La imagen de prueba aparecerá aquí</span>
            </div>
          )}
        </div>

        <aside className="wifi-camera-tab__meta-panel">
          <h3>Metadatos</h3>
          <dl>
            <MetaRow label="Cámara" value={selectedCamera?.name ?? selectedDevice ?? '—'} />
            <MetaRow label="Dispositivo" value={selectedDevice || '—'} />
            <MetaRow label="Driver" value={selectedCamera?.driver ?? '—'} />
            <MetaRow label="Bus" value={selectedCamera?.bus_info ?? '—'} />
            <MetaRow label="Guardada en Pi" value={savedLabel} />
            <MetaRow label="Resolución" value={resolution} />
            <MetaRow label="Tamaño de la foto" value={formatBytes(captureMeta?.sizeBytes)} />
            <MetaRow label="Backend" value={captureMeta?.backend ?? '—'} />
            <MetaRow label="Modo captura" value={captureMeta?.mode ?? '—'} />
          </dl>
        </aside>
      </div>
    </div>
  )
}
