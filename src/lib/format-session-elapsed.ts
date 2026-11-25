import { parseApiDateMs } from './parse-api-datetime'

/** Tiempo transcurrido desde `startedAt` en días, horas y minutos (UTC/ISO del servidor). */
export function formatSessionElapsed(startedAtIso: string, nowMs: number = Date.now()): string {
  const start = parseApiDateMs(startedAtIso)
  if (Number.isNaN(start)) return '—'
  const ms = Math.max(0, nowMs - start)
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const parts: string[] = []
  if (days > 0) parts.push(`${days} d`)
  parts.push(`${hours} h`)
  parts.push(`${minutes} min`)
  return parts.join(' ')
}