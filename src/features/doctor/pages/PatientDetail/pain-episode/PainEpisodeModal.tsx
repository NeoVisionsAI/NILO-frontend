import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CameraError,
  canUseLiveCamera,
  insecureCameraDevHint,
  requestCameraStream,
} from '@/lib/camera'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import {
  drawFaceLandmarks,
  getFaceLandmarker,
  landmarksFromResult,
} from './faceLandmarker'
import type { RecordedPainScale } from './pain-scales'
import { PainScalePanel } from './PainScalePanel'
import {
  buildPainEpisodeSession,
  formatPainEpisodeDate,
  formatPainEpisodeElapsed,
  type PainEpisodeFrame,
  type PainEpisodeSessionData,
} from './types'
import './PainEpisodeCapture.css'

interface CameraDevice {
  deviceId: string
  label: string
}

type CameraFacing = 'user' | 'environment'

interface CameraStartOptions {
  deviceId?: string
  facingMode?: CameraFacing
}

function classifyCameraLabel(label: string): CameraFacing | null {
  const normalized = label.toLowerCase()
  if (/back|rear|environment|world|trasera|posterior/.test(normalized)) return 'environment'
  if (/front|user|face|selfie|frontal|anterior/.test(normalized)) return 'user'
  return null
}

function resolveDualCameras(cameras: CameraDevice[]) {
  let front: CameraDevice | undefined
  let back: CameraDevice | undefined

  for (const cam of cameras) {
    const role = classifyCameraLabel(cam.label)
    if (role === 'user' && !front) front = cam
    if (role === 'environment' && !back) back = cam
  }

  if (cameras.length === 2) {
    if (!front) front = cameras.find((c) => c.deviceId !== back?.deviceId) ?? cameras[1]
    if (!back) back = cameras.find((c) => c.deviceId !== front?.deviceId) ?? cameras[0]
  }

  return { front, back }
}

interface PainEpisodeCapturePanelProps {
  patientId: string
  summaryBackSignal?: number
  onComplete?: (session: PainEpisodeSessionData) => void
  onPhaseChange?: (phase: 'capture' | 'summary') => void
}

type LoadState = 'loading' | 'pick-source' | 'ready' | 'error'
type InputMode = 'live' | 'file'
type CapturePhase = 'capture' | 'summary'

