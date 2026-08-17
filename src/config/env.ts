/**
 * Acceso tipado y centralizado a las variables de entorno.
 * Evita usar `import.meta.env` disperso por todo el código.
 */

const API_PATH = import.meta.env.VITE_API_PATH ?? '/api/v1'

/**
 * URL base de la API en runtime.
 * - Navegador: misma origen (`/api/v1` vía proxy nginx o Vite) → HTTPS, sin CORS ni mixed content.
 * - Build/SSR: `VITE_API_BASE_URL` (p. ej. https://192.168.1.43:8443/api/v1).
 */
function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
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
