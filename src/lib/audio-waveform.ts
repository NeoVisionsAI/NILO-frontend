/** Picos normalizados 0–1 para dibujar la forma de onda del fichero. */
export async function computeWaveformPeaks(url: string, bars = 96): Promise<number[]> {
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
    return peaks.map((p) => p / top)
  } finally {
    await ctx.close()
  }
}

export function isVoiceNoteClip(kind: string | undefined): boolean {
  return kind === 'voice_note'
}