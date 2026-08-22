const FRAME_TIMEOUT_MS = 120_000

interface FrameBucket {
  total: number
  parts: string[]
  timer: ReturnType<typeof setTimeout>
}

/** Reensambla notificaciones BLE fragmentadas `{t:"f", i, n, d}`. */
export class BleResponseAssembler {
  private pending = new Map<string, FrameBucket>()
  private activeRequestId: string | null = null

  /** Asocia frames entrantes a la petición BLE activa (una sola in-flight). */
  setActiveRequestId(id: string | null) {
    if (this.activeRequestId && this.activeRequestId !== id) {
      this.clearBucket(this.activeRequestId)
    }
    this.activeRequestId = id
  }

  feed(notificationText: string): unknown {
    const obj = JSON.parse(notificationText) as { t?: string; i?: number; n?: number; d?: string }

    if (obj.t !== 'f') {
      return obj
    }

    const total = obj.n ?? 0
    const index = obj.i ?? 0
    const key = this.activeRequestId ?? `orphan-n${total}`

    let bucket = this.pending.get(key)
    if (!bucket) {
      bucket = {
        total,
        parts: new Array(total),
        timer: setTimeout(() => this.clearBucket(key), FRAME_TIMEOUT_MS),
      }
      this.pending.set(key, bucket)
    }

    bucket.parts[index] = obj.d ?? ''

    if (bucket.parts.every((part) => part !== undefined)) {
      this.clearBucket(key)
      return JSON.parse(bucket.parts.join(''))
    }

    return null
  }

  private clearBucket(key: string) {
    const bucket = this.pending.get(key)
    if (bucket) {
      clearTimeout(bucket.timer)
      this.pending.delete(key)
    }
  }

  clear() {
    for (const key of [...this.pending.keys()]) {
      this.clearBucket(key)
    }
    this.activeRequestId = null
  }
}
