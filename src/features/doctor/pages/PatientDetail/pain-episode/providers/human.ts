import Human from '@vladmandic/human'
import { drawGenericLandmarks, normalizeLandmarkPoint } from './shared'
import type { FaceLandmarkDetection, FaceLandmarkEngine, FaceLandmarkEngineMeta } from './types'

const META: FaceLandmarkEngineMeta = {
  id: 'human',
  label: 'Human.js',
  description: 'Vlad Mandic Human — malla facial modular',
  landmarkCount: '468',
  backend: 'WebGL / WASM',
  available: true,
}

const MODEL_BASE = 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/'

export function createHumanEngine(): FaceLandmarkEngine {
  let human: Human | null = null

  return {
    meta: META,

    async init() {
      human = new Human({
        cacheSensitivity: 0,
        debug: false,
        modelBasePath: MODEL_BASE,
        face: {
          enabled: true,
          detector: { enabled: true, rotation: false },
          mesh: { enabled: true },
          iris: { enabled: false },
          description: { enabled: false },
          emotion: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        gesture: { enabled: false },
        object: { enabled: false },
      })

      await human.load()
      await human.warmup()
    },

    async detect(video) {
      if (!human || !video.videoWidth) return { faces: [] }

      const result = await human.detect(video)
      const faces =
        result.face?.map((face) => {
          const mesh = face.mesh ?? []
          return mesh.map((point) =>
            normalizeLandmarkPoint(
              Array.isArray(point) ?
                [point[0], point[1], point[2] ?? 0]
              : { x: point[0], y: point[1], z: point[2] ?? 0 },
              video.videoWidth,
              video.videoHeight,
            ),
          )
        }) ?? []

      return { faces: faces.filter((face) => face.length > 0) } satisfies FaceLandmarkDetection
    },

    draw(ctx, detection, video, displayWidth, displayHeight, mirror, showFaceMesh) {
      drawGenericLandmarks(ctx, detection, video, displayWidth, displayHeight, mirror, showFaceMesh)
    },

    dispose() {
      human = null
    },
  }
}
