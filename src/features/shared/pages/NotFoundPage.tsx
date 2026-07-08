import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <div className="u-stack" style={{ alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)' }}>404</h1>
        <p className="u-muted">La página que buscas no existe o ha sido movida.</p>
        <Button onClick={() => navigate(-1)}>Volver atrás</Button>
      </div>
    </div>
  )
}
