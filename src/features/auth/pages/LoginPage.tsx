import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useAuth } from '@/hooks/useAuth'
import { homePathForRole } from '@/router/paths'
import './LoginPage.css'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // El backend identifica al usuario y su tipo; según el rol se redirige
      // a su área correspondiente (admin/médico/enfermería/paciente).
      const user = await login({ email: username.trim(), password })
      const from = (location.state as { from?: Location })?.from?.pathname
      navigate(from ?? homePathForRole(user.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="nilo-login m3">
      {/* Fondo atmosférico */}
      <div className="nilo-login__bg" aria-hidden="true">
        <span className="nilo-login__blob nilo-login__blob--primary" />
        <span className="nilo-login__blob nilo-login__blob--secondary" />
      </div>

      <main className="nilo-login__main">
        <div className="nilo-login__content">
          {/* Cabecera de marca */}
          <div className="nilo-login__brand">
            <div className="nilo-login__brand-icon">
              <MaterialIcon name="clinical_notes" size={64} />
            </div>
            <h1 className="nilo-login__title">NILO</h1>
            <p className="nilo-login__subtitle">Clinical Monitoring Ecosystem</p>
          </div>

          {/* Formulario */}
          <form className="nilo-login__form" onSubmit={handleSubmit}>
            <div className="nilo-login__fields">
              {/* Usuario */}
              <div className="nilo-login__group">
                <label className="nilo-login__label" htmlFor="username">
                  Clinician Username
                </label>
                <div className="nilo-login__input-wrap">
                  <MaterialIcon name="person" size={24} className="nilo-login__input-icon" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    className="nilo-login__input"
                    placeholder="Enter clinician ID"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div className="nilo-login__group">
                <div className="nilo-login__label-row">
                  <label className="nilo-login__label" htmlFor="password">
                    Security Password
                  </label>
                  <a className="nilo-login__forgot" href="#">
                    Forgot password?
                  </a>
                </div>
                <div className="nilo-login__input-wrap">
                  <MaterialIcon name="lock" size={24} className="nilo-login__input-icon" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="nilo-login__input nilo-login__input--password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="nilo-login__toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <MaterialIcon name={showPassword ? 'visibility_off' : 'visibility'} size={24} />
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <p className="nilo-login__error" role="alert">
                <MaterialIcon name="error" size={20} />
                {error}
              </p>
            )}

            {/* Sesión + acción */}
            <div className="nilo-login__actions">
              <label className="nilo-login__remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Maintain secure session persistence</span>
              </label>

              <button type="submit" className="nilo-login__submit" disabled={loading}>
                <span>{loading ? 'Authorizing…' : 'Authorize Access'}</span>
                <MaterialIcon name={loading ? 'progress_activity' : 'arrow_forward'} size={28} />
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Pie */}
      <footer className="nilo-login__footer">
        <div className="nilo-login__footer-inner">
          <p>v1.0</p>
          <span className="nilo-login__dot" />
          <p>Contact: info@niloai.net</p>
        </div>
      </footer>
    </div>
  )
}
