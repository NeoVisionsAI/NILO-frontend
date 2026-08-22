import type { CardmedDashboardPower } from '../../wifi/types'

export function formatDashboardPower(power?: CardmedDashboardPower): { label: string; percent: string } {
  if (!power) return { label: 'Sin datos', percent: '—' }

  switch (power.power_source) {
    case 'mains':
      return { label: 'Corriente', percent: '100 %' }
    case 'usb':
      return { label: 'USB / alimentación externa', percent: '100 %' }
    case 'powerbank':
      return {
        label: 'Powerbank / batería',
        percent: power.display_percent != null ? `${power.display_percent} %` : '—',
      }
    default:
      return {
        label: power.source_label ?? 'Alimentación desconocida',
        percent: power.display_percent != null ? `${power.display_percent} %` : '—',
      }
  }
}

export function formatIsoDate(value?: string): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('es-ES')
  } catch {
    return value
  }
}
