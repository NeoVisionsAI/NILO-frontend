export interface SyntheticLandmarksPayload {
  schema: string
  kind: 'pose' | 'face'
  frame_count: number
  fps: number
  duration_seconds: number
  frames: Array<{
    index: number
    timestamp_ms: number
    landmarks: Array<{ x: number; y: number; z: number; visibility: number }>
  }>
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function buildFrames(
  frameCount: number,
  fps: number,
  pointCount: number,
  kind: 'pose' | 'face',
): SyntheticLandmarksPayload['frames'] {
  const frames: SyntheticLandmarksPayload['frames'] = []
  for (let i = 0; i < frameCount; i += 1) {
    const landmarks = Array.from({ length: pointCount }, (_, j) => {
      const r = pseudoRandom(i * 31 + j + (kind === 'face' ? 1000 : 0))
      return {
        x: 0.35 + r * 0.3,
        y: 0.25 + pseudoRandom(i + j * 2) * 0.5,
        z: (pseudoRandom(j) - 0.5) * 0.1,
        visibility: 0.85 + pseudoRandom(i + j) * 0.15,
      }
    })
    frames.push({ index: i, timestamp_ms: Math.round((i / fps) * 1000), landmarks })
  }
  return frames
}

export function generatePoseLandmarksJson(durationSeconds: number, fps = 25): SyntheticLandmarksPayload {
  const frameCount = Math.max(1, Math.round(durationSeconds * fps))
  return {
    schema: 'nilo-synthetic-pose-v1',
    kind: 'pose',
    frame_count: frameCount,
    fps,
    duration_seconds: durationSeconds,
    frames: buildFrames(frameCount, fps, 33, 'pose'),
  }
}

export function generateFaceLandmarksJson(durationSeconds: number, fps = 25): SyntheticLandmarksPayload {
  const frameCount = Math.max(1, Math.round(durationSeconds * fps))
  return {
    schema: 'nilo-synthetic-face-v1',
    kind: 'face',
    frame_count: frameCount,
    fps,
    duration_seconds: durationSeconds,
    frames: buildFrames(frameCount, fps, 33, 'face'),
  }
}

export interface PhysiologicalSample {
  session_id: string
  patient_id: string
  node_id?: string
  timestamp: string
  device_id: string
  metrics: Record<string, number>
  units: Record<string, string>
}

export function generatePhysiologicalBulk(
  durationSeconds: number,
  sessionId: string,
  patientId: string,
  nodeId: string | undefined,
  hz = 1,
): PhysiologicalSample[] {
  const count = Math.max(1, Math.round(durationSeconds * hz))
  const start = Date.now()
  const samples: PhysiologicalSample[] = []
  for (let i = 0; i < count; i += 1) {
    const t = new Date(start + i * (1000 / hz))
    const base = pseudoRandom(i + start)
    samples.push({
      session_id: sessionId,
      patient_id: patientId,
      node_id: nodeId,
      timestamp: t.toISOString(),
      device_id: 'dev-simulator-vitals',
      metrics: {
        heart_rate: Math.round(68 + base * 22),
        spo2: Math.round(94 + pseudoRandom(i * 3) * 6),
        respiratory_rate: Math.round(14 + pseudoRandom(i * 5) * 6),
        systolic_bp: Math.round(110 + pseudoRandom(i * 7) * 20),
        diastolic_bp: Math.round(70 + pseudoRandom(i * 11) * 15),
      },
      units: {
        heart_rate: 'bpm',
        spo2: '%',
        respiratory_rate: 'rpm',
        systolic_bp: 'mmHg',
        diastolic_bp: 'mmHg',
      },
    })
  }
  return samples
}

/** Placeholder MP4 (no válido para reproductor; válido para probar MinIO + confirm). */
export function generatePlaceholderMp4Bytes(): ArrayBuffer {
  const header = new TextEncoder().encode('NILO-SYNTHETIC-MP4-PLACEHOLDER')
  const buf = new Uint8Array(header.length + 64)
  buf.set(header, 0)
  for (let i = header.length; i < buf.length; i += 1) {
    buf[i] = i % 256
  }
  return buf.buffer
}