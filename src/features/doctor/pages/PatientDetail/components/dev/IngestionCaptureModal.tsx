import { useCallback, useEffect, useRef, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import {
  deviceLabel,
  ensureMediaPermission,
  listMediaInputDevices,
  type MediaDeviceKind,
} from '@/lib/media-devices'
import { canUseLiveCamera } from '@/lib/camera'
import { drawFaceLandmarks, getFaceLandmarker } from '@/features/doctor/pages/PatientDetail/pain-episode/faceLandmarker'
import {
  captureFaceLandmarksClip,
  recordAudioClip,
  recordVideoClip,
} from '@/dev/ingestion-sim/real-capture'
import { ApiError } from '@/services/api'
import { ingestionSimulator, type IngestionTarget, type SimResult } from '@/dev/ingestion-sim/ingestion-simulator'
import './IngestionCaptureModal.css'

export type CaptureMode = 'audio' | 'video' | 'face'

interface IngestionCaptureModalProps {
  mode: CaptureMode
  durationSeconds: number
  target: IngestionTarget
  onClose: () => void
  onSuccess: (result: SimResult) => void
}

const MODE_META: Record<CaptureMode, { title: string; icon: string; needsCamera: boolean }> = {
  audio: { title: 'Grabar nota de audio', icon: 'mic', needsCamera: false },
  video: { title: 'Grabar clip de vídeo', icon: 'videocam', needsCamera: true },
  face: { title: 'Capturar landmarks faciales', icon: 'face', needsCamera: true },
}

export function IngestionCaptureModal({
  mode,
  durationSeconds,
  target,
  onClose,
  onSuccess,
}: IngestionCaptureModalProps) {
  const meta = MODE_META[mode]
  const deviceKind: MediaDeviceKind = mode === 'audio' ? 'audioinput' : 'videoinput'

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [phase, setPhase] = useState<'idle' | 'capturing' | 'uploading'>('idle')
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds)
  const [status, setStatus] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewStreamRef = useRef<MediaStream | null>(null)
  const facePreviewRafRef = useRef<number>(0)
  const lastVideoTimeRef = useRef(-1)
  const [faceModelReady, setFaceModelReady] = useState(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const stopPreview = useCallback(() => {
    previewStreamRef.current?.getTracks().forEach((t) => t.stop())
    previewStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const syncFaceCanvasSize = useCallback(() => {
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

  const startPreview = useCallback(async () => {
    if (mode === 'audio') return
    if (!canUseLiveCamera()) {
      toast.error('Se requiere HTTPS para la cámara.')
      return
    }
    stopPreview()
    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' },
      audio: false,
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    previewStreamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      syncFaceCanvasSize()
    }
  }, [deviceId, mode, stopPreview, syncFaceCanvasSize])

  useEffect(() => {
    if (mode !== 'face') {
      setFaceModelReady(false)
      return
    }

    let cancelled = false
    void getFaceLandmarker()
      .then(() => {
        if (!cancelled) setFaceModelReady(true)
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar MediaPipe Face Landmarker.')
      })

    return () => {
      cancelled = true
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'face' || phase !== 'idle' || !faceModelReady) return

    let running = true

    async function loop() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) {
        if (running) facePreviewRafRef.current = requestAnimationFrame(loop)
        return
      }

      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime
        syncFaceCanvasSize()

        try {
          const landmarker = await getFaceLandmarker()
          const results = landmarker.detectForVideo(video, performance.now())
          const ctx = canvas.getContext('2d')
          if (ctx) {
            const w = canvas.width
            const h = canvas.height
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.clearRect(0, 0, w, h)
            drawFaceLandmarks(ctx, results, video, w, h, true, true)
          }
        } catch {
          /* frame suelto */
        }
      }

      if (running) facePreviewRafRef.current = requestAnimationFrame(loop)
    }

    facePreviewRafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(facePreviewRafRef.current)
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [faceModelReady, mode, phase, syncFaceCanvasSize])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingDevices(true)
      try {
        await ensureMediaPermission(deviceKind)
        const list = await listMediaInputDevices(deviceKind)
        if (cancelled) return
        setDevices(list)
        setDeviceId((prev) => prev || list[0]?.deviceId || '')
      } catch {
        if (!cancelled) toast.error('No se pudo acceder al micrófono/cámara.')
      } finally {
        if (!cancelled) setLoadingDevices(false)
      }
    })()
    return () => {
      cancelled = true
      stopPreview()
    }
  }, [deviceKind, stopPreview])

  useEffect(() => {
    if (!meta.needsCamera || !deviceId || phase !== 'idle') return
    void startPreview().catch(() => {
      /* permiso o dispositivo */
    })
    return () => {
      if (phaseRef.current === 'idle') stopPreview()
    }
  }, [deviceId, meta.needsCamera, phase, startPreview, stopPreview])

  const paintFaceOverlay = useCallback(
    (results: Parameters<typeof drawFaceLandmarks>[1], video: HTMLVideoElement) => {
      const canvas = canvasRef.current
      if (!canvas) return
      syncFaceCanvasSize()
      const ctx = canvas.getContext('2d')
      if (!ctx || canvas.width <= 0 || canvas.height <= 0) return
      const w = canvas.width
      const h = canvas.height
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)
      drawFaceLandmarks(ctx, results, video, w, h, true, true)
    },
    [syncFaceCanvasSize],
  )

  async function handleCapture() {
    if (phase !== 'idle') return
    phaseRef.current = 'capturing'
    setPhase('capturing')
    setSecondsLeft(durationSeconds)
    setStatus('Capturando…')

    try {
      if (mode !== 'face') stopPreview()
      const dev = deviceId || undefined
      const durationMs = durationSeconds * 1000
      const onTick = (left: number) => setSecondsLeft(left)

      let result: SimResult

      if (mode === 'audio') {
        setStatus('Grabando audio…')
        const clip = await recordAudioClip(durationMs, dev, onTick)
        setPhase('uploading')
        setStatus('Subiendo nota de audio…')
        result = await ingestionSimulator.sendAudioBlob(target, {
          blob: clip.blob,
          startedAt: clip.startedAt,
          endedAt: clip.endedAt,
          format: clip.ext,
          fileExtension: clip.ext,
          contentType: clip.mime,
        })
      } else if (mode === 'video') {
        setStatus('Grabando vídeo…')
        const clip = await recordVideoClip(durationMs, dev, onTick)
        setPhase('uploading')
        setStatus('Subiendo segmento (puede fallar si MinIO no es HTTPS)…')
        result = await ingestionSimulator.sendVideoBlob(target, {
          blob: clip.blob,
          durationSeconds,
          startedAt: clip.startedAt,
          endedAt: clip.endedAt,
        })
      } else {
        setStatus('Detectando rostro con MediaPipe…')
        cancelAnimationFrame(facePreviewRafRef.current)
        const capture = await captureFaceLandmarksClip(
          durationSeconds,
          dev,
          onTick,
          videoRef.current ?? undefined,
          previewStreamRef.current,
          paintFaceOverlay,
        )
        const framesWithFace = capture.payload.frames.filter((f) => f.landmarks.length > 0).length
        if (framesWithFace === 0) {
          throw new Error('No se detectaron landmarks; revisa encuadre o iluminación.')
        }
        setPhase('uploading')
        setStatus('Subiendo landmarks.zip…')
        result = await ingestionSimulator.sendFaceLandmarksPayload(target, {
          payload: capture.payload,
          frameCount: capture.payload.frame_count,
          startedAt: capture.startedAt,
          endedAt: capture.endedAt,
        })
      }

      onSuccess(result)
      onClose()
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Error en captura'
      if (err instanceof ApiError && err.status === 413) {
        msg =
          'El lote de landmarks supera el límite del servidor (413). Reduce la duración o confirma nginx client_max_body_size (p. ej. 64m) en /api/.'
      }
      if (err instanceof ApiError && err.status === 400) {
        msg = `${msg} (si es ZIP: debe contener exactamente un landmarks.json).`
      }
      toast.error(msg)
      phaseRef.current = 'idle'
      setPhase('idle')
      setStatus('')
      if (meta.needsCamera) void startPreview()
    }
  }

  return (
    <div className="nilo-ingest-cap" role="dialog" aria-modal="true" aria-labelledby="ingest-cap-title">
      <div className="nilo-ingest-cap__backdrop" onClick={phase === 'idle' ? onClose : undefined} />
      <div className="nilo-ingest-cap__panel">
        <header className="nilo-ingest-cap__head">
          <MaterialIcon name={meta.icon} size={24} />
          <h2 id="ingest-cap-title">{meta.title}</h2>
          <button type="button" className="nilo-ingest-cap__close" onClick={onClose} disabled={phase === 'capturing'}>
            <MaterialIcon name="close" size={20} />
          </button>
        </header>

        {(devices.length > 1 || loadingDevices) && (
          <label className="nilo-ingest-cap__field">
            <span>{mode === 'audio' ? 'Micrófono' : 'Cámara'}</span>
            <select
              value={deviceId}
              disabled={loadingDevices || phase !== 'idle'}
              onChange={(e) => setDeviceId(e.target.value)}
            >
              {devices.length === 0 ? (
                <option value="">Sin dispositivos</option>
              ) : (
                devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {deviceLabel(d, i)}
                  </option>
                ))
              )}
            </select>
          </label>
        )}

        {meta.needsCamera && (
          <div className="nilo-ingest-cap__preview-wrap">
            <video
              ref={videoRef}
              className="nilo-ingest-cap__preview"
              playsInline
              muted
              onLoadedMetadata={() => syncFaceCanvasSize()}
            />
            {mode === 'face' && <canvas ref={canvasRef} className="nilo-ingest-cap__canvas" aria-hidden />}
            {mode === 'face' && !faceModelReady && (
              <span className="nilo-ingest-cap__overlay-hint">Cargando modelo facial…</span>
            )}
            {mode === 'face' && faceModelReady && (
              <span className="nilo-ingest-cap__hint">Rostro centrado — malla en vivo</span>
            )}
          </div>
        )}

        <p className="nilo-ingest-cap__duration">
          Duración: <strong>{durationSeconds} s</strong>
          {phase !== 'idle' && (
            <span className="nilo-ingest-cap__countdown" aria-live="polite">
              {secondsLeft > 0 ? ` — ${secondsLeft} s` : ' — finalizando…'}
            </span>
          )}
        </p>

        {status && <p className="nilo-ingest-cap__status">{status}</p>}

        <footer className="nilo-ingest-cap__actions">
          <button type="button" className="nilo-ingest-cap__btn nilo-ingest-cap__btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="nilo-ingest-cap__btn nilo-ingest-cap__btn--primary"
            disabled={phase !== 'idle' || (devices.length === 0 && !loadingDevices)}
            onClick={() => void handleCapture()}
          >
            <MaterialIcon name={phase === 'idle' ? 'fiber_manual_record' : 'hourglass_top'} size={20} />
            {phase === 'idle' ? `Grabar ${durationSeconds} s` : phase === 'capturing' ? 'Grabando…' : 'Subiendo…'}
          </button>
        </footer>
      </div>
    </div>
  )
}