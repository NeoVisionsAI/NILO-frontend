import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './NodeLocationMap.css'

// Icono por defecto de Leaflet servido por CDN (evita problemas de rutas de imágenes con el bundler).
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038] // Madrid

interface NodeLocationMapProps {
  lat: number | null
  lon: number | null
  /** Se llama al hacer click en el mapa o al arrastrar el marcador. */
  onPick: (lat: number, lon: number) => void
}

/** Recentra el mapa cuando cambian las coordenadas. */
function Recenter({ lat, lon }: { lat: number | null; lon: number | null }) {
  const map = useMap()
  useEffect(() => {
    if (lat != null && lon != null) {
      map.setView([lat, lon], Math.max(map.getZoom(), 14), { animate: true })
    }
  }, [lat, lon, map])
  return null
}

/** Captura los clicks en el mapa. */
function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function NodeLocationMap({ lat, lon, onPick }: NodeLocationMapProps) {
  const hasPoint = lat != null && lon != null
  const center = hasPoint ? ([lat, lon] as [number, number]) : DEFAULT_CENTER

  return (
    <div className="nilo-nodemap">
      <MapContainer center={center} zoom={hasPoint ? 14 : 5} className="nilo-nodemap__canvas" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onPick} />
        <Recenter lat={lat} lon={lon} />
        {hasPoint && (
          <Marker
            position={[lat, lon]}
            icon={markerIcon}
            draggable
            eventHandlers={{
              dragend(e) {
                const { lat: newLat, lng: newLng } = e.target.getLatLng()
                onPick(newLat, newLng)
              },
            }}
          />
        )}
      </MapContainer>
      <p className="nilo-nodemap__hint">
        Haz click en el mapa o arrastra el marcador para ajustar la ubicación.
      </p>
    </div>
  )
}
