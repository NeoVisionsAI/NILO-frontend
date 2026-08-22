import { useCallback, useEffect, useRef, useState } from 'react'
import { CARDMED_BLOCKING_COMMANDS, isBleTimeout, isConnectionLostError } from '../ble/ble-errors'
import { connectGatt, NiloCardmedClient } from '../ble/NiloCardmedClient'
import {
  deviceDisplayLabel,
  getPairedDevice,
  loadPairedDevices,
  pairDevice,
  touchPairedDevice,
  unpairDevice,
  updatePairedDevice,
} from '../ble/device-registry'
import type { CardmedConnectionPhase, CardmedDeviceLocation, CardmedResponse, SavedCardmedDevice } from '../ble/types'
import {
  cardmedErrorMessage,
  requestCardmedBleDevice,
} from '../ble/web-bluetooth'

export function useCardmedConnection() {
  const clientRef = useRef<NiloCardmedClient | null>(null)
  const deviceRef = useRef<BluetoothDevice | null>(null)
  const disconnectHandlerRef = useRef<(() => void) | null>(null)
  const connectedIdRef = useRef<string | null>(null)

  const [phase, setPhase] = useState<CardmedConnectionPhase>('idle')
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null)
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null)
  const [pairedDevices, setPairedDevices] = useState<SavedCardmedDevice[]>(() => loadPairedDevices())
  const [lastError, setLastError] = useState<string | null>(null)
  const [blockingCommand, setBlockingCommand] = useState<string | null>(null)
  const [hasCachedDevice, setHasCachedDevice] = useState(false)

  const refreshPaired = useCallback(() => {
    setPairedDevices(loadPairedDevices())
  }, [])

  const handleInvoluntaryDisconnect = useCallback((message = 'Conexión Bluetooth perdida.') => {
    clientRef.current?.dispose()
    clientRef.current = null
    setBlockingCommand(null)
    setConnectedDeviceId(null)
    connectedIdRef.current = null
    setPhase('disconnected')
    setLastError(message)
    setHasCachedDevice(Boolean(deviceRef.current))
  }, [])

  const detachDisconnectHandler = useCallback((device: BluetoothDevice | null) => {
    if (device && disconnectHandlerRef.current) {
      device.removeEventListener('gattserverdisconnected', disconnectHandlerRef.current)
    }
    disconnectHandlerRef.current = null
  }, [])

  const attachDisconnectHandler = useCallback(
    (device: BluetoothDevice) => {
      detachDisconnectHandler(device)
      const handler = () => handleInvoluntaryDisconnect()
      disconnectHandlerRef.current = handler
      device.addEventListener('gattserverdisconnected', handler)
    },
    [detachDisconnectHandler, handleInvoluntaryDisconnect],
  )

  const disconnect = useCallback(() => {
    detachDisconnectHandler(deviceRef.current)
    clientRef.current?.dispose()
    clientRef.current = null
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect()
    }
    deviceRef.current = null
    connectedIdRef.current = null
    setBlockingCommand(null)
    setDeviceLabel(null)
    setConnectedDeviceId(null)
    setHasCachedDevice(false)
    setLastError(null)
    setPhase('idle')
  }, [detachDisconnectHandler])

  useEffect(() => {
    return () => {
      detachDisconnectHandler(deviceRef.current)
      clientRef.current?.dispose()
      if (deviceRef.current?.gatt?.connected) {
        deviceRef.current.gatt.disconnect()
      }
    }
  }, [detachDisconnectHandler])

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

  const establishSession = useCallback(
    async (device: BluetoothDevice, password: string) => {
      if (clientRef.current) {
        clientRef.current.dispose()
        clientRef.current = null
      }

      const { rx, tx } = await connectGatt(device)
      const client = new NiloCardmedClient(rx, tx)
      client.onUnauthorized = () => handleInvoluntaryDisconnect('Sesión BLE expirada.')

      deviceRef.current = device
      setHasCachedDevice(true)
      attachDisconnectHandler(device)
      clientRef.current = client

      setPhase('authenticating')
      const auth = await client.auth(password)
      const bleName = auth.device_name || device.name || device.id

      const paired = pairDevice({
        id: device.id,
        bleName,
        password,
      })

      refreshPaired()
      connectedIdRef.current = device.id
      setConnectedDeviceId(device.id)
      setDeviceLabel(deviceDisplayLabel(paired))
      setLastError(null)
      setPhase('connected')
      return client
    },
    [attachDisconnectHandler, handleInvoluntaryDisconnect, refreshPaired],
  )

  const connect = useCallback(
    async (device: BluetoothDevice, password: string) => {
      setLastError(null)
      setPhase('connecting')

      try {
        return await establishSession(device, password)
      } catch (err) {
        if (isConnectionLostError(err)) {
          handleInvoluntaryDisconnect(cardmedErrorMessage(err))
        } else {
          setPhase('error')
          const message = cardmedErrorMessage(err)
          setLastError(message)
          setHasCachedDevice(Boolean(deviceRef.current))
        }
        throw new Error(cardmedErrorMessage(err))
      }
    },
    [establishSession, handleInvoluntaryDisconnect],
  )

  const reconnect = useCallback(async (pickedDevice?: BluetoothDevice) => {
    const savedId = connectedIdRef.current
    const saved = savedId ? getPairedDevice(savedId) : undefined

    const device = pickedDevice ?? deviceRef.current
    if (!device) {
      throw new Error('No hay dispositivo en caché. Pulsa Conectar y elige el NiloCardmed en el selector.')
    }

    if (saved && device.id !== saved.id) {
      throw new Error(
        `Seleccionaste «${device.name ?? device.id}», no el emparejado «${saved.bleName}».`,
      )
    }

    if (!saved?.password) {
      throw new Error('Falta la contraseña guardada para reconectar.')
    }

    setLastError(null)
    setPhase('connecting')

    try {
      return await establishSession(device, saved.password)
    } catch (err) {
      if (isConnectionLostError(err)) {
        handleInvoluntaryDisconnect(cardmedErrorMessage(err))
      } else {
        setPhase('disconnected')
        setLastError(cardmedErrorMessage(err))
      }
      throw new Error(cardmedErrorMessage(err))
    }
  }, [establishSession, handleInvoluntaryDisconnect])

  const connectPaired = useCallback(
    async (saved: SavedCardmedDevice, passwordOverride?: string, pickedDevice?: BluetoothDevice) => {
      const password = passwordOverride ?? saved.password
      if (!password) {
        throw new Error('Este dispositivo no tiene contraseña guardada.')
      }

      setLastError(null)

      const cached = deviceRef.current
      if (cached?.id === saved.id && !pickedDevice) {
        setPhase('connecting')
        try {
          await establishSession(cached, password)
          touchPairedDevice(saved.id)
          refreshPaired()
          return
        } catch (err) {
          if (isConnectionLostError(err)) {
            handleInvoluntaryDisconnect(cardmedErrorMessage(err))
          } else {
            setPhase('disconnected')
            setLastError(cardmedErrorMessage(err))
          }
          throw new Error(cardmedErrorMessage(err))
        }
      }

      const device = pickedDevice
      if (!device) {
        throw new Error('PICKER_REQUIRED')
      }

      if (device.id !== saved.id) {
        throw new Error(
          `Seleccionaste «${device.name ?? device.id}», no «${saved.bleName}».`,
        )
      }

      await connect(device, password)
      touchPairedDevice(saved.id)
      refreshPaired()
    },
    [connect, establishSession, handleInvoluntaryDisconnect, refreshPaired],
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
      if (deviceId === connectedDeviceId || deviceRef.current?.id === deviceId) {
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
      timeoutMs?: number,
    ) => {
      if (blockingCommand && blockingCommand !== cmd) {
        throw new Error(`Espera a que termine «${blockingCommand}» antes de enviar «${cmd}».`)
      }

      const blocksUi = CARDMED_BLOCKING_COMMANDS.has(cmd)
      if (blocksUi) setBlockingCommand(cmd)

      const execute = async (): Promise<CardmedResponse<T>> => {
        const client = getClient()
        return client.command<T>(cmd, fields, timeoutMs)
      }

      try {
        let response: CardmedResponse<T>
        try {
          response = await execute()
        } catch (err) {
          const authError =
            typeof err === 'object' &&
            err &&
            'ok' in err &&
            (err as CardmedResponse).ok === false &&
            ((err as CardmedResponse).error === 'privileged_auth_required' ||
              (err as CardmedResponse).error === 'unauthorized')

          if (authError && connectedIdRef.current) {
            const saved = getPairedDevice(connectedIdRef.current)
            if (!saved?.password) throw err
            const client = getClient()
            await client.auth(saved.password)
            response = await execute()
          } else {
            throw err
          }
        }

        return response
      } catch (err) {
        if (isBleTimeout(err)) {
          setLastError(err instanceof Error ? err.message : 'Timeout BLE')
          throw err
        }
        if (isConnectionLostError(err)) {
          handleInvoluntaryDisconnect(
            err instanceof Error ? err.message : 'Conexión Bluetooth perdida.',
          )
        }
        throw err
      } finally {
        if (blocksUi) setBlockingCommand(null)
      }
    },
    [blockingCommand, getClient, handleInvoluntaryDisconnect],
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
    blockingCommand,
    hasCachedDevice,
    scanDevice,
    connect,
    reconnect,
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
