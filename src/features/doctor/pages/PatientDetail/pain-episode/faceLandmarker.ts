import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
  type FaceLandmarkerResult,
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

export function drawFaceLandmarks(
  ctx: CanvasRenderingContext2D,
  results: FaceLandmarkerResult,
  showFaceMesh: boolean,
) {
  if (!results.faceLandmarks?.length) return

  const drawing = new DrawingUtils(ctx)

  for (const landmarks of results.faceLandmarks) {
    if (showFaceMesh) {
      drawing.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
        color: '#38bdf880',
        lineWidth: 1,
      })
      drawing.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_CONTOURS, {
        color: '#22d3ee',
        lineWidth: 1.5,
      })
    }
    drawing.drawLandmarks(landmarks, {
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