export function PainEpisodeCapturePanel({
  patientId,
  summaryBackSignal = 0,
  onComplete,
  onPhaseChange,
}: PainEpisodeCapturePanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const captureInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileUrlRef = useRef<string | null>(null)
  const rafRef = useRef<number>()
  const lastVideoTimeRef = useRef(-1)
  const recordingRef = useRef(false)
  const recordingStartRef = useRef(0)
  const recordingStartedAtRef = useRef<Date | null>(null)
  const framesRef = useRef<PainEpisodeFrame[]>([])
  const mirrorVideoRef = useRef(true)
  const [mirrorVideo, setMirrorVideo] = useState(true)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<InputMode>('live')
  const [sourceLabel, setSourceLabel] = useState('')
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [activeCameraId, setActiveCameraId] = useState<string>('')
  const [activeFacingMode, setActiveFacingMode] = useState<CameraFacing | null>(null)
  const [showFace, setShowFace] = useState(true)
  const [recording, setRecording] = useState(false)
  const [recordingStartedAt, setRecordingStartedAt] = useState<Date | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [frameCount, setFrameCount] = useState(0)
  const [faceDetected, setFaceDetected] = useState(false)
  const [capturePhase, setCapturePhase] = useState<CapturePhase>('capture')
  const [completedSession, setCompletedSession] = useState<PainEpisodeSessionData | null>(null)
  const [addedScales, setAddedScales] = useState<RecordedPainScale[]>([])

  recordingRef.current = recording

  const revokeFileUrl = useCallback(() => {
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current)
      fileUrlRef.current = null
    }
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    revokeFileUrl()
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }
  }, [revokeFileUrl])

  const syncCanvasSize = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return

    const w = video.clientWidth
    const h = video.clientHeight
    canvas.width = w
    canvas.height = h
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
  }, [])

  const startCamera = useCallback(
    async (options?: string | CameraStartOptions) => {
      stopStream()
      const video = videoRef.current
      if (!video) return

      const opts: CameraStartOptions =
        typeof options === 'string' ? { deviceId: options } : (options ?? { facingMode: 'user' })

      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }

      if (opts.deviceId) {
        videoConstraints.deviceId = { exact: opts.deviceId }
      } else {
        videoConstraints.facingMode = opts.facingMode ?? 'user'
      }

      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: false,
      }

      const stream = await requestCameraStream(constraints)
      streamRef.current = stream
      video.srcObject = stream
      video.loop = false
      await video.play()

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Cámara ${i + 1}`,
        }))
      setCameras(videoInputs)

      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      const facingMode =
        settings.facingMode === 'environment' || settings.facingMode === 'user'
          ? settings.facingMode
          : opts.facingMode ?? classifyCameraLabel(track.label) ?? null

      mirrorVideoRef.current = facingMode !== 'environment'
      setMirrorVideo(mirrorVideoRef.current)
      setActiveFacingMode(facingMode)
      if (settings.deviceId) setActiveCameraId(settings.deviceId)

      setInputMode('live')
      setSourceLabel('Cámara en vivo')
      syncCanvasSize()
    },
    [stopStream, syncCanvasSize],
  )

  const startVideoFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('video/')) {
        toast.error('Selecciona un archivo de vídeo.')
        return
      }

      stopStream()
      const video = videoRef.current
      if (!video) return

      const url = URL.createObjectURL(file)
      fileUrlRef.current = url
      video.srcObject = null
      video.src = url
      video.loop = true
      video.muted = true

      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve()
        video.onerror = () => reject(new Error('No se pudo cargar el vídeo.'))
      })

      await video.play()
      lastVideoTimeRef.current = -1
      setInputMode('file')
      setSourceLabel(file.name)
      mirrorVideoRef.current = false
      setMirrorVideo(false)
      setCameras([])
      setActiveCameraId('')
      setActiveFacingMode(null)
      setLoadState('ready')
      syncCanvasSize()
      toast.success('Vídeo cargado. MediaPipe analizará los frames.')
    },
    [stopStream, syncCanvasSize],
  )

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        await getFaceLandmarker()
        if (cancelled) return

        if (canUseLiveCamera()) {
          await startCamera()
          if (cancelled) return
          setLoadState('ready')
        } else {
          setLoadState('pick-source')
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof CameraError && err.code === 'insecure') {
          setLoadState('pick-source')
          return
        }
        setLoadState('error')
        setErrorMsg(err instanceof Error ? err.message : 'Error al iniciar la cámara.')
      }
    }

    void init()
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      stopStream()
    }
  }, [startCamera, stopStream])

  useEffect(() => {
    if (loadState !== 'ready') return

    let running = true

    async function loop() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) {
        if (running) rafRef.current = requestAnimationFrame(loop)
        return
      }

      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime
        syncCanvasSize()

        try {
          const landmarker = await getFaceLandmarker()
          const results = landmarker.detectForVideo(video, performance.now())
          const hasFace = Boolean(results.faceLandmarks?.length)
          setFaceDetected(hasFace)

          const ctx = canvas.getContext('2d')
          if (ctx) {
            const w = canvas.width
            const h = canvas.height
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.clearRect(0, 0, w, h)

            if (!showFace) {
              ctx.fillStyle = '#0b1220'
              ctx.fillRect(0, 0, w, h)
            }

            drawFaceLandmarks(ctx, results, video, w, h, mirrorVideoRef.current, showFace)

            if (recordingRef.current && hasFace) {
              const t = Math.round(performance.now() - recordingStartRef.current)
              framesRef.current.push({
                t,
                landmarks: landmarksFromResult(results),
              })
              setFrameCount(framesRef.current.length)
            }
          }
        } catch {
          /* ignorar frames sueltos */
        }
      }

      if (running) rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [loadState, showFace, syncCanvasSize])

  useEffect(() => {
    function onResize() {
      syncCanvasSize()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [syncCanvasSize])

  useEffect(() => {
    function onFullscreenChange() {
      requestAnimationFrame(() => syncCanvasSize())
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    }
  }, [syncCanvasSize])

  useEffect(() => {
    if (!recording) {
      setElapsedMs(0)
      return
    }

    function tick() {
      if (recordingStartedAtRef.current) {
        setElapsedMs(Date.now() - recordingStartedAtRef.current.getTime())
      }
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [recording])

  async function handleCameraChange(deviceId: string) {
    try {
      await startCamera({ deviceId })
    } catch {
      toast.error('No se pudo cambiar de cámara.')
    }
  }

  async function handleSwitchFacing(facing: CameraFacing) {
    if (recording || activeFacingMode === facing) return

    const { front, back } = resolveDualCameras(cameras)
    const fallbackDevice = facing === 'user' ? front : back

    try {
      await startCamera({ facingMode: facing })
    } catch {
      if (fallbackDevice) {
        try {
          await startCamera({ deviceId: fallbackDevice.deviceId })
          return
        } catch {
          /* continuar al toast */
        }
      }
      toast.error('No se pudo cambiar de cámara.')
    }
  }

  const dualCameras = resolveDualCameras(cameras)
  const isFrontCameraActive =
    activeFacingMode === 'user' ||
    (activeFacingMode === null && dualCameras.front?.deviceId === activeCameraId)
  const isBackCameraActive =
    activeFacingMode === 'environment' ||
    (activeFacingMode === null && dualCameras.back?.deviceId === activeCameraId)

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void startVideoFile(file)
  }

  function handleStartRecording() {
    if (!faceDetected) {
      toast.error('No se detecta rostro. Coloca la cara delante de la cámara.')
      return
    }
    const startedAt = new Date()
    framesRef.current = []
    recordingStartedAtRef.current = startedAt
    recordingStartRef.current = performance.now()
    setRecordingStartedAt(startedAt)
    setElapsedMs(0)
    setFrameCount(0)
    setRecording(true)
    toast.success('Grabación iniciada.')
  }

  function handleStopRecording() {
    const startedAt = recordingStartedAtRef.current ?? new Date()
    const endedAt = new Date()
    setRecording(false)
    setElapsedMs(0)

    const session = buildPainEpisodeSession(patientId, startedAt, endedAt, [...framesRef.current])
    setCompletedSession(session)
    setAddedScales([])
    setCapturePhase('summary')
    onPhaseChange?.('summary')
    toast.success(`Sesión finalizada: ${session.frames.length} frames capturados.`)
  }

  function handleSaveEpisode() {
    if (!completedSession) return
    onComplete?.({ ...completedSession, scales: addedScales })
  }

  function handleDiscardSummary() {
    setCompletedSession(null)
    setAddedScales([])
    setCapturePhase('capture')
    onPhaseChange?.('capture')
    setRecordingStartedAt(null)
    recordingStartedAtRef.current = null
    setFrameCount(0)
  }

  useEffect(() => {
    if (summaryBackSignal > 0 && capturePhase === 'summary') {
      handleDiscardSummary()
    }
  }, [summaryBackSignal, capturePhase, onPhaseChange])

  function handleBackToSourcePicker() {
    if (recording) return
    stopStream()
    setFaceDetected(false)
    setFrameCount(0)
    setLoadState('pick-source')
  }

  return (
    <div className="nilo-pain-capture" role="region" aria-label="Captura de episodio de dolor">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="nilo-pain-capture__file-input"
        onChange={handleFilePick}
      />
      <input
        ref={captureInputRef}
        type="file"
        accept="video/*"
        capture="user"
        className="nilo-pain-capture__file-input"
        onChange={handleFilePick}
      />

      {loadState === 'error' ? (
        <div className="nilo-pain-capture__error">
          <MaterialIcon name="videocam_off" size={48} />
          <p>{errorMsg}</p>
        </div>
      ) : loadState === 'pick-source' ? (
        <div className="nilo-pain-capture__pick-source">
          <MaterialIcon name="info" size={40} />
          <p className="nilo-pain-capture__pick-source-title">Desarrollo por HTTP</p>
          <p className="nilo-pain-capture__pick-source-text">{insecureCameraDevHint()}</p>
          <div className="nilo-pain-capture__pick-source-actions">
            <button
              type="button"
              className="nilo-pain-capture__btn nilo-pain-capture__btn--record"
              onClick={() => captureInputRef.current?.click()}
            >
              <MaterialIcon name="photo_camera" size={22} />
              Capturar vídeo (cámara del sistema)
            </button>
            <button
              type="button"
              className="nilo-pain-capture__btn nilo-pain-capture__btn--secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <MaterialIcon name="video_library" size={22} />
              Seleccionar vídeo de prueba
            </button>
            {canUseLiveCamera() && (
              <button
                type="button"
                className="nilo-pain-capture__btn nilo-pain-capture__btn--secondary"
                onClick={() => void startCamera().then(() => setLoadState('ready'))}
              >
                <MaterialIcon name="videocam" size={22} />
                Usar cámara en vivo
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="nilo-pain-capture__workspace">
          <div className="nilo-pain-capture__stage">
            {loadState === 'loading' && (
              <div className="nilo-pain-capture__loading">
                <MaterialIcon name="progress_activity" size={40} />
                <p>Cargando cámara y MediaPipe…</p>
              </div>
            )}
            {inputMode === 'file' && (
              <div className="nilo-pain-capture__dev-badge">
                <MaterialIcon name="science" size={16} />
                Modo prueba · {sourceLabel}
              </div>
            )}
            <video
              ref={videoRef}
              className={`nilo-pain-capture__video${showFace ? '' : ' nilo-pain-capture__video--hidden'}${mirrorVideo ? ' nilo-pain-capture__video--mirror' : ''}`}
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="nilo-pain-capture__canvas" />
            {!faceDetected && loadState === 'ready' && !recording && (
              <div className="nilo-pain-capture__hint">Buscando rostro…</div>
            )}
          </div>

          <aside className="nilo-pain-capture__sidebar m3-scroll" aria-label="Controles de captura">
            {capturePhase === 'summary' && completedSession ? (
              <>
                <div className="nilo-pain-capture__status-row">
                  <span className="nilo-pain-capture__status-pill nilo-pain-capture__status-pill--ok">
                    <MaterialIcon name="check_circle" size={16} />
                    Sesión completada
                  </span>
                </div>

                <dl className="nilo-pain-capture__stats">
                  <div className="nilo-pain-capture__stat">
                    <dt>Hora de inicio</dt>
                    <dd>{formatPainEpisodeDate(completedSession.startedAt)}</dd>
                  </div>
                  <div className="nilo-pain-capture__stat">
                    <dt>Duración</dt>
                    <dd>{formatPainEpisodeElapsed(completedSession.durationMs)}</dd>
                  </div>
                  <div className="nilo-pain-capture__stat">
                    <dt>Frames capturados</dt>
                    <dd>{completedSession.frames.length}</dd>
                  </div>
                </dl>

                <PainScalePanel scales={addedScales} onChange={setAddedScales} />

                <div className="nilo-pain-capture__actions">
                  <button
                    type="button"
                    className="nilo-pain-capture__btn nilo-pain-capture__btn--record"
                    onClick={handleSaveEpisode}
                  >
                    <MaterialIcon name="save" size={22} />
                    Guardar episodio
                  </button>
                  <button
                    type="button"
                    className="nilo-pain-capture__btn nilo-pain-capture__btn--secondary"
                    onClick={handleDiscardSummary}
                  >
                    <MaterialIcon name="replay" size={20} />
                    Descartar y repetir
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="nilo-pain-capture__status-row">
                  <span
                    className={`nilo-pain-capture__status-pill${recording ? ' nilo-pain-capture__status-pill--rec' : ''}`}
                  >
                    {recording && <span className="nilo-pain-capture__rec-dot" aria-hidden="true" />}
                    {recording ? 'Grabando' : 'En espera'}
                  </span>
                  <button
                    type="button"
                    className={`nilo-pain-capture__status-pill nilo-pain-capture__status-pill--toggle${showFace ? ' nilo-pain-capture__status-pill--on' : ''}`}
                    onClick={() => setShowFace((v) => !v)}
                    disabled={recording}
                  >
                    <MaterialIcon name={showFace ? 'face' : 'grid_on'} size={16} />
                    {showFace ? 'Ver cara' : 'Solo puntos'}
                  </button>
                  <span
                    className={`nilo-pain-capture__status-pill${faceDetected ? ' nilo-pain-capture__status-pill--ok' : ' nilo-pain-capture__status-pill--warn'}`}
                  >
                    <MaterialIcon name={faceDetected ? 'face' : 'face_retouching_off'} size={16} />
                    {faceDetected ? 'Rostro detectado' : 'Sin rostro'}
                  </span>
                </div>

                <dl className="nilo-pain-capture__stats">
                  <div className="nilo-pain-capture__stat">
                    <dt>Hora de inicio</dt>
                    <dd>{recordingStartedAt ? formatPainEpisodeDate(recordingStartedAt) : '—'}</dd>
                  </div>
                  <div className="nilo-pain-capture__stat">
                    <dt>Tiempo transcurrido</dt>
                    <dd className="nilo-pain-capture__stat-value--timer">
                      {recording ? formatPainEpisodeElapsed(elapsedMs) : '00:00'}
                    </dd>
                  </div>
                  <div className="nilo-pain-capture__stat">
                    <dt>Frames capturados</dt>
                    <dd>{frameCount}</dd>
                  </div>
                </dl>

                <div className="nilo-pain-capture__actions">
                  {!recording ? (
                    <button
                      type="button"
                      className="nilo-pain-capture__btn nilo-pain-capture__btn--record"
                      onClick={handleStartRecording}
                      disabled={loadState !== 'ready' || !faceDetected}
                    >
                      <MaterialIcon name="fiber_manual_record" size={22} />
                      Iniciar grabación
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="nilo-pain-capture__btn nilo-pain-capture__btn--stop"
                      onClick={handleStopRecording}
                    >
                      <MaterialIcon name="stop" size={22} />
                      Parar grabación
                    </button>
                  )}
                </div>

                <div className="nilo-pain-capture__settings">
                  <p className="nilo-pain-capture__settings-title">Opciones</p>

                  {inputMode === 'live' && cameras.length === 2 ? (
                    <div className="nilo-pain-capture__setting-group">
                      <span className="nilo-pain-capture__setting-label">Cámara</span>
                      <div className="nilo-pain-capture__camera-switch" role="group" aria-label="Seleccionar cámara">
                        <button
                          type="button"
                          className={`nilo-pain-capture__camera-btn${isFrontCameraActive ? ' nilo-pain-capture__camera-btn--active' : ''}`}
                          onClick={() => void handleSwitchFacing('user')}
                          disabled={recording}
                          aria-label="Cámara frontal"
                          aria-pressed={isFrontCameraActive}
                        >
                          <MaterialIcon name="photo_camera_front" size={22} />
                          Frontal
                        </button>
                        <button
                          type="button"
                          className={`nilo-pain-capture__camera-btn${isBackCameraActive ? ' nilo-pain-capture__camera-btn--active' : ''}`}
                          onClick={() => void handleSwitchFacing('environment')}
                          disabled={recording}
                          aria-label="Cámara trasera"
                          aria-pressed={isBackCameraActive}
                        >
                          <MaterialIcon name="photo_camera" size={22} />
                          Trasera
                        </button>
                      </div>
                    </div>
                  ) : inputMode === 'live' && cameras.length > 2 ? (
                    <label className="nilo-pain-capture__setting-group nilo-pain-capture__select-wrap">
                      <span className="nilo-pain-capture__setting-label">Cámara</span>
                      <select
                        value={activeCameraId}
                        onChange={(e) => void handleCameraChange(e.target.value)}
                        disabled={recording}
                      >
                        {cameras.map((cam) => (
                          <option key={cam.deviceId} value={cam.deviceId}>
                            {cam.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : inputMode === 'file' ? (
                    <button
                      type="button"
                      className="nilo-pain-capture__btn nilo-pain-capture__btn--secondary"
                      onClick={handleBackToSourcePicker}
                      disabled={recording}
                    >
                      <MaterialIcon name="swap_horiz" size={20} />
                      Cambiar vídeo
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

/** @deprecated Usar PainEpisodeCapturePanel embebido en CONDATA. */
export const PainEpisodeModal = PainEpisodeCapturePanel
