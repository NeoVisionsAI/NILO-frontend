import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROOT_PATHS, homePathForRole } from '@/router/paths'
import { Spinner } from '@/components/ui/Spinner'

/** Redirige la ruta raíz "/" al panel correspondiente al rol (o a login). */
export function RootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner fullscreen />
  if (!isAuthenticated || !user) return <Navigate to={ROOT_PATHS.login} replace />
  return <Navigate to={homePathForRole(user.role)} replace />
}
