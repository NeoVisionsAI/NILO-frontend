import { useEffect, useMemo, useRef, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { ScannedBleDevice } from '../ble/web-bluetooth'
import type { SavedCardmedDevice } from '../ble/types'
import './BleDevicePickerModal.css'

interface BleDevicePickerModalProps {
  open: boolean
  scanning: boolean
  devices: ScannedBleDevice[]
  knownPaired: SavedCardmedDevice[]
  onSelect: (device: ScannedBleDevice) => void
  onSelectKnown: (device: SavedCardmedDevice) => void
  onRescan: () => void
  onStopScan: () => void
  onSystemPicker: () => void
  onClose: () => void
}

function rssiBars(rssi?: number): 0 | 1 | 2 | 3 | 4 {
  if (rssi == null) return 0
  if (rssi >= -55) return 4
  if (rssi >= -65) return 3
  if (rssi >= -75) return 2
  if (rssi >= -85) return 1
  return 0
}

export function BleDevicePickerModal({
  open,
  scanning,
  devices,
  knownPaired,
  onSelect,
  onSelectKnown,
  onRescan,
  onStopScan,
  onSystemPicker,
  onClose,
}: BleDevicePickerModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const emptyMessage = useMemo(() => {
    if (scanning && knownPaired.length === 0 && devices.length === 0) {
      return 'Buscando dispositivos Nilo / Cardmed cerca…'
    }
    if (scanning && devices.length === 0) {
      return 'Escaneando… También puedes elegir un dispositivo emparejado abajo.'
    }
    if (devices.length === 0 && knownPaired.length === 0) {
      return 'No se encontró ningún dispositivo. Prueba el selector del sistema.'
    }
    return ''
  }, [devices.length, knownPaired.length, scanning])

  const liveDeviceIds = useMemo(() => new Set(devices.map((item) => item.id)), [devices])
  const pairedOnly = useMemo(
    () => knownPaired.filter((item) => !liveDeviceIds.has(item.id)),
    [knownPaired, liveDeviceIds],
  )

  if (!open) return null

  return (
    <div
      className={`ble-picker__backdrop${entered ? ' ble-picker__backdrop--visible' : ''}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={`ble-picker${entered ? ' ble-picker--visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ble-picker-title"
      >
        <header className="ble-picker__header">
          <div className={`ble-picker__icon${scanning ? ' ble-picker__icon--pulse' : ''}`}>
            <MaterialIcon name={scanning ? 'bluetooth_searching' : 'bluetooth'} size={28} />
            {scanning && <span className="ble-picker__ripple" aria-hidden="true" />}
          </div>
          <div className="ble-picker__header-text">
            <h2 id="ble-picker-title">Escaneo en la app</h2>
            <p>
              Detecta por nombre «nilo»/«cardmed», UUID del servicio o dispositivos ya emparejados. Si no aparece nada,
              usa el selector del sistema (más fiable).
            </p>
          </div>
          <button type="button" className="ble-picker__close" onClick={onClose} aria-label="Cerrar">
            <MaterialIcon name="close" size={22} />
          </button>
        </header>

        <div className="ble-picker__body m3-scroll">
          {scanning && devices.length > 0 && (
            <p className="ble-picker__scanning-hint">
              <MaterialIcon name="radar" size={16} />
              {devices.length} detectado{devices.length === 1 ? '' : 's'} — refinando señal…
            </p>
          )}

          {devices.length > 0 && (
            <ul className="ble-picker__list">
              {devices.map((item) => {
                const bars = rssiBars(item.rssi)
                return (
                  <li key={item.id}>
                    <button type="button" className="ble-picker__device" onClick={() => onSelect(item)}>
                      <span className="ble-picker__device-icon">
                        <MaterialIcon name="medical_information" size={22} />
                      </span>
                      <span className="ble-picker__device-info">
                        <strong>{item.name}</strong>
                        <span className="ble-picker__device-meta">
                          {item.rssi != null ? `${item.rssi} dBm` : 'Señal desconocida'}
                        </span>
                      </span>
                      <span className="ble-picker__signal" aria-hidden="true">
                        {([1, 2, 3, 4] as const).map((level) => (
                          <span
                            key={level}
                            className={`ble-picker__signal-bar${bars >= level ? ' ble-picker__signal-bar--on' : ''}`}
                          />
                        ))}
                      </span>
                      <MaterialIcon name="chevron_right" size={22} className="ble-picker__chevron" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {devices.length === 0 && (scanning || knownPaired.length === 0) && (
            <div className="ble-picker__empty">
              {scanning && <div className="ble-picker__scan-bar" aria-hidden="true" />}
              <MaterialIcon name="devices_other" size={40} />
              <p>{emptyMessage}</p>
            </div>
          )}

          {pairedOnly.length > 0 && (
            <div className="ble-picker__known">
              <h3>Emparejados en esta tablet</h3>
              <ul className="ble-picker__list">
                {pairedOnly.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="ble-picker__device ble-picker__device--known" onClick={() => onSelectKnown(item)}>
                      <span className="ble-picker__device-icon">
                        <MaterialIcon name="bookmark" size={22} />
                      </span>
                      <span className="ble-picker__device-info">
                        <strong>{item.displayName?.trim() || item.bleName}</strong>
                        <span className="ble-picker__device-meta">{item.bleName}</span>
                      </span>
                      <MaterialIcon name="chevron_right" size={22} className="ble-picker__chevron" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="ble-picker__footer">
          <button type="button" className="ble-picker__primary" onClick={onSystemPicker} disabled={scanning}>
            <MaterialIcon name="bluetooth" size={18} />
            Selector del sistema (recomendado)
          </button>
          {scanning && (
            <button type="button" className="ble-picker__secondary" onClick={onStopScan}>
              <MaterialIcon name="stop_circle" size={18} />
              Detener búsqueda
            </button>
          )}
          <button type="button" className="ble-picker__secondary" onClick={onRescan} disabled={scanning}>
            <MaterialIcon name="refresh" size={18} />
            {scanning ? 'Escaneando…' : 'Buscar de nuevo'}
          </button>
        </footer>
      </div>
    </div>
  )
}
