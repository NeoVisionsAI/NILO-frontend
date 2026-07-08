import './Brand.css'

interface BrandProps {
  compact?: boolean
}

/** Logotipo de NILO reutilizable. */
export function Brand({ compact = false }: BrandProps) {
  return (
    <div className="nilo-brand">
      <span className="nilo-brand__mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="28" height="28">
          <rect width="64" height="64" rx="14" fill="currentColor" />
          <path
            d="M10 34 h10 l4 -12 l7 24 l6 -18 l4 6 h13"
            fill="none"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact && <span className="nilo-brand__name">NILO</span>}
    </div>
  )
}
