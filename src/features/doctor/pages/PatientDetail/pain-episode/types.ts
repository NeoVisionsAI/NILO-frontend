/** Un frame de landmarks registrado durante la sesión de dolor. */
export interface PainEpisodeFrame {
  /** Milisegundos desde el inicio de la grabación. */
  t: number
  landmarks: Array<Array<{ x: number; y: number; z: number }>>
}

export interface PainEpisodeSessionData {
  patientId: string
  startedAt: string
  endedAt: string
  frames: PainEpisodeFrame[]
}
