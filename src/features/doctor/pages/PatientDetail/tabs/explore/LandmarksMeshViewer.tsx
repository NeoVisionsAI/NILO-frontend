import { useCallback, useEffect, useRef, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { ParsedLandmarks } from '@/lib/landmarks-json'
import './LandmarksMeshViewer.css'

/** Conexiones simplificadas MediaPipe Pose (33 puntos). */
const POSE_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
]

interface LandmarksMeshViewerProps {
  data: ParsedLandmarks
  title?: string
}

export function LandmarksMeshViewer({ data, title }: LandmarksMeshViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [playbackFps, setPlaybackFps] = useState(data.fps || 15)
  const [playing, setPlaying] = useState(false)

  const frameCount = data.frames.length

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, w, h)

    const frame = data.frames[frameIndex]
    if (!frame) return
  const points = frame.points
    const padding = 16
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)'
    ctx.lineWidth = 1.25
    ctx.fillStyle = '#38bdf8'

    const drawPoint = (x: number, y: number) => {
      const px = padding + x * (w - padding * 2)
      const py = padding + y * (h - padding * 2)
      ctx.beginPath()
      ctx.arc(px, py, data.kind === 'face' ? 1.2 : 3.5, 0, Math.PI * 2)
      ctx.fill()
    }

    if (data.kind === 'pose') {
      for (const [a, b] of POSE_CONNECTIONS) {
        const pa = points[a]
        const pb = points[b]
        if (!pa || !pb) continue
        const x1 = padding + pa.x * (w - padding * 2)
        const y1 = padding + pa.y * (h - padding * 2)
        const x2 = padding + pb.x * (w - padding * 2)
        const y2 = padding + pb.y * (h - padding * 2)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }
    }

    for (const p of points) {
      drawPoint(p.x, p.y)
    }

    ctx.fillStyle = 'rgba(248, 250, 252, 0.85)'
    ctx.font = '12px system-ui'
    ctx.fillText(
      `Frame ${frameIndex + 1}/${frameCount} · ${frame.timestamp_ms} ms`,
      padding,
      h - padding,
    )
  }, [data, frameCount, frameIndex])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    if (!playing || frameCount < 2) return
    const interval = window.setInterval(() => {
      setFrameIndex((i) => (i + 1) % frameCount)
    }, 1000 / Math.max(1, playbackFps))
    return () => window.clearInterval(interval)
  }, [playing, playbackFps, frameCount])

  return (
    <div className="nilo-lm-viewer">
      {title && <p className="nilo-lm-viewer__title">{title}</p>}
      <canvas ref={canvasRef} className="nilo-lm-viewer__canvas" width={640} height={400} />
      <div className="nilo-lm-viewer__controls">
        <button type="button" className="nilo-lm-viewer__btn" onClick={() => setPlaying((p) => !p)}>
          <MaterialIcon name={playing ? 'pause' : 'play_arrow'} size={22} />
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, frameCount - 1)}
          value={frameIndex}
          onChange={(e) => {
            setPlaying(false)
            setFrameIndex(Number(e.target.value))
          }}
          className="nilo-lm-viewer__scrub"
        />
        <label className="nilo-lm-viewer__fps">
          FPS
          <input
            type="number"
            min={1}
            max={60}
            value={playbackFps}
            onChange={(e) => setPlaybackFps(Math.max(1, Number(e.target.value) || 15))}
          />
        </label>
      </div>
    </div>
  )
}