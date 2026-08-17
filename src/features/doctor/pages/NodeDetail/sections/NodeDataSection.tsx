import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { geocodeForward, geocodeReverse } from '@/services/geocoding.service'
import { toast } from '@/lib/toast'
import type { Node, NodeUpdate } from '@/types'
import { useClinicalData } from '../../../context/ClinicalDataContext'
import { NodeLocationMap } from '../../AddNode/NodeLocationMap'

interface NodeForm {
  name: string
  mac_address: string
  ddns: string
  address: string
  zip: string
  city: string
  location: string
  latitude: string
  longitude: string
  access_password: string
  bluetooth_enabled: boolean
  wifi_enabled: boolean
  wired_enabled: boolean
}

function nodeToForm(node: Node): NodeForm {
  return {
    name: node.name ?? '',
    mac_address: node.mac_address ?? '',
    ddns: node.ddns ?? '',
    address: node.address ?? '',
    zip: node.zip ?? '',
    city: node.city ?? '',
    location: node.location ?? '',
    latitude: node.latitude != null ? String(node.latitude) : '',
    longitude: node.longitude != null ? String(node.longitude) : '',
    access_password: '',
    bluetooth_enabled: node.bluetooth_enabled ?? false,
    wifi_enabled: node.wifi_enabled ?? false,
    wired_enabled: node.wired_enabled ?? false,
  }
}

interface NodeDataSectionProps {
  node: Node
}

