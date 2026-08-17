export type FaceLandmarkEngineId =
  | 'mediapipe'
  | 'tfjs'
  | 'human'
  | 'face-api'
  | 'webar-rocks'
  | 'jeeliz'
  | 'banuba'

export interface FaceLandmarkPoint {
  x: number
  y: number
  z: number
}

export interface FaceLandmarkDetection {
  faces: FaceLandmarkPoint[][]
}

export interface FaceLandmarkEngineMeta {
  id: FaceLandmarkEngineId
  label: string
  description: string
  landmarkCount: string
  backend: string
  available: boolean
  unavailableReason?: string
}

export interface FaceLandmarkEngine {
  meta: FaceLandmarkEngineMeta
  init(): Promise<void>
  detect(video: HTMLVideoElement, timestampMs: number): Promise<FaceLandmarkDetection>
  draw(
    ctx: CanvasRenderingContext2D,
    detection: FaceLandmarkDetection,
    video: HTMLVideoElement,
    displayWidth: number,
    displayHeight: number,
    mirror: boolean,
    showFaceMesh: boolean,
  ): void
  dispose(): void
}
