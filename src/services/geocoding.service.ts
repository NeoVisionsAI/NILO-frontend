/**
 * Servicio de geocodificación basado en Nominatim (OpenStreetMap).
 * No requiere API key. Uso sujeto a la política de Nominatim (máx. ~1 req/s),
 * por eso las llamadas deben ir debounced desde la UI.
 */

const BASE_URL = 'https://nominatim.openstreetmap.org'

export interface GeoAddress {
  address: string
  city: string
  zip: string
  /** true si la dirección incluye número de portal (nivel edificio). */
  hasHouseNumber: boolean
}

export interface GeoResult extends GeoAddress {
  lat: number
  lon: number
}

/** Geocodificación directa: texto de dirección -> coordenadas. */
export async function geocodeForward(query: string): Promise<GeoResult | null> {
  const q = query.trim()
  if (!q) return null

  const url = `${BASE_URL}/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null

  const data = (await res.json()) as Array<{
    lat: string
    lon: string
    address?: Record<string, string>
  }>
  const hit = data[0]
  if (!hit) return null

  return {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    ...extractAddress(hit.address ?? {}),
  }
}

/** Geocodificación inversa: coordenadas -> dirección. */
export async function geocodeReverse(lat: number, lon: number): Promise<GeoAddress | null> {
  // zoom=18 => máximo detalle (nivel edificio) para intentar obtener el número.
  const url = `${BASE_URL}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lon}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null

  const data = (await res.json()) as { address?: Record<string, string> }
  if (!data.address) return null
  return extractAddress(data.address)
}

function extractAddress(a: Record<string, string>): GeoAddress {
  const hasHouseNumber = Boolean(a.house_number)
  // Formato "Calle, número" (el número tras el nombre de la vía).
  const street = a.road ? [a.road, a.house_number].filter(Boolean).join(', ') : a.house_number || ''
  const city = a.city || a.town || a.village || a.municipality || a.county || ''
  const zip = a.postcode || ''
  return { address: street, city, zip, hasHouseNumber }
}
