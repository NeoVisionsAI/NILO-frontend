const PREFIX = 'nilo_session_display_name_'

/** Respaldo local hasta que exista PATCH `/sessions/{id}` con `display_name`. */
export const sessionDisplayNameCache = {
  get(sessionId: string): string | null {
    return localStorage.getItem(`${PREFIX}${sessionId}`)
  },
  set(sessionId: string, name: string | null): void {
    const key = `${PREFIX}${sessionId}`
    if (name?.trim()) localStorage.setItem(key, name.trim())
    else localStorage.removeItem(key)
  },
}

export function resolveSessionDisplayName(
  session: { id: string; display_name?: string | null },
): string | null {
  const remote = session.display_name?.trim()
  if (remote) return remote
  return sessionDisplayNameCache.get(session.id)
}