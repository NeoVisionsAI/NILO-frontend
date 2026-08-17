import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'

let landmarkerPromise: Promise<FaceLandmarker> | null = null

export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
      const options = {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU' as const,
        },
        runningMode: 'VIDEO' as const,
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      }
      try {
        return await FaceLandmarker.createFromOptions(vision, options)
      } catch {
        return FaceLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'CPU' },
        })
      }
    })()
  }
  return landmarkerPromise
}

/** Mapea landmarks del frame de vídeo al rectángulo visible (object-fit: cover) + espejo frontal. */
function remapLandmarksForDisplay(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
  mirror: boolean,
): NormalizedLandmark[] {
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
      ...lm,
      x: px / displayWidth,
      y: py / displayHeight,
    }
  })
}

export function drawFaceLandmarks(
  ctx: CanvasRenderingContext2D,
  results: FaceLandmarkerResult,
  video: HTMLVideoElement,
  displayWidth: number,
  displayHeight: number,
  mirror: boolean,
  showFaceMesh: boolean,
) {
  if (!results.faceLandmarks?.length || !video.videoWidth) return

  const drawing = new DrawingUtils(ctx)

  for (const face of results.faceLandmarks) {
    const mapped = remapLandmarksForDisplay(
      face,
      video.videoWidth,
      video.videoHeight,
      displayWidth,
      displayHeight,
      mirror,
    )

    if (showFaceMesh) {
      drawing.drawConnectors(mapped, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
        color: '#38bdf880',
        lineWidth: 1,
      })
      drawing.drawConnectors(mapped, FaceLandmarker.FACE_LANDMARKS_CONTOURS, {
        color: '#22d3ee',
        lineWidth: 1.5,
      })
    }
    drawing.drawLandmarks(mapped, {
      color: '#f97316',
      lineWidth: 1,
      radius: showFaceMesh ? 1.5 : 2.5,
    })
  }
}

export function landmarksFromResult(results: FaceLandmarkerResult) {
  return (results.faceLandmarks ?? []).map((face) =>
    face.map((p) => ({ x: p.x, y: p.y, z: p.z })),
  )
}
