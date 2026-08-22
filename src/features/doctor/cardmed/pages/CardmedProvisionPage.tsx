import { isWifiProvisioning } from '../config/provisioning'
import { CardmedDevicePage } from './CardmedDevicePage'
import { CardmedWifiProvisionPage } from './CardmedWifiProvisionPage'

/** Punto de entrada: WiFi AP (prod) o Web Bluetooth (legacy, oculto). */
export function CardmedProvisionPage() {
  if (isWifiProvisioning()) {
    return <CardmedWifiProvisionPage />
  }
  return <CardmedDevicePage />
}
