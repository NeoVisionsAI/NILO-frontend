import { PageHeader } from '@/components/common'
import { Card } from '@/components/ui/Card'

interface PlaceholderPageProps {
  title: string
  description?: string
}

/**
 * Página de marcador de posición reutilizable.
 * Útil mientras se implementan las vistas reales de cada rol.
 */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <p className="u-muted">
          Vista pendiente de implementar. Sustituye este componente por la vista real cuando
          esté lista.
        </p>
      </Card>
    </div>
  )
}
