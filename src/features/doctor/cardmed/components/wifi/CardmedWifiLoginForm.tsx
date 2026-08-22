import { MaterialIcon } from '@/components/ui/MaterialIcon'
import './CardmedWifiLoginForm.css'

interface CardmedWifiLoginFormProps {
  deviceName: string
  version?: string
  password: string
  showPassword: boolean
  busy: boolean
  error?: string | null
  onPasswordChange: (value: string) => void
  onToggleShowPassword: () => void
  onSubmit: () => void
}

export function CardmedWifiLoginForm({
  deviceName,
  version,
  password,
  showPassword,
  busy,
  error,
  onPasswordChange,
  onToggleShowPassword,
  onSubmit,
}: CardmedWifiLoginFormProps) {
  return (
    <section className="wifi-login">
      <div className="wifi-login__intro">
        <MaterialIcon name="lock" size={28} />
        <div>
          <h2>Acceso al dispositivo</h2>
          <p>
            <strong>{deviceName}</strong>
            {version ? ` · v${version}` : ''}
          </p>
          <span className="wifi-login__hint">Usa la misma contraseña que la red WiFi del Pi.</span>
        </div>
      </div>

      <form
        className="wifi-login__form"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <label className="wifi-login__label" htmlFor="wifi-device-password">
          Contraseña
        </label>

        <div className="wifi-login__row">
          <div className="wifi-login__input-wrap">
            <input
              id="wifi-device-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              autoComplete="off"
              autoFocus
              disabled={busy}
            />
            <button
              type="button"
              className="wifi-login__toggle"
              onClick={onToggleShowPassword}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              disabled={busy}
            >
              <MaterialIcon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
            </button>
          </div>
          <button type="submit" className="nilo-cardmed__primary wifi-login__submit" disabled={busy || !password.trim()}>
            Entrar
          </button>
        </div>

        {error && (
          <p className="wifi-login__error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}
