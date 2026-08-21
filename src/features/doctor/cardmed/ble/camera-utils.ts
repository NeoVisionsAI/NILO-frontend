import type { CardmedResponse } from './types'

interface ChunkPayload {
  index: number
  total_chunks: number
  chunk_base64: string
}

export function chunksToBlob(responses: CardmedResponse[]): Blob {
  const sorted = [...responses].sort(
    (a, b) =>
      ((a.data as unknown as ChunkPayload)?.index ?? 0) -
      ((b.data as unknown as ChunkPayload)?.index ?? 0),
  )
  const bytes = sorted.flatMap((response) => {
    const chunk = (response.data as unknown as ChunkPayload)?.chunk_base64 ?? ''
    return Array.from(atob(chunk), (char) => char.charCodeAt(0))
  })
  return new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
