/** Serializa operaciones GATT: un solo writeValue a la vez (Web Bluetooth en Android). */
export class BleGattQueue {
  private chain: Promise<unknown> = Promise.resolve()

  run<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn)
    this.chain = run.catch(() => {})
    return run
  }

  clear() {
    this.chain = Promise.resolve()
  }
}
