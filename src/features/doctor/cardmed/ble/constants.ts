export const CARDMED_SERVICE_UUID = '6e400010-b5a3-f393-e0a9-e50e24dcca9e'
export const CARDMED_RX_UUID = '6e400011-b5a3-f393-e0a9-e50e24dcca9e'
export const CARDMED_TX_UUID = '6e400012-b5a3-f393-e0a9-e50e24dcca9e'

export const CARDMED_STORAGE_KEY = 'nilo.cardmed.saved-devices'

export const CARDMED_TIMEOUTS = {
  default: 30_000,
  wifiScan: 60_000,
  wifiConnect: 60_000,
  imageDownload: 120_000,
} as const satisfies Record<string, number>
