import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { CardmedConnectionPhase } from '../ble/types'
import './CardmedBleProgress.css'

interface CardmedBleProgressProps {
  phase: Extract<CardmedConnectionPhase, 'connecting' | 'authenticating'>
  variant?: 'page' | 'compact' | 'modal'
}

const STEPS = [
  { id: 'connecting', label: 'Bluetooth', icon: 'bluetooth' as const },
  { id: 'authenticating', label: 'Autenticación', icon: 'lock' as const },
]

export function CardmedBleProgress({ phase, variant = 'page' }: CardmedBleProgressProps) {
  const stepIndex = phase === 'authenticating' ? 1 : 0
  const headline = phase === 'authenticating' ? 'Autenticando con NiloCardmed…' : 'Conectando por Bluetooth…'
  const detail =
    phase === 'authenticating'
      ? 'Verificando contraseña y abriendo sesión segura.'
      : 'Emparejando con el dispositivo. Puede tardar unos segundos.'

  if (variant === 'compact') {
    return (
      <div className="cardmed-ble-progress cardmed-ble-progress--compact" role="status" aria-live="polite">
        <div className="cardmed-ble-progress__track" aria-hidden="true">
          <div className="cardmed-ble-progress__fill" />
        </div>
        <span>{headline}</span>
      </div>
    )
  }

  return (
    <div
      className={`cardmed-ble-progress cardmed-ble-progress--${variant}`}
      role="status"
      aria-live="polite"
      aria-label={headline}
    >
      {variant === 'page' && (
        <div className="cardmed-ble-progress__top" aria-hidden="true">
          <div className="cardmed-ble-progress__track">
            <div className="cardmed-ble-progress__fill" />
          </div>
        </div>
      )}

      <div className="cardmed-ble-progress__panel">
        <div className="cardmed-ble-progress__spinner" aria-hidden="true">
          <MaterialIcon name="bluetooth_searching" size={28} />
        </div>

        <div className="cardmed-ble-progress__copy">
          <strong>{headline}</strong>
          <p>{detail}</p>
        </div>

        <ol className="cardmed-ble-progress__steps">
          {STEPS.map((step, index) => {
            const done = index < stepIndex
            const active = index === stepIndex
            return (
              <li
                key={step.id}
                className={`cardmed-ble-progress__step${done ? ' cardmed-ble-progress__step--done' : ''}${active ? ' cardmed-ble-progress__step--active' : ''}`}
              >
                <span className="cardmed-ble-progress__step-icon">
                  <MaterialIcon name={done ? 'check' : step.icon} size={16} />
                </span>
                <span>{step.label}</span>
              </li>
            )
          })}
        </ol>

        <div className="cardmed-ble-progress__track cardmed-ble-progress__track--inline" aria-hidden="true">
          <div className="cardmed-ble-progress__fill" />
        </div>
      </div>
    </div>
  )
}
