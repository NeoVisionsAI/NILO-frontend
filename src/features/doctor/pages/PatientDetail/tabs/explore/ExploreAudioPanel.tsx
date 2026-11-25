import { useEffect, useRef, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { audioRecordingService } from '@/services/audio-recording.service'
import { monitoringSessionService } from '@/services/monitoring-session.service'
import type { AudioRecording } from '@/types/monitoring-session'
import './ExploreAudioPanel.css'

interface ExploreAudioPanelProps {
  clips: AudioRecording[]
  sessionId: string
}

interface ClipEntry {
  clip: AudioRecording
  url: string | null
  loading: boolean
}

function AudioWaveBars({ active }: { active: boolean }) {
  return (
    <span className={`nilo-audio-wave${active ? ' nilo-audio-wave--live' : ''}`} aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="nilo-audio-wave__bar" style={{ animationDelay: `${i * 0.07}s` }} />
      ))}
    </span>
  )
}

function AudioClipPlayer({ clip, url }: { clip: AudioRecording; url: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  if (!url) {
    return (
      <article className="nilo-audio-clip nilo-audio-clip--error">
        <MaterialIcon name="mic_off" size={22} />
        <div>
          <strong>{new Date(clip.start_ts).toLocaleString('es-ES')}</strong>
          <p>Sin URL de reproducción</p>
        </div>
      </article>
    )
  }

  return (
    <article className="nilo-audio-clip">
      <div className="nilo-audio-clip__meta">
        <strong>{new Date(clip.start_ts).toLocaleString('es-ES')}</strong>
        <span>
          {clip.duration_seconds != null ? `${Math.round(clip.duration_seconds)} s` : clip.status}
        </span>
        {clip.transcription && <p className="nilo-audio-clip__transcript">{clip.transcription}</p>}
      </div>
      <AudioWaveBars active={playing} />
      <audio
        ref={audioRef}
        className="nilo-audio-clip__player"
        controls
        preload="metadata"
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      >
        Tu navegador no puede reproducir este audio.
      </audio>
    </article>
  )
}

export function ExploreAudioPanel({ clips, sessionId }: ExploreAudioPanelProps) {
  const [entries, setEntries] = useState<ClipEntry[]>(() =>
    clips.map((clip) => ({ clip, url: null, loading: true })),
  )

  useEffect(() => {
    let cancelled = false
    setEntries(clips.map((clip) => ({ clip, url: null, loading: true })))

    void (async () => {
      const resolved = await Promise.all(
        clips.map(async (clip) => {
          try {
            const res = await audioRecordingService.getDownloadUrl(clip.id)
            return { clip, url: res.download_url, loading: false }
          } catch {
            try {
              const access = await monitoringSessionService.mediaAccess(sessionId, 86_400, { silent: true })
              const item = access.items.find((i) => i.kind === 'audio' && i.id === clip.id)
              return { clip, url: item?.download_url ?? null, loading: false }
            } catch {
              return { clip, url: null, loading: false }
            }
          }
        }),
      )
      if (!cancelled) setEntries(resolved)
    })()

    return () => {
      cancelled = true
    }
  }, [clips, sessionId])

  if (clips.length === 0) {
    return <p className="nilo-explore__placeholder">Sin notas de voz en este intervalo.</p>
  }

  const anyLoading = entries.some((e) => e.loading)

  return (
    <div className="nilo-audio-panel">
      {anyLoading && <p className="nilo-explore__placeholder">Preparando reproducción…</p>}
      {entries.map((entry) => (
        <AudioClipPlayer key={entry.clip.id} clip={entry.clip} url={entry.url} />
      ))}
    </div>
  )
}