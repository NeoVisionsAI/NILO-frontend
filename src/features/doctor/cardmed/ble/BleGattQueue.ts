/** Serializa operaciones GATT: un solo writeValue a la vez (Web Bluetooth en Android). */
export class BleGattQueue {
  private chain: Promise<unknown> = Promise.resolve()

  write(rx: BluetoothRemoteGATTCharacteristic, bytes: BufferSource): Promise<void> {
    const next = this.chain.then(() => rx.writeValue(bytes))
    this.chain = next.catch(() => {})
    return next
  }

  clear() {
    this.chain = Promise.resolve()
  }
}
