import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/common'
import { Card } from '@/components/ui/Card'
import { ROOT_PATHS } from '@/router/paths'
import { IconHeart, IconStethoscope, IconActivity } from '@/components/icons'

const SECTIONS = [
  {
    to: `${ROOT_PATHS.admin}/pacientes`,
    title: 'Pacientes',
    description: 'Alta, búsqueda y gestión global de pacientes.',
    icon: <IconHeart />,
  },
  {
    to: `${ROOT_PATHS.admin}/medicos`,
    title: 'Médicos',
    description: 'Clínicos registrados en la plataforma.',
    icon: <IconStethoscope />,
  },
  {
    to: `${ROOT_PATHS.admin}/nodos`,
    title: 'NILO Nodes',
    description: 'Nodos edge, telemetría y heartbeat (vía nilo-node).',
    icon: <IconActivity />,
  },
]

export function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Root Admin"
        description="Administración global de NILO. Usa los endpoints /api/v1/admin/*."
      />

      <div className="u-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {SECTIONS.map((section) => (
          <Link key={section.to} to={section.to} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card title={section.title} subtitle={section.description}>
              <div className="u-row" style={{ marginTop: 'var(--space-2)', color: 'var(--color-primary)' }}>
                {section.icon}
                <span style={{ fontWeight: 'var(--font-semibold)' }}>Abrir sección →</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
