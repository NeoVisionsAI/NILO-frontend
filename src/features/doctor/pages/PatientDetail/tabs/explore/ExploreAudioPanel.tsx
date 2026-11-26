import { useCallback, useEffect, useRef, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import {
  AUDIO_WAVE_PLACEHOLDER_PEAKS,
  computeWaveformPeaks,
  drawSmoothWaveform,
} from '@/lib/audio-waveform'
import { parseApiDateMs } from '@/lib/parse-api-datetime'
import {
  fetchClinicalAudioPlaybackUrl,
  revokeClinicalAudioPlaybackUrl,
} from '@/lib/fetch-clinical-audio-url'
import type { AudioRecording } from '@/types/monitoring-session'
import './ExploreAudioPanel.css'

export type ExploreAudioVariant = 'ambient' | 'voice'

interface ExploreAudioPanelProps {
  clips: AudioRecording[]
  sessionId: string
  variant: ExploreAudioVariant
}

interface ClipEntry {
  clip: AudioRecording
  url: string | null
  loading: boolean
}

function formatClipTime(iso: string): string {
  const ms = parseApiDateMs(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

function audioDurationSeconds(el: HTMLAudioElement, clip: AudioRecording): number {
  if (Number.isFinite(el.duration) && el.duration > 0) return el.duration
  if (clip.duration_seconds != null && clip.duration_seconds > 0) return clip.duration_seconds
  return 0
}

function AudioWaveformCanvas({
  peaks,
  progress,
  onSeek,
  pending,
}: {
  peaks: number[]
  progress: number
  onSeek: (ratio: number) => void
  pending?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const mid = h / 2
    const padX = 2
    const drawW = w - padX * 2

    const grayGrad = ctx.createLinearGradient(0, 0, 0, h)
    grayGrad.addColorStop(0, 'rgba(148, 163, 184, 0.55)')
    grayGrad.addColorStop(0.45, 'rgba(148, 163, 184, 0.22)')
    grayGrad.addColorStop(0.55, 'rgba(148, 163, 184, 0.22)')
    grayGrad.addColorStop(1, 'rgba(148, 163, 184, 0.55)')

    const blueGrad = ctx.createLinearGradient(0, 0, 0, h)
    blueGrad.addColorStop(0, 'rgba(37, 99, 235, 0.92)')
    blueGrad.addColorStop(0.42, 'rgba(59, 130, 246, 0.38)')
    blueGrad.addColorStop(0.58, 'rgba(59, 130, 246, 0.38)')
    blueGrad.addColorStop(1, 'rgba(37, 99, 235, 0.92)')

    ctx.save()
    ctx.translate(padX, 0)
    drawSmoothWaveform(ctx, peaks, drawW, h, grayGrad)

    const playedPx = Math.max(0, progress * drawW)
    if (playedPx > 0.5) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, playedPx, h)
      ctx.clip()
      drawSmoothWaveform(ctx, peaks, drawW, h, blueGrad)
      ctx.restore()
    }
    ctx.restore()

    const needleX = padX + progress * drawW
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(needleX, 3)
    ctx.lineTo(needleX, h - 3)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padX, mid)
    ctx.lineTo(w - padX, mid)
    ctx.stroke()
  }, [peaks, progress])

  return (
    <canvas
      ref={canvasRef}
      className={`nilo-audio-clip__wave${pending ? ' nilo-audio-clip__wave--pending' : ''}`}
      role="slider"
      aria-label="Posición en el audio"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
        onSeek(ratio)
      }}
    />
  )
}

