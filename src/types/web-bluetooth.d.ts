/* Web Bluetooth API (Chrome / Edge Android) */

interface Bluetooth extends EventTarget {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>
  requestLEScan?(options?: BluetoothLEScanOptions): Promise<BluetoothLEScan>
  getAvailability?(): Promise<boolean>
  addEventListener(
    type: 'advertisementreceived',
    listener: (this: Bluetooth, ev: BluetoothAdvertisingEvent) => void,
  ): void
  removeEventListener(
    type: 'advertisementreceived',
    listener: (this: Bluetooth, ev: BluetoothAdvertisingEvent) => void,
  ): void
}

interface Navigator {
  bluetooth?: Bluetooth
}

interface RequestDeviceOptions {
  filters?: BluetoothLEScanFilter[]
  optionalServices?: BluetoothServiceUUID[]
  acceptAllDevices?: boolean
}

interface BluetoothLEScanFilter {
  services?: BluetoothServiceUUID[]
  name?: string
  namePrefix?: string
}

interface BluetoothLEScanOptions {
  filters?: BluetoothLEScanFilter[]
  keepRepeatedDevices?: boolean
  acceptAllAdvertisements?: boolean
}

interface BluetoothLEScan {
  readonly active: boolean
  stop(): void
}

interface BluetoothAdvertisingEvent extends Event {
  readonly device: BluetoothDevice
  readonly name?: string
  readonly rssi?: number
  readonly uuids?: BluetoothServiceUUID[]
}

type BluetoothServiceUUID = number | string

interface BluetoothDevice extends EventTarget {
  readonly id: string
  readonly name?: string
  readonly gatt?: BluetoothRemoteGATTServer
}

interface BluetoothRemoteGATTServer {
  readonly device: BluetoothDevice
  readonly connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: BluetoothServiceUUID): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly value?: DataView
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  writeValue(value: BufferSource): Promise<void>
}

interface CharacteristicEventMap {
  characteristicvaluechanged: Event
}

interface BluetoothRemoteGATTCharacteristic {
  addEventListener(
    type: 'characteristicvaluechanged',
    listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => void,
  ): void
  removeEventListener(
    type: 'characteristicvaluechanged',
    listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => void,
  ): void
}

interface BluetoothDevice {
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void
}
