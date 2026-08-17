import type { FaceLandmarkEngine, FaceLandmarkEngineId, FaceLandmarkEngineMeta } from './types'

export const FACE_LANDMARK_ENGINE_CATALOG: FaceLandmarkEngineMeta[] = [
  {
    id: 'mediapipe',
    label: 'MediaPipe',
    description: 'Google MediaPipe Face Landmarker',
    landmarkCount: '468',
    backend: 'WASM / WebGL',
    available: true,
  },
  {
    id: 'tfjs',
    label: 'TF.js Face Mesh',
    description: '@tensorflow-models/face-landmarks-detection',
    landmarkCount: '468',
    backend: 'WebGL',
    available: true,
  },
  {
    id: 'human',
    label: 'Human.js',
    description: '@vladmandic/human',
    landmarkCount: '468',
    backend: 'WebGL / WASM',
    available: true,
  },
  {
    id: 'face-api',
    label: 'face-api.js',
    description: '@vladmandic/face-api',
    landmarkCount: '68',
    backend: 'TensorFlow.js',
    available: true,
  },
  {
    id: 'webar-rocks',
    label: 'WebAR.rocks.face',
    description: 'WebGL nativo sin TensorFlow.js',
    landmarkCount: 'Variable',
    backend: 'WebGL',
    available: false,
    unavailableReason: 'PoC pendiente: integración manual desde repositorio',
  },
  {
    id: 'jeeliz',
    label: 'jeelizFaceFilter',
    description: 'Tracking WebGL propio',
    landmarkCount: 'Clave + rotación',
    backend: 'WebGL',
    available: false,
    unavailableReason: 'PoC pendiente: integración manual desde repositorio',
  },
  {
    id: 'banuba',
    label: 'Banuba Web SDK',
    description: 'SDK comercial de referencia',
    landmarkCount: '~500',
    backend: 'WASM / WebGL',
    available: false,
    unavailableReason: 'Requiere licencia / API key de evaluación',
  },
]

let activeEngine: FaceLandmarkEngine | null = null
let activeEngineId: FaceLandmarkEngineId | null = null
let switchPromise: Promise<FaceLandmarkEngine> | null = null

async function createEngine(id: FaceLandmarkEngineId): Promise<FaceLandmarkEngine> {
  switch (id) {
    case 'mediapipe':
      return (await import('./mediapipe')).createMediaPipeEngine()
    case 'tfjs':
      return (await import('./tfjs')).createTfjsEngine()
    case 'human':
      return (await import('./human')).createHumanEngine()
    case 'face-api':
      return (await import('./face-api')).createFaceApiEngine()
    default: {
      const meta = FACE_LANDMARK_ENGINE_CATALOG.find((item) => item.id === id)
      throw new Error(meta?.unavailableReason ?? 'Motor de landmarks no disponible todavía.')
    }
  }
}

export function getLandmarkEngineCatalog() {
  return FACE_LANDMARK_ENGINE_CATALOG
}

export function isLandmarkEngineAvailable(id: FaceLandmarkEngineId) {
  return FACE_LANDMARK_ENGINE_CATALOG.find((item) => item.id === id)?.available ?? false
}

export function getActiveLandmarkEngineId() {
  return activeEngineId
}

export async function switchLandmarkEngine(id: FaceLandmarkEngineId): Promise<FaceLandmarkEngine> {
  if (!isLandmarkEngineAvailable(id)) {
    throw new Error(
      FACE_LANDMARK_ENGINE_CATALOG.find((item) => item.id === id)?.unavailableReason ??
        'Motor no disponible',
    )
  }

  if (activeEngine && activeEngineId === id) return activeEngine

  if (switchPromise) return switchPromise

  switchPromise = (async () => {
    activeEngine?.dispose()
    activeEngine = null
    activeEngineId = null

    const engine = await createEngine(id)
    await engine.init()

    activeEngine = engine
    activeEngineId = id
    return engine
  })()

  try {
    return await switchPromise
  } finally {
    switchPromise = null
  }
}

export async function getActiveLandmarkEngine(): Promise<FaceLandmarkEngine> {
  if (activeEngine && activeEngineId) return activeEngine
  return switchLandmarkEngine('mediapipe')
}

export function disposeLandmarkEngine() {
  activeEngine?.dispose()
  activeEngine = null
  activeEngineId = null
}
