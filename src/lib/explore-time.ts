import type { MonitoringSession } from '@/types/monitoring-session'
import { parseApiDateMs } from './parse-api-datetime'

export function sessionBounds(session: MonitoringSession): { startMs: number; endMs: number } {
  const startMs = parseApiDateMs(session.started_at)
  const endMs = session.ended_at ? parseApiDateMs(session.ended_at) : Date.now()
  return { startMs, endMs: Math.max(startMs, endMs) }
}

export function sessionDurationHours(session: MonitoringSession): number {
  const { startMs, endMs } = sessionBounds(session)
  return Math.max(0, (endMs - startMs) / 3_600_000)
}

/** Sesiones que solapan el intervalo [filterStart, filterEnd] (datetime-local o ISO). */
export function sessionOverlapsInterval(
  session: MonitoringSession,
  filterStart: string,
  filterEnd: string,
): boolean {
  const a = new Date(filterStart).getTime()
  const b = new Date(filterEnd).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return true
  const from = Math.min(a, b)
  const to = Math.max(a, b)
  const { startMs, endMs } = sessionBounds(session)
  if (Number.isNaN(startMs)) return false
  return startMs <= to && endMs >= from
}

export function isoInRange(ts: string, fromMs: number, toMs: number): boolean {
  const t = parseApiDateMs(ts)
  if (Number.isNaN(t)) return true
  return t >= fromMs && t <= toMs
}

export function msToLocalDatetimeValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}