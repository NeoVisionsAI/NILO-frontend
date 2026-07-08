import { PageHeader } from '@/components/common'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { IconHeart, IconActivity } from '@/components/icons'

export function PatientDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Hola, Pablo"
        description="Este es el resumen de tu estado de salud."
      />
      <div className="u-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-6)' }}>
        <StatCard label="Frecuencia cardíaca" value="72" unit="lpm" icon={<IconHeart />} trend={{ value: 'Normal', tone: 'success' }} />
        <StatCard label="Saturación O₂" value="98" unit="%" icon={<IconActivity />} trend={{ value: 'Normal', tone: 'success' }} />
        <StatCard label="Pasos hoy" value="4.310" />
      </div>
      <Card title="Próxima cita">
        <div className="u-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>Dr. Ramírez · Cardiología</strong>
            <p className="u-muted">Jueves 3 de julio, 12:30</p>
          </div>
          <Badge tone="info">Confirmada</Badge>
        </div>
      </Card>
    </div>
  )
}
