import { api, clearTokens, setTokens, type TokenPair } from './api'
import { roleFromApi, type User } from '@/types'

export interface LoginCredentials {
  email: string
  password: string
}

/**
 * Estructura del usuario que devuelve `GET /auth/me` (esquema `UserOut`).
 * El rol viene en `type_user` y el nombre en `name` / `lastname`.
 */
interface ApiUser {
  id?: string
  name?: string
  lastname?: string
  email?: string
  type_user?: string
}

function mapUser(u: ApiUser): User {
  const email = u.email ?? ''
  return {
    id: u.id ?? email,
    firstName: u.name || email.split('@')[0] || 'Usuario',
    lastName: u.lastname ?? '',
    email,
    role: roleFromApi(u.type_user),
  }
}

export const authService = {
  /** Login OAuth2 (form-urlencoded). Guarda el par de tokens. */
  async login({ email, password }: LoginCredentials): Promise<User> {
    const form = new URLSearchParams({ username: email, password })
    // Silenciamos el toast automático: el formulario de login ya muestra el
    // error en línea (evita mensaje duplicado).
    const tokens = await api.postForm<TokenPair>('/auth/login', form, { silent: true })
    setTokens(tokens.access_token, tokens.refresh_token)
    return this.me()
  },

  /** Datos del usuario autenticado. */
  async me(silent = false): Promise<User> {
    const raw = await api.get<ApiUser>('/auth/me', { silent })
    return mapUser(raw)
  },

  logout(): void {
    clearTokens()
  },
}
