import * as faceapi from '@vladmandic/face-api'
import { drawGenericLandmarks, normalizeLandmarkPoint } from './shared'
import type { FaceLandmarkDetection, FaceLandmarkEngine, FaceLandmarkEngineMeta } from './types'

const META: FaceLandmarkEngineMeta = {
  id: 'face-api',
  label: 'face-api.js',
  description: 'Vlad Mandic face-api — 68 puntos clásicos',
  landmarkCount: '68',
  backend: 'TensorFlow.js / WebGL',
  available: true,
}

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

export function createFaceApiEngine(): FaceLandmarkEngine {
  let ready = false

  return {
    meta: META,

    async init() {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
      ready = true
    },

    async detect(video) {
      if (!ready || !video.videoWidth) return { faces: [] }

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
        .withFaceLandmarks()

      if (!detection) return { faces: [] }

      const points = detection.landmarks.positions.map((point) =>
        normalizeLandmarkPoint(point, video.videoWidth, video.videoHeight),
      )

      return { faces: [points] } satisfies FaceLandmarkDetection
    },

    draw(ctx, detection, video, displayWidth, displayHeight, mirror, showFaceMesh) {
      drawGenericLandmarks(ctx, detection, video, displayWidth, displayHeight, mirror, showFaceMesh)
    },

    dispose() {
      ready = false
    },
  }
}
