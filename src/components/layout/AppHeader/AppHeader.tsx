import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_LABELS } from '@/types'
import './AppHeader.css'

interface AppHeaderProps {
  /** Título contextual de la sección actual. */
  title?: string
  /** Callback para abrir/cerrar la barra lateral en móvil. */
  onToggleSidebar?: () => void
}

/** Cabecera reutilizable compartida por todos los roles. */
export function AppHeader({ title, onToggleSidebar }: AppHeaderProps) {
  const { user, logout } = useAuth()

  return (
    <header className="nilo-header">
      <div className="nilo-header__left">
        {onToggleSidebar && (
          <button
            className="nilo-header__burger"
            onClick={onToggleSidebar}
            aria-label="Abrir menú"
          >
            ☰
          </button>
        )}
        {title && <h1 className="nilo-header__title">{title}</h1>}
      </div>

      <div className="nilo-header__right">
        {user && (
          <div className="nilo-header__user">
            <Avatar name={`${user.firstName} ${user.lastName}`} src={user.avatarUrl} />
            <div className="nilo-header__user-info">
              <span className="nilo-header__user-name">
                {user.firstName} {user.lastName}
              </span>
              <span className="nilo-header__user-role">{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={logout}>
          Salir
        </Button>
      </div>
    </header>
  )
}
