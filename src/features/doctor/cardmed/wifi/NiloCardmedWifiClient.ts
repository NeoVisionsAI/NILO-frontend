import type { CardmedAuthData, CardmedResponse } from '../ble/types'
import { CARDMED_WIFI_API_BASE, CARDMED_WIFI_TIMEOUTS, timeoutForWifiCommand } from './constants'
import type { CardmedDashboard } from './types'

export interface CardmedWifiStatus {
  status: 'ok'
  device: string
  device_name?: string
  version?: string
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } finally {
    window.clearTimeout(timer)
  }
}

export async function checkCardmedWifiStatus(
  baseUrl = CARDMED_WIFI_API_BASE,
  timeoutMs = CARDMED_WIFI_TIMEOUTS.status,
): Promise<CardmedWifiStatus | null> {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/status`, { method: 'GET' }, timeoutMs)
    if (!res.ok) return null
    const data = (await res.json()) as CardmedWifiStatus
    return data.status === 'ok' ? data : null
  } catch {
    return null
  }
}

export class NiloCardmedWifiClient {
  private token: string | null = null

  constructor(readonly baseUrl: string = CARDMED_WIFI_API_BASE) {}

  getToken(): string | null {
    return this.token
  }

  setToken(token: string | null) {
    this.token = token
  }

  async command<T = Record<string, unknown>>(
    cmd: string,
    fields: Record<string, unknown> = {},
    timeoutMs?: number,
  ): Promise<CardmedResponse<T>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.token) headers.Authorization = `Bearer ${this.token}`

    const resolvedTimeout = timeoutMs ?? timeoutForWifiCommand(cmd)
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/command`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cmd,
          id: String(Date.now()),
          payload: fields,
        }),
      },
      resolvedTimeout,
    )

    let data: CardmedResponse<T>
    try {
      data = (await res.json()) as CardmedResponse<T>
    } catch {
      throw new Error(`Respuesta inválida del dispositivo (${res.status}).`)
    }

    if (!res.ok || data.ok === false) {
      throw new Error(data.error ?? `Comando «${cmd}» falló (${res.status}).`)
    }

    return data
  }

  async auth(password: string): Promise<CardmedAuthData> {
    const resp = await this.command<CardmedAuthData>('auth', { password }, CARDMED_WIFI_TIMEOUTS.auth)
    const authData = resp.data
    if (!authData?.token) throw new Error('Auth sin token en la respuesta.')
    this.token = authData.token
    return authData
  }

  async fetchDashboard(timeoutMs = CARDMED_WIFI_TIMEOUTS.status): Promise<CardmedDashboard> {
    const res = await fetchWithTimeout(`${this.baseUrl}/api/dashboard`, { method: 'GET' }, timeoutMs)
    if (!res.ok) throw new Error(`No se pudo cargar el panel de estado (${res.status}).`)
    return (await res.json()) as CardmedDashboard
  }
}
