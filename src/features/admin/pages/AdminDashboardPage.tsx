import { PageHeader } from '@/components/common'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { IconUsers, IconActivity, IconAlert, IconStethoscope } from '@/components/icons'

export function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Panel de administración"
        description="Visión general del estado de la plataforma NILO."
      />

      <div className="u-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 'var(--space-6)' }}>
        <StatCard label="Usuarios activos" value="1.284" icon={<IconUsers />} trend={{ value: '+4,2%', tone: 'success' }} />
        <StatCard label="Profesionales" value="176" icon={<IconStethoscope />} />
        <StatCard label="Dispositivos online" value="932" icon={<IconActivity />} trend={{ value: '98% uptime', tone: 'success' }} />
        <StatCard label="Alertas 24h" value="12" icon={<IconAlert />} trend={{ value: '3 críticas', tone: 'danger' }} />
      </div>

      <Card title="Actividad reciente" subtitle="Últimos eventos del sistema">
        <ul className="u-stack">
          <li>Nuevo médico dado de alta · hace 2 h</li>
          <li>Actualización de firmware en 12 dispositivos · hace 5 h</li>
          <li>Copia de seguridad completada · hace 8 h</li>
        </ul>
      </Card>
    </div>
  )
}
