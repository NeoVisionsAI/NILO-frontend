import { useCallback, useRef, useState } from 'react'
import { CARDMED_BLOCKING_COMMANDS } from '../ble/ble-errors'
import type { CardmedResponse } from '../ble/types'
import {
  checkCardmedWifiStatus,
  NiloCardmedWifiClient,
  type CardmedWifiStatus,
} from '../wifi/NiloCardmedWifiClient'
import type { CardmedDashboard } from '../wifi/types'
import { cardmedWifiErrorMessage } from '../wifi/wifi-errors'

export type CardmedWifiPhase =
  | 'idle'
  | 'checking'
  | 'connected'
  | 'unreachable'
  | 'authenticating'
  | 'authenticated'
  | 'error'

export function useCardmedWifiConnection() {
  const clientRef = useRef<NiloCardmedWifiClient>(new NiloCardmedWifiClient())

  const [phase, setPhase] = useState<CardmedWifiPhase>('idle')
  const [deviceStatus, setDeviceStatus] = useState<CardmedWifiStatus | null>(null)
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [blockingCommand, setBlockingCommand] = useState<string | null>(null)

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setPhase('checking')
    setLastError(null)

    try {
      const status = await checkCardmedWifiStatus()
      if (!status) {
        setDeviceStatus(null)
        setPhase('unreachable')
        setLastError(
          'No se detectó el Nilocardmed. Conecta la tablet a la WiFi «Nilocardmed-Config-xxxx» (xxxx = últimos 4 hex de la MAC) y vuelve a comprobar.',
        )
        return false
      }

      setDeviceStatus(status)
      setDeviceLabel(status.device_name ?? status.device ?? 'Nilocardmed')
      setPhase('connected')
      return true
    } catch (err) {
      const message = cardmedWifiErrorMessage(err)
      setDeviceStatus(null)
      setPhase('unreachable')
      setLastError(message)
      return false
    }
  }, [])

  const authenticate = useCallback(async (password: string) => {
    setLastError(null)
    setPhase('authenticating')

    try {
      const auth = await clientRef.current.auth(password.trim())
      setDeviceLabel(auth.device_name ?? deviceStatus?.device_name ?? 'Nilocardmed')
      setPhase('authenticated')
      return auth
    } catch (err) {
      const message = cardmedWifiErrorMessage(err)
      setPhase('connected')
      setLastError(message)
      throw new Error(message)
    }
  }, [deviceStatus?.device_name])

  const runCommand = useCallback(
    async <T = Record<string, unknown>>(
      cmd: string,
      fields: Record<string, unknown> = {},
      timeoutMs?: number,
    ): Promise<CardmedResponse<T>> => {
      if (!clientRef.current.getToken()) {
        throw new Error('Sin sesión. Autentica primero con la contraseña del dispositivo.')
      }

      if (blockingCommand && blockingCommand !== cmd) {
        throw new Error(`Espera a que termine «${blockingCommand}» antes de enviar «${cmd}».`)
      }

      const blocksUi = CARDMED_BLOCKING_COMMANDS.has(cmd)
      if (blocksUi) setBlockingCommand(cmd)

      try {
        let response = await clientRef.current.command<T>(cmd, fields, timeoutMs)

        if (
          response.ok === false &&
          (response.error === 'unauthorized' || response.error === 'privileged_auth_required')
        ) {
          throw new Error(response.error)
        }

        return response
      } catch (err) {
        const message = cardmedWifiErrorMessage(err)
        setLastError(message)
        throw err instanceof Error ? err : new Error(message)
      } finally {
        if (blocksUi) setBlockingCommand(null)
      }
    },
    [blockingCommand],
  )

  const disconnect = useCallback(() => {
    clientRef.current.setToken(null)
    setDeviceStatus(null)
    setDeviceLabel(null)
    setLastError(null)
    setBlockingCommand(null)
    setPhase('idle')
  }, [])

  const resetUnreachable = useCallback(() => {
    setLastError(null)
    setPhase('idle')
  }, [])

  const fetchDashboard = useCallback(async (): Promise<CardmedDashboard> => {
    try {
      return await clientRef.current.fetchDashboard()
    } catch (err) {
      const message = cardmedWifiErrorMessage(err)
      setLastError(message)
      throw new Error(message)
    }
  }, [])

  const clearError = useCallback(() => setLastError(null), [])

  return {
    phase,
    deviceStatus,
    deviceLabel,
    lastError,
    blockingCommand,
    checkConnection,
    authenticate,
    runCommand,
    fetchDashboard,
    disconnect,
    resetUnreachable,
    clearError,
    isAuthenticated: phase === 'authenticated',
    isReachable: phase === 'connected' || phase === 'authenticating' || phase === 'authenticated',
  }
}
