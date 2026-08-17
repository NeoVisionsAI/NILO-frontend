/**
 * Acceso tipado y centralizado a las variables de entorno.
 * Evita usar `import.meta.env` disperso por todo el código.
 */

const API_PATH = import.meta.env.VITE_API_PATH ?? '/api/v1'

/**
 * URL base de la API en runtime.
 * - Por defecto: misma origen (/api/v1 proxied por nginx).
 * - VITE_API_DIRECT=true: llama al backend directo (útil si el proxy nginx falla; requiere CORS).
 */
function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if (import.meta.env.VITE_API_DIRECT === 'true') {
      return import.meta.env.VITE_API_BASE_URL ?? `https://${window.location.hostname}:8443${API_PATH}`
    }
    return `${window.location.origin}${API_PATH}`
  }

  return import.meta.env.VITE_API_BASE_URL ?? `https://localhost:8443${API_PATH}`
}

export const env = {
  get apiBaseUrl(): string {
    return resolveApiBaseUrl()
  },
  appName: import.meta.env.VITE_APP_NAME ?? 'NILO',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}
