export type ProvisioningMode = 'wifi' | 'bluetooth'

/** Producción: WiFi AP. Cambiar a 'bluetooth' solo para rescate legacy. */
export const PROVISIONING_MODE: ProvisioningMode =
  (import.meta.env.VITE_CARDMED_PROVISIONING_MODE as ProvisioningMode | undefined) ?? 'wifi'

export function isWifiProvisioning(): boolean {
  return PROVISIONING_MODE === 'wifi'
}

export function isBluetoothProvisioning(): boolean {
  return PROVISIONING_MODE === 'bluetooth'
}
