import { getFaceLandmarker, landmarksFromResult } from '@/features/doctor/pages/PatientDetail/pain-episode/faceLandmarker'
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { requestCameraStream } from '@/lib/camera'

export interface FaceLandmarksCapturePayload {
  schema: string
  kind: 'face'
  frame_count: number
  fps: number
  duration_seconds: number
  frames: Array<{
    index: number
    timestamp_ms: number
    landmarks: Array<{ x: number; y: number; z: number; visibility: number }>
  }>
}

function pickAudioMime(): string {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  return 'audio/webm'
}

function pickVideoMime(): string {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9'
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return 'video/webm;codecs=vp8'
  return 'video/webm'
}

function audioConstraints(deviceId?: string): MediaTrackConstraints {
  return deviceId ? { deviceId: { exact: deviceId } } : {}
}

function videoConstraints(deviceId?: string): MediaTrackConstraints {
  return deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
}

async function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while ((!video.videoWidth || !video.videoHeight || video.readyState < 2) && Date.now() < deadline) {
    await new Promise((r) => window.setTimeout(r, 40))
  }
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('La cámara no entregó vídeo; comprueba permisos y encuadre.')
  }
}

export async function recordAudioClip(
  durationMs: number,
  deviceId?: string,
  onTick?: (secondsLeft: number) => void,
): Promise<{ blob: Blob; mime: string; ext: string; startedAt: Date; endedAt: Date }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: audioConstraints(deviceId),
  })
  const mime = pickAudioMime()
  const recorder = new MediaRecorder(stream, { mimeType: mime })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data)
  }

  const startedAt = new Date()
  const endAt = startedAt.getTime() + durationMs

  const tickId = window.setInterval(() => {
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
    onTick?.(left)
  }, 250)

  recorder.start(250)
  await new Promise<void>((resolve) => {
    window.setTimeout(() => {
      recorder.stop()
      recorder.onstop = () => resolve()
    }, durationMs)
  })
  window.clearInterval(tickId)
  onTick?.(0)

  stream.getTracks().forEach((t) => t.stop())
  const endedAt = new Date()
  const blob = new Blob(chunks, { type: mime })
  const ext = mime.includes('webm') ? 'webm' : 'wav'
  return { blob, mime, ext, startedAt, endedAt }
}

export async function recordVideoClip(
  durationMs: number,
  deviceId?: string,
  onTick?: (secondsLeft: number) => void,
): Promise<{ blob: Blob; mime: string; ext: string; startedAt: Date; endedAt: Date }> {
  const stream = await requestCameraStream({
    video: videoConstraints(deviceId),
    audio: false,
  })
  const mime = pickVideoMime()
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data)
  }

  const startedAt = new Date()
  const endAt = startedAt.getTime() + durationMs

  const tickId = window.setInterval(() => {
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
    onTick?.(left)
  }, 250)

  recorder.start(200)
  await new Promise<void>((resolve) => {
    window.setTimeout(() => {
      recorder.stop()
      recorder.onstop = () => resolve()
    }, durationMs)
  })
  window.clearInterval(tickId)
  onTick?.(0)

  stream.getTracks().forEach((t) => t.stop())
  const endedAt = new Date()
  const blob = new Blob(chunks, { type: mime })
  return { blob, mime, ext: 'webm', startedAt, endedAt }
}

export async function captureFaceLandmarksClip(
  durationSeconds: number,
  deviceId?: string,
  onTick?: (secondsLeft: number) => void,
  videoPreview?: HTMLVideoElement,
  reuseStream?: MediaStream | null,
  onVisualFrame?: (results: FaceLandmarkerResult, video: HTMLVideoElement) => void,
): Promise<{
  payload: FaceLandmarksCapturePayload
  frameCount: number
  startedAt: Date
  endedAt: Date
}> {
  const ownsStream = !reuseStream
  const stream =
    reuseStream ??
    (await requestCameraStream({
      video: videoConstraints(deviceId),
      audio: false,
    }))

  const video = videoPreview ?? document.createElement('video')
  if (!video.srcObject) {
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await video.play()
  } else if (video.paused) {
    await video.play()
  }
  await waitForVideoFrame(video)

  const landmarker = await getFaceLandmarker()
  const targetFps = 15
  const frameIntervalMs = 1000 / targetFps
  const frames: FaceLandmarksCapturePayload['frames'] = []

  const startedAt = new Date()
  const endAt = startedAt.getTime() + durationSeconds * 1000

  while (Date.now() < endAt) {
    if (!video.videoWidth || !video.videoHeight) {
      await waitForVideoFrame(video, 1500)
    }

    const ts = performance.now()
    let result: FaceLandmarkerResult
    try {
      result = landmarker.detectForVideo(video, ts)
    } catch {
      onTick?.(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)))
      await new Promise((r) => window.setTimeout(r, frameIntervalMs))
      continue
    }

    onVisualFrame?.(result, video)

    const faces = landmarksFromResult(result)
    const points = faces[0] ?? []
    frames.push({
      index: frames.length,
      timestamp_ms: Date.now() - startedAt.getTime(),
      landmarks: points.map((p) => ({
        x: p.x,
        y: p.y,
        z: p.z,
        visibility: 1,
      })),
    })
    onTick?.(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)))
    await new Promise((r) => window.setTimeout(r, frameIntervalMs))
  }

  onTick?.(0)
  if (ownsStream) {
    stream.getTracks().forEach((t) => t.stop())
    if (!videoPreview) {
      video.srcObject = null
    }
  }

  const endedAt = new Date()
  const payload: FaceLandmarksCapturePayload = {
    schema: 'nilo-mediapipe-face-capture-v1',
    kind: 'face',
    frame_count: frames.length,
    fps: targetFps,
    duration_seconds: durationSeconds,
    frames,
  }

  return { payload, frameCount: frames.length, startedAt, endedAt }
}