function AudioClipRow({ clip, url }: { clip: AudioRecording; url: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [peaksLoading, setPeaksLoading] = useState(false)

  useEffect(() => {
    if (!url) {
      setPeaks(null)
      return
    }
    let cancelled = false
    setPeaksLoading(true)
    void computeWaveformPeaks(url)
      .then((p) => {
        if (!cancelled) setPeaks(p)
      })
      .catch(() => {
        if (!cancelled) setPeaks(null)
      })
      .finally(() => {
        if (!cancelled) setPeaksLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      setPlaying(true)
      const dur = audioDurationSeconds(el, clip)
      if (dur > 0) setProgress(Math.min(1, el.currentTime / dur))
      void el.play().catch(() => setPlaying(false))
    } else {
      el.pause()
    }
  }, [])

  const seek = useCallback(
    (ratio: number) => {
      const el = audioRef.current
      const dur = el ? audioDurationSeconds(el, clip) : 0
      if (!el || dur <= 0) return
      el.currentTime = ratio * dur
      setProgress(ratio)
    },
    [clip],
  )

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      const el = audioRef.current
      if (el) {
        const dur = audioDurationSeconds(el, clip)
        if (dur > 0) setProgress(Math.min(1, el.currentTime / dur))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clip, playing])

  if (!url) {
    return (
      <article className="nilo-audio-clip nilo-audio-clip--error">
        <MaterialIcon name="mic_off" size={18} />
        <span>{formatClipTime(clip.start_ts)} — sin URL</span>
      </article>
    )
  }

  return (
    <article className="nilo-audio-clip">
      <button type="button" className="nilo-audio-clip__play" onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'}>
        <MaterialIcon name={playing ? 'pause' : 'play_arrow'} size={22} />
      </button>
      <div className="nilo-audio-clip__body">
        <div className="nilo-audio-clip__head">
          <time dateTime={clip.start_ts}>{formatClipTime(clip.start_ts)}</time>
          <span>
            {clip.duration_seconds != null ? `${Math.round(clip.duration_seconds)} s` : clip.status}
          </span>
        </div>
        <AudioWaveformCanvas
          peaks={peaks ?? AUDIO_WAVE_PLACEHOLDER_PEAKS}
          progress={progress}
          onSeek={seek}
          pending={peaksLoading || peaks == null}
        />
        {clip.transcription && (
          <p className="nilo-audio-clip__transcript" title={clip.transcription}>
            {clip.transcription}
          </p>
        )}
      </div>
      <audio
        ref={audioRef}
        className="nilo-audio-clip__audio-hidden"
        preload="auto"
        src={url}
        onLoadedMetadata={() => {
          const el = audioRef.current
          if (!el || !playing) return
          const dur = audioDurationSeconds(el, clip)
          if (dur > 0) setProgress(Math.min(1, el.currentTime / dur))
        }}
        onPlay={() => {
          setPlaying(true)
          const el = audioRef.current
          if (!el) return
          const dur = audioDurationSeconds(el, clip)
          if (dur > 0) setProgress(Math.min(1, el.currentTime / dur))
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setProgress(0)
        }}
      />
    </article>
  )
}

export function ExploreAudioPanel({ clips, sessionId, variant }: ExploreAudioPanelProps) {
  const [entries, setEntries] = useState<ClipEntry[]>(() =>
    clips.map((clip) => ({ clip, url: null, loading: true })),
  )

  useEffect(() => {
    let cancelled = false
    setEntries(clips.map((clip) => ({ clip, url: null, loading: true })))

    void (async () => {
      const resolved = await Promise.all(
        clips.map(async (clip) => {
          const url = await fetchClinicalAudioPlaybackUrl(clip.id, sessionId)
          return { clip, url, loading: false }
        }),
      )
      if (!cancelled) setEntries(resolved)
    })()

    return () => {
      cancelled = true
      setEntries((prev) => {
        for (const e of prev) revokeClinicalAudioPlaybackUrl(e.url)
        return prev
      })
    }
  }, [clips, sessionId])

  if (clips.length === 0) {
    return (
      <p className="nilo-explore__placeholder">
        {variant === 'voice'
          ? 'Sin notas de voz en este intervalo.'
          : 'Sin audio ambiente (micrófonos) en este intervalo.'}
      </p>
    )
  }

  return (
    <div className="nilo-audio-panel">
      <p className="nilo-audio-panel__hint">
        {variant === 'voice'
          ? 'Notas de voz clínicas — pulsa la forma de onda para avanzar.'
          : 'Audio captado por micrófonos del nodo — forma de onda real del fichero.'}
      </p>
      {entries.map((entry) => (
        <AudioClipRow key={entry.clip.id} clip={entry.clip} url={entry.url} />
      ))}
    </div>
  )
}