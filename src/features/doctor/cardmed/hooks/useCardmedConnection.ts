import { useCallback, useEffect, useRef, useState } from 'react'
import { connectGatt, NiloCardmedClient } from '../ble/NiloCardmedClient'
import { CARDMED_TIMEOUTS } from '../ble/constants'
import type { CardmedConnectionPhase, SavedCardmedDevice } from '../ble/types'
import {
  cardmedErrorMessage,
  loadSavedDevices,
  requestCardmedBleDevice,
  requestDeviceByName,
  saveDeviceEntry,
} from '../ble/web-bluetooth'

export function useCardmedConnection() {
  const clientRef = useRef<NiloCardmedClient | null>(null)
  const deviceRef = useRef<BluetoothDevice | null>(null)
  const [phase, setPhase] = useState<CardmedConnectionPhase>('idle')
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null)
  const [savedDevices, setSavedDevices] = useState<SavedCardmedDevice[]>(() => loadSavedDevices())
  const [lastError, setLastError] = useState<string | null>(null)

  const refreshSaved = useCallback(() => {
    setSavedDevices(loadSavedDevices())
  }, [])

  const disconnect = useCallback(() => {
    clientRef.current?.dispose()
    clientRef.current = null
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect()
    }
    deviceRef.current = null
    setDeviceLabel(null)
    setPhase('idle')
  }, [])

  useEffect(() => {
    return () => {
      clientRef.current?.dispose()
      if (deviceRef.current?.gatt?.connected) {
        deviceRef.current.gatt.disconnect()
      }
    }
  }, [])

  const scanDevice = useCallback(async () => {
    setLastError(null)
    try {
      const device = await requestCardmedBleDevice()
      saveDeviceEntry({
        id: device.id,
        name: device.name ?? device.id,
        lastConnected: new Date().toISOString(),
      })
      refreshSaved()
      return device
    } catch (err) {
      const message = cardmedErrorMessage(err)
      setLastError(message)
      throw new Error(message)
    }
  }, [refreshSaved])

  const connect = useCallback(
    async (device: BluetoothDevice, password: string) => {
      setLastError(null)
      setPhase('connecting')

      try {
        if (clientRef.current) {
          clientRef.current.dispose()
          clientRef.current = null
        }

        const { rx, tx } = await connectGatt(device)
        const client = new NiloCardmedClient(rx, tx)
        client.onUnauthorized = () => setPhase('disconnected')

        deviceRef.current = device
        clientRef.current = client

        device.addEventListener('gattserverdisconnected', () => {
          setPhase('disconnected')
          setDeviceLabel(null)
        })

        setPhase('authenticating')
        const auth = await client.auth(password)
        saveDeviceEntry({
          id: device.id,
          name: auth.device_name || device.name || device.id,
          lastConnected: new Date().toISOString(),
        })
        refreshSaved()
        setDeviceLabel(auth.device_name || device.name || 'NiloCardmed')
        setPhase('connected')
        return client
      } catch (err) {
        setPhase('error')
        const message = cardmedErrorMessage(err)
        setLastError(message)
        throw new Error(message)
      }
    },
    [refreshSaved],
  )

  const connectBySavedName = useCallback(
    async (saved: SavedCardmedDevice, password: string) => {
      const device = await requestDeviceByName(saved.name)
      return connect(device, password)
    },
    [connect],
  )

  const getClient = useCallback(() => {
    const client = clientRef.current
    if (!client || phase !== 'connected') {
      throw new Error('No hay dispositivo conectado.')
    }
    return client
  }, [phase])

  const runCommand = useCallback(
    async <T = Record<string, unknown>>(
      cmd: string,
      fields: Record<string, unknown> = {},
      timeoutMs: number = CARDMED_TIMEOUTS.default,
    ) => {
      const client = getClient()
      const response = await client.command<T>(cmd, fields, timeoutMs)

      if (response.error === 'unauthorized' || response.error === 'privileged_auth_required') {
        throw new Error(response.error)
      }

      return response
    },
    [getClient],
  )

  const reauth = useCallback(async (password: string) => {
    const client = getClient()
    await client.auth(password)
  }, [getClient])

  return {
    phase,
    deviceLabel,
    savedDevices,
    lastError,
    scanDevice,
    connect,
    connectBySavedName,
    disconnect,
    runCommand,
    reauth,
    refreshSaved,
    getClient,
  }
}
