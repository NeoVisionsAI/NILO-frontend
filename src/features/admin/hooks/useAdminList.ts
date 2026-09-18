import { useCallback, useEffect, useState } from 'react'

export const ADMIN_PAGE_SIZE = 20

export interface AdminListFilters {
  name?: string
  lastname?: string
  email?: string
  country?: string
  zip?: string
  mac_address?: string
  city?: string
  public_ip?: string
  ddns?: string
}

interface UseAdminListOptions<T, P> {
  fetchList: (params: P) => Promise<T[]>
  buildParams: (args: {
    skip: number
    limit: number
    q: string
    filters: AdminListFilters
  }) => P
}

export function useAdminList<T, P>({
  fetchList,
  buildParams,
}: UseAdminListOptions<T, P>) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [filters, setFilters] = useState<AdminListFilters>({})
  const [appliedFilters, setAppliedFilters] = useState<AdminListFilters>({})
  const [showFilters, setShowFilters] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const params = buildParams({
        skip: page * ADMIN_PAGE_SIZE,
        limit: ADMIN_PAGE_SIZE,
        q: appliedQ,
        filters: appliedFilters,
      })
      const data = await fetchList(params)
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, appliedQ, buildParams, fetchList, page])

  useEffect(() => {
    void reload()
  }, [reload])

  function applySearch() {
    setPage(0)
    setAppliedQ(q.trim())
    setAppliedFilters({ ...filters })
  }

  function resetFilters() {
    setQ('')
    setFilters({})
    setAppliedQ('')
    setAppliedFilters({})
    setPage(0)
  }

  const hasMore = items.length === ADMIN_PAGE_SIZE

  return {
    items,
    loading,
    page,
    setPage,
    q,
    setQ,
    filters,
    setFilters,
    showFilters,
    setShowFilters,
    applySearch,
    resetFilters,
    reload,
    hasMore,
    pageSize: ADMIN_PAGE_SIZE,
  }
}
