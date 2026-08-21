import { useCallback, useEffect, useRef, useState } from 'react'
import { connectGatt, NiloCardmedClient } from '../ble/NiloCardmedClient'
import { CARDMED_TIMEOUTS } from '../ble/constants'
import {
  deviceDisplayLabel,
  getPairedDevice,
  loadPairedDevices,
  pairDevice,
  touchPairedDevice,
  unpairDevice,
  updatePairedDevice,
} from '../ble/device-registry'
import type { CardmedConnectionPhase, CardmedDeviceLocation, SavedCardmedDevice } from '../ble/types'
import {
  cardmedErrorMessage,
  requestCardmedBleDevice,
  requestDeviceByBleName,
} from '../ble/web-bluetooth'

export function useCardmedConnection() {
  const clientRef = useRef<NiloCardmedClient | null>(null)
  const deviceRef = useRef<BluetoothDevice | null>(null)
  const [phase, setPhase] = useState<CardmedConnectionPhase>('idle')
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null)
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null)
  const [pairedDevices, setPairedDevices] = useState<SavedCardmedDevice[]>(() => loadPairedDevices())
  const [lastError, setLastError] = useState<string | null>(null)

  const refreshPaired = useCallback(() => {
    setPairedDevices(loadPairedDevices())
  }, [])

  const disconnect = useCallback(() => {
    clientRef.current?.dispose()
    clientRef.current = null
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect()
    }
    deviceRef.current = null
    setDeviceLabel(null)
    setConnectedDeviceId(null)
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
      return await requestCardmedBleDevice()
    } catch (err) {
      const message = cardmedErrorMessage(err)
      setLastError(message)
      throw new Error(message)
    }
  }, [])

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
          setConnectedDeviceId(null)
        })

        setPhase('authenticating')
        const auth = await client.auth(password)
        const bleName = auth.device_name || device.name || device.id

        const paired = pairDevice({
          id: device.id,
          bleName,
          password,
        })

        refreshPaired()
        setConnectedDeviceId(device.id)
        setDeviceLabel(deviceDisplayLabel(paired))
        setPhase('connected')
        return client
      } catch (err) {
        setPhase('error')
        const message = cardmedErrorMessage(err)
        setLastError(message)
        throw new Error(message)
      }
    },
    [refreshPaired],
  )

  const connectPaired = useCallback(
    async (saved: SavedCardmedDevice, passwordOverride?: string) => {
      const password = passwordOverride ?? saved.password
      if (!password) {
        throw new Error('Este dispositivo no tiene contraseña guardada.')
      }

      const device = await requestDeviceByBleName(saved.bleName)
      await connect(device, password)
      touchPairedDevice(saved.id)
      refreshPaired()
    },
    [connect, refreshPaired],
  )

  const saveDeviceMetadata = useCallback(
    (deviceId: string, patch: { displayName?: string; location?: CardmedDeviceLocation }) => {
      const updated = updatePairedDevice(deviceId, patch)
      refreshPaired()
      if (updated && deviceId === connectedDeviceId) {
        setDeviceLabel(deviceDisplayLabel(updated))
      }
      return updated
    },
    [connectedDeviceId, refreshPaired],
  )

  const removePairing = useCallback(
    (deviceId: string) => {
      unpairDevice(deviceId)
      refreshPaired()
      if (deviceId === connectedDeviceId) {
        disconnect()
      }
    },
    [connectedDeviceId, disconnect, refreshPaired],
  )

  const getConnectedPaired = useCallback((): SavedCardmedDevice | undefined => {
    if (!connectedDeviceId) return undefined
    return getPairedDevice(connectedDeviceId)
  }, [connectedDeviceId])

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
    connectedDeviceId,
    pairedDevices,
    lastError,
    scanDevice,
    connect,
    connectPaired,
    disconnect,
    runCommand,
    reauth,
    refreshPaired,
    saveDeviceMetadata,
    removePairing,
    getConnectedPaired,
    getClient,
    /** @deprecated Usar refreshPaired */
    refreshSaved: refreshPaired,
    /** @deprecated Usar pairedDevices */
    savedDevices: pairedDevices,
    /** @deprecated Usar connectPaired */
    connectBySavedName: connectPaired,
  }
}
