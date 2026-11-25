import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { PatientExploreStats } from '@/lib/explore-patient-stats'
import './PatientExploreSummary.css'

function fmtHours(h: number): string {
  if (h < 0.1) return `${Math.round(h * 60)} min`
  return `${h.toFixed(1)} h`
}

interface PatientExploreSummaryProps {
  stats: PatientExploreStats
}

const TILES: Array<{
  key: keyof PatientExploreStats
  label: string
  icon: string
  format?: (v: number) => string
}> = [
  { key: 'sessionCount', label: 'Sesiones', icon: 'layers' },
  { key: 'totalMonitoringHours', label: 'Horas monitorizadas', icon: 'schedule', format: fmtHours },
  { key: 'totalAudioClips', label: 'Notas de voz', icon: 'mic' },
  { key: 'estimatedVideoHours', label: 'Vídeo (estim.)', icon: 'videocam', format: fmtHours },
  { key: 'totalLandmarks', label: 'Lotes landmarks', icon: 'face' },
  { key: 'totalPhysio', label: 'Lecturas fisiológicas', icon: 'monitor_heart' },
  { key: 'totalPainEvents', label: 'Episodios de dolor', icon: 'healing' },
  { key: 'totalTextNotes', label: 'Notas texto', icon: 'edit_note' },
]

export function PatientExploreSummary({ stats }: PatientExploreSummaryProps) {
  if (stats.loading) {
    return (
      <div className="nilo-explore-summary nilo-explore-summary--loading">
        <MaterialIcon name="hourglass_top" size={22} />
        <span>Calculando resumen del paciente…</span>
      </div>
    )
  }

  return (
    <section className="nilo-explore-summary" aria-label="Resumen global del paciente">
      <header className="nilo-explore-summary__head">
        <h2>Resumen del paciente</h2>
        {stats.activeSessions > 0 && (
          <span className="nilo-explore-summary__live">
            <span aria-hidden className="nilo-explore-summary__dot" />
            {stats.activeSessions} sesión activa
          </span>
        )}
      </header>
      <div className="nilo-explore-summary__grid">
        {TILES.map((tile) => {
          const raw = stats[tile.key]
          const value = typeof raw === 'number' ? raw : 0
          const display = tile.format ? tile.format(value) : String(value)
          return (
            <div key={tile.key} className="nilo-explore-summary__tile">
              <MaterialIcon name={tile.icon} size={22} />
              <span className="nilo-explore-summary__val">{display}</span>
              <span className="nilo-explore-summary__lbl">{tile.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}