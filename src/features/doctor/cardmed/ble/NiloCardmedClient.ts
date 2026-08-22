import { BleGattQueue } from './BleGattQueue'
import { BleResponseAssembler } from './BleResponseAssembler'
import { CARDMED_RX_UUID, CARDMED_SERVICE_UUID, CARDMED_TIMEOUTS, CARDMED_TX_UUID, timeoutForCommand } from './constants'
import type { CardmedAuthData, CardmedResponse } from './types'

type ResponseHandler = (response: CardmedResponse) => void

interface Waiter {
  resolve: (response: CardmedResponse) => void
  reject: (reason: CardmedResponse | Error) => void
  timer: ReturnType<typeof setTimeout>
  cmd: string
}

function withBleTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`timeout BLE ${label}`))
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export class NiloCardmedClient {
  private assembler = new BleResponseAssembler()
  private waiters = new Map<string, Waiter>()
  private queue = new BleGattQueue()
  /** Serializa petición completa (write + espera respuesta): un comando in-flight. */
  private sendChain: Promise<unknown> = Promise.resolve()
  private onNotify: (event: Event) => void
  private notificationsStarted = false
  token: string | null = null
  deviceName: string | null = null
  onUnhandledResponse?: ResponseHandler
  onUnauthorized?: () => void

  constructor(
    readonly rx: BluetoothRemoteGATTCharacteristic,
    readonly tx: BluetoothRemoteGATTCharacteristic,
  ) {
    this.onNotify = (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic
      const value = target.value
      if (!value) return

      const text = new TextDecoder().decode(value)
      let parsed: unknown
      try {
        parsed = this.assembler.feed(text)
      } catch {
        return
      }
      if (!parsed) return

      const response = parsed as CardmedResponse
      const id = response.id != null ? String(response.id) : null

      if (id && this.waiters.has(id)) {
        const waiter = this.waiters.get(id)!
        clearTimeout(waiter.timer)
        this.waiters.delete(id)
        if (response.ok) waiter.resolve(response)
        else waiter.reject(response)
        return
      }

      this.onUnhandledResponse?.(response)
      if (response.error === 'unauthorized' || response.error === 'privileged_auth_required') {
        this.onUnauthorized?.()
      }
    }

    this.tx.addEventListener('characteristicvaluechanged', this.onNotify)
  }

  async startNotifications(): Promise<void> {
    if (this.notificationsStarted) return
    await this.tx.startNotifications()
    this.notificationsStarted = true
  }

  dispose() {
    this.tx.removeEventListener('characteristicvaluechanged', this.onNotify)
    this.queue.clear()
    this.sendChain = Promise.resolve()
    this.notificationsStarted = false
    for (const waiter of this.waiters.values()) {
      clearTimeout(waiter.timer)
      waiter.reject(new Error('disconnected'))
    }
    this.waiters.clear()
    this.assembler.clear()
    this.token = null
    this.deviceName = null
  }

  send(payload: Record<string, unknown>, timeoutMs: number = CARDMED_TIMEOUTS.default): Promise<CardmedResponse> {
    const id = String(payload.id ?? Date.now())
    const cmd = String(payload.cmd ?? 'unknown')
    const body = { ...payload, id }

    const operation = this.executeSend(id, cmd, body, timeoutMs)
    const chained = this.sendChain.then(() => operation)
    this.sendChain = chained.catch(() => {})
    return chained
  }

  private async executeSend(
    id: string,
    cmd: string,
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<CardmedResponse> {
    this.assembler.setActiveRequestId(id)

    let timer: ReturnType<typeof setTimeout> | undefined

    try {
      const responsePromise = new Promise<CardmedResponse>((resolve, reject) => {
        timer = setTimeout(() => {
          this.waiters.delete(id)
          reject(new Error(`timeout BLE id=${id} cmd=${cmd}`))
        }, timeoutMs)

        this.waiters.set(id, { resolve, reject, timer, cmd })
      })

      try {
        await this.queue.write(this.rx, new TextEncoder().encode(JSON.stringify(body)))
      } catch (err) {
        if (timer) clearTimeout(timer)
        this.waiters.delete(id)
        throw err instanceof Error ? err : new Error(String(err))
      }

      return await responsePromise
    } finally {
      this.assembler.setActiveRequestId(null)
    }
  }

  async auth(password: string): Promise<CardmedAuthData> {
    const resp = await this.send({ cmd: 'auth', password }, CARDMED_TIMEOUTS.auth)
    const data = resp.data as unknown as CardmedAuthData
    this.token = data.token
    this.deviceName = data.device_name
    return data
  }

  async command<T = Record<string, unknown>>(
    cmd: string,
    fields: Record<string, unknown> = {},
    timeoutMs?: number,
  ): Promise<CardmedResponse<T>> {
    if (!this.token) throw new Error('Sin token. Autentica primero.')
    const resolvedTimeout = timeoutMs ?? timeoutForCommand(cmd)
    return this.send({ cmd, token: this.token, ...fields }, resolvedTimeout) as Promise<CardmedResponse<T>>
  }
}

/**
 * Orden obligatorio: connect → service → RX/TX → listener → startNotifications → auth.
 */
export async function connectGatt(device: BluetoothDevice): Promise<{
  server: BluetoothRemoteGATTServer
  rx: BluetoothRemoteGATTCharacteristic
  tx: BluetoothRemoteGATTCharacteristic
  client: NiloCardmedClient
}> {
  const gatt = device.gatt
  if (!gatt) {
    throw new Error('GATT no disponible en el dispositivo seleccionado.')
  }

  const server = await withBleTimeout(gatt.connect(), CARDMED_TIMEOUTS.gattConnect, 'gatt.connect()')
  const service = await server.getPrimaryService(CARDMED_SERVICE_UUID)
  const rx = await service.getCharacteristic(CARDMED_RX_UUID)
  const tx = await service.getCharacteristic(CARDMED_TX_UUID)

  const client = new NiloCardmedClient(rx, tx)
  await client.startNotifications()

  return { server, rx, tx, client }
}
