const HEARTBEAT_STALE_MS = 2 * 60 * 1000

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return 'ahora'

  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `hace ${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `hace ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 48) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export function isHeartbeatStale(iso: string | null | undefined): boolean {
  if (!iso) return true
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return true
  return Date.now() - date.getTime() > HEARTBEAT_STALE_MS
}

export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const total = Math.floor(seconds)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}
