/**
 * Acceso tipado y centralizado a las variables de entorno.
 * Evita usar `import.meta.env` disperso por todo el código.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001/api/v1',
  appName: import.meta.env.VITE_APP_NAME ?? 'NILO',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const
