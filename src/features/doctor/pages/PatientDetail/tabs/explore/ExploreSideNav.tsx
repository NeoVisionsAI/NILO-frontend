import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { SessionOverview } from '@/types/monitoring-session'
import './ExploreSideNav.css'

export type ExploreSection = 'summary' | 'session' | 'face' | 'pose' | 'audio' | 'video' | 'text' | 'physio' | 'pain'

interface NavCategory {
  id: ExploreSection
  label: string
  icon: string
  countKey?:
    | 'video_segments'
    | 'audio_clips'
    | 'physiological_readings'
    | 'landmarks_batches'
    | 'pain_events'
    | 'text_notes'
}

const PRIMARY: Array<{ id: ExploreSection; label: string; icon: string }> = [
  { id: 'summary', label: 'Resumen', icon: 'dashboard' },
  { id: 'session', label: 'Sesión y filtros', icon: 'tune' },
]

const DATA_CATEGORIES: NavCategory[] = [
  { id: 'face', label: 'Expresión facial', icon: 'face' },
  { id: 'pose', label: 'Postura', icon: 'accessibility_new' },
  { id: 'audio', label: 'Audio', icon: 'mic', countKey: 'audio_clips' },
  { id: 'video', label: 'Vídeo', icon: 'videocam', countKey: 'video_segments' },
  { id: 'text', label: 'Notas texto', icon: 'edit_note', countKey: 'text_notes' },
  { id: 'physio', label: 'Fisiológicos', icon: 'monitor_heart', countKey: 'physiological_readings' },
  { id: 'pain', label: 'Dolor', icon: 'healing', countKey: 'pain_events' },
]

interface ExploreSideNavProps {
  active: ExploreSection
  onSelect: (section: ExploreSection) => void
  overview: SessionOverview | null
  sessionSelected: boolean
}

function countFor(cat: NavCategory, overview: SessionOverview | null): string | number | null {
  if (!overview) return null
  if (cat.countKey) return overview[cat.countKey]
  if (cat.id === 'face' || cat.id === 'pose') return overview.landmarks_batches
  return null
}

export function ExploreSideNav({ active, onSelect, overview, sessionSelected }: ExploreSideNavProps) {
  return (
    <nav className="nilo-explore-nav" aria-label="Secciones de exploración">
      <p className="nilo-explore-nav__group">Paciente</p>
      {PRIMARY.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nilo-explore-nav__item${active === item.id ? ' nilo-explore-nav__item--on' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <MaterialIcon name={item.icon} size={20} />
          <span>{item.label}</span>
        </button>
      ))}

      <p className="nilo-explore-nav__group">Datos de sesión</p>
      {!sessionSelected && (
        <p className="nilo-explore-nav__hint">Elige una sesión en «Sesión y filtros».</p>
      )}
      {DATA_CATEGORIES.map((cat) => {
        const count = countFor(cat, overview)
        const disabled = !sessionSelected
        return (
          <button
            key={cat.id}
            type="button"
            disabled={disabled}
            className={`nilo-explore-nav__item${active === cat.id ? ' nilo-explore-nav__item--on' : ''}`}
            onClick={() => onSelect(cat.id)}
          >
            <MaterialIcon name={cat.icon} size={20} />
            <span className="nilo-explore-nav__label">{cat.label}</span>
            {count != null && <span className="nilo-explore-nav__badge">{count}</span>}
          </button>
        )
      })}
    </nav>
  )
}