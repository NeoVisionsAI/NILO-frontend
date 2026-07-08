import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ROOT_PATHS } from '@/router/paths'
import { geocodeForward, geocodeReverse } from '@/services/geocoding.service'
import { toast } from '@/lib/toast'
import type { NodeCreate } from '@/types'
import { useClinicalData } from '../../context/ClinicalDataContext'
import { NodeLocationMap } from './NodeLocationMap'
import './AddNodePage.css'

type Method = 'qr' | 'manual' | null

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
}

const EMPTY_FORM: NodeForm = {
  name: '',
  mac_address: '',
  ddns: '',
  address: '',
  zip: '',
  city: '',
  location: '',
  latitude: '',
  longitude: '',
  access_password: '',
}

export function AddNodePage() {
  const navigate = useNavigate()
  const { createNode } = useClinicalData()
  const [method, setMethod] = useState<Method>(null)
  const [form, setForm] = useState<NodeForm>(EMPTY_FORM)
  const [geoStatus, setGeoStatus] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const forwardTimer = useRef<number>()
  const reverseTimer = useRef<number>()

  const latNum = form.latitude ? Number(form.latitude) : NaN
  const lonNum = form.longitude ? Number(form.longitude) : NaN
  const validLat = Number.isFinite(latNum) ? latNum : null
  const validLon = Number.isFinite(lonNum) ? lonNum : null

  /** Programa geocodificación directa (dirección -> coordenadas). */
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

  /** Programa geocodificación inversa (coordenadas -> dirección). */
  function scheduleReverse(lat: number, lon: number) {
    window.clearTimeout(reverseTimer.current)
    reverseTimer.current = window.setTimeout(async () => {
      setGeoStatus('Obteniendo dirección…')
      try {
        const res = await geocodeReverse(lat, lon)
        if (res) {
          setForm((prev) => {
            // Si la inversa no trae número pero el usuario ya escribió una
            // dirección, conservamos la suya (para no perder el portal).
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

  /** Campos que disparan geocodificación directa. */
  function handleAddressChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      scheduleForward(next)
      return next
    })
  }

  /** Campos de coordenadas: disparan geocodificación inversa. */
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

  /** Campos normales sin efectos secundarios. */
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  /** Selección de punto en el mapa (click o arrastre del marcador). */
  function handlePick(lat: number, lon: number) {
    setForm((prev) => ({ ...prev, latitude: lat.toFixed(6), longitude: lon.toFixed(6) }))
    scheduleReverse(lat, lon)
  }

  /**
   * Autolocalización por navegador (pide permiso).
   * Usa watchPosition para recoger lecturas y quedarse con la de MEJOR
   * precisión. Sigue afinando hasta alcanzar TARGET_ACCURACY_M o agotar
   * MAX_WAIT_MS. Si no lo consigue, avisa (limitación del hardware/red).
   */
  function handleUseMyLocation() {
    if (!('geolocation' in navigator)) {
      setGeoStatus('Tu navegador no soporta geolocalización.')
      return
    }
    if (locating) return

    const TARGET_ACCURACY_M = 30
    const MAX_WAIT_MS = 25000

    setLocating(true)
    setGeoStatus('Solicitando permiso de ubicación…')

    let best: GeolocationPosition | null = null
    const startedAt = Date.now()

    const finish = () => {
      window.clearTimeout(timeoutId)
      navigator.geolocation.clearWatch(watchId)
      setLocating(false)
      if (!best) return

      const { latitude, longitude, accuracy } = best.coords
      setForm((prev) => ({
        ...prev,
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
      }))
      scheduleReverse(latitude, longitude)

      const acc = Math.round(accuracy)
      if (accuracy <= TARGET_ACCURACY_M) {
        setGeoStatus(`Ubicación fijada con buena precisión (±${acc} m).`)
      } else {
        setGeoStatus(
          `Precisión limitada (±${acc} m): tu dispositivo no tiene GPS o está desactivado. ` +
            `Arrastra el marcador para ajustar el punto exacto.`,
        )
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos
        const bestAcc = Math.round(best.coords.accuracy)
        setGeoStatus(`Afinando ubicación… mejor hasta ahora ±${bestAcc} m`)
        // Paramos si alcanzamos el objetivo o si se agota el tiempo máximo.
        if (best.coords.accuracy <= TARGET_ACCURACY_M || Date.now() - startedAt >= MAX_WAIT_MS) {
          finish()
        }
      },
      (err) => {
        window.clearTimeout(timeoutId)
        navigator.geolocation.clearWatch(watchId)
        setLocating(false)
        setGeoStatus(`No se pudo obtener la ubicación: ${err.message}`)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT_MS },
    )

    // Corte de seguridad: usamos la mejor lectura al agotar el tiempo máximo.
    const timeoutId = window.setTimeout(finish, MAX_WAIT_MS)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    const mac = form.mac_address.trim()
    if (!name || !mac) {
      toast.error('El nombre y la dirección MAC son obligatorios.')
      return
    }

    const body: NodeCreate = { name, mac_address: mac }
    if (form.ddns.trim()) body.ddns = form.ddns.trim()
    if (form.access_password.trim()) body.access_password = form.access_password.trim()
    if (form.address.trim()) body.address = form.address.trim()
    if (form.zip.trim()) body.zip = form.zip.trim()
    if (form.city.trim()) body.city = form.city.trim()
    if (form.location.trim()) body.location = form.location.trim()
    if (validLat !== null) body.latitude = validLat
    if (validLon !== null) body.longitude = validLon

    setSubmitting(true)
    try {
      await createNode(body)
      navigate(ROOT_PATHS.doctor)
    } catch {
      /* el cliente API ya muestra el toast de error */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="nilo-addn">
      <header className="nilo-addn__header">
        <h1 className="nilo-addn__title">Add New Node</h1>
        <p className="nilo-addn__subtitle">
          Register a monitoring node by scanning its QR code or entering its details manually.
        </p>
      </header>

      {/* Paso 1: elección de método */}
      {method === null && (
        <div className="nilo-addn__choices">
          <button className="nilo-addn__choice" onClick={() => setMethod('qr')}>
            <span className="nilo-addn__choice-icon">
              <MaterialIcon name="qr_code_scanner" size={40} />
            </span>
            <span className="nilo-addn__choice-title">Scan QR Code</span>
            <span className="nilo-addn__choice-desc">
              Usa la cámara para leer el QR físico del dispositivo.
            </span>
          </button>

          <button
            className="nilo-addn__choice nilo-addn__choice--outlined"
            onClick={() => setMethod('manual')}
          >
            <span className="nilo-addn__choice-icon">
              <MaterialIcon name="keyboard" size={40} />
            </span>
            <span className="nilo-addn__choice-title">Add Manually</span>
            <span className="nilo-addn__choice-desc">
              Introduce los datos del nodo en un formulario.
            </span>
          </button>
        </div>
      )}

      {/* Opción QR (planteada, pendiente de implementar) */}
      {method === 'qr' && (
        <div className="nilo-addn__card">
          <button className="nilo-addn__back" onClick={() => setMethod(null)}>
            <MaterialIcon name="arrow_back" size={18} />
            Volver
          </button>
          <div className="nilo-addn__qr">
            <MaterialIcon name="photo_camera" size={56} />
            <h3>Escaneo por cámara</h3>
            <p>
              Aquí se abrirá la cámara para capturar el código QR situado físicamente en el
              dispositivo. Esta funcionalidad se implementará más adelante.
            </p>
            <button className="nilo-addn__btn nilo-addn__btn--primary" disabled>
              <MaterialIcon name="photo_camera" size={18} />
              Abrir cámara (próximamente)
            </button>
          </div>
        </div>
      )}

      {/* Opción manual */}
      {method === 'manual' && (
        <div className="nilo-addn__card">
          <button className="nilo-addn__back" onClick={() => setMethod(null)}>
            <MaterialIcon name="arrow_back" size={18} />
            Volver
          </button>

          <form className="nilo-addn__form" onSubmit={handleSubmit}>
            {/* Identidad del nodo */}
            <section className="nilo-addn__section">
              <h3 className="nilo-addn__section-title">
                <MaterialIcon name="dns" size={20} />
                Node Details
              </h3>
              <div className="nilo-addn__fields">
                <div className="nilo-addn__field">
                  <label htmlFor="name">Name</label>
                  <input id="name" name="name" type="text" value={form.name} onChange={handleChange} placeholder="e.g., Room 204 Monitor" />
                </div>
                <div className="nilo-addn__field">
                  <label htmlFor="mac_address">MAC Address</label>
                  <input id="mac_address" name="mac_address" type="text" value={form.mac_address} onChange={handleChange} placeholder="AA:BB:CC:DD:EE:FF" />
                </div>
                <div className="nilo-addn__field">
                  <label htmlFor="ddns">DDNS</label>
                  <input id="ddns" name="ddns" type="text" value={form.ddns} onChange={handleChange} placeholder="node-1234.ddns.net" />
                </div>
                <div className="nilo-addn__field">
                  <label htmlFor="access_password">Access Password</label>
                  <input id="access_password" name="access_password" type="password" value={form.access_password} onChange={handleChange} placeholder="••••••••" />
                </div>
              </div>
            </section>

            {/* Ubicación */}
            <section className="nilo-addn__section">
              <div className="nilo-addn__section-head">
                <h3 className="nilo-addn__section-title">
                  <MaterialIcon name="location_on" size={20} />
                  Location
                </h3>
                <button
                  type="button"
                  className="nilo-addn__locate"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                >
                  <MaterialIcon name={locating ? 'sync' : 'my_location'} size={18} />
                  {locating ? 'Locating…' : 'Use my location'}
                </button>
              </div>

              <div className="nilo-addn__fields">
                <div className="nilo-addn__field nilo-addn__field--full">
                  <label htmlFor="address">Address</label>
                  <input id="address" name="address" type="text" value={form.address} onChange={handleAddressChange} placeholder="123 Clinical Way" />
                </div>
                <div className="nilo-addn__field">
                  <label htmlFor="zip">ZIP / Postal Code</label>
                  <input id="zip" name="zip" type="text" value={form.zip} onChange={handleAddressChange} placeholder="e.g., 28001" />
                </div>
                <div className="nilo-addn__field">
                  <label htmlFor="city">City</label>
                  <input id="city" name="city" type="text" value={form.city} onChange={handleAddressChange} placeholder="e.g., Madrid" />
                </div>
                <div className="nilo-addn__field nilo-addn__field--full">
                  <label htmlFor="location">Location / Site</label>
                  <input id="location" name="location" type="text" value={form.location} onChange={handleChange} placeholder="e.g., Building B, 2nd floor" />
                </div>
                <div className="nilo-addn__field">
                  <label htmlFor="latitude">Latitude</label>
                  <input id="latitude" name="latitude" type="text" inputMode="decimal" value={form.latitude} onChange={handleCoordChange} placeholder="40.416800" />
                </div>
                <div className="nilo-addn__field">
                  <label htmlFor="longitude">Longitude</label>
                  <input id="longitude" name="longitude" type="text" inputMode="decimal" value={form.longitude} onChange={handleCoordChange} placeholder="-3.703800" />
                </div>
              </div>

              {geoStatus && <p className="nilo-addn__geostatus">{geoStatus}</p>}

              <NodeLocationMap lat={validLat} lon={validLon} onPick={handlePick} />
            </section>

            {/* Acciones */}
            <div className="nilo-addn__actions">
              <button
                type="button"
                className="nilo-addn__btn nilo-addn__btn--ghost"
                onClick={() => navigate(ROOT_PATHS.doctor)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="nilo-addn__btn nilo-addn__btn--primary"
                disabled={submitting}
              >
                <MaterialIcon name="save" size={18} />
                {submitting ? 'Saving…' : 'Save Node'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
