import type { CameraDevice } from '../ble/types'

export interface CardmedDashboardWifi {
  connected?: boolean
  ssid?: string
  ip_address?: string
  signal?: number
  connectivity_ok?: boolean
}

export interface CardmedDashboardPower {
  power_source?: 'mains' | 'usb' | 'powerbank' | 'unknown' | string
  source_label?: string
  display_percent?: number
  on_battery?: boolean
}

export interface CardmedDashboardSampling {
  enabled?: boolean
  interval_seconds?: number
  window_active?: boolean
  window_reason?: string
}

export interface CardmedDashboardCamera {
  connected?: boolean
  saved_device?: string
  saved_device_present?: boolean
  cameras_count?: number
  cameras?: CameraDevice[]
}

export interface CardmedDashboardCaptures {
  cycles_successful?: number
  cycles_recorded?: number
  images_on_disk?: number
  last_capture_success_at?: string
}

export interface CardmedDashboardCardmed {
  enabled?: boolean
  site_id?: string
  configured?: boolean
}

export interface CardmedDashboard {
  device_name?: string
  version?: string
  wifi?: CardmedDashboardWifi
  power?: CardmedDashboardPower
  sampling?: CardmedDashboardSampling
  camera?: CardmedDashboardCamera
  captures?: CardmedDashboardCaptures
  cardmed?: CardmedDashboardCardmed
  config_last_saved_at?: string
  refreshed_at?: string
}

export interface CardmedCaptureBase64Data {
  image_base64?: string
  capture_id?: string
  device?: string
  device_path?: string
  size_bytes?: number
  width?: number
  height?: number
  backend?: string
  sha256?: string
  mode?: string
}

export interface CameraCaptureMeta {
  device?: string
  sizeBytes?: number
  width?: number
  height?: number
  backend?: string
  sha256?: string
  mode?: string
}

export interface CardmedTestStep {
  name?: string
  ok?: boolean
  message?: string
  [key: string]: unknown
}

export interface CardmedTestData {
  steps?: CardmedTestStep[]
  [key: string]: unknown
}
