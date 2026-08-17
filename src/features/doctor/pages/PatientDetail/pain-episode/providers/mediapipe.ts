import {
  DrawingUtils,
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { drawGenericLandmarks, normalizeLandmarkPoint, remapLandmarksForDisplay } from './shared'
import type { FaceLandmarkEngine, FaceLandmarkEngineMeta } from './types'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'

const META: FaceLandmarkEngineMeta = {
  id: 'mediapipe',
  label: 'MediaPipe',
  description: 'Google MediaPipe Face Landmarker (Tasks Vision)',
  landmarkCount: '468',
  backend: 'WASM / WebGL',
  available: true,
}

export function createMediaPipeEngine(): FaceLandmarkEngine {
  let landmarker: FaceLandmarker | null = null

  return {
    meta: META,

    async init() {
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
        landmarker = await FaceLandmarker.createFromOptions(vision, options)
      } catch {
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'CPU' },
        })
      }
    },

    async detect(video, timestampMs) {
      if (!landmarker) return { faces: [] }

      const results = landmarker.detectForVideo(video, timestampMs)
      const faces =
        results.faceLandmarks?.map((face) =>
          face.map((point) => normalizeLandmarkPoint(point, video.videoWidth, video.videoHeight)),
        ) ?? []

      return { faces }
    },

    draw(ctx, detection, video, displayWidth, displayHeight, mirror, showFaceMesh) {
      if (!landmarker || !detection.faces.length || !video.videoWidth) {
        drawGenericLandmarks(ctx, detection, video, displayWidth, displayHeight, mirror, showFaceMesh)
        return
      }

      const drawing = new DrawingUtils(ctx)

      for (const face of detection.faces) {
        const mapped = remapLandmarksForDisplay(
          face,
          video.videoWidth,
          video.videoHeight,
          displayWidth,
          displayHeight,
          mirror,
        ) as NormalizedLandmark[]

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
    },

    dispose() {
      landmarker?.close()
      landmarker = null
    },
  }
}
