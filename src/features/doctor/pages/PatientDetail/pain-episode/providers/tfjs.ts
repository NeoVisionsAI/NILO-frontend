import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection'
import { drawGenericLandmarks, normalizeLandmarkPoint } from './shared'
import type { FaceLandmarkDetection, FaceLandmarkEngine, FaceLandmarkEngineMeta } from './types'

const META: FaceLandmarkEngineMeta = {
  id: 'tfjs',
  label: 'TF.js Face Mesh',
  description: 'TensorFlow.js MediaPipe Face Mesh (runtime tfjs)',
  landmarkCount: '468',
  backend: 'WebGL',
  available: true,
}

type Detector = Awaited<ReturnType<typeof faceLandmarksDetection.createDetector>>

export function createTfjsEngine(): FaceLandmarkEngine {
  let detector: Detector | null = null

  return {
    meta: META,

    async init() {
      await tf.setBackend('webgl')
      await tf.ready()

      detector = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',
          maxFaces: 1,
          refineLandmarks: false,
        },
      )
    },

    async detect(video) {
      if (!detector || !video.videoWidth) return { faces: [] }

      const faces = await detector.estimateFaces(video, {
        flipHorizontal: false,
        staticImageMode: false,
      })

      const normalized = faces.map((face) =>
        face.keypoints.map((point) =>
          normalizeLandmarkPoint(
            { x: point.x, y: point.y, z: point.z },
            video.videoWidth,
            video.videoHeight,
          ),
        ),
      )

      return { faces: normalized } satisfies FaceLandmarkDetection
    },

    draw(ctx, detection, video, displayWidth, displayHeight, mirror, showFaceMesh) {
      drawGenericLandmarks(ctx, detection, video, displayWidth, displayHeight, mirror, showFaceMesh)
    },

    dispose() {
      detector?.dispose()
      detector = null
    },
  }
}
