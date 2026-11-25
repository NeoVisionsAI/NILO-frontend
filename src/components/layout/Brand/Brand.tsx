import { NILO_LOGO_ALT, niloLogoUrl } from '@/assets/brand/logo'
import './Brand.css'

interface BrandProps {
  compact?: boolean
}

/** Logotipo de NILO reutilizable. */
export function Brand({ compact = false }: BrandProps) {
  return (
    <div className="nilo-brand">
      <img
        src={niloLogoUrl}
        alt={compact ? '' : NILO_LOGO_ALT}
        className="nilo-brand__logo"
        width={32}
        height={32}
        decoding="async"
      />
      {!compact && <span className="nilo-brand__name">NILO</span>}
    </div>
  )
}