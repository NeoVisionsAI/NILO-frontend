import { env } from '@/config/env'
import { startActivity, endActivity } from '@/lib/activity'
import { toast } from '@/lib/toast'

/**
 * Cliente HTTP de NILO.
 * - access_token en memoria (efímero), refresh_token en localStorage.
 * - Ante un 401 intenta refrescar el token una vez y reintenta la petición.
 * - Notifica actividad (barra de carga) y muestra toast rojo ante errores.
 */

const REFRESH_KEY = 'nilo.refresh'

let accessToken: string | null = null
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY)

export function getAccessToken(): string | null {
  return accessToken
}

/** ¿Hay sesión persistente (refresh token guardado)? */
export function hasSession(): boolean {
  return Boolean(refreshToken)
}

export function setTokens(access: string | null, refresh: string | null): void {
  accessToken = access
  refreshToken = refresh
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  else localStorage.removeItem(REFRESH_KEY)
}

export function clearTokens(): void {
  setTokens(null, null)
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

let refreshPromise: Promise<boolean> | null = null

/** Refresca el par de tokens usando el refresh token (single-flight). */
async function refreshTokens(): Promise<boolean> {
  if (!refreshToken) return false
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
        if (!res.ok) {
          clearTokens()
          return false
        }
        const data = (await res.json()) as TokenPair
        setTokens(data.access_token, data.refresh_token)
        return true
      } catch {
        return false
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

interface RequestOptions extends RequestInit {
  /** Si false, no adjunta el token ni intenta refrescar (login/refresh). */
  auth?: boolean
  /** Si true, no muestra toast automático ante error. */
  silent?: boolean
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) return data.detail[0].msg
    if (typeof data?.message === 'string') return data.message
  } catch {
    /* respuesta sin JSON */
  }
  return res.statusText || 'Error de red'
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { auth = true, silent = false, ...init } = options

  const headers = new Headers(init.headers)
  const isForm = init.body instanceof URLSearchParams
  if (init.body != null && !isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (auth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  startActivity()
  let res: Response
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, { ...init, headers })
  } catch {
    endActivity()
    if (!silent) toast.error('No se pudo conectar con el servidor.')
    throw new ApiError(0, 'No se pudo conectar con el servidor.')
  }
  endActivity()

  // Token caducado: intentamos refrescar una vez y reintentar.
  if (res.status === 401 && auth && !isRetry) {
    const ok = await refreshTokens()
    if (ok) return request<T>(path, options, true)
    clearTokens()
    if (!silent) toast.error('Tu sesión ha expirado. Vuelve a iniciar sesión.')
    throw new ApiError(401, 'Sesión expirada')
  }

  if (!res.ok) {
    const message = await parseError(res)
    if (!silent) toast.error(message)
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  /** POST con cuerpo form-urlencoded (usado por el login OAuth2). */
  postForm: <T>(path: string, form: URLSearchParams, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: form, auth: false }),
  /** POST multipart/form-data (p. ej. subida de foto de usuario). */
  postFormData: <T>(path: string, form: FormData, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: form }),
}

export type { TokenPair }
