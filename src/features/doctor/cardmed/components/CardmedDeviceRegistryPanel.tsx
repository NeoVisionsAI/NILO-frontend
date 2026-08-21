import { useEffect, useRef, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { NodeLocationMap } from '@/features/doctor/pages/AddNode/NodeLocationMap'
import { geocodeForward, geocodeReverse } from '@/services/geocoding.service'
import type { CardmedDeviceLocation, SavedCardmedDevice } from '../ble/types'
import { deviceDisplayLabel, formatDeviceLocation } from '../ble/device-registry'
import './CardmedDeviceRegistryPanel.css'

interface RegistryForm {
  displayName: string
  address: string
  city: string
  zip: string
  latitude: string
  longitude: string
  additionalNotes: string
}

function toForm(device: SavedCardmedDevice): RegistryForm {
  const loc = device.location
  return {
    displayName: device.displayName ?? '',
    address: loc?.address ?? '',
    city: loc?.city ?? '',
    zip: loc?.zip ?? '',
    latitude: loc?.lat != null ? String(loc.lat) : '',
    longitude: loc?.lon != null ? String(loc.lon) : '',
    additionalNotes: loc?.additionalNotes ?? '',
  }
}

function toLocation(form: RegistryForm): CardmedDeviceLocation {
  const lat = form.latitude ? Number(form.latitude) : null
  const lon = form.longitude ? Number(form.longitude) : null
  return {
    address: form.address.trim() || undefined,
    city: form.city.trim() || undefined,
    zip: form.zip.trim() || undefined,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    additionalNotes: form.additionalNotes.trim() || undefined,
  }
}

interface CardmedDeviceRegistryPanelProps {
  device: SavedCardmedDevice
  busy: boolean
  onSave: (patch: { displayName?: string; location?: CardmedDeviceLocation }) => void
}

export function CardmedDeviceRegistryPanel({
  device,
  busy,
  onSave,
}: CardmedDeviceRegistryPanelProps) {
  const [form, setForm] = useState<RegistryForm>(() => toForm(device))
  const [geoStatus, setGeoStatus] = useState<string | null>(null)
  const forwardTimer = useRef<number>()
  const reverseTimer = useRef<number>()

  useEffect(() => {
    setForm(toForm(device))
  }, [device])

  const latNum = form.latitude ? Number(form.latitude) : NaN
  const lonNum = form.longitude ? Number(form.longitude) : NaN
  const validLat = Number.isFinite(latNum) ? latNum : null
  const validLon = Number.isFinite(lonNum) ? lonNum : null

  function scheduleForward(next: RegistryForm) {
    window.clearTimeout(forwardTimer.current)
    const query = [next.address, next.zip, next.city].filter(Boolean).join(', ')
    if (query.length < 4) return
    forwardTimer.current = window.setTimeout(async () => {
      setGeoStatus('Localizando en el mapa…')
      try {
        const res = await geocodeForward(query)
        if (res) {
          setForm((prev) => ({
            ...prev,
            latitude: res.lat.toFixed(6),
            longitude: res.lon.toFixed(6),
          }))
          setGeoStatus(null)
        } else {
          setGeoStatus('No se encontró esa dirección.')
        }
      } catch {
        setGeoStatus('Error al localizar la dirección.')
      }
    }, 800)
  }

  function scheduleReverse(lat: number, lon: number) {
    window.clearTimeout(reverseTimer.current)
    reverseTimer.current = window.setTimeout(async () => {
      setGeoStatus('Obteniendo dirección…')
      try {
        const res = await geocodeReverse(lat, lon)
        if (res) {
          setForm((prev) => ({
            ...prev,
            address: res.address || prev.address,
            city: res.city || prev.city,
            zip: res.zip || prev.zip,
          }))
          setGeoStatus(null)
        } else {
          setGeoStatus(null)
        }
      } catch {
        setGeoStatus('Error al obtener la dirección.')
      }
    }, 600)
  }

  function handleFieldChange(field: keyof RegistryForm, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'address' || field === 'city' || field === 'zip') {
        scheduleForward(next)
      }
      return next
    })
  }

  function handleMapPick(lat: number, lon: number) {
    setForm((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
    }))
    scheduleReverse(lat, lon)
  }

  function handleSave() {
    onSave({
      displayName: form.displayName.trim() || undefined,
      location: toLocation(form),
    })
  }

  const locationSummary = formatDeviceLocation({ ...device, location: toLocation(form) })

  return (
    <div className="cardmed-registry">
      <div className="cardmed-registry__meta">
        <div>
          <span className="cardmed-registry__label">ID Bluetooth</span>
          <strong>{device.bleName}</strong>
        </div>
        <div>
          <span className="cardmed-registry__label">Emparejado</span>
          <strong>{new Date(device.pairedAt).toLocaleString('es-ES')}</strong>
        </div>
        {device.lastConnected && (
          <div>
            <span className="cardmed-registry__label">Última conexión</span>
            <strong>{new Date(device.lastConnected).toLocaleString('es-ES')}</strong>
          </div>
        )}
      </div>

      <label className="cardmed-registry__field">
        Nombre personalizado
        <input
          value={form.displayName}
          onChange={(e) => handleFieldChange('displayName', e.target.value)}
          placeholder={deviceDisplayLabel(device)}
        />
        <span className="cardmed-registry__hint">El nombre BLE «{device.bleName}» no se puede modificar.</span>
      </label>

      <div className="cardmed-registry__address-grid">
        <label className="cardmed-registry__field">
          Dirección
          <input value={form.address} onChange={(e) => handleFieldChange('address', e.target.value)} />
        </label>
        <label className="cardmed-registry__field">
          Código postal
          <input value={form.zip} onChange={(e) => handleFieldChange('zip', e.target.value)} />
        </label>
        <label className="cardmed-registry__field cardmed-registry__field--wide">
          Ciudad
          <input value={form.city} onChange={(e) => handleFieldChange('city', e.target.value)} />
        </label>
      </div>

      {geoStatus && <p className="cardmed-registry__geo">{geoStatus}</p>}

      <NodeLocationMap lat={validLat} lon={validLon} onPick={handleMapPick} />

      <label className="cardmed-registry__field">
        Ubicación adicional
        <textarea
          value={form.additionalNotes}
          onChange={(e) => handleFieldChange('additionalNotes', e.target.value)}
          rows={3}
          placeholder="Planta, habitación, referencias internas…"
        />
      </label>

      {locationSummary && (
        <p className="cardmed-registry__summary">
          <MaterialIcon name="place" size={18} />
          {locationSummary}
        </p>
      )}

      <div className="cardmed-registry__actions">
        <button type="button" className="cardmed-registry__save" onClick={handleSave} disabled={busy}>
          <MaterialIcon name="save" size={18} />
          Guardar registro
        </button>
      </div>
    </div>
  )
}
