import { BleGattQueue } from './BleGattQueue'
import { BleResponseAssembler } from './BleResponseAssembler'
import { CARDMED_RX_UUID, CARDMED_SERVICE_UUID, CARDMED_TIMEOUTS, CARDMED_TX_UUID } from './constants'
import type { CardmedAuthData, CardmedResponse } from './types'

type ResponseHandler = (response: CardmedResponse) => void

interface Waiter {
  resolve: (response: CardmedResponse) => void
  reject: (reason: CardmedResponse | Error) => void
  timer: ReturnType<typeof setTimeout>
}

async function writeRaw(rx: BluetoothRemoteGATTCharacteristic, text: string) {
  await rx.writeValue(new TextEncoder().encode(text))
}

export class NiloCardmedClient {
  private assembler = new BleResponseAssembler()
  private waiters = new Map<string, Waiter>()
  private queue = new BleGattQueue()
  private onNotify: (event: Event) => void
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
        else {
          if (response.error === 'unauthorized') this.onUnauthorized?.()
          waiter.reject(response)
        }
        return
      }

      this.onUnhandledResponse?.(response)
    }

    this.tx.addEventListener('characteristicvaluechanged', this.onNotify)
  }

  dispose() {
    this.tx.removeEventListener('characteristicvaluechanged', this.onNotify)
    this.queue.clear()
    for (const waiter of this.waiters.values()) {
      clearTimeout(waiter.timer)
      waiter.reject(new Error('disconnected'))
    }
    this.waiters.clear()
    this.assembler.clear()
    this.token = null
  }

  send(payload: Record<string, unknown>, timeoutMs: number = CARDMED_TIMEOUTS.default): Promise<CardmedResponse> {
    return this.queue.run(async () => {
      const id = String(payload.id ?? Date.now())
      const body = { ...payload, id }

      let timer: ReturnType<typeof setTimeout> | undefined

      const responsePromise = new Promise<CardmedResponse>((resolve, reject) => {
        timer = setTimeout(() => {
          this.waiters.delete(id)
          reject(new Error(`timeout BLE id=${id}`))
        }, timeoutMs)

        this.waiters.set(id, { resolve, reject, timer })
      })

      try {
        await writeRaw(this.rx, JSON.stringify(body))
      } catch (err) {
        if (timer) clearTimeout(timer)
        this.waiters.delete(id)
        throw err instanceof Error ? err : new Error(String(err))
      }

      return responsePromise
    })
  }

  async auth(password: string): Promise<CardmedAuthData> {
    const resp = await this.send({ cmd: 'auth', password })
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
    return this.send({ cmd, token: this.token, ...fields }, timeoutMs) as Promise<CardmedResponse<T>>
  }
}

export async function connectGatt(device: BluetoothDevice) {
  const server = await device.gatt!.connect()
  const service = await server.getPrimaryService(CARDMED_SERVICE_UUID)
  const rx = await service.getCharacteristic(CARDMED_RX_UUID)
  const tx = await service.getCharacteristic(CARDMED_TX_UUID)
  await tx.startNotifications()
  return { server, rx, tx }
}
