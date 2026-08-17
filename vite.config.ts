import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

function loadDevTls() {
  const certDir = path.resolve('certs')
  const keyPath = path.join(certDir, 'key.pem')
  const certPath = path.join(certDir, 'cert.pem')
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
  }
  return undefined
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiOrigin =
    env.VITE_API_BASE_URL?.replace(/\/api\/v1\/?$/, '') || 'https://192.168.1.43:8443'

  return {
    plugins: [
      react(),
      // Vite añade crossorigin a <script>/<link>; sin ACAO en nginx el módulo JS no carga en el navegador.
      {
        name: 'nilo-strip-crossorigin',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler(html: string) {
            return html.replace(/\s+crossorigin/g, '')
          },
        },
      },
    ],
    build: {
      modulePreload: false,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: Number(env.VITE_DEV_PORT || 5173),
      https: loadDevTls(),
      proxy: {
        '/api/v1': {
          target: apiOrigin,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      host: true,
      port: Number(env.VITE_PREVIEW_PORT || 4173),
      https: loadDevTls(),
      proxy: {
        '/api/v1': {
          target: apiOrigin,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
