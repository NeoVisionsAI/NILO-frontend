/** Un frame de landmarks registrado durante la sesión de dolor. */
export interface PainEpisodeFrame {
  /** Milisegundos desde el inicio de la grabación. */
  t: number
  landmarks: Array<Array<{ x: number; y: number; z: number }>>
}

/** Episodio de dolor con captura de landmarks faciales. */
export interface PainEpisode {
  id: string
  patientId: string
  startedAt: string
  endedAt: string
  durationMs: number
  frames: PainEpisodeFrame[]
}

/** Datos de sesión en cliente antes de enviar al backend. */
export type PainEpisodeSessionData = Omit<PainEpisode, 'id'>

export function formatPainEpisodeDate(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatPainEpisodeElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function buildPainEpisodeSession(
  patientId: string,
  startedAt: Date,
  endedAt: Date,
  frames: PainEpisodeFrame[],
): PainEpisodeSessionData {
  return {
    patientId,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    frames,
  }
}
