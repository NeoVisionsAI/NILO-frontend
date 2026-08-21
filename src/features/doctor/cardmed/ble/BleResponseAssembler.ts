const FRAME_TIMEOUT_MS = 15_000

interface FrameBucket {
  total: number
  parts: string[]
  timer: ReturnType<typeof setTimeout>
}

/** Reensambla notificaciones BLE fragmentadas `{t:"f", i, n, d}`. */
export class BleResponseAssembler {
  private pending = new Map<string, FrameBucket>()

  feed(notificationText: string): unknown {
    const obj = JSON.parse(notificationText) as { t?: string; i?: number; n?: number; d?: string }

    if (obj.t !== 'f') {
      return obj
    }

    const total = obj.n ?? 0
    const index = obj.i ?? 0
    const key = `n${total}`

    let bucket = this.pending.get(key)
    if (!bucket) {
      bucket = {
        total,
        parts: new Array(total),
        timer: setTimeout(() => this.pending.delete(key), FRAME_TIMEOUT_MS),
      }
      this.pending.set(key, bucket)
    }

    bucket.parts[index] = obj.d ?? ''

    if (bucket.parts.every((part) => part !== undefined)) {
      clearTimeout(bucket.timer)
      this.pending.delete(key)
      return JSON.parse(bucket.parts.join(''))
    }

    return null
  }

  clear() {
    for (const bucket of this.pending.values()) {
      clearTimeout(bucket.timer)
    }
    this.pending.clear()
  }
}
