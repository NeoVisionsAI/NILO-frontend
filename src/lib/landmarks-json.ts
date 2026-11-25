export interface LandmarkPoint {
  x: number
  y: number
  z: number
}

export interface LandmarkFrame {
  index: number
  timestamp_ms: number
  points: LandmarkPoint[]
}

export interface ParsedLandmarks {
  kind: 'face' | 'pose' | 'unknown'
  fps: number
  frame_count: number
  duration_seconds: number
  frames: LandmarkFrame[]
}

function flatToPoints(flat: number[], count?: number): LandmarkPoint[] {
  const n = count ?? Math.floor(flat.length / 3)
  const points: LandmarkPoint[] = []
  for (let i = 0; i < n; i += 1) {
    points.push({ x: flat[i * 3], y: flat[i * 3 + 1], z: flat[i * 3 + 2] })
  }
  return points
}

function frameFromLoose(raw: Record<string, unknown>): LandmarkFrame | null {
  const index = typeof raw.index === 'number' ? raw.index : 0
  const timestamp_ms = typeof raw.timestamp_ms === 'number' ? raw.timestamp_ms : index * 33
  if (Array.isArray(raw.landmarks) && raw.landmarks.length > 0) {
    if (typeof raw.landmarks[0] === 'number') {
      const count =
        typeof (raw as { landmark_count?: number }).landmark_count === 'number'
          ? (raw as { landmark_count: number }).landmark_count
          : undefined
      return { index, timestamp_ms, points: flatToPoints(raw.landmarks as number[], count) }
    }
    const pts = (raw.landmarks as Array<Record<string, number>>).map((p) => ({
      x: p.x ?? 0,
      y: p.y ?? 0,
      z: p.z ?? 0,
    }))
    return { index, timestamp_ms, points: pts }
  }
  return null
}

/** Normaliza JSON de landmarks (sintético, flat-xyz, MediaPipe). */
export function parseLandmarksJson(data: unknown): ParsedLandmarks {
  const root = data as Record<string, unknown>
  const framesRaw = Array.isArray(root.frames) ? root.frames : []
  const frames: LandmarkFrame[] = []
  for (const row of framesRaw) {
    if (row && typeof row === 'object') {
      const frame = frameFromLoose(row as Record<string, unknown>)
      if (frame) frames.push(frame)
    }
  }
  frames.sort((a, b) => a.index - b.index)

  let kind: ParsedLandmarks['kind'] = 'unknown'
  if (root.kind === 'face') kind = 'face'
  else if (root.kind === 'pose') kind = 'pose'
  else if (typeof root.schema === 'string') {
    const s = String(root.schema).toLowerCase()
    if (s.includes('face')) kind = 'face'
    if (s.includes('pose')) kind = 'pose'
  }

  const fps = typeof root.fps === 'number' && root.fps > 0 ? root.fps : 15
  const frame_count = typeof root.frame_count === 'number' ? root.frame_count : frames.length
  const duration_seconds =
    typeof root.duration_seconds === 'number'
      ? root.duration_seconds
      : frames.length > 0
        ? (frames[frames.length - 1].timestamp_ms - frames[0].timestamp_ms) / 1000 + 1 / fps
        : 0

  return { kind, fps, frame_count, duration_seconds, frames }
}