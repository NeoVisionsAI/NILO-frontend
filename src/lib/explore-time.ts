import type { MonitoringSession } from '@/types/monitoring-session'

export function sessionBounds(session: MonitoringSession): { startMs: number; endMs: number } {
  const startMs = new Date(session.started_at).getTime()
  const endMs = session.ended_at ? new Date(session.ended_at).getTime() : Date.now()
  return { startMs, endMs: Math.max(startMs, endMs) }
}

export function sessionDurationHours(session: MonitoringSession): number {
  const { startMs, endMs } = sessionBounds(session)
  return Math.max(0, (endMs - startMs) / 3_600_000)
}

/** La sesión contiene el instante indicado por el filtro. */
export function sessionContainsDateTime(session: MonitoringSession, filterIso: string): boolean {
  const t = new Date(filterIso).getTime()
  if (Number.isNaN(t)) return true
  const { startMs, endMs } = sessionBounds(session)
  return t >= startMs && t <= endMs
}

export function isoInRange(ts: string, fromMs: number, toMs: number): boolean {
  const t = new Date(ts).getTime()
  if (Number.isNaN(t)) return true
  return t >= fromMs && t <= toMs
}

export function msToLocalDatetimeValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}