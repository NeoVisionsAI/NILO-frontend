import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { isRootUser } from '@/types'
import { homePathForRole, ROOT_PATHS } from './paths'

/** Exige sesión root (`type_user === "root"`) para el área /admin. */
export function RootAdminRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <Spinner fullscreen />

  if (!isAuthenticated || !user) {
    return <Navigate to={ROOT_PATHS.login} replace />
  }

  if (!isRootUser(user)) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  return <>{children}</>
}
