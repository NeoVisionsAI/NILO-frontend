import { Button } from '@/components/ui/Button'
import './AdminShared.css'

interface AdminPaginationProps {
  page: number
  hasMore: boolean
  loading?: boolean
  onPrev: () => void
  onNext: () => void
}

export function AdminPagination({ page, hasMore, loading, onPrev, onNext }: AdminPaginationProps) {
  return (
    <div className="admin-pagination">
      <Button type="button" size="sm" variant="ghost" disabled={page === 0 || loading} onClick={onPrev}>
        Anterior
      </Button>
      <span className="admin-pagination__info">Página {page + 1}</span>
      <Button type="button" size="sm" variant="ghost" disabled={!hasMore || loading} onClick={onNext}>
        Siguiente
      </Button>
    </div>
  )
}
