/** Parámetros comunes de listado admin (pacientes y médicos). */
export interface AdminUserListParams {
  q?: string
  name?: string
  lastname?: string
  email?: string
  country?: string
  zip?: string
  skip?: number
  limit?: number
}

/** Parámetros de listado admin de nodos. */
export interface AdminNodeListParams {
  q?: string
  name?: string
  mac_address?: string
  city?: string
  public_ip?: string
  ddns?: string
  skip?: number
  limit?: number
}

export function buildQueryString(params: object): string {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== '') q.set(key, String(value))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}
