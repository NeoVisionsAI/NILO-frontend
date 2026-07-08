import { useContext } from 'react'
import { AuthContext } from '@/context/AuthContext'

/** Acceso tipado al contexto de autenticación. */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}
