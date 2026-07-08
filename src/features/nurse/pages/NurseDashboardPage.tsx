import { PageHeader } from '@/components/common'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { IconClipboard, IconHeart, IconAlert } from '@/components/icons'

export function NurseDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Panel de enfermería"
        description="Tu turno de hoy de un vistazo."
      />
      <div className="u-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 'var(--space-6)' }}>
        <StatCard label="Pacientes asignados" value="14" icon={<IconHeart />} />
        <StatCard label="Tareas pendientes" value="6" icon={<IconClipboard />} trend={{ value: '2 urgentes', tone: 'warning' }} />
        <StatCard label="Avisos" value="3" icon={<IconAlert />} />
      </div>
      <Card title="Próximas tareas">
        <ul className="u-stack">
          <li>Control de constantes · Hab. 204-A · 10:00</li>
          <li>Administración de medicación · Hab. 210-B · 10:30</li>
          <li>Extracción analítica · Hab. 215-A · 11:15</li>
        </ul>
      </Card>
    </div>
  )
}
