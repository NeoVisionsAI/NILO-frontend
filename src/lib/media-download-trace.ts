import { env } from '@/config/env'

/** En HTTPS el navegador bloquea fetch a URLs http:// (p. ej. MinIO interno). */
export function isBrowserSafeMediaUrl(url: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    const u = new URL(url, window.location.href)
    if (window.location.protocol === 'https:' && u.protocol === 'http:') return false
    return true
  } catch {
    return false
  }
}

export function shouldPreferApiMediaProxy(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:'
}

const debugEnabled =
  env.isDev || String(import.meta.env.VITE_DEBUG_MEDIA ?? '').toLowerCase() === 'true'

export class MediaDownloadTracer {
  private readonly steps: string[] = []

  log(step: string, detail?: string): void {
    const line = detail ? `${step} (${detail})` : step
    this.steps.push(line)
    if (debugEnabled) console.info('[nilo-media-download]', line)
  }

  logSkip(step: string, reason: string): void {
    this.log(`${step} omitido`, reason)
  }

  summary(): string {
    return this.steps.join(' → ')
  }
}