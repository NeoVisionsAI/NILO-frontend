/**
 * Acceso tipado y centralizado a las variables de entorno.
 * Evita usar `import.meta.env` disperso por todo el código.
 */

const API_PORT = import.meta.env.VITE_API_PORT ?? '8001'
const API_PATH = import.meta.env.VITE_API_PATH ?? '/api/v1'

/**
 * Resuelve la URL base de la API en runtime.
 * Deriva el host del frontend (`window.location.hostname`) para que funcione
 * en LAN (tablet, móvil, otro PC) sin hardcodear localhost en el build.
 */
function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}${API_PATH}`
  }

  return import.meta.env.VITE_API_BASE_URL ?? `http://localhost:${API_PORT}${API_PATH}`
}

export const env = {
  get apiBaseUrl(): string {
    return resolveApiBaseUrl()
  },
  appName: import.meta.env.VITE_APP_NAME ?? 'NILO',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}
