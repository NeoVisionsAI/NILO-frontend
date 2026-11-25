/** Fechas API sin zona: asumimos UTC (evita desfase ~1 h en España). */
export function parseApiDateMs(iso: string | null | undefined): number {
  if (!iso?.trim()) return Number.NaN
  const trimmed = iso.trim()
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed).getTime()
  }
  return new Date(`${trimmed}Z`).getTime()
}