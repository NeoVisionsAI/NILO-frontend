import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { ROOT_PATHS, homePathForRole } from './paths'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  /** Roles autorizados a acceder. Si se omite, basta con estar autenticado. */
  allow?: UserRole[]
  children: ReactNode
}

/**
 * Guarda de ruta: exige sesión y, opcionalmente, un rol concreto.
 * Redirige a login si no hay sesión, o al home del rol si el rol no coincide.
 */
export function ProtectedRoute({ allow, children }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <Spinner fullscreen />

  if (!isAuthenticated || !user) {
    return <Navigate to={ROOT_PATHS.login} state={{ from: location }} replace />
  }

  if (allow && !allow.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  return <>{children}</>
}
