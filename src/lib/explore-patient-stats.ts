import type { MonitoringSession, SessionOverview } from '@/types/monitoring-session'
import { sessionDurationHours } from './explore-time'

export interface PatientExploreStats {
  sessionCount: number
  activeSessions: number
  totalMonitoringHours: number
  totalAudioClips: number
  totalVideoSegments: number
  estimatedVideoHours: number
  totalPhysio: number
  totalLandmarks: number
  totalPainEvents: number
  totalTextNotes: number
  loading: boolean
}

export function emptyPatientStats(loading = false): PatientExploreStats {
  return {
    sessionCount: 0,
    activeSessions: 0,
    totalMonitoringHours: 0,
    totalAudioClips: 0,
    totalVideoSegments: 0,
    estimatedVideoHours: 0,
    totalPhysio: 0,
    totalLandmarks: 0,
    totalPainEvents: 0,
    totalTextNotes: 0,
    loading,
  }
}

export function aggregatePatientExploreStats(
  sessions: MonitoringSession[],
  overviews: (SessionOverview | null)[],
): PatientExploreStats {
  let totalAudioClips = 0
  let totalVideoSegments = 0
  let estimatedVideoHours = 0
  let totalPhysio = 0
  let totalLandmarks = 0
  let totalPainEvents = 0
  let totalTextNotes = 0

  sessions.forEach((session, i) => {
    const o = overviews[i]
    if (!o) return
    totalAudioClips += o.audio_clips
    totalVideoSegments += o.video_segments
    const segSec = session.hls_segment_seconds ?? session.archive_chunk_seconds ?? 6
    estimatedVideoHours += (o.video_segments * segSec) / 3600
    totalPhysio += o.physiological_readings
    totalLandmarks += o.landmarks_batches
    totalPainEvents += o.pain_events
    totalTextNotes += o.text_notes
  })

  const totalMonitoringHours = sessions.reduce((acc, s) => acc + sessionDurationHours(s), 0)
  const activeSessions = sessions.filter((s) => s.status === 'active').length

  return {
    sessionCount: sessions.length,
    activeSessions,
    totalMonitoringHours,
    totalAudioClips,
    totalVideoSegments,
    estimatedVideoHours,
    totalPhysio,
    totalLandmarks,
    totalPainEvents,
    totalTextNotes,
    loading: false,
  }
}