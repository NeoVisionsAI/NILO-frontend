import type {
  CardmedDashboard,
  CardmedDashboardCamera,
  CardmedDashboardCaptures,
  CardmedDashboardPower,
  CardmedDashboardSampling,
  CardmedDashboardWifi,
} from '../../wifi/types'

export const DASHBOARD_NA = '—'

export interface DashboardWifiView {
  active: string
  ssid: string
  ip: string
  signal: string
  internet: string
}

export interface DashboardPowerView {
  label: string
  percent: string
}

export interface DashboardSamplingView {
  interval: string
  state: string
}

export interface DashboardCameraView {
  connected: string
  count: string
  savedDevice: string
  savedPresent: string
}

export interface DashboardCapturesView {
  cyclesOk: string
  imagesOnDisk: string
}

export interface DashboardStatusView {
  wifi: DashboardWifiView
  power: DashboardPowerView
  sampling: DashboardSamplingView
  camera: DashboardCameraView
  lastConfig: string
  captures: DashboardCapturesView
  refreshedAt: string | null
}

function na(value: string | number | null | undefined, formatter?: (v: string | number) => string): string {
  if (value === null || value === undefined || value === '') return DASHBOARD_NA
  return formatter ? formatter(value) : String(value)
}

export function formatDashboardPower(power?: CardmedDashboardPower): DashboardPowerView {
  if (!power) return { label: DASHBOARD_NA, percent: DASHBOARD_NA }

  switch (power.power_source) {
    case 'mains':
      return { label: 'Corriente', percent: '100 %' }
    case 'usb':
      return { label: 'USB / alimentación externa', percent: '100 %' }
    case 'powerbank':
      return {
        label: 'Powerbank / batería',
        percent: power.display_percent != null ? `${power.display_percent} %` : DASHBOARD_NA,
      }
    default:
      return {
        label: power.source_label ?? DASHBOARD_NA,
        percent: power.display_percent != null ? `${power.display_percent} %` : DASHBOARD_NA,
      }
  }
}

function buildWifiView(wifi?: CardmedDashboardWifi, hasData = false): DashboardWifiView {
  if (!hasData) {
    return {
      active: DASHBOARD_NA,
      ssid: DASHBOARD_NA,
      ip: DASHBOARD_NA,
      signal: DASHBOARD_NA,
      internet: DASHBOARD_NA,
    }
  }

  if (!wifi?.connected) {
    return {
      active: 'No',
      ssid: DASHBOARD_NA,
      ip: DASHBOARD_NA,
      signal: DASHBOARD_NA,
      internet: DASHBOARD_NA,
    }
  }

  return {
    active: 'Sí',
    ssid: na(wifi.ssid),
    ip: na(wifi.ip_address),
    signal: wifi.signal != null ? `${wifi.signal} dBm` : DASHBOARD_NA,
    internet:
      wifi.connectivity_ok === true ? 'Sí' : wifi.connectivity_ok === false ? 'No' : DASHBOARD_NA,
  }
}

function buildSamplingView(sampling?: CardmedDashboardSampling, hasData = false): DashboardSamplingView {
  if (!hasData) {
    return { interval: DASHBOARD_NA, state: DASHBOARD_NA }
  }

  return {
    interval:
      sampling?.interval_seconds != null ? `${sampling.interval_seconds} s` : DASHBOARD_NA,
    state:
      sampling?.enabled === true ? 'Activo' : sampling?.enabled === false ? 'Inactivo' : DASHBOARD_NA,
  }
}

function buildCameraView(camera?: CardmedDashboardCamera, hasData = false): DashboardCameraView {
  if (!hasData) {
    return {
      connected: DASHBOARD_NA,
      count: DASHBOARD_NA,
      savedDevice: DASHBOARD_NA,
      savedPresent: DASHBOARD_NA,
    }
  }

  return {
    connected: camera?.connected === true ? 'Sí' : camera?.connected === false ? 'No' : DASHBOARD_NA,
    count: camera?.cameras_count != null ? String(camera.cameras_count) : DASHBOARD_NA,
    savedDevice: na(camera?.saved_device),
    savedPresent:
      camera?.saved_device_present === true
        ? 'Sí'
        : camera?.saved_device_present === false
          ? 'No'
          : DASHBOARD_NA,
  }
}

function buildCapturesView(captures?: CardmedDashboardCaptures, hasData = false): DashboardCapturesView {
  if (!hasData) {
    return { cyclesOk: DASHBOARD_NA, imagesOnDisk: DASHBOARD_NA }
  }

  return {
    cyclesOk: captures?.cycles_successful != null ? String(captures.cycles_successful) : DASHBOARD_NA,
    imagesOnDisk: captures?.images_on_disk != null ? String(captures.images_on_disk) : DASHBOARD_NA,
  }
}

export function formatIsoDate(value?: string): string {
  if (!value) return DASHBOARD_NA
  try {
    return new Date(value).toLocaleString('es-ES')
  } catch {
    return value
  }
}

export function buildDashboardStatusView(dashboard: CardmedDashboard | null): DashboardStatusView {
  const hasData = dashboard != null

  return {
    wifi: buildWifiView(dashboard?.wifi, hasData),
    power: formatDashboardPower(dashboard?.power),
    sampling: buildSamplingView(dashboard?.sampling, hasData),
    camera: buildCameraView(dashboard?.camera, hasData),
    lastConfig: hasData ? formatIsoDate(dashboard?.config_last_saved_at) : DASHBOARD_NA,
    captures: buildCapturesView(dashboard?.captures, hasData),
    refreshedAt: dashboard?.refreshed_at ?? null,
  }
}
