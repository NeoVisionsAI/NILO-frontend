/** Fecha/hora aproximada del lote a partir de la ruta MinIO (`DD-MM-YYYY/landmarks_<unix>_…`). */
export function landmarkRecordedAtMs(objectKey: string): number {
  const key = objectKey.replace(/^\/+/, '')

  const unixMatch = key.match(/landmarks_(\d{10,13})_/i) ?? key.match(/[_-](\d{10,13})[_-]/)
  if (unixMatch) {
    const raw = Number(unixMatch[1])
    if (Number.isFinite(raw)) {
      const ms = raw > 1e12 ? raw : raw * 1000
      if (ms > 0) return ms
    }
  }

  const dateSeg = key.match(/(\d{2})-(\d{2})-(\d{4})/)
  if (dateSeg) {
    const day = Number(dateSeg[1])
    const month = Number(dateSeg[2])
    const year = Number(dateSeg[3])
    const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
    if (Number.isFinite(ms)) return ms
  }

  return NaN
}

export function formatLandmarkChipLabel(objectKey: string): string {
  const ms = landmarkRecordedAtMs(objectKey)
  if (Number.isNaN(ms)) {
    const tail = objectKey.split('/').pop() ?? objectKey
    return tail.length > 28 ? `${tail.slice(0, 25)}…` : tail
  }
  return new Date(ms).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function sortLandmarksByRecordedAt<T extends { id: string; object_key: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ma = landmarkRecordedAtMs(a.object_key)
    const mb = landmarkRecordedAtMs(b.object_key)
    if (!Number.isNaN(ma) && !Number.isNaN(mb) && ma !== mb) return ma - mb
    if (!Number.isNaN(ma) && Number.isNaN(mb)) return -1
    if (Number.isNaN(ma) && !Number.isNaN(mb)) return 1
    return a.object_key.localeCompare(b.object_key)
  })
}