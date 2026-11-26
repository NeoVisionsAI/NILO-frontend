/** Silueta neutra mientras se decodifica el fichero (misma longitud que picos reales). */
export const AUDIO_WAVE_PLACEHOLDER_PEAKS: number[] = Array.from({ length: 140 }, (_, i) => {
  const t = i / 140
  return 0.07 + 0.14 * (Math.sin(t * Math.PI * 6.5) ** 2) * (0.55 + 0.45 * Math.sin(t * Math.PI * 2.1 + 0.6))
})

/** Suaviza picos para una silueta más continua (media móvil). */
export function smoothWaveformPeaks(peaks: number[], radius = 3): number[] {
  if (peaks.length < 3) return peaks
  const out = new Array<number>(peaks.length)
  for (let i = 0; i < peaks.length; i += 1) {
    let sum = 0
    let n = 0
    for (let j = i - radius; j <= i + radius; j += 1) {
      if (j < 0 || j >= peaks.length) continue
      sum += peaks[j]!
      n += 1
    }
    out[i] = n ? sum / n : peaks[i]!
  }
  return out
}

function lerpPeak(peaks: number[], t: number): number {
  const n = peaks.length
  if (n === 0) return 0
  if (n === 1) return peaks[0]!
  const f = t * (n - 1)
  const i = Math.floor(f)
  const frac = f - i
  const a = peaks[i]!
  const b = peaks[Math.min(i + 1, n - 1)]!
  return a + (b - a) * frac
}

/** Silueta simétrica suave (relleno arriba + abajo). */
export function drawSmoothWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  width: number,
  height: number,
  fillStyle: string | CanvasGradient,
): void {
  const mid = height / 2
  const ampScale = height * 0.46
  const steps = Math.max(48, Math.floor(width * 1.25))

  const topY = (x: number) => {
    const t = x / width
    return mid - lerpPeak(peaks, t) * ampScale
  }
  const bottomY = (x: number) => {
    const t = x / width
    return mid + lerpPeak(peaks, t) * ampScale
  }

  ctx.beginPath()
  ctx.moveTo(0, mid)
  for (let s = 0; s <= steps; s += 1) {
    const x = (s / steps) * width
    ctx.lineTo(x, topY(x))
  }
  ctx.lineTo(width, mid)
  for (let s = steps; s >= 0; s -= 1) {
    const x = (s / steps) * width
    ctx.lineTo(x, bottomY(x))
  }
  ctx.closePath()
  ctx.fillStyle = fillStyle
  ctx.fill()
}

/** Picos normalizados 0–1 para dibujar la forma de onda del fichero. */
export async function computeWaveformPeaks(url: string, bars = 140): Promise<number[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo leer el audio (${res.status})`)
  const buf = await res.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const audio = await ctx.decodeAudioData(buf.slice(0))
    const ch = audio.getChannelData(0)
    const block = Math.max(1, Math.floor(ch.length / bars))
    const peaks: number[] = []
    for (let i = 0; i < bars; i += 1) {
      let max = 0
      const start = i * block
      for (let j = 0; j < block; j += 1) {
        max = Math.max(max, Math.abs(ch[start + j] ?? 0))
      }
      peaks.push(max)
    }
    const top = Math.max(...peaks, 1e-6)
    return smoothWaveformPeaks(
      peaks.map((p) => p / top),
      4,
    )
  } finally {
    await ctx.close()
  }
}

export function isVoiceNoteClip(kind: string | undefined): boolean {
  return kind === 'voice_note'
}