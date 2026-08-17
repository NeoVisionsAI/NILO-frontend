import { useCallback, useEffect, useRef, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import {
  drawFaceLandmarks,
  getFaceLandmarker,
  landmarksFromResult,
} from './faceLandmarker'
import type { PainEpisodeFrame, PainEpisodeSessionData } from './types'
import './PainEpisodeModal.css'

interface CameraDevice {
  deviceId: string
  label: string
}

interface PainEpisodeModalProps {
  patientId: string
  patientName: string
  onClose: () => void
}

type LoadState = 'loading' | 'ready' | 'error'

export function PainEpisodeModal({ patientId, patientName, onClose }: PainEpisodeModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>()
  const lastVideoTimeRef = useRef(-1)
  const recordingRef = useRef(false)
  const recordingStartRef = useRef(0)
  const framesRef = useRef<PainEpisodeFrame[]>([])

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [activeCameraId, setActiveCameraId] = useState<string>('')
  const [showFace, setShowFace] = useState(true)
  const [recording, setRecording] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [faceDetected, setFaceDetected] = useState(false)

  recordingRef.current = recording

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const syncCanvasSize = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return

    const w = video.clientWidth
    const h = video.clientHeight
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
  }, [])

  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopStream()
      const video = videoRef.current
      if (!video) return

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      video.srcObject = stream
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
      if (settings.deviceId) setActiveCameraId(settings.deviceId)

      syncCanvasSize()
    },
    [stopStream, syncCanvasSize],
  )

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Este navegador no soporta acceso a la cámara.')
        }
        await getFaceLandmarker()
        if (cancelled) return
        await startCamera()
        if (cancelled) return
        setLoadState('ready')
      } catch (err) {
        if (cancelled) return
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
            const dpr = window.devicePixelRatio || 1
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            const w = canvas.clientWidth
            const h = canvas.clientHeight
            ctx.clearRect(0, 0, w, h)

            if (!showFace) {
              ctx.fillStyle = '#0b1220'
              ctx.fillRect(0, 0, w, h)
            }

            drawFaceLandmarks(ctx, results, showFace)

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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !recording) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, recording])

  async function handleCameraChange(deviceId: string) {
    try {
      await startCamera(deviceId)
      setActiveCameraId(deviceId)
    } catch {
      toast.error('No se pudo cambiar de cámara.')
    }
  }

  function handleStartRecording() {
    if (!faceDetected) {
      toast.error('No se detecta rostro. Coloca la cara delante de la cámara.')
      return
    }
    framesRef.current = []
    recordingStartRef.current = performance.now()
    setFrameCount(0)
    setRecording(true)
    toast.success('Grabación iniciada.')
  }

  function handleStopRecording() {
    setRecording(false)
    const session: PainEpisodeSessionData = {
      patientId,
      startedAt: new Date(Date.now() - (framesRef.current.at(-1)?.t ?? 0)).toISOString(),
      endedAt: new Date().toISOString(),
      frames: [...framesRef.current],
    }
    // TODO: POST al backend cuando exista el endpoint
    console.info('[PainEpisode] sesión registrada (local):', session)
    toast.success(`Sesión finalizada: ${session.frames.length} frames capturados.`)
  }

  return (
    <div className="nilo-pain-modal" role="dialog" aria-modal="true" aria-labelledby="pain-modal-title">
      <div className="nilo-pain-modal__backdrop" onClick={() => !recording && onClose()} />

      <div className="nilo-pain-modal__panel">
        <header className="nilo-pain-modal__header">
          <div>
            <p className="nilo-pain-modal__eyebrow">Episodio de dolor</p>
            <h2 id="pain-modal-title">{patientName}</h2>
          </div>
          <button
            type="button"
            className="nilo-pain-modal__close"
            onClick={onClose}
            disabled={recording}
            aria-label="Cerrar"
          >
            <MaterialIcon name="close" size={24} />
          </button>
        </header>

        {loadState === 'error' ? (
          <div className="nilo-pain-modal__error">
            <MaterialIcon name="videocam_off" size={48} />
            <p>{errorMsg}</p>
          </div>
        ) : (
          <>
            <div className="nilo-pain-modal__stage">
              {loadState === 'loading' && (
                <div className="nilo-pain-modal__loading">
                  <MaterialIcon name="progress_activity" size={40} />
                  <p>Cargando cámara y MediaPipe…</p>
                </div>
              )}
              <video
                ref={videoRef}
                className={`nilo-pain-modal__video${showFace ? '' : ' nilo-pain-modal__video--hidden'}`}
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="nilo-pain-modal__canvas" />
              {recording && (
                <div className="nilo-pain-modal__rec-badge">
                  <span className="nilo-pain-modal__rec-dot" />
                  REC · {frameCount} frames
                </div>
              )}
              {!faceDetected && loadState === 'ready' && !recording && (
                <div className="nilo-pain-modal__hint">Buscando rostro…</div>
              )}
            </div>

            <footer className="nilo-pain-modal__controls">
              <div className="nilo-pain-modal__controls-row">
                <label className="nilo-pain-modal__select-wrap">
                  <MaterialIcon name="videocam" size={20} />
                  <select
                    value={activeCameraId}
                    onChange={(e) => void handleCameraChange(e.target.value)}
                    disabled={recording || cameras.length === 0}
                  >
                    {cameras.map((cam) => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className={`nilo-pain-modal__toggle${showFace ? ' nilo-pain-modal__toggle--on' : ''}`}
                  onClick={() => setShowFace((v) => !v)}
                  disabled={recording}
                >
                  <MaterialIcon name={showFace ? 'face' : 'grid_on'} size={20} />
                  <span>{showFace ? 'Ver cara' : 'Solo puntos'}</span>
                </button>
              </div>

              <div className="nilo-pain-modal__controls-row">
                {!recording ? (
                  <button
                    type="button"
                    className="nilo-pain-modal__btn nilo-pain-modal__btn--record"
                    onClick={handleStartRecording}
                    disabled={loadState !== 'ready'}
                  >
                    <MaterialIcon name="fiber_manual_record" size={22} />
                    Iniciar grabación
                  </button>
                ) : (
                  <button
                    type="button"
                    className="nilo-pain-modal__btn nilo-pain-modal__btn--stop"
                    onClick={handleStopRecording}
                  >
                    <MaterialIcon name="stop" size={22} />
                    Parar grabación
                  </button>
                )}
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