export function NodeDataSection({ node }: NodeDataSectionProps) {
  const { updateNode } = useClinicalData()
  const [form, setForm] = useState<NodeForm>(() => nodeToForm(node))
  const [geoStatus, setGeoStatus] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const forwardTimer = useRef<number>()
  const reverseTimer = useRef<number>()

  useEffect(() => {
    setForm(nodeToForm(node))
    setGeoStatus(null)
  }, [node])

  const latNum = form.latitude ? Number(form.latitude) : NaN
  const lonNum = form.longitude ? Number(form.longitude) : NaN
  const validLat = Number.isFinite(latNum) ? latNum : null
  const validLon = Number.isFinite(lonNum) ? lonNum : null

  function scheduleForward(next: NodeForm) {
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
          setForm((prev) => {
            const keepAddress = !res.hasHouseNumber && prev.address.trim().length > 0
            return {
              ...prev,
              address: keepAddress ? prev.address : res.address || prev.address,
              city: res.city || prev.city,
              zip: res.zip || prev.zip,
            }
          })
        }
        setGeoStatus(null)
      } catch {
        setGeoStatus('Error al obtener la dirección.')
      }
    }, 600)
  }

  function handleAddressChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      scheduleForward(next)
      return next
    })
  }

  function handleCoordChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      const la = Number(next.latitude)
      const lo = Number(next.longitude)
      if (Number.isFinite(la) && Number.isFinite(lo) && next.latitude && next.longitude) {
        scheduleReverse(la, lo)
      }
      return next
    })
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handlePick(lat: number, lon: number) {
    setForm((prev) => ({ ...prev, latitude: lat.toFixed(6), longitude: lon.toFixed(6) }))
    scheduleReverse(lat, lon)
  }

  function handleUseMyLocation() {
    if (!('geolocation' in navigator)) {
      setGeoStatus('Tu navegador no soporta geolocalización.')
      return
    }
    if (locating) return

    setLocating(true)
    setGeoStatus('Solicitando permiso de ubicación…')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setForm((prev) => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }))
        scheduleReverse(latitude, longitude)
        setLocating(false)
        setGeoStatus(`Ubicación obtenida (±${Math.round(accuracy)} m).`)
      },
      (err) => {
        setLocating(false)
        setGeoStatus(`No se pudo obtener la ubicación: ${err.message}`)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    const mac = form.mac_address.trim()
    if (!name || !mac) {
      toast.error('El nombre y la dirección MAC son obligatorios.')
      return
    }

    const body: NodeUpdate = {
      name,
      mac_address: mac,
      ddns: form.ddns.trim() || undefined,
      address: form.address.trim() || undefined,
      zip: form.zip.trim() || undefined,
      city: form.city.trim() || undefined,
      location: form.location.trim() || undefined,
      latitude: validLat ?? undefined,
      longitude: validLon ?? undefined,
      bluetooth_enabled: form.bluetooth_enabled,
      wifi_enabled: form.wifi_enabled,
      wired_enabled: form.wired_enabled,
    }

    if (form.access_password.trim()) {
      body.access_password = form.access_password.trim()
    }

    setSubmitting(true)
    try {
      await updateNode(node.id, body)
    } catch {
      /* toast de error del cliente API */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="nilo-ndetail-section nilo-ndetail-section--data nilo-ndetail-form" onSubmit={handleSubmit}>
      <section className="nilo-ndetail-form__block">
        <h3 className="nilo-ndetail-form__block-title">
          <MaterialIcon name="dns" size={20} />
          Node Details
        </h3>
        <div className="nilo-ndetail-form__fields">
          <div className="nilo-ndetail-form__field">
            <label htmlFor="node-name">Name</label>
            <input id="node-name" name="name" type="text" value={form.name} onChange={handleChange} />
          </div>
          <div className="nilo-ndetail-form__field">
            <label htmlFor="node-mac">MAC Address</label>
            <input id="node-mac" name="mac_address" type="text" value={form.mac_address} onChange={handleChange} />
          </div>
          <div className="nilo-ndetail-form__field">
            <label htmlFor="node-ddns">DDNS</label>
            <input id="node-ddns" name="ddns" type="text" value={form.ddns} onChange={handleChange} />
          </div>
          <div className="nilo-ndetail-form__field">
            <label htmlFor="node-password">Access Password</label>
            <input
              id="node-password"
              name="access_password"
              type="password"
              value={form.access_password}
              onChange={handleChange}
              placeholder="Dejar vacío para no cambiar"
            />
          </div>
        </div>
      </section>

      <section className="nilo-ndetail-form__block">
        <h3 className="nilo-ndetail-form__block-title">
          <MaterialIcon name="settings_ethernet" size={20} />
          Connectivity
        </h3>
        <div className="nilo-ndetail-form__checks">
          <label className="nilo-ndetail-form__check">
            <input type="checkbox" name="wifi_enabled" checked={form.wifi_enabled} onChange={handleChange} />
            <span>Wi‑Fi</span>
          </label>
          <label className="nilo-ndetail-form__check">
            <input type="checkbox" name="bluetooth_enabled" checked={form.bluetooth_enabled} onChange={handleChange} />
            <span>Bluetooth</span>
          </label>
          <label className="nilo-ndetail-form__check">
            <input type="checkbox" name="wired_enabled" checked={form.wired_enabled} onChange={handleChange} />
            <span>Cable</span>
          </label>
        </div>
      </section>

      <section className="nilo-ndetail-form__block">
        <div className="nilo-ndetail-form__block-head">
          <h3 className="nilo-ndetail-form__block-title">
            <MaterialIcon name="location_on" size={20} />
            Location
          </h3>
          <button type="button" className="nilo-ndetail-form__locate" onClick={handleUseMyLocation} disabled={locating}>
            <MaterialIcon name={locating ? 'sync' : 'my_location'} size={18} />
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        </div>
        <div className="nilo-ndetail-form__fields">
          <div className="nilo-ndetail-form__field nilo-ndetail-form__field--full">
            <label htmlFor="node-address">Address</label>
            <input id="node-address" name="address" type="text" value={form.address} onChange={handleAddressChange} />
          </div>
          <div className="nilo-ndetail-form__field">
            <label htmlFor="node-zip">ZIP / Postal Code</label>
            <input id="node-zip" name="zip" type="text" value={form.zip} onChange={handleAddressChange} />
          </div>
          <div className="nilo-ndetail-form__field">
            <label htmlFor="node-city">City</label>
            <input id="node-city" name="city" type="text" value={form.city} onChange={handleAddressChange} />
          </div>
          <div className="nilo-ndetail-form__field nilo-ndetail-form__field--full">
            <label htmlFor="node-location">Location / Site</label>
            <input id="node-location" name="location" type="text" value={form.location} onChange={handleChange} />
          </div>
          <div className="nilo-ndetail-form__field">
            <label htmlFor="node-latitude">Latitude</label>
            <input
              id="node-latitude"
              name="latitude"
              type="text"
              inputMode="decimal"
              value={form.latitude}
              onChange={handleCoordChange}
            />
          </div>
          <div className="nilo-ndetail-form__field">
            <label htmlFor="node-longitude">Longitude</label>
            <input
              id="node-longitude"
              name="longitude"
              type="text"
              inputMode="decimal"
              value={form.longitude}
              onChange={handleCoordChange}
            />
          </div>
        </div>
        {geoStatus && <p className="nilo-ndetail-form__geostatus">{geoStatus}</p>}
        <NodeLocationMap lat={validLat} lon={validLon} onPick={handlePick} />
      </section>

      <div className="nilo-ndetail-form__actions">
        <button type="submit" className="nilo-ndetail__btn nilo-ndetail__btn--save" disabled={submitting}>
          <MaterialIcon name="save" size={18} />
          <span>{submitting ? 'Saving…' : 'Save'}</span>
        </button>
      </div>
    </form>
  )
}
