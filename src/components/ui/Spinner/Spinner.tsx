import './Spinner.css'

interface SpinnerProps {
  label?: string
  fullscreen?: boolean
}

export function Spinner({ label = 'Cargando…', fullscreen = false }: SpinnerProps) {
  return (
    <div className={fullscreen ? 'nilo-spinner nilo-spinner--full' : 'nilo-spinner'}>
      <span className="nilo-spinner__ring" aria-hidden="true" />
      <span className="u-visually-hidden">{label}</span>
    </div>
  )
}
