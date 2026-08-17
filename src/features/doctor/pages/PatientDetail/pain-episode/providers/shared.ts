import type { FaceLandmarkDetection, FaceLandmarkPoint } from './types'

export function normalizeLandmarkPoint(
  point: { x: number; y: number; z?: number | null } | number[],
  videoWidth: number,
  videoHeight: number,
): FaceLandmarkPoint {
  const raw =
    Array.isArray(point) ?
      { x: point[0], y: point[1], z: point[2] ?? 0 }
    : point
  const x = raw.x > 1 ? raw.x / videoWidth : raw.x
  const y = raw.y > 1 ? raw.y / videoHeight : raw.y
  return { x, y, z: raw.z ?? 0 }
}

export function remapLandmarksForDisplay(
  landmarks: FaceLandmarkPoint[],
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
  mirror: boolean,
): FaceLandmarkPoint[] {
  const scale = Math.max(displayWidth / videoWidth, displayHeight / videoHeight)
  const drawW = videoWidth * scale
  const drawH = videoHeight * scale
  const offsetX = (displayWidth - drawW) / 2
  const offsetY = (displayHeight - drawH) / 2

  return landmarks.map((lm) => {
    let px = lm.x * drawW + offsetX
    const py = lm.y * drawH + offsetY
    if (mirror) px = displayWidth - px
    return {
      x: px / displayWidth,
      y: py / displayHeight,
      z: lm.z,
    }
  })
}

export function drawGenericLandmarks(
  ctx: CanvasRenderingContext2D,
  detection: FaceLandmarkDetection,
  video: HTMLVideoElement,
  displayWidth: number,
  displayHeight: number,
  mirror: boolean,
  showFaceMesh: boolean,
) {
  if (!detection.faces.length || !video.videoWidth) return

  const radius = showFaceMesh ? 1.2 : 2.2

  for (const face of detection.faces) {
    const mapped = remapLandmarksForDisplay(
      face,
      video.videoWidth,
      video.videoHeight,
      displayWidth,
      displayHeight,
      mirror,
    )

    ctx.fillStyle = showFaceMesh ? '#f97316cc' : '#f97316'
    for (const point of mapped) {
      ctx.beginPath()
      ctx.arc(point.x * displayWidth, point.y * displayHeight, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function detectionToLandmarkArrays(detection: FaceLandmarkDetection) {
  return detection.faces.map((face) => face.map((p) => ({ x: p.x, y: p.y, z: p.z })))
}